import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { DEMO_CODE, DEMO_PASSWORD, seedSql } from "@/lib/demo/seed";

// Public demo only: a real Postgres (PGlite, in the server's memory) with the production schema,
// the real migrations and RLS, behind a small imitation of Supabase's HTTP API (auth + the part of
// PostgREST this app uses). Data is made up and resets when the server restarts.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
export const DEMO_SERVICE_KEY = "demo-service-key";

type Store = { getMetadata: (k: string) => Promise<any>; get: (k: string, o: { type: "blob" }) => Promise<Blob | null>; set: (k: string, v: Blob, o: { metadata: Record<string, unknown> }) => Promise<unknown> };
type State = { db: PGlite; version: number };
const g = globalThis as unknown as { __demo?: State; __demoLock?: Promise<unknown>; __demoStore?: Store | null };

async function boot(): Promise<PGlite> {
  // The SQL files are listed in next.config (outputFileTracingIncludes), so don't trace the project.
  const root = /* turbopackIgnore: true */ process.cwd();
  const sql = (p: string) => readFileSync(join(/* turbopackIgnore: true */ root, p), "utf8");
  const db = new PGlite();
  await db.exec(sql("supabase/tests/auth_stub.sql"));
  await db.exec(sql("supabase/tests/base_schema.sql"));
  await db.exec(sql("supabase/seed_quran_surahs.sql"));
  for (const f of readdirSync(join(/* turbopackIgnore: true */ root, "supabase/migrations")).filter((f) => f >= "20261101").sort()) {
    await db.exec(sql(`supabase/migrations/${f}`));
  }
  await db.exec(seedSql());
  await db.exec(`create table if not exists auth.demo_passwords (user_id uuid primary key references auth.users(id) on delete cascade, password text not null)`);
  return db;
}
// On Netlify the site runs on several server instances at once, each with its own memory. So the
// database is snapshotted to Netlify Blobs after every change, and an instance that is behind
// loads the latest snapshot before answering. Locally (no Blobs) it simply stays in memory.
// Bump SNAPSHOT to start the demo over (e.g. after a schema change).
const SNAPSHOT = "db-2026-11-01-v3";

async function blobStore(): Promise<Store | null> {
  if (g.__demoStore !== undefined) return g.__demoStore;
  try {
    const { getStore } = await import("@netlify/blobs");
    g.__demoStore = getStore({ name: "madaya-demo", consistency: "strong" }) as unknown as Store;
    await g.__demoStore.getMetadata(SNAPSHOT);
  } catch {
    g.__demoStore = null;
  }
  return g.__demoStore;
}

/** The up-to-date database (call inside the lock). */
async function current(): Promise<PGlite> {
  const store = await blobStore();
  let remote = 0;
  if (store) remote = Number((await store.getMetadata(SNAPSHOT).catch(() => null))?.metadata?.version ?? 0);
  const st = g.__demo;
  if (st && st.version >= remote) return st.db;
  if (store && remote > 0) {
    const blob = await store.get(SNAPSHOT, { type: "blob" }).catch(() => null);
    if (blob) {
      const db = new PGlite({ loadDataDir: blob });
      await db.waitReady;
      st?.db.close().catch(() => {});
      g.__demo = { db, version: remote };
      return db;
    }
  }
  if (!st) g.__demo = { db: await boot(), version: 0 };
  return g.__demo!.db;
}

async function persist() {
  const store = await blobStore();
  const st = g.__demo;
  if (!store || !st) return;
  const remote = Number((await store.getMetadata(SNAPSHOT).catch(() => null))?.metadata?.version ?? 0);
  const dump = await st.db.dumpDataDir("gzip");
  st.version = Math.max(st.version, remote) + 1;
  await store.set(SNAPSHOT, dump, { metadata: { version: st.version } });
}

/** One request at a time: PGlite is a single connection and each request sets its own role. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__demoLock ?? Promise.resolve()).then(fn, fn);
  g.__demoLock = run.catch(() => {});
  return run;
}

let active: PGlite;
const database = async () => active;

type Who = { role: "anon" | "authenticated" | "service_role"; sub?: string; email?: string };

async function asRole<T>(who: Who, fn: (db: PGlite) => Promise<T>): Promise<T> {
  const db = active;
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [who.sub ? JSON.stringify({ sub: who.sub, role: who.role, email: who.email }) : ""]);
    await db.exec(`set local role ${who.role}`);
    const out = await fn(db);
    await db.exec("commit");
    return out;
  } catch (e) {
    await db.exec("rollback").catch(() => {});
    throw e;
  }
}

// ------------------------------------------------------------------ helpers
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
  "access-control-expose-headers": "*",
};
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  if (status === 204) return new Response(null, { status, headers: { ...CORS, ...extra } });
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS, ...extra } });
}
function pgError(e: any) {
  const code = e?.code || "XX000";
  const status = code === "42501" ? 403 : code === "23505" ? 409 : code === "P0001" || code.startsWith("22") || code.startsWith("23") ? 400 : 400;
  return json({ code, message: e?.message || String(e), details: e?.detail ?? null, hint: e?.hint ?? null }, status);
}
const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: "42602" });
  return `"${s}"`;
};

function who(req: Request): Who {
  const apikey = req.headers.get("apikey") || "";
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (apikey === DEMO_SERVICE_KEY || tok === DEMO_SERVICE_KEY) return { role: "service_role" };
  try {
    const p = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
    if (p.sub && p.exp * 1000 > Date.now()) return { role: "authenticated", sub: p.sub, email: p.email };
  } catch {}
  return { role: "anon" };
}

async function userRow(id: string) {
  const db = await database();
  const r = await (db.query<any>(`select id, email, raw_user_meta_data, email_confirmed_at, banned_until from auth.users where id = $1`, [id]));
  return r.rows[0] ?? null;
}
async function userByEmail(email: string) {
  const db = await database();
  const r = await (db.query<any>(`select id from auth.users where lower(email) = lower($1)`, [email.trim()]));
  return r.rows[0]?.id as string | undefined;
}
async function createUser(email: string, meta: Json = {}, password?: string) {
  const db = await database();
  const id = crypto.randomUUID();
  await (async () => {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, lower($2), $3)`, [id, email.trim(), JSON.stringify(meta || {})]);
    if (password) await db.query(`insert into auth.demo_passwords values ($1, $2)`, [id, password]);
  })();
  return id;
}
function authUser(u: any) {
  return {
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.email_confirmed_at,
    user_metadata: u.raw_user_meta_data ?? {}, app_metadata: { provider: "email" }, created_at: u.email_confirmed_at,
  };
}
async function session(id: string) {
  const u = await userRow(id);
  if (!u) return json({ code: "user_not_found", msg: "User not found" }, 404);
  if (u.banned_until && new Date(u.banned_until) > new Date()) return json({ code: "user_banned", msg: "User is banned" }, 400);
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", aud: "authenticated", exp, email: u.email })}.demo`;
  return json({ access_token, token_type: "bearer", expires_in: 7 * 86400, expires_at: exp, refresh_token: `demo.${id}`, user: authUser(u) });
}

// ------------------------------------------------------------------ PostgREST subset
function where(params: URLSearchParams, vals: unknown[]): string {
  const conds: string[] = [];
  const one = (col: string, expr: string): string => {
    const [op, ...rest] = expr.split(".");
    const val = rest.join(".");
    const c = ident(col);
    const p = (v: unknown) => {
      vals.push(v);
      return `$${vals.length}`;
    };
    switch (op) {
      case "eq": return `${c}::text = ${p(val)}`;
      case "neq": return `${c}::text <> ${p(val)}`;
      case "gt": return `${c} > ${p(val)}`;
      case "gte": return `${c} >= ${p(val)}`;
      case "lt": return `${c} < ${p(val)}`;
      case "lte": return `${c} <= ${p(val)}`;
      case "is": return val === "null" ? `${c} is null` : val === "true" ? `${c} is true` : `${c} is false`;
      case "in": return `${c}::text = any(${p(val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")))}::text[])`;
      case "ilike": return `${c}::text ilike ${p(val.replace(/\*/g, "%"))}`;
      case "like": return `${c}::text like ${p(val.replace(/\*/g, "%"))}`;
      case "not": return `not (${one(col, rest.join("."))})`;
      default: throw Object.assign(new Error(`unsupported filter ${op}`), { code: "PGRST100" });
    }
  };
  for (const [k, v] of params) {
    if (["select", "order", "on_conflict", "limit", "offset", "columns"].includes(k)) continue;
    if (k === "or") {
      const parts = v.replace(/^\(|\)$/g, "").split(",").map((x) => {
        const [col, ...rest] = x.split(".");
        return one(col, rest.join("."));
      });
      conds.push(`(${parts.join(" or ")})`);
    } else conds.push(one(k, v));
  }
  return conds.length ? ` where ${conds.join(" and ")}` : "";
}
function columns(select: string | null): string {
  if (!select || select === "*") return "*";
  return select.split(",").map((c) => ident(c.trim())).join(", ");
}
function orderBy(order: string | null): string {
  if (!order) return "";
  return " order by " + order.split(",").map((o) => {
    const [col, dir, nulls] = o.split(".");
    return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullslast" ? " nulls last" : nulls === "nullsfirst" ? " nulls first" : ""}`;
  }).join(", ");
}

async function rest(req: Request, table: string, url: URL, body: Json) {
  const w = who(req);
  const params = url.searchParams;
  const prefer = req.headers.get("prefer") || "";
  const single = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
  const t = `public.${ident(table)}`;
  const out = (rows: Json[], status = 200, extra: Record<string, string> = {}) => {
    if (single) {
      if (rows.length !== 1) return json({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null }, 406);
      return json(rows[0], status, extra);
    }
    if (status !== 200 && !prefer.includes("return=representation")) return json(null, 204);
    return json(rows, status, extra);
  };

  return asRole(w, async (db) => {
    const vals: unknown[] = [];
    if (req.method === "GET" || req.method === "HEAD") {
      const filter = where(params, vals);
      if (prefer.includes("count=exact") && req.method === "HEAD") {
        const r = await db.query<any>(`select count(*)::int n from ${t}${filter}`, vals);
        return json(null, 200, { "content-range": `*/${r.rows[0].n}` });
      }
      let lim = params.get("limit") ? ` limit ${Number(params.get("limit"))}` : "";
      let off = params.get("offset") ? ` offset ${Number(params.get("offset"))}` : "";
      const range = req.headers.get("range");
      if (range) {
        const [a, b] = range.split("-").map(Number);
        lim = ` limit ${b - a + 1}`;
        off = ` offset ${a}`;
      }
      const r = await db.query<any>(`select coalesce(jsonb_agg(to_jsonb(x)), '[]') j from (select ${columns(params.get("select"))} from ${t}${filter}${orderBy(params.get("order"))}${lim}${off}) x`, vals);
      return out(r.rows[0].j);
    }
    if (req.method === "POST") {
      const rows: Json[] = ([] as Json[]).concat(body);
      const result: Json[] = [];
      const conflict = params.get("on_conflict");
      const upsert = prefer.includes("resolution=merge-duplicates") || prefer.includes("resolution=ignore-duplicates");
      for (const row of rows) {
        const cols = Object.keys(row);
        const list = cols.map(ident).join(", ");
        let sql = `insert into ${t} (${list}) select ${list} from jsonb_populate_record(null::${t}, $1::jsonb)`;
        if (upsert) {
          const keys = (conflict || "id").split(",").map((k) => ident(k.trim()));
          const sets = cols.filter((c) => !keys.includes(ident(c))).map((c) => `${ident(c)} = excluded.${ident(c)}`);
          sql += prefer.includes("ignore-duplicates") || !sets.length ? ` on conflict (${keys.join(", ")}) do nothing` : ` on conflict (${keys.join(", ")}) do update set ${sets.join(", ")}`;
        }
        const r = await db.query<any>(`with r as (${sql} returning *) select coalesce(jsonb_agg(to_jsonb(r)), '[]') j from r`, [JSON.stringify(row)]);
        result.push(...r.rows[0].j);
      }
      return out(result, 201);
    }
    if (req.method === "PATCH") {
      const cols = Object.keys(body || {});
      if (!cols.length) return out([]);
      vals.push(JSON.stringify(body));
      const list = cols.map(ident).join(", ");
      const sql = `update ${t} set (${list}) = (select ${list} from jsonb_populate_record(null::${t}, $1::jsonb))${where(params, vals)}`;
      const r = await db.query<any>(`with r as (${sql} returning *) select coalesce(jsonb_agg(to_jsonb(r)), '[]') j from r`, vals);
      return out(r.rows[0].j, 200);
    }
    if (req.method === "DELETE") {
      const r = await db.query<any>(`with r as (delete from ${t}${where(params, vals)} returning *) select coalesce(jsonb_agg(to_jsonb(r)), '[]') j from r`, vals);
      return out(r.rows[0].j, 200);
    }
    return json({ message: "method" }, 405);
  });
}

async function rpc(req: Request, fn: string, body: Json) {
  const w = who(req);
  return asRole(w, async (db) => {
    const meta = await db.query<any>(
      `select p.proretset, t.typname, p.prorettype = 'void'::regtype as void, p.prokind
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
       where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
    if (!meta.rows.length) return json({ code: "PGRST202", message: `Could not find the function public.${fn}` }, 404);
    const m = meta.rows[0];
    const args = Object.entries(body || {}).filter(([, v]) => v !== undefined);
    const vals = args.map(([, v]) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v));
    const call = `public.${ident(fn)}(${args.map(([k], i) => `${ident(k)} => $${i + 1}`).join(", ")})`;
    if (m.proretset || m.typname === "record") {
      const r = await db.query<any>(`select coalesce(jsonb_agg(to_jsonb(x)), '[]') j from ${call} x`, vals);
      return json(r.rows[0].j);
    }
    const r = await db.query<any>(`select to_jsonb(${call}) j`, vals);
    return m.void ? json(null, 204) : json(r.rows[0].j);
  });
}

// ------------------------------------------------------------------ auth subset
async function auth(req: Request, path: string, url: URL, body: Json) {
  const w = who(req);
  const service = w.role === "service_role";
  const err = (code: string, msg: string, status = 400) => json({ code, error_code: code, msg, message: msg }, status);

  if (path === "/auth/v1/otp") {
    if (service) return err("unexpected_failure", "البريد غير مفعّل في النسخة التجريبية", 500);
    const id = await userByEmail(body.email || "");
    if (!id && !body.create_user) return err("otp_disabled", "Signups not allowed for otp", 422);
    if (!id) await createUser(body.email);
    return json({});
  }
  if (path === "/auth/v1/verify") {
    if (String(body.token || "") !== DEMO_CODE) return err("otp_expired", "Token has expired or is invalid", 403);
    const id = await userByEmail(body.email || "");
    return id ? session(id) : err("otp_expired", "Token has expired or is invalid", 403);
  }
  if (path === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      const id = String(body.refresh_token || "").replace(/^demo\./, "");
      return /^[0-9a-f-]{36}$/.test(id) ? session(id) : err("refresh_token_not_found", "Invalid Refresh Token", 400);
    }
    if (grant === "password") {
      const id = await userByEmail(body.email || "");
      if (!id) return err("invalid_credentials", "Invalid login credentials");
      const db = await database();
      const r = await (db.query<any>(`select password from auth.demo_passwords where user_id = $1`, [id]));
      const ok = body.password === (r.rows[0]?.password ?? DEMO_PASSWORD);
      return ok ? session(id) : err("invalid_credentials", "Invalid login credentials");
    }
    return err("unsupported_grant_type", "unsupported grant");
  }
  if (path === "/auth/v1/signup") {
    if (await userByEmail(body.email || "")) return err("user_already_exists", "User already registered", 422);
    if (String(body.password || "").length < 8) return err("weak_password", "Password should be at least 8 characters", 422);
    return session(await createUser(body.email, body.data, body.password));
  }
  if (path === "/auth/v1/user") {
    if (!w.sub) return err("no_authorization", "missing token", 401);
    if (req.method === "PUT" && body?.data) {
      const db = await database();
      await (db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [w.sub, JSON.stringify(body.data)]));
    }
    const u = await userRow(w.sub);
    return u ? json(authUser(u)) : err("user_not_found", "User not found", 404);
  }
  if (path === "/auth/v1/logout") return json(null, 204);
  if (path === "/auth/v1/recover") return json({});
  if (path === "/auth/v1/invite") return err("unexpected_failure", "البريد غير مفعّل في النسخة التجريبية", 500);

  if (path.startsWith("/auth/v1/admin/users")) {
    if (!service) return err("not_admin", "User not allowed", 403);
    const id = path.split("/")[5];
    const db = await database();
    if (req.method === "POST" && !id) {
      if (await userByEmail(body.email || "")) return err("email_exists", "A user with this email address has already been registered", 422);
      const nid = await createUser(body.email, body.user_metadata, body.password);
      return json(authUser(await userRow(nid)));
    }
    if (req.method === "GET" && id) {
      const u = await userRow(id);
      return u ? json(authUser(u)) : err("user_not_found", "User not found", 404);
    }
    if (req.method === "PUT" && id) {
      await (async () => {
        if (body.email) await db.query(`update auth.users set email = lower($2) where id = $1`, [id, body.email]);
        if (body.password) await db.query(`insert into auth.demo_passwords values ($1, $2) on conflict (user_id) do update set password = excluded.password`, [id, body.password]);
      })();
      return json(authUser(await userRow(id)));
    }
    if (req.method === "DELETE" && id) {
      await (db.query(`delete from auth.users where id = $1`, [id]));
      return json({});
    }
    return json({ users: [], aud: "authenticated" });
  }
  return err("not_found", "not found", 404);
}

const READ_ONLY_RPC = new Set(["my_context", "public_center", "invite_info", "super_centers", "admin_trash", "report_data",
  "sync_latest_quran_entries", "sync_latest_arabic_entries", "guardian_view", "tilawah_percent", "ayahs_before"]);

function changes(req: Request, path: string, body: Json): boolean {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const rpcName = path.match(/^\/rest\/v1\/rpc\/(\w+)/)?.[1];
  if (rpcName) return !READ_ONLY_RPC.has(rpcName);
  if (path.startsWith("/rest/v1/")) return true;
  if (path === "/auth/v1/signup" || path.startsWith("/auth/v1/admin/")) return true;
  if (path === "/auth/v1/otp") return !!body?.create_user;
  return path === "/auth/v1/user" && req.method === "PUT";
}

export async function handleDemo(req: Request, path: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
  let body: Json = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {}
  return locked(async () => {
    try {
      active = await current();
    } catch (e) {
      g.__demo = undefined;
      return pgError(e);
    }
    let res: Response;
    try {
      if (path.startsWith("/auth/v1/")) res = await auth(req, path, url, body);
      else {
        const m = path.match(/^\/rest\/v1\/(rpc\/)?([a-z_][a-z0-9_]*)$/);
        res = !m ? json({ message: "not found" }, 404) : m[1] ? await rpc(req, m[2], body) : await rest(req, m[2], url, body);
      }
    } catch (e) {
      res = pgError(e);
    }
    if (res.status < 400 && changes(req, path, body)) await persist().catch((e) => console.error("demo snapshot:", e));
    return res;
  });
}
