"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import LoginDialog from "@/components/center/LoginDialog";
import { CenterMark } from "@/components/center/Geo";
import { applyPalette, type Palette } from "@/lib/center";

type Info = { center: string; slug: string; logo_url: string | null; palette: Palette; role: "ADMIN" | "TEACHER"; email: string; name: string | null; state: "OK" | "USED" | "EXPIRED" | "REVOKED" };

const STATE_MESSAGE: Record<Exclude<Info["state"], "OK">, string> = {
  USED: "استُخدم رابط الدعوة هذا من قبل.",
  EXPIRED: "انتهت صلاحية رابط الدعوة. اطلب رابطًا جديدًا من إدارة المركز.",
  REVOKED: "ألغت إدارة المركز هذه الدعوة.",
};

// رابط الدعوة: sign in (or make a login) with the invited email, then join the centre.
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc("invite_info", { p_token: token }).then(({ data }) => {
      const v = data as unknown as Info | null;
      setInfo(v);
      if (v) {
        applyPalette({ palette: v.palette });
        setName(v.name ?? "");
      }
    });
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    // Signing in from the dialog on this page: show the "accept" step right away.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase, token]);

  async function accept() {
    setError("");
    setBusy(true);
    const { error } = await supabase.rpc("accept_invite", { p_token: token, p_name: name.trim() || null });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/");
  }

  if (info === undefined || email === undefined) return <div className="login"><p className="muted">جارٍ التحميل...</p></div>;
  if (!info || info.state !== "OK") {
    return (
      <div className="login">
        <div className="loginbox center">
          <h2>الدعوة غير صالحة</h2>
          <p className="muted">{info ? STATE_MESSAGE[info.state as Exclude<Info["state"], "OK">] : "تأكد من الرابط."}</p>
        </div>
      </div>
    );
  }

  const roleLabel = info.role === "ADMIN" ? "مديرًا" : "معلّمًا";
  if (!email) {
    return (
      <div className="login geo-bg">
        <LoginDialog
          title={info.center}
          subtitle={`دعوة للانضمام ${roleLabel} — ادخل بالبريد ${info.email}`}
          logo={info.logo_url}
          defaultEmail={info.email}
          allowCreate
          next={`/invite/${token}`}
        />
      </div>
    );
  }

  const sameEmail = email.toLowerCase() === info.email.toLowerCase();
  return (
    <div className="login geo-bg">
      <div className="loginbox">
        <div className="lg-head">
          <CenterMark name={info.center} logo={info.logo_url} size={64} />
          <h2>{info.center}</h2>
          <p>دعوة للانضمام {roleLabel}</p>
        </div>
        {sameEmail ? (
          <>
            <div className="field">
              <label>اسمك كما يظهر في المركز</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <button type="button" className="btn-block" onClick={accept} disabled={busy}>
              {busy ? "..." : "قبول الدعوة"}
            </button>
          </>
        ) : (
          <>
            <p className="notice" style={{ marginTop: 14 }}>
              أنت داخل ببريد <b dir="ltr">{email}</b>، والدعوة للبريد <b dir="ltr">{info.email}</b>.
            </p>
            <button type="button" className="secondary btn-block" onClick={async () => { await supabase.auth.signOut(); location.reload(); }}>
              الخروج والدخول بالبريد الصحيح
            </button>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
