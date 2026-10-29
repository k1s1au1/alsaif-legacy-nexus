import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, RefreshCw, Smartphone, ShieldCheck, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callTvPair, newPairSecret, pairingUrl, TvPairError, type TvPairRequest } from "@/lib/tv-pairing";
import councilPhoto from "@/assets/council-oasis-night-wide-v2.webp";

const STORAGE = "alsaif-tv-device-pair-v1";
export function TvSignIn({ onSignedIn }: { onSignedIn: (id: string) => void }) {
  const [attempt, setAttempt] = useState(0), [pair, setPair] = useState<TvPairRequest | null>(null), [qr, setQr] = useState("");
  const [state, setState] = useState<"starting" | "waiting" | "connecting" | "expired" | "denied" | "failed">("starting");
  const [error, setError] = useState(""), [remaining, setRemaining] = useState(300), [reconnecting, setReconnecting] = useState(false);
  const refresh = useRef<HTMLButtonElement>(null), signedIn = useRef(onSignedIn); signedIn.current = onSignedIn;
  useEffect(() => { if (state !== "starting" && state !== "connecting") refresh.current?.focus({ preventScroll: true }); }, [state]);
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>, current: TvPairRequest | null = null;
    const controller = new AbortController();
    const call = (action: Parameters<typeof callTvPair>[0], body: Record<string, unknown>) => callTvPair(action, body, undefined, controller.signal);
    setState("starting"); setError(""); setQr(""); setPair(null); setReconnecting(false);
    async function poll() {
      if (!active || !current) return;
      if (Date.parse(current.expiresAt) <= Date.now()) { sessionStorage.removeItem(STORAGE); setState("expired"); return; }
      if (document.visibilityState === "hidden") { timer = setTimeout(poll, 3000); return; }
      try {
        const result = await call("status", { id: current.id, deviceSecret: current.deviceSecret });
        if (!active) return;
        setReconnecting(false);
        if (result.status === "approved") {
          setState("connecting"); setQr("");
          sessionStorage.removeItem(STORAGE);
          // A fresh one-use Auth token creates this television's own session.
          const claim = await call("claim", { id: current.id, deviceSecret: current.deviceSecret });
          if (!active) return;
          const { data, error: authError } = await supabase.auth.verifyOtp({ token_hash: claim.tokenHash, type: "email" });
          if (authError || !data.user || !data.session) throw new Error("تعذّر إكمال الدخول. اطلب رمزًا جديدًا وحاول مرة أخرى.");
          if (active) signedIn.current(data.user.id);
          return;
        }
        if (result.status === "denied" || result.status === "consumed") { sessionStorage.removeItem(STORAGE); setState(result.status === "denied" ? "denied" : "expired"); return; }
      } catch (err) {
        if (!active) return;
        if (err instanceof TvPairError && [404, 409, 410].includes(err.status)) { sessionStorage.removeItem(STORAGE); setState("expired"); return; }
        if (err instanceof TvPairError && err.status === 403) { sessionStorage.removeItem(STORAGE); setError(err.message); setState("failed"); return; }
        // If an approved claim or Auth exchange failed, the one-use request must be replaced.
        if (current && !sessionStorage.getItem(STORAGE)) { setError(err instanceof Error ? err.message : "تعذّر إكمال الدخول"); setState("failed"); return; }
        setReconnecting(true);
      }
      if (active) timer = setTimeout(poll, 3000);
    }
    void (async () => {
      try {
        let saved: TvPairRequest | null = null;
        try { saved = JSON.parse(sessionStorage.getItem(STORAGE) || "null"); } catch { /* Start a clean request. */ }
        if (saved && Date.parse(saved.expiresAt) > Date.now() + 5000 && saved.deviceSecret && saved.approvalSecret) current = saved;
        else {
          const deviceSecret = newPairSecret(), approvalSecret = newPairSecret();
          const result = await call("start", { deviceSecret, approvalSecret });
          current = { ...result, deviceSecret, approvalSecret };
          if (!active) return;
          sessionStorage.setItem(STORAGE, JSON.stringify(current));
        }
        const url = pairingUrl(window.location.origin, current!);
        const image = await QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: "M", color: { dark: "#071c19", light: "#ffffff" } });
        if (!active) return;
        setPair(current); setQr(image); setState("waiting"); setRemaining(Math.max(0, Math.ceil((Date.parse(current!.expiresAt) - Date.now()) / 1000)));
        timer = setTimeout(poll, 3000);
      } catch (err) {
        if (active) { setError(err instanceof Error ? err.message : "تعذّر تجهيز رمز الدخول"); setState("failed"); }
      }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [attempt]);
  useEffect(() => {
    if (!pair || state !== "waiting") return;
    const timer = setInterval(() => { const seconds = Math.max(0, Math.ceil((Date.parse(pair.expiresAt) - Date.now()) / 1000)); setRemaining(seconds); if (!seconds) { setState("expired"); setQr(""); sessionStorage.removeItem(STORAGE); } }, 1000);
    return () => clearInterval(timer);
  }, [pair, state]);
  function renew() {
    if (pair) void callTvPair("cancel", { id: pair.id, deviceSecret: pair.deviceSecret }).catch(() => undefined);
    sessionStorage.removeItem(STORAGE); setAttempt(n => n + 1);
  }
  const closed = ["expired", "denied", "failed"].includes(state);
  return <div className="tv-app tv-login" dir="rtl">
    <img className="tv-login-scenery" src={councilPhoto} alt="" />
    <header className="tv-login-brand"><img src="/logo-home.png" alt="شعار عائلة السيف" /><span>مجلس السيف<small>مساحة العائلة على شاشتك</small></span><span className="tv-login-device"><Tv /> تطبيق التلفزيون</span></header>
    <main className="tv-login-content">
      <section className="tv-login-copy"><span className="tv-login-eyebrow"><Smartphone /> الدخول من جوالك</span><h1>جوالك يفتح لك المجلس</h1><p className="tv-login-lead">امسح الرمز ووافق من جوالك.<br />ويفتح حسابك هنا تلقائيًا.</p>
        <ol><li><span>١</span><div>افتح كاميرا الجوال<small>ووجّهها إلى رمز QR</small></div></li><li><span>٢</span><div>افتح الرابط وسجّل دخولك<small>إذا كنت داخل حسابك، انتقل مباشرة للموافقة</small></div></li><li><span>٣</span><div>طابق الرقم واضغط «السماح بالدخول»<small>تأكد أنه نفس الرقم الظاهر على هذا التلفزيون</small></div></li></ol>
        <p className="tv-login-note"><ShieldCheck /> لا تحتاج تكتب بريدك أو كلمة مرورك بالريموت</p>
      </section>
      <section className="tv-login-panel" aria-label="رمز الدخول من الجوال">
        <h2>{state === "connecting" ? "تمت الموافقة" : "امسح الرمز بجوالك"}</h2>
        <div className="tv-login-qr">{state === "waiting" && qr ? <img src={qr} alt="رمز QR لفتح صفحة الموافقة على دخول هذا التلفزيون" /> : <div className="tv-login-qr-state">{state === "connecting" ? <Check /> : closed ? <Tv /> : <RefreshCw className="tv-spin" />}<p>{state === "connecting" ? "جارٍ فتح مجلسك…" : state === "expired" ? "انتهت صلاحية الرمز" : state === "denied" ? "تم رفض طلب الدخول" : state === "failed" ? "تعذّر تجهيز الدخول" : "جارٍ تجهيز الرمز…"}</p></div>}</div>
        {state === "waiting" && pair && <><p className="tv-login-code-label">رقم المطابقة</p><strong className="tv-login-code" dir="ltr">{pair.code.slice(0, 3)} {pair.code.slice(3)}</strong><p className="tv-login-countdown">يتجدد عند الطلب · صالح لـ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p></>}
        <p className="tv-login-status" role="status">{error || (reconnecting ? "جارٍ إعادة الاتصال…" : state === "waiting" ? "بانتظار موافقتك على الجوال" : state === "connecting" ? "أهلًا بك في مجلس السيف" : "")}</p>
        <button ref={refresh} type="button" className="tv-button tv-button-secondary" onClick={renew} disabled={state === "starting" || state === "connecting"}><RefreshCw /> {closed ? "إنشاء رمز جديد" : "تحديث الرمز"}</button>
      </section>
    </main><footer className="tv-login-footer">مجلس السيف · الدخول خاص بأعضاء العائلة</footer>
  </div>;
}
