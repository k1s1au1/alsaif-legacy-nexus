import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LogIn, RefreshCw, ShieldCheck, Tv, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callTvPair, parsePairLink, TV_PAIR_STORAGE, TvPairError } from "@/lib/tv-pairing";
import "./tv-login.css";

export const Route = createFileRoute("/tv-login")({
  ssr: false,
  head: () => ({ meta: [{ title: "دخول التلفزيون — مجلس السيف" }, { name: "robots", content: "noindex,nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: TvLoginApproval,
});
type Approval = { id: string; approvalSecret: string };
export function TvLoginApproval() {
  const [pair, setPair] = useState<Approval | null>(null), [account, setAccount] = useState<{ id: string; email?: string } | null>(null);
  const [status, setStatus] = useState("loading"), [code, setCode] = useState(""), [expiresAt, setExpiresAt] = useState(""), [error, setError] = useState("");
  const [matched, setMatched] = useState(false), [busy, setBusy] = useState(false), [remaining, setRemaining] = useState(0), [retry, setRetry] = useState(0);
  const busyRef = useRef(false);
  useEffect(() => {
    const fromLink = parsePairLink(window.location.hash);
    // Keep the approval capability out of URL history, referrers, and the login return URL.
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    let value = fromLink;
    if (value) sessionStorage.setItem(TV_PAIR_STORAGE, JSON.stringify(value));
    else { try { const saved = JSON.parse(sessionStorage.getItem(TV_PAIR_STORAGE) || "null"); value = saved ? parsePairLink(new URLSearchParams({ id: saved.id, key: saved.approvalSecret }).toString()) : null; } catch { /* Invalid local request. */ } }
    if (!value) { setStatus("invalid"); return; }
    setPair(value);
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) { setAccount(data.user ? { id: data.user.id, email: data.user.email } : null); setStatus(data.user ? "checking" : "login"); } }).catch(() => { if (active) { setStatus("error"); setError("تعذّر التحقق من دخولك. تحقق من الإنترنت وأعد المحاولة."); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") { setAccount(null); setMatched(false); setStatus("login"); }
      else if (event === "SIGNED_IN" && session?.user) { setAccount({ id: session.user.id, email: session.user.email }); setStatus("checking"); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [retry]);
  const authCall = useCallback(async (action: "inspect" | "approve" | "deny") => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new TvPairError("سجّل دخولك على الجوال أولًا", 401, "unauthorized");
    return callTvPair(action, { ...pair }, token);
  }, [pair]);
  function handleError(err: unknown) {
    if (err instanceof TvPairError && err.status === 401) { setStatus("login"); return; }
    if (err instanceof TvPairError && [404, 409, 410].includes(err.status)) { setStatus("expired"); sessionStorage.removeItem(TV_PAIR_STORAGE); return; }
    setError(err instanceof Error ? err.message : "تعذّر الاتصال بالخدمة"); setStatus("error");
  }
  useEffect(() => {
    if (!pair || !account || status !== "checking") return;
    let active = true;
    authCall("inspect").then(result => {
      if (!active) return;
      setCode(result.code); setExpiresAt(result.expiresAt); setRemaining(Math.max(0, Math.ceil((Date.parse(result.expiresAt) - Date.now()) / 1000)));
      if (result.status === "pending") setStatus("ready");
      else { setStatus(result.status === "approved" || result.status === "consumed" ? "approved" : "denied"); sessionStorage.removeItem(TV_PAIR_STORAGE); }
    }).catch(err => { if (active) handleError(err); });
    return () => { active = false; };
  }, [pair, account, status, authCall]);
  useEffect(() => {
    if (status !== "ready" || !expiresAt) return;
    const timer = setInterval(() => { const left = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)); setRemaining(left); if (!left) { setStatus("expired"); sessionStorage.removeItem(TV_PAIR_STORAGE); } }, 1000);
    return () => clearInterval(timer);
  }, [status, expiresAt]);
  async function decide(action: "approve" | "deny") {
    if (busyRef.current || (action === "approve" && !matched)) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await authCall(action); sessionStorage.removeItem(TV_PAIR_STORAGE); setStatus(action === "approve" ? "approved" : "denied"); }
    catch (err) { handleError(err); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const loading = ["loading", "checking"].includes(status), done = status === "approved";
  return <main className="tv-approval" dir="rtl"><div className="tv-approval-shell">
    <header><img src="/logo-home.png" alt="شعار عائلة السيف" /><span>مجلس السيف<small>الدخول على التلفزيون</small></span></header>
    <section className="tv-approval-card" aria-busy={loading || busy}>
      <div className={`tv-approval-symbol ${done ? "is-done" : ""}`}>{done ? <Check /> : <Tv />}</div>
      <h1>{done ? "تلفزيونك جاهز" : status === "denied" ? "تم رفض الدخول" : status === "expired" || status === "invalid" ? "نحتاج رمزًا جديدًا" : "افتح مجلسك على التلفزيون"}</h1>
      {loading ? <p role="status"><RefreshCw className="tv-approval-spin" /> جارٍ التحقق من طلب الدخول…</p> : done ? <><p>تم السماح للتلفزيون بالدخول إلى حسابك.<br />ارجع للشاشة، وبيفتح المجلس تلقائيًا.</p><a className="tv-approval-primary" href="/dashboard">العودة إلى المجلس على الجوال</a></> : status === "denied" ? <><p>لن يتم تسجيل الدخول بهذا الطلب.</p><a className="tv-approval-secondary" href="/dashboard">العودة للمجلس</a></> : status === "expired" || status === "invalid" ? <><p>اضغط «إنشاء رمز جديد» في التلفزيون، ثم امسحه بكاميرا جوالك.</p><a className="tv-approval-secondary" href="/dashboard">العودة للمجلس</a></> : status === "login" ? <><p>سجّل دخولك بحساب العائلة على هذا الجوال، ثم نرجعك لصفحة الموافقة.</p><a className="tv-approval-primary" href="/auth?next=%2Ftv-login"><LogIn /> تسجيل الدخول بالجوال</a><p className="tv-approval-hint">لن تحتاج كتابة أي شيء على التلفزيون.</p></> : status === "ready" ? <>
        <p>طابق هذا الرقم مع الرقم الظاهر على تلفزيونك:</p><strong className="tv-approval-code" dir="ltr">{code.slice(0, 3)} {code.slice(3)}</strong>
        <p className="tv-approval-hint">صالح لـ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>
        <div className="tv-approval-account"><ShieldCheck /><span>الدخول باستخدام حسابك<strong dir="auto">{account?.email}</strong></span></div>
        <label className="tv-approval-match"><input type="checkbox" checked={matched} onChange={e => setMatched(e.target.checked)} disabled={busy} /><span>الرقم مطابق لشاشة التلفزيون الموجودة أمامي</span></label>
        <button type="button" className="tv-approval-primary" onClick={() => decide("approve")} disabled={!matched || busy}>{busy ? <RefreshCw className="tv-approval-spin" /> : <Check />} السماح بالدخول</button>
        <button type="button" className="tv-approval-secondary" onClick={() => decide("deny")} disabled={busy}><X /> رفض الطلب</button>
        <p className="tv-approval-hint">وافق فقط للتلفزيون الموجود أمامك. سيبقى حسابك مفتوحًا عليه حتى تسجّل خروجه.</p>
      </> : <><p role="alert">{error || "تعذّر الوصول لطلب الدخول"}</p><button type="button" className="tv-approval-primary" onClick={() => { setError(""); setStatus("loading"); setRetry(n => n + 1); }}><RefreshCw /> إعادة المحاولة</button></>}
    </section><footer><ShieldCheck /> كلمة مرورك تبقى عندك، وللتلفزيون جلسة دخول مستقلة</footer>
  </div></main>;
}
