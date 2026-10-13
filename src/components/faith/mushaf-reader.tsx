import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, BookmarkCheck, ExternalLink, Loader2, Maximize, Minus, Plus, RefreshCw, X } from "lucide-react";
import { MUSHAF_PAGE_COUNT, MUSHAF_SOURCE, mushafPageLabel, mushafPageUrl, mushafSpread } from "@/lib/mushaf";

export function MushafReader({ initialPage, onClose, onRead }: { initialPage: number; onClose: () => void; onRead: (page: number) => void }) {
  const [page, setPage] = useState(initialPage);
  const [double, setDouble] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [input, setInput] = useState(String(initialPage));
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState<number[]>([]);
  const [failed, setFailed] = useState<number[]>([]);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const pages = mushafSpread(page, double);
  const lastVisible = pages[pages.length - 1];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setDouble(entry.contentRect.width >= 800));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setInput(String(page)); setMessage(""); }, [page]);

  const move = (direction: number) => {
    const destination = double ? pages[0] + direction * 2 : page + direction;
    if (destination >= 1 && destination <= MUSHAF_PAGE_COUNT) setPage(destination);
  };
  const keyDown = (event: KeyboardEvent) => {
    const tag = (event.target as HTMLElement).tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); move(1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(-1); }
  };
  const jump = () => {
    const normalized = input.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0));
    const requested = Number(normalized);
    if (Number.isInteger(requested) && requested >= 1 && requested <= MUSHAF_PAGE_COUNT) setPage(requested);
    else setMessage("أدخل رقم صفحة من ١ إلى ٦٠٤");
  };
  return <section ref={root} className="mushaf-reader" dir="rtl" tabIndex={0} onKeyDown={keyDown} aria-label="قراءة مصحفي">
    <div className="mushaf-toolbar">
      <div><strong>مصحفي</strong><small>{mushafPageLabel(page)}</small></div>
      <div className="faith-button-row">
        <button type="button" className="faith-icon-button" onClick={() => setZoom((value) => Math.max(100, value - 25))} disabled={zoom === 100} aria-label="تصغير الصفحة"><Minus size={19} /></button>
        <span className="mushaf-zoom" aria-live="polite">{new Intl.NumberFormat("ar-SA").format(zoom)}٪</span>
        <button type="button" className="faith-icon-button" onClick={() => setZoom((value) => Math.min(225, value + 25))} disabled={zoom === 225} aria-label="تكبير الصفحة"><Plus size={19} /></button>
        {typeof document !== "undefined" && document.fullscreenEnabled && <button type="button" className="faith-icon-button" aria-label="ملء الشاشة" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.current?.requestFullscreen().catch(() => undefined); }}><Maximize size={19} /></button>}
        <button type="button" className="faith-icon-button" onClick={onClose} aria-label="الرجوع إلى فهرس مصحفي"><X size={20} /></button>
      </div>
    </div>
    <div className="mushaf-pan" tabIndex={0} aria-label="صفحات المصحف المصورة؛ يمكن التكبير والتمرير">
      <div className={`mushaf-pages${double ? " is-spread" : ""}`} style={{ width: `${zoom}%` }}>
        {pages.map((number) => <figure key={`${number}:${retry}`} className="mushaf-page-image">
          {!loaded.includes(number) && !failed.includes(number) && <div className="mushaf-page-loading" role="status"><Loader2 className="animate-spin" size={24} /><span>تحميل الصفحة من المصدر الرسمي…</span></div>}
          {failed.includes(number) ? <div className="mushaf-page-error" role="alert"><p>تعذر تحميل الصفحة. تحقق من الاتصال ثم أعد المحاولة.</p><button type="button" className="faith-button" onClick={() => { setLoaded([]); setFailed([]); setRetry((value) => value + 1); }}><RefreshCw size={17} /> إعادة المحاولة</button><a href={mushafPageUrl(number)} target="_blank" rel="noopener noreferrer">عرض الصفحة من المصدر الرسمي <ExternalLink size={15} /></a></div> : <img
            src={mushafPageUrl(number)}
            alt={`الصفحة ${new Intl.NumberFormat("ar-SA").format(number)} من مصحف المدينة؛ المصدر جامعة الملك سعود`}
            onLoad={() => { setLoaded((value) => value.includes(number) ? value : [...value, number]); if (number === page) onRead(page); }}
            onError={() => setFailed((value) => value.includes(number) ? value : [...value, number])}
            decoding="async"
            draggable={false}
            style={{ visibility: loaded.includes(number) ? "visible" : "hidden" }}
          />}
          <figcaption>صفحة {new Intl.NumberFormat("ar-SA").format(number)}</figcaption>
        </figure>)}
      </div>
    </div>
    <div className="mushaf-navigation">
      <button type="button" className="faith-button faith-button-outline" onClick={() => move(-1)} disabled={pages[0] === 1}><ArrowRight size={18} /> السابق</button>
      <form onSubmit={(event) => { event.preventDefault(); jump(); }} className="mushaf-page-jump">
        <label htmlFor="mushaf-page-input">صفحة</label>
        <input id="mushaf-page-input" inputMode="numeric" type="text" value={input} onChange={(event) => setInput(event.target.value)} aria-describedby="mushaf-page-total" />
        <span id="mushaf-page-total">من ٦٠٤</span>
        <button type="submit" className="faith-icon-button" aria-label="الانتقال إلى الصفحة"><ArrowLeft size={17} /></button>
      </form>
      <button type="button" className="faith-button" onClick={() => move(1)} disabled={lastVisible === MUSHAF_PAGE_COUNT}>التالي <ArrowLeft size={18} /></button>
    </div>
    {message && <p className="faith-message" role="alert">{message}</p>}
    {loaded.includes(page) && !failed.includes(page) && <p className="mushaf-reading-saved"><BookmarkCheck size={15} /> يُحفظ آخر موضع قراءة تلقائيًا على هذا الجهاز.</p>}
    <p className="mushaf-source-footer"><a href={MUSHAF_SOURCE.url} target="_blank" rel="noopener noreferrer">المصدر: {MUSHAF_SOURCE.name} <ExternalLink size={13} /></a><span>الصفحات التي فتحتها تُحفظ دون إنترنت عند تفعيل نسخة الموقع المثبتة.</span></p>
  </section>;
}
