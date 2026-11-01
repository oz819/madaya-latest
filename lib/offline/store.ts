"use client";

// Local-first data layer (spec §6). Every read in the UI comes from this in-memory copy, which is
// persisted to IndexedDB. Every write is applied locally first and queued in an outbox; the sync
// loop pushes the outbox to Supabase (idempotent upserts keyed by client uuids) and then pulls
// rows other devices changed since the last pull.

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Activity,
  ArabicBook,
  ArabicEnrollment,
  ArabicEntry,
  Attendance,
  AttendanceStatus,
  Circle,
  CircleLesson,
  EduNote,
  Exam,
  GuardianLink,
  ReportSend,
  StudentTransfer,
  QuranEntry,
  Student,
  Surah,
  TalqeenSession,
} from "@/lib/types";
import { addDays, todayStr } from "@/lib/types";
import * as idb from "@/lib/offline/idb";

export type ProfileRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  deleted_at: string | null;
  default_filter: string | null;
};

export const PROFILE_COLUMNS = "id,name,role,active,deleted_at,default_filter";

type TableRows = {
  circles: Circle;
  students: Student;
  profiles: ProfileRow;
  quran_surahs: Surah;
  quran_entries: QuranEntry;
  attendance: Attendance;
  arabic_books: ArabicBook;
  student_arabic_enrollments: ArabicEnrollment;
  arabic_entries: ArabicEntry;
  edu_notes: EduNote;
  talqeen_sessions: TalqeenSession;
  circle_lessons: CircleLesson;
  activities: Activity;
  guardian_links: GuardianLink;
  report_sends: ReportSend;
  exams: Exam;
  student_transfers: StudentTransfer;
};
export type TableName = keyof TableRows;

/** Tables teachers write through the outbox (work offline). */
export type OutboxTable =
  | "students"
  | "quran_entries"
  | "attendance"
  | "student_arabic_enrollments"
  | "arabic_entries"
  | "edu_notes"
  | "circle_lessons"
  | "activities"
  | "report_sends"
  | "exams";

const TABLE_NAMES: TableName[] = [
  "circles",
  "students",
  "profiles",
  "quran_surahs",
  "quran_entries",
  "attendance",
  "arabic_books",
  "student_arabic_enrollments",
  "arabic_entries",
  "edu_notes",
  "talqeen_sessions",
  "circle_lessons",
  "activities",
  "guardian_links",
  "report_sends",
  "exams",
  "student_transfers",
];

// Pulled incrementally by updated_at, in dependency order (parents before children).
const SYNC_TABLES = [
  "circles",
  "students",
  "student_transfers",
  "arabic_books",
  "student_arabic_enrollments",
  "talqeen_sessions",
  "quran_entries",
  "arabic_entries",
  "edu_notes",
  "attendance",
  "circle_lessons",
  "activities",
  "guardian_links",
  "report_sends",
  "exams",
] as const;

// Server-managed columns are never sent: triggers set them (spec §9).
// center_id comes from the signed-in centre on the server (default + RLS), never from the device.
const SERVER_MANAGED = new Set(["updated_at", "updated_by", "created_at", "teacher_id", "deleted_by", "center_id"]);

// Soft-deleted rows of these tables stay in the local copy (so a restore is just another update)
// but are hidden from every list: all() skips them. get() still finds them, e.g. for old names.
const SOFT_DELETE_HIDDEN = new Set<TableName>(["students", "circles", "arabic_books", "profiles"]);

/** Devices keep this many days of entries locally (plus all HIFZ and each student's latest per track). */
export const LOCAL_WINDOW_DAYS = 60;
const PAGE = 1000;
const PULL_OVERLAP_MS = 2 * 60 * 1000;

export function keyOf(table: TableName, row: Record<string, unknown>): string {
  if (table === "attendance") return `${row.student_id}|${row.att_date}`;
  if (table === "circle_lessons") return `${row.circle_id}|${row.lesson_date}`;
  if (table === "guardian_links") return String(row.student_id);
  if (table === "report_sends") return `${row.student_id}|${row.send_date}|${row.kind}`;
  if (table === "quran_surahs") return String(row.surah_no);
  return String(row.id);
}

function onConflict(table: OutboxTable): string {
  return table === "attendance"
    ? "student_id,att_date"
    : table === "circle_lessons"
      ? "circle_id,lesson_date"
      : table === "report_sends"
        ? "student_id,send_date,kind"
        : "id";
}

function serverPayload(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!SERVER_MANAGED.has(k)) out[k] = v;
  return out;
}

export function newId(): string {
  return crypto.randomUUID();
}

type TalqeenPayload = { id: string; student_id: string; notes: string | null; quality: string | null };

export type OutboxItem = {
  seq?: number;
  status: "pending" | "failed";
  error?: string;
  label: string;
  createdAt: string;
  /** `${table}:${key}` of every local row this item wrote; used to protect unsynced edits from pulls. */
  keys: string[];
} & (
  | { kind: "upsert"; table: OutboxTable; row: Record<string, unknown> }
  | { kind: "talqeen"; session: Record<string, unknown>; entries: TalqeenPayload[] }
);

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  /** The login session is gone/expired: queued changes wait until the teacher signs in again. */
  authProblem: boolean;
  lastError: string | null;
  initialSyncDone: boolean;
};

type ErrorKind = "network" | "auth" | "rejected";

function classify(error: { message?: string; code?: string } | null, status: number): ErrorKind {
  const msg = error?.message ?? "";
  if (status === 0 || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return "network";
  if (status === 401 || error?.code === "PGRST301" || error?.code === "PGRST303" || /jwt/i.test(msg)) return "auth";
  return "rejected";
}

class LocalStore {
  private sb: SupabaseClient<Database> | null = null;
  private userId: string | null = null;
  private data = Object.fromEntries(TABLE_NAMES.map((t) => [t, new Map()])) as {
    [T in TableName]: Map<string, TableRows[T]>;
  };
  private outbox: OutboxItem[] = [];
  private listeners = new Set<() => void>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private syncPromise: Promise<void> | null = null;
  private derived = new Map<string, { version: number; value: unknown }>();
  private loaded = false;

  version = 0;
  status: SyncStatus = {
    online: true,
    syncing: false,
    pending: 0,
    failed: 0,
    lastSyncAt: null,
    authProblem: false,
    lastError: null,
    initialSyncDone: false,
  };

  // ---------- lifecycle ----------

  async start(sb: SupabaseClient<Database>, userId: string) {
    this.sb = sb;
    this.userId = userId;
    await this.ensureLoaded();
    this.status.online = navigator.onLine;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisible);
    this.interval = setInterval(() => this.requestSync(), 60_000);
    // Ask the browser not to evict this origin's storage (matters most on iOS, spec §6.3).
    navigator.storage?.persist?.().catch(() => {});
    this.emit();
    this.requestSync(0);
  }

  stop() {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisible);
    if (this.interval) clearInterval(this.interval);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.interval = null;
    this.syncTimer = null;
  }

  private handleOnline = () => {
    this.status.online = true;
    this.emit();
    this.requestSync(0);
  };
  private handleOffline = () => {
    this.status.online = false;
    this.emit();
  };
  private handleVisible = () => {
    if (document.visibilityState === "visible") this.requestSync(0);
  };

  async ensureLoaded() {
    if (!this.loaded) await this.load();
  }

  private async load() {
    const [rows, outbox, lastSyncAt, initialSyncDone] = await Promise.all([
      idb.getAll<idb.RowRecord>("rows"),
      idb.getAll<OutboxItem>("outbox"),
      idb.getMeta<string>("lastSyncAt"),
      idb.getMeta<boolean>("initialSyncDone"),
    ]);
    for (const r of rows) {
      const map = this.data[r.table as TableName] as Map<string, unknown> | undefined;
      map?.set(r.key, r.row);
    }
    this.outbox = outbox.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    this.status.lastSyncAt = lastSyncAt ?? null;
    this.status.initialSyncDone = !!initialSyncDone;
    this.recount();
    this.loaded = true;
  }

  /** Wipes everything on this device (sign-out on a shared device, spec §6.3). */
  async reset() {
    this.stop();
    await idb.clearAll();
    for (const t of TABLE_NAMES) this.data[t].clear();
    this.outbox = [];
    this.status = { ...this.status, pending: 0, failed: 0, lastSyncAt: null, initialSyncDone: false, authProblem: false };
    this.loaded = false;
    this.emit();
  }

  // ---------- subscription ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  private recount() {
    this.status.pending = this.outbox.filter((o) => o.status === "pending").length;
    this.status.failed = this.outbox.filter((o) => o.status === "failed").length;
  }

  /** Memoizes a derived value until the next change. */
  memo<T>(key: string, compute: () => T): T {
    const hit = this.derived.get(key);
    if (hit && hit.version === this.version) return hit.value as T;
    const value = compute();
    this.derived.set(key, { version: this.version, value });
    return value;
  }

  // ---------- reads ----------

  all<T extends TableName>(table: T): TableRows[T][] {
    return this.memo(`all:${table}`, () => {
      const rows = Array.from(this.data[table].values());
      return SOFT_DELETE_HIDDEN.has(table) ? rows.filter((r) => !(r as { deleted_at?: string | null }).deleted_at) : rows;
    });
  }

  get<T extends TableName>(table: T, key: string): TableRows[T] | undefined {
    return this.data[table].get(key);
  }

  /** Live (non-deleted) rows of a table grouped by student_id. */
  /** Every row including soft-deleted ones, keyed for lookups (names of deleted books in history). */
  lookup<T extends TableName>(table: T): Map<string, TableRows[T]> {
    return this.memo(`lookup:${table}`, () => new Map(this.data[table]));
  }

  byStudent<T extends "quran_entries" | "arabic_entries" | "edu_notes" | "attendance" | "student_arabic_enrollments" | "exams">(
    table: T
  ): Map<string, TableRows[T][]> {
    return this.memo(`byStudent:${table}`, () => {
      const m = new Map<string, TableRows[T][]>();
      for (const r of this.data[table].values()) {
        const row = r as TableRows[T] & { student_id: string; deleted_at: string | null };
        if (row.deleted_at) continue;
        const list = m.get(row.student_id);
        if (list) list.push(r);
        else m.set(row.student_id, [r]);
      }
      return m;
    });
  }

  outboxItems(): OutboxItem[] {
    return this.outbox;
  }

  /** Student ids with unsynced changes (for the card's sync badge). */
  unsyncedStudents(): Set<string> {
    return this.memo("unsyncedStudents", () => {
      const s = new Set<string>();
      for (const o of this.outbox) {
        if (o.kind === "upsert") {
          const sid = o.table === "students" ? o.row.id : o.row.student_id;
          if (typeof sid === "string") s.add(sid);
        } else {
          for (const e of o.entries) s.add(e.student_id);
        }
      }
      return s;
    });
  }

  // ---------- writes ----------

  /** Creates or updates a row locally and queues it for sync. Returns the stored row. */
  async save<T extends OutboxTable>(table: T, row: Partial<TableRows[T]>, label: string): Promise<TableRows[T]> {
    const now = new Date().toISOString();
    const key = keyOf(table, row as Record<string, unknown>);
    const existing = this.data[table].get(key) as Record<string, unknown> | undefined;
    const full = {
      ...(existing ?? { created_at: now, teacher_id: this.userId, deleted_at: null }),
      ...row,
      edited_at: now,
      updated_by: this.userId,
    } as unknown as TableRows[T];
    if (table === "students") delete (full as Record<string, unknown>).deleted_at;

    const item: OutboxItem = {
      kind: "upsert",
      table,
      row: serverPayload(full as Record<string, unknown>),
      status: "pending",
      label,
      createdAt: now,
      keys: [`${table}:${key}`],
    };
    (this.data[table] as Map<string, TableRows[T]>).set(key, full);
    const seq = await idb.putRowsAndEnqueue([{ table, key, row: full as Record<string, unknown> }], item);
    this.outbox.push({ ...item, seq });
    this.recount();
    this.emit();
    this.requestSync();
    return full;
  }

  async softDelete<T extends Exclude<OutboxTable, "students">>(table: T, key: string, label: string) {
    const existing = this.data[table].get(key);
    if (!existing) return;
    await this.save(table, { ...existing, deleted_at: new Date().toISOString() } as Partial<TableRows[T]>, label);
  }

  /** Marks a student present for a day unless attendance is already recorded (spec §4.6). */
  async ensurePresent(studentId: string, date: string) {
    const existing = this.data.attendance.get(`${studentId}|${date}`);
    if (existing && !existing.deleted_at) return;
    await this.save("attendance", { student_id: studentId, att_date: date, status: "PRESENT", deleted_at: null }, "تسجيل حضور");
  }

  async setAttendance(studentId: string, date: string, status: AttendanceStatus | null) {
    const key = `${studentId}|${date}`;
    if (status === null) {
      if (this.data.attendance.has(key)) await this.softDelete("attendance", key, "إلغاء الحضور");
      return;
    }
    await this.save("attendance", { student_id: studentId, att_date: date, status, deleted_at: null }, "تسجيل حضور");
  }

  /**
   * Saves a talqeen session (spec §4.7 / §5.2): the session, one TALQEEN entry per ticked
   * student, and their attendance, applied locally and queued as ONE outbox item that is sent
   * as a single RPC call. Re-saving with a different list adds/removes students.
   */
  async saveTalqeen(
    session: Pick<TalqeenSession, "id" | "circle_id" | "session_date" | "from_surah_no" | "from_ayah" | "to_surah_no" | "to_ayah" | "notes"> & {
      deleted_at?: string | null;
    },
    ticked: { student_id: string; notes?: string | null; quality?: string | null }[]
  ) {
    const now = new Date().toISOString();
    const records: idb.RowRecord[] = [];
    const keys: string[] = [];
    const put = <T extends TableName>(table: T, row: TableRows[T]) => {
      const key = keyOf(table, row as Record<string, unknown>);
      (this.data[table] as Map<string, TableRows[T]>).set(key, row);
      records.push({ table, key, row: row as Record<string, unknown> });
      keys.push(`${table}:${key}`);
    };

    const prev = this.data.talqeen_sessions.get(session.id);
    const deleted = session.deleted_at ?? null;
    const sessionRow: TalqeenSession = {
      created_at: now,
      teacher_id: this.userId,
      ...prev,
      ...session,
      deleted_at: deleted,
      edited_at: now,
      updated_at: prev?.updated_at ?? now,
      updated_by: this.userId,
    } as TalqeenSession;
    put("talqeen_sessions", sessionRow);

    const list = deleted ? [] : ticked;
    const existingEntries = Array.from(this.data.quran_entries.values()).filter((e) => e.talqeen_session_id === session.id);
    const byStudent = new Map(existingEntries.map((e) => [e.student_id, e]));
    const payload: TalqeenPayload[] = [];
    const tickedIds = new Set<string>();

    for (const t of list) {
      tickedIds.add(t.student_id);
      const old = byStudent.get(t.student_id);
      const entry: QuranEntry = {
        created_at: now,
        teacher_id: this.userId,
        updated_at: now,
        ...old,
        id: old?.id ?? newId(),
        student_id: t.student_id,
        entry_date: session.session_date,
        track: "TALQEEN",
        from_surah_no: session.from_surah_no,
        from_ayah: session.from_ayah,
        to_surah_no: session.to_surah_no,
        to_ayah: session.to_ayah,
        quality: t.quality ?? null,
        notes: t.notes ?? null,
        talqeen_session_id: session.id,
        edited_at: now,
        updated_by: this.userId,
        deleted_at: null,
      } as QuranEntry;
      put("quran_entries", entry);
      payload.push({ id: entry.id, student_id: entry.student_id, notes: entry.notes, quality: entry.quality });

      const attKey = `${t.student_id}|${session.session_date}`;
      const att = this.data.attendance.get(attKey);
      if (!att || att.deleted_at || att.status === "ABSENT") {
        put("attendance", {
          created_at: now,
          teacher_id: this.userId,
          updated_at: now,
          ...att,
          student_id: t.student_id,
          att_date: session.session_date,
          status: "PRESENT",
          deleted_at: null,
          edited_at: now,
          updated_by: this.userId,
        } as Attendance);
      }
    }
    for (const e of existingEntries) {
      if (!tickedIds.has(e.student_id) && !e.deleted_at) {
        put("quran_entries", { ...e, deleted_at: now, edited_at: now, updated_by: this.userId });
      }
    }

    const item: OutboxItem = {
      kind: "talqeen",
      session: serverPayload(sessionRow as unknown as Record<string, unknown>),
      entries: payload,
      status: "pending",
      label: deleted ? "حذف جلسة تلقين" : "جلسة تلقين",
      createdAt: now,
      keys,
    };
    const seq = await idb.putRowsAndEnqueue(records, item);
    this.outbox.push({ ...item, seq });
    this.recount();
    this.emit();
    this.requestSync();
  }

  /** Applies rows written directly online (admin actions) or fetched on demand. */
  async applyRemote<T extends TableName>(table: T, rows: TableRows[T][]) {
    const records: idb.RowRecord[] = [];
    for (const r of rows) {
      const key = keyOf(table, r as Record<string, unknown>);
      (this.data[table] as Map<string, TableRows[T]>).set(key, r);
      records.push({ table, key, row: r as Record<string, unknown> });
    }
    await idb.putRows(records);
    this.emit();
  }

  // ---------- outbox management ----------

  async retry(seq: number) {
    const item = this.outbox.find((o) => o.seq === seq);
    if (!item) return;
    item.status = "pending";
    item.error = undefined;
    await idb.putOutbox(item);
    this.recount();
    this.emit();
    this.requestSync(0);
  }

  /** Drops a failed change and restores the server's version of the rows it touched. */
  async discard(seq: number) {
    const item = this.outbox.find((o) => o.seq === seq);
    if (!item) return;
    await idb.deleteOutbox(seq);
    this.outbox = this.outbox.filter((o) => o.seq !== seq);
    this.recount();
    this.emit();
    await this.refetchKeys(item.keys).catch(() => {});
  }

  private async refetchKeys(keys: string[]) {
    if (!this.sb) return;
    for (const k of keys) {
      const sep = k.indexOf(":");
      const table = k.slice(0, sep) as TableName;
      const key = k.slice(sep + 1);
      let q;
      if (table === "attendance") {
        const [student_id, att_date] = key.split("|");
        q = this.sb.from("attendance").select("*").eq("student_id", student_id).eq("att_date", att_date);
      } else if (table === "circle_lessons") {
        const [circle_id, lesson_date] = key.split("|");
        q = this.sb.from("circle_lessons").select("*").eq("circle_id", circle_id).eq("lesson_date", lesson_date);
      } else if (table === "report_sends") {
        const [student_id, send_date, kind] = key.split("|");
        q = this.sb.from("report_sends").select("*").eq("student_id", student_id).eq("send_date", send_date).eq("kind", kind);
      } else {
        // Every other synced table is keyed by id; the cast only picks one for typing.
        q = this.sb.from(table as "students").select("*").eq("id", key);
      }
      const { data, error } = await q;
      if (error) continue;
      if (data && data.length) {
        await this.applyRemote(table, data as TableRows[typeof table][]);
      } else {
        this.data[table].delete(key);
        await idb.deleteRow(table, key);
        this.emit();
      }
    }
  }

  // ---------- sync ----------

  requestSync(delay = 800) {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.sync();
    }, delay);
  }

  sync(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.runSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async runSync() {
    if (!this.sb || !navigator.onLine) {
      this.status.online = navigator.onLine;
      this.emit();
      return;
    }
    this.status.syncing = true;
    this.emit();
    try {
      const { data } = await this.sb.auth.getSession();
      if (!data.session) {
        this.status.authProblem = true;
        return;
      }
      const pushed = await this.push();
      if (pushed === "stop") return;
      await this.pull();
      this.status.authProblem = false;
      this.status.lastError = null;
      this.status.lastSyncAt = new Date().toISOString();
      this.status.initialSyncDone = true;
      await idb.setMeta("lastSyncAt", this.status.lastSyncAt);
      await idb.setMeta("initialSyncDone", true);
    } catch (e) {
      const kind = classify({ message: String((e as Error)?.message ?? e) }, 0);
      if (kind === "network") this.status.online = false;
      this.status.lastError = String((e as Error)?.message ?? e);
    } finally {
      this.status.syncing = false;
      this.recount();
      this.emit();
    }
  }

  /** Sends pending outbox items in order. Returns "stop" when the network or login blocked it. */
  private async push(): Promise<"ok" | "stop"> {
    const sb = this.sb!;
    let i = 0;
    while (i < this.outbox.length) {
      const item = this.outbox[i];
      if (item.status !== "pending") {
        i++;
        continue;
      }

      // Batch consecutive upserts to the same table into one request.
      const batch: OutboxItem[] = [item];
      if (item.kind === "upsert") {
        for (let j = i + 1; j < this.outbox.length && batch.length < 200; j++) {
          const o = this.outbox[j];
          if (o.status !== "pending" || o.kind !== "upsert" || o.table !== item.table) break;
          batch.push(o);
        }
      }

      let error: { message: string; code?: string } | null = null;
      let status = 200;
      if (item.kind === "upsert") {
        // Later items for the same key supersede earlier ones inside a batch.
        const rows = new Map<string, Record<string, unknown>>();
        for (const b of batch) if (b.kind === "upsert") rows.set(keyOf(b.table, b.row), b.row);
        const res = await sb.from(item.table).upsert(Array.from(rows.values()) as never, { onConflict: onConflict(item.table) });
        error = res.error;
        status = res.status;
      } else {
        const res = await sb.rpc("save_talqeen_session", {
          p_session: item.session as never,
          p_entries: item.entries as never,
        });
        error = res.error;
        status = res.status;
      }

      if (!error) {
        for (const b of batch) await idb.deleteOutbox(b.seq!);
        const done = new Set(batch.map((b) => b.seq));
        this.outbox = this.outbox.filter((o) => !done.has(o.seq));
        this.recount();
        this.emit();
        continue;
      }

      const kind = classify(error, status);
      if (kind === "network") {
        this.status.online = false;
        return "stop";
      }
      if (kind === "auth") {
        this.status.authProblem = true;
        return "stop";
      }
      if (batch.length > 1 && item.kind === "upsert") {
        // Retry one by one so a single bad row doesn't block the rest.
        const single = await sb.from(item.table).upsert(item.row as never, { onConflict: onConflict(item.table) });
        if (!single.error) {
          await idb.deleteOutbox(item.seq!);
          this.outbox.splice(i, 1);
          this.recount();
          this.emit();
          continue;
        }
        error = single.error;
        const k2 = classify(single.error, single.status);
        if (k2 !== "rejected") return "stop";
      }
      item.status = "failed";
      item.error = error.message;
      await idb.putOutbox(item);
      this.recount();
      this.emit();
      i++;
    }
    return "ok";
  }

  private pendingKeys(): Set<string> {
    const s = new Set<string>();
    for (const o of this.outbox) for (const k of o.keys) s.add(k);
    return s;
  }

  private async pull() {
    const sb = this.sb!;
    const cursors = (await idb.getMeta<Record<string, string>>("cursors")) ?? {};
    const since = addDays(todayStr(), -LOCAL_WINDOW_DAYS);
    const protectedKeys = this.pendingKeys();

    const merge = async <T extends TableName>(table: T, rows: TableRows[T][]) => {
      const records: idb.RowRecord[] = [];
      for (const r of rows) {
        const key = keyOf(table, r as Record<string, unknown>);
        if (protectedKeys.has(`${table}:${key}`)) continue; // unsynced local edit wins until pushed
        (this.data[table] as Map<string, TableRows[T]>).set(key, r);
        records.push({ table, key, row: r as Record<string, unknown> });
      }
      await idb.putRows(records);
    };

    // Small reference tables: replaced wholesale.
    if (this.data.quran_surahs.size < 114) {
      const { data, error } = await sb.from("quran_surahs").select("surah_no,name,ayah_count").order("surah_no");
      if (error) throw new Error(error.message);
      await merge("quran_surahs", data ?? []);
    }
    {
      const { data, error } = await sb.from("profiles").select(PROFILE_COLUMNS);
      if (error) throw new Error(error.message);
      const ids = new Set((data ?? []).map((p) => p.id));
      for (const k of Array.from(this.data.profiles.keys())) {
        if (!ids.has(k)) {
          this.data.profiles.delete(k);
          await idb.deleteRow("profiles", k);
        }
      }
      await merge("profiles", data ?? []);
    }

    const bootstrap = !cursors.quran_entries;

    for (const table of SYNC_TABLES) {
      const cursor = cursors[table];
      let maxUpdated = cursor ?? "";
      for (let from = 0; ; from += PAGE) {
        let q = sb.from(table).select("*");
        if (cursor) {
          q = q.gte("updated_at", new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString());
        } else if (table === "quran_entries") {
          q = q.is("deleted_at", null).or(`entry_date.gte.${since},track.eq.HIFZ`);
        } else if (table === "arabic_entries") {
          q = q.is("deleted_at", null).gte("entry_date", since);
        } else if (table === "edu_notes") {
          q = q.is("deleted_at", null).gte("record_date", since);
        } else if (table === "attendance") {
          q = q.is("deleted_at", null).gte("att_date", since);
        } else if (table === "talqeen_sessions") {
          q = q.is("deleted_at", null).gte("session_date", since);
        } else if (table === "circle_lessons") {
          q = q.is("deleted_at", null).gte("lesson_date", since);
        } else if (table === "activities") {
          q = q.is("deleted_at", null).gte("activity_date", since);
        } else if (table === "report_sends") {
          q = q.is("deleted_at", null).gte("send_date", since);
        } else if (table === "exams") {
          // Every exam, however old: certificates and «جاهز للاختبار» need the whole history.
          q = q.is("deleted_at", null);
        }
        const tiebreak =
          table === "attendance" || table === "guardian_links" || table === "report_sends"
            ? "student_id"
            : table === "circle_lessons"
              ? "circle_id"
              : "id";
        const { data, error } = await q.order("updated_at").order(tiebreak).range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as TableRows[typeof table][];
        await merge(table, rows);
        for (const r of rows) if (r.updated_at > maxUpdated) maxUpdated = r.updated_at;
        if (rows.length < PAGE) break;
      }
      if (maxUpdated) cursors[table] = maxUpdated;
      else if (!cursor) cursors[table] = new Date(0).toISOString();
    }

    if (bootstrap) {
      // Each student's latest entry per track / per book, however old, so the card header and
      // "prefill from last entry" work for students not seen in the local window.
      const [q, a] = await Promise.all([sb.rpc("sync_latest_quran_entries"), sb.rpc("sync_latest_arabic_entries")]);
      if (q.error) throw new Error(q.error.message);
      if (a.error) throw new Error(a.error.message);
      await merge("quran_entries", (q.data ?? []) as QuranEntry[]);
      await merge("arabic_entries", (a.data ?? []) as ArabicEntry[]);
    }

    await idb.setMeta("cursors", cursors);
    this.emit();
  }

  /** Online-only: older history for one student beyond the local window. */
  async fetchStudentHistory(studentId: string) {
    if (!this.sb) return;
    const [q, a, n, t] = await Promise.all([
      this.sb.from("quran_entries").select("*").eq("student_id", studentId).is("deleted_at", null),
      this.sb.from("arabic_entries").select("*").eq("student_id", studentId).is("deleted_at", null),
      this.sb.from("edu_notes").select("*").eq("student_id", studentId).is("deleted_at", null),
      this.sb.from("attendance").select("*").eq("student_id", studentId).is("deleted_at", null),
    ]);
    const err = q.error || a.error || n.error || t.error;
    if (err) throw new Error(err.message);
    const protectedKeys = this.pendingKeys();
    const keep = <T extends TableName>(table: T, rows: TableRows[T][]) =>
      rows.filter((r) => !protectedKeys.has(`${table}:${keyOf(table, r as Record<string, unknown>)}`));
    await this.applyRemote("quran_entries", keep("quran_entries", q.data ?? []));
    await this.applyRemote("arabic_entries", keep("arabic_entries", a.data ?? []));
    await this.applyRemote("edu_notes", keep("edu_notes", n.data ?? []));
    await this.applyRemote("attendance", keep("attendance", t.data ?? []));
  }
}

export const store = new LocalStore();

/** Re-renders the component whenever local data or sync status changes. */
export function useStore(): LocalStore {
  useSyncExternalStore(
    store.subscribe,
    () => store.version,
    () => 0
  );
  return store;
}
