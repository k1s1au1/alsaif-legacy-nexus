import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home, CalendarDays, UsersRound, Newspaper, GitBranch, Plane, ListChecks, Images,
  Settings, LayoutGrid, ArrowRight, ArrowLeft, MapPin, Clock3, Maximize2, X,
  RefreshCw, Check, CircleCheck, LogOut, ChevronLeft, ChevronRight, BookOpen,
  Bell, Wallet, LockKeyhole, MessageCircle, Lightbulb, UserRound, ImageOff,
} from "lucide-react";
import { getCurrentUser, supabase } from "@/integrations/supabase/client";
import { Preview as OccasionPreview } from "@/pages/family-occasions-page";
import { TermsGate, useTermsReady } from "@/components/terms-gate";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { parseThemePreference, getThemeColor, getCustomThemeTokens } from "@/lib/theme-preferences";
import { readableThemeInk } from "@/lib/theme-color-contrast";
import councilPhoto from "@/assets/council-oasis-night-wide-v2.webp";
import { clearPrivateImageCache, loadTvItems, PROFILE_FIELDS, setAttendance, signedImage } from "./data";
import { lineageIds, nearestInDirection, taskStage, tvDate, tvTime, type Direction, type TvItem, type TvView } from "./model";
import "./tv.css";

declare const __TV_PREVIEW__: boolean;
declare global { interface Window { alsaifTvBack?: () => boolean } }
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60000, refetchOnWindowFocus: true, refetchInterval: 5 * 60000, networkMode: "offlineFirst" } } });
const views = [
  ["home", "الرئيسية", Home], ["events", "مناسبات العائلة", CalendarDays],
  ["members", "ركن الأعضاء", UsersRound], ["news", "الأخبار", Newspaper],
  ["heritage", "نسب وأثر", GitBranch], ["trips", "الرحلات", Plane],
  ["meetings", "الاجتماعات", UsersRound], ["tasks", "المهام", ListChecks],
  ["albums", "الألبومات", Images], ["services", "كل الخدمات", LayoutGrid],
] as const;
const labels = Object.fromEntries(views.map(v => [v[0], v[1]]));
const pageSize = 6;
type Profile = { id: string; arabic_name?: string | null; full_name?: string | null; first_name?: string | null; avatar_url?: string | null; parent_id?: string | null };
const nameOf = (p?: Profile | null) => p?.arabic_name || p?.full_name || p?.first_name || "عضو العائلة";
const web = (path: string) => { if (__TV_PREVIEW__) { toast("هذه الخدمة تفتح صفحة الموقع داخل التطبيق"); return; } window.location.href = path; };

function Button({ children, onClick, id, secondary = false, disabled = false, pressed }: {
  children: ReactNode; onClick: () => void; id: string; secondary?: boolean; disabled?: boolean; pressed?: boolean;
}) { return <button type="button" data-tv-focus={id} className={`tv-button ${secondary ? "tv-button-secondary" : ""}`} onClick={onClick} disabled={disabled} aria-pressed={pressed}>{children}</button>; }

function Avatar({ person }: { person?: Profile | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let active = true; setUrl(""); const refresh = () => signedImage("avatars", person?.avatar_url).then(value => { if (active) setUrl(value); }); refresh(); const timer = window.setInterval(refresh, 50 * 60000); return () => { active = false; clearInterval(timer); }; }, [person?.avatar_url]);
  return <span className="tv-avatar">{url ? <img src={url} alt="" onError={() => setUrl("")} /> : <span>{nameOf(person)[0]}</span>}</span>;
}

function Photo({ src, alt, fallback = false }: { src?: string; alt: string; fallback?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="tv-image-empty">{fallback ? <img src={councilPhoto} alt="" /> : <><ImageOff aria-hidden="true" /><span>بدون صورة مرفقة</span></>}</span>;
  return <img className="tv-photo" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function Invitation({ item }: { item: TvItem }) {
  const box = useRef<HTMLDivElement>(null), [scale, setScale] = useState(1);
  useEffect(() => { const element = box.current; if (!element) return; const resize = () => setScale(element.clientWidth / 600); resize(); const observer = new ResizeObserver(resize); observer.observe(element); return () => observer.disconnect(); }, []);
  let extras: any = {};
  try { extras = JSON.parse(item.raw.details || "{}"); } catch { /* Legacy plain text has no design extras. */ }
  const supported = ["wedding", "newborn", "condolence", "graduation", "birthday", "promotion", "recovery", "gathering", "ramadan", "eid_fitr", "eid_adha"];
  const type = supported.includes(item.raw.type) ? item.raw.type : "gathering";
  return <div className="tv-invitation-render" ref={box}><div className="tv-invitation-canvas" style={{ transform: `scale(${scale})` }}><OccasionPreview type={type as ComponentProps<typeof OccasionPreview>["type"]}
    design={type === "condolence" ? 1 : Math.min(3, Math.max(1, Number(item.raw.design) || 1))}
    name={item.title} eventDate={item.date} time={item.time} location={item.place}
    birthDate={item.raw.birthDate} birthdayAudience={item.raw.birthdayAudience} x={extras && typeof extras === "object" ? extras : {}} show /></div></div>;
}

function Empty({ title = "لا يوجد محتوى لعرضه حاليًا" }: { title?: string }) { return <div className="tv-empty"><Images aria-hidden="true" /><h2>{title}</h2></div>; }
function Loading() { return <div className="tv-empty" role="status"><RefreshCw className="tv-spin" aria-hidden="true" /><p>جارٍ تحميل محتوى العائلة…</p></div>; }
function ErrorView({ retry }: { retry: () => void }) { return <div className="tv-empty" role="alert"><h2>تعذّر تحميل المحتوى</h2><p>تحقق من اتصال التلفزيون بالإنترنت</p><Button id="retry" onClick={retry}><RefreshCw /> إعادة المحاولة</Button></div>; }

function PageHead({ title, children }: { title: string; children?: ReactNode }) { return <div className="tv-page-head"><h1>{title}</h1><div className="tv-head-tools">{children}</div></div>; }
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  return <div className="tv-pager"><Button secondary id="page-before" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronRight /> السابق</Button><span aria-live="polite">{page + 1} / {total}</span><Button secondary id="page-after" disabled={page >= total - 1} onClick={() => onChange(page + 1)}>التالي <ChevronLeft /></Button></div>;
}

function Collection({ view, userId, profiles, onOpen, onTree, epoch }: {
  view: TvView; userId: string; profiles: Profile[]; onOpen: (item: TvItem) => void; onTree: () => void; epoch: number;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [view]);
  const query = useQuery({ queryKey: ["tv", userId, view], queryFn: () => loadTvItems(view, userId), refetchInterval: 5 * 60000 });
  const rows = query.data || [], count = view === "events" ? 3 : pageSize;
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / count) - 1));
  const shown = rows.slice(safePage * count, safePage * count + count);
  if (query.isPending) return <><PageHead title={labels[view] || "نسب وأثر"} /><Loading /></>;
  if (query.isError) return <><PageHead title={labels[view] || "المحتوى"} /><ErrorView retry={() => query.refetch()} /></>;
  if (view === "tasks") return <TaskBoard rows={rows} profiles={profiles} onOpen={onOpen} />;
  return <>
    <PageHead title={labels[view] || "العائلة"}>{view === "heritage" && <Button id="open-tree" secondary onClick={onTree}><GitBranch /> شجرة العائلة</Button>}</PageHead>
    {!rows.length ? <Empty /> : <div className={`tv-collection ${view === "events" ? "tv-event-posters" : ""} ${view === "meetings" ? "tv-meetings" : ""}`}>
      {shown.map(item => <button key={item.id} type="button" data-tv-focus={`item-${item.id}`} className={`tv-item ${view === "events" ? "tv-event-item" : ""}`} onClick={() => onOpen(item)}>
        {view === "events" ? <div className="tv-poster"><Invitation item={item} /></div> : view === "meetings" ? <div className="tv-date-art"><b>{tvDate(item.date, { day: "numeric", month: undefined })}</b><span>{tvDate(item.date, { day: undefined, month: "long" })}</span><UsersRound /></div> : <div className="tv-item-cover"><Photo src={item.image} alt={item.title} /></div>}
        <div className="tv-item-copy"><h2>{item.title}</h2><div className="tv-item-meta">{item.authorId && <Avatar person={profiles.find(p => p.id === item.authorId)} />}<span>{view === "meetings" ? item.archived ? "اجتماع سابق" : "اجتماع قادم" : item.place || (item.authorId ? nameOf(profiles.find(p => p.id === item.authorId)) : tvDate(item.date))}</span><ArrowLeft aria-hidden="true" /></div></div>
      </button>)}
    </div>}
    <Pager page={safePage} total={Math.ceil(rows.length / count)} onChange={setPage} />
  </>;
}

function TaskBoard({ rows, profiles, onOpen }: { rows: TvItem[]; profiles: Profile[]; onOpen: (item: TvItem) => void }) {
  const [pages, setPages] = useState<Record<string, number>>({ new: 0, doing: 0, done: 0 });
  return <><PageHead title="مهام العائلة" /><div className="tv-task-board">{[["new", "جديدة"], ["doing", "قيد التنفيذ"], ["done", "مكتملة"]].map(([stage, title]) => {
    const all = rows.filter(row => taskStage(row.progress || 0) === stage), page = Math.min(pages[stage] || 0, Math.max(0, Math.ceil(all.length / 2) - 1));
    return <section key={stage} className="tv-task-column"><h2>{title} <span>{all.length}</span></h2>{!all.length && <p className="tv-muted">لا توجد مهام</p>}{all.slice(page * 2, page * 2 + 2).map(row => <button type="button" key={row.id} data-tv-focus={`item-${row.id}`} className="tv-task" onClick={() => onOpen(row)}><h3>{row.title}</h3><div><Avatar person={profiles.find(p => p.id === row.authorId)} /><span>{row.authorId ? nameOf(profiles.find(p => p.id === row.authorId)) : "غير مسندة"}</span></div><div className="tv-progress" role="progressbar" aria-label="الإنجاز" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, Math.max(0, row.progress || 0))}%` }} /></div><small>{row.progress}% · {tvDate(row.date)}</small></button>)}{all.length > 2 && <Button secondary id={`tasks-next-${stage}`} onClick={() => setPages({ ...pages, [stage]: (page + 1) % Math.ceil(all.length / 2) })}>التالي · {page + 1} / {Math.ceil(all.length / 2)} <ChevronLeft /></Button>}</section>;
  })}</div></>;
}

function HomePage({ userId, name, onNavigate, onOpen }: { userId: string; name: string; onNavigate: (view: TvView) => void; onOpen: (item: TvItem, view: TvView) => void }) {
  const events = useQuery({ queryKey: ["tv", userId, "events"], queryFn: () => loadTvItems("events", userId) });
  const posts = useQuery({ queryKey: ["tv", userId, "members"], queryFn: () => loadTvItems("members", userId) });
  const trips = useQuery({ queryKey: ["tv", userId, "trips"], queryFn: () => loadTvItems("trips", userId) });
  const shortcuts: [TvView, string, TvItem | undefined][] = [["events", "مناسبات العائلة", events.data?.[0]], ["members", "من ركن الأعضاء", posts.data?.find(row => !!row.image)], ["trips", "رحلات العائلة", trips.data?.find(row => !!row.image)]];
  return <><PageHead title={`حياك الله، ${name.split(" ")[0]}`} /><section className="tv-home-hero"><img src={councilPhoto} alt="مجلس السيف في المساء" /><div><span>مجلس السيف</span><h2>أهلٌ وذكريات<br />تجمعنا</h2><Button id="home-services" onClick={() => onNavigate("services")}>خدمات العائلة <ArrowLeft /></Button></div></section><div className="tv-home-tiles">{shortcuts.map(([view, title, item]) => <button type="button" key={view} data-tv-focus={`home-${view}`} onClick={() => item ? onOpen(item, view) : onNavigate(view)}><div className={`tv-home-tile-image ${view === "events" && item ? "tv-home-invitation" : ""}`}>{item && view === "events" ? <Invitation item={item} /> : <Photo src={item?.image} alt={item?.title || title} fallback />}</div><span><b>{title}</b><small>{item?.title || "عرض القسم"}</small></span><ArrowLeft /></button>)}</div></>;
}

function FamilyTree({ profiles: accountProfiles, onClose }: { profiles: Profile[]; onClose: () => void }) {
  const extras = useQuery({ queryKey: ["tv-tree-extras"], queryFn: async () => { const { data, error } = await supabase.from("family_tree_extras" as any).select("*").order("first_name").limit(1000); if (error) throw error; return (data as any[] || []).map(row => ({ ...row, full_name: [row.first_name, row.father_name, row.grandfather_name].filter(Boolean).join(" ") })) as Profile[]; } });
  const profiles = [...accountProfiles, ...(extras.data || [])];
  const [centerId, setCenterId] = useState(profiles.find(p => !p.parent_id)?.id || profiles[0]?.id || "");
  const [page, setPage] = useState(0);
  useEffect(() => { if (!centerId && profiles.length) setCenterId(profiles.find(p => !p.parent_id)?.id || profiles[0].id); }, [centerId, profiles.length]);
  const center = profiles.find(p => p.id === centerId), children = profiles.filter(p => p.parent_id === centerId), parent = profiles.find(p => p.id === center?.parent_id);
  const roots = profiles.filter(p => !p.parent_id || !profiles.some(q => q.id === p.parent_id));
  const line = lineageIds(profiles, centerId).map(id => nameOf(profiles.find(p => p.id === id))).join(" ← ");
  return <><PageHead title="شجرة العائلة"><Button secondary id="tree-back" onClick={onClose}><ArrowRight /> نسب وأثر</Button></PageHead>{extras.isError && <p role="status" className="tv-muted">تعذّر تحميل بعض أفراد الشجرة. <button type="button" data-tv-focus="tree-retry" onClick={() => extras.refetch()}>إعادة المحاولة</button></p>}{!center ? extras.isPending ? <Loading /> : <Empty title="لا توجد بيانات للشجرة" /> : <section className="tv-tree"><p className="tv-lineage">{line}</p>{parent && <Button secondary id="tree-parent" onClick={() => { setCenterId(parent.id); setPage(0); }}>فرع {nameOf(parent)} <ArrowUpIcon /></Button>}<div className="tv-tree-root"><Avatar person={center} /><h2>{nameOf(center)}</h2></div><div className="tv-tree-children">{children.slice(page * 4, page * 4 + 4).map(p => <button type="button" key={p.id} data-tv-focus={`tree-${p.id}`} onClick={() => { setCenterId(p.id); setPage(0); }}><Avatar person={p} /><b>{nameOf(p)}</b><span>فتح الفرع <ChevronLeft /></span></button>)}</div>{!children.length && <p className="tv-muted">لا توجد فروع مسجلة لهذا العضو</p>}<Pager page={page} total={Math.ceil(children.length / 4)} onChange={setPage} />{roots.length > 1 && <div className="tv-root-pager"><Button secondary id="tree-next-root" onClick={() => { const next = (roots.findIndex(p => p.id === centerId) + 1) % roots.length; setCenterId(roots[next].id); setPage(0); }}>الفرع الرئيسي التالي <ChevronLeft /></Button></div>}</section>}</>;
}
function ArrowUpIcon() { return <GitBranch aria-hidden="true" />; }

function Attendance({ item, kind, userId }: { item: TvItem; kind: "events" | "meetings"; userId: string }) {
  const qc = useQueryClient(), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const queryKey = ["tv-attendance", userId, kind, item.id];
  const query = useQuery({ queryKey, queryFn: async () => {
    const table = kind === "events" ? "event_attendees" : "meeting_attendees", key = kind === "events" ? "event_id" : "meeting_id";
    const { data, error } = await supabase.from(table).select("user_id,rsvp").eq(key, item.id);
    if (error) throw error; return data || [];
  } });
  const mine = query.data?.find(row => row.user_id === userId)?.rsvp;
  async function respond(value: string) {
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const next = mine === value ? null : value;
      await setAttendance(kind, item.id, userId, next);
      await qc.invalidateQueries({ queryKey });
      setMessage(next === "going" ? "تم تأكيد حضورك" : next === "not_going" ? "تم تسجيل اعتذارك" : "تم إلغاء الرد");
    } catch { setMessage("تعذّر حفظ الرد، حاول مجددًا"); } finally { setSaving(false); }
  }
  if (item.archived) return null;
  return <div className="tv-attendance"><p>{query.isError ? "تعذّر تحميل قائمة الحضور" : `الحضور المؤكد: ${query.data?.filter(row => row.rsvp === "going").length ?? "…"}`}</p><div className="tv-actions"><Button id="attend-yes" disabled={saving || query.isPending || query.isError} pressed={mine === "going"} onClick={() => respond("going")}><Check />{mine === "going" ? "إلغاء تأكيد الحضور" : "سأحضر"}</Button><Button secondary id="attend-no" disabled={saving || query.isPending || query.isError} pressed={mine === "not_going"} onClick={() => respond("not_going")}>{mine === "not_going" ? "إلغاء الاعتذار" : "أعتذر"}</Button></div><p role="status">{saving ? "جارٍ الحفظ…" : message}</p></div>;
}

function TaskActions({ item, userId, canManage, onSaved }: { item: TvItem; userId: string; canManage: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const allowed = canManage || item.raw.assignee_id === userId || item.raw.created_by === userId;
  if (!allowed) return null;
  async function update(progress: number) {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.from("tasks").update({ progress, status: progress === 100 ? "done" : progress ? "in_progress" : "todo", completed_at: progress === 100 ? new Date().toISOString() : null } as any).eq("id", item.id).select("id,progress").single();
      if (error || data?.progress !== progress) throw error || new Error("Task progress was not saved");
      item.progress = progress; item.raw.progress = progress; setMessage("تم تحديث المهمة"); onSaved();
    } catch { setMessage("تعذّر حفظ حالة المهمة"); } finally { setBusy(false); }
  }
  return <div><div className="tv-actions">{item.progress === 0 && <Button id="task-start" disabled={busy} onClick={() => update(40)}>بدء التنفيذ</Button>}{(item.progress || 0) < 100 ? <Button id="task-complete" disabled={busy} onClick={() => update(100)}><CircleCheck /> إتمام المهمة</Button> : <Button id="task-reopen" secondary disabled={busy} onClick={() => update(0)}>إعادة فتح المهمة</Button>}</div><p role="status">{busy ? "جارٍ الحفظ…" : message}</p></div>;
}

function ItemDetail({ view, item, userId, profiles, canManage, onClose, onZoom, onSaved }: {
  view: TvView; item: TvItem; userId: string; profiles: Profile[]; canManage: boolean; onClose: () => void; onZoom: (index?: number) => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState("summary"), [photo, setPhoto] = useState(0);
  const hasPhoto = view === "events" || !!item.image;
  return <div className="tv-overlay"><section className={`tv-detail ${hasPhoto ? "tv-detail-with-image" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tv-detail-title" data-tv-scope>
    <button type="button" className="tv-icon-button tv-close" data-tv-focus="detail-close" onClick={onClose} aria-label="إغلاق"><X /></button>
    {hasPhoto && <div className={`tv-detail-image ${view === "events" ? "tv-detail-invitation" : ""}`}>{view === "events" ? <Invitation item={item} /> : <Photo src={item.images?.[photo] || item.image} alt={item.title} />}<div className="tv-image-controls"><Button secondary id="detail-zoom" onClick={() => onZoom(photo)}><Maximize2 /> تكبير {view === "events" ? "الدعوة" : "الصورة"}</Button>{(item.images?.length || 0) > 1 && <Button secondary id="detail-photo-next" onClick={() => setPhoto((photo + 1) % item.images!.length)}>الصورة {photo + 1} / {item.images!.length} <ChevronLeft /></Button>}</div></div>}
    <div className="tv-detail-copy" data-tv-scroll><span className="tv-eyebrow">{labels[view]}</span><h1 id="tv-detail-title">{item.title}</h1>{item.authorId && <div className="tv-author"><Avatar person={profiles.find(p => p.id === item.authorId)} /><span>{nameOf(profiles.find(p => p.id === item.authorId))}</span></div>}
      <div className="tv-facts">{item.date && <span><CalendarDays />{tvDate(item.date)}</span>}{(view === "events" && item.time || view === "meetings") && <span><Clock3 />{tvTime(item.date, item.time)}</span>}{item.place && <span><MapPin />{item.place}</span>}</div>
      {view === "meetings" && <div className="tv-actions"><Button id="meeting-agenda" secondary pressed={tab === "summary"} onClick={() => setTab("summary")}>جدول الأعمال</Button><Button id="meeting-minutes" secondary pressed={tab === "minutes"} onClick={() => setTab("minutes")}>المحضر</Button></div>}
      {view !== "events" && <p className="tv-body-text">{view === "meetings" && tab === "minutes" ? item.raw.minutes || "المحضر غير متاح بعد" : item.body || (view === "tasks" ? "لا توجد تفاصيل إضافية لهذه المهمة" : "")}</p>}
      {(view === "events" || view === "meetings") && <Attendance item={item} kind={view} userId={userId} />}
      {view === "tasks" && <><div className="tv-progress" role="progressbar" aria-label="الإنجاز" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${item.progress || 0}%` }} /></div><p>{item.progress}% مكتملة</p><TaskActions item={item} userId={userId} canManage={canManage} onSaved={onSaved} /></>}
      {view === "trips" && <Button id="trip-details" onClick={() => web(`/trips/${encodeURIComponent(item.id)}`)}>البرنامج والتسجيل <ArrowLeft /></Button>}
    </div>
  </section></div>;
}

function ImageViewer({ item, view, startPhoto, onClose }: { item: TvItem; view: TvView; startPhoto: number; onClose: () => void }) {
  const [zoom, setZoom] = useState(1), [index, setIndex] = useState(startPhoto);
  const scroll = useRef<HTMLDivElement>(null), images = item.images?.length ? item.images : [item.image || ""];
  useEffect(() => { const panel = scroll.current; if (panel) { panel.scrollTop = (panel.scrollHeight - panel.clientHeight) / 2; panel.scrollLeft = (panel.scrollWidth - panel.clientWidth) / 2; } }, [zoom, index]);
  return <div className="tv-overlay tv-viewer" role="dialog" aria-modal="true" aria-label={item.title} data-tv-scope><div className="tv-viewer-bar"><h2>{item.title}</h2><div className="tv-actions"><Button secondary id="viewer-zoom" onClick={() => setZoom(zoom === 1 ? 1.5 : zoom === 1.5 ? 2 : 1)}><Maximize2 />{zoom === 1 ? "تكبير" : `${Math.round(zoom * 100)}٪`}</Button>{view !== "events" && images.length > 1 && <Button secondary id="viewer-next" onClick={() => setIndex((index + 1) % images.length)}>التالي <ChevronLeft /></Button>}<Button secondary id="viewer-close" onClick={onClose}><X /> إغلاق</Button></div></div><div className="tv-viewer-scroll" data-tv-scroll ref={scroll} data-pan={zoom > 1 ? "true" : undefined}><div className={`tv-viewer-content ${view === "events" ? "tv-viewer-invitation" : ""}`} style={{ width: zoom === 1 ? "100%" : `${zoom * 100}%`, height: `${zoom * 100}%` }}>{view === "events" ? <Invitation item={item} /> : <img src={images[index]} alt={item.title} />}</div></div></div>;
}

function Services({ navigate }: { navigate: (view: TvView) => void }) {
  const extra = [["الصندوق المالي", "/finance", Wallet], ["الصلاة ومصحفي", "/faith", BookOpen], ["الدردشة", "/chat", MessageCircle], ["الخزنة", "/vault", LockKeyhole], ["الاقتراحات", "/suggestions", Lightbulb], ["الإشعارات", "/notifications", Bell]] as const;
  return <><PageHead title="خدمات العائلة" /><div className="tv-services">{views.filter(v => !["home", "services"].includes(v[0])).map(([view, title, Icon]) => <button type="button" data-tv-focus={`service-${view}`} key={view} onClick={() => navigate(view)}><Icon /><span>{title}</span></button>)}{extra.map(([title, path, Icon]) => <button type="button" data-tv-focus={`service-${path}`} key={path} onClick={() => web(path)}><Icon /><span>{title}</span></button>)}</div></>;
}

function TvApp({ userId }: { userId: string }) {
  const termsReady = useTermsReady();
  const [view, setView] = useState<TvView>("home"), [detail, setDetail] = useState<{ item: TvItem; view: TvView } | null>(null), [viewer, setViewer] = useState<number | null>(null), [tree, setTree] = useState(false), [epoch, setEpoch] = useState(0), [clock, setClock] = useState(() => tvTime(new Date().toISOString()));
  const root = useRef<HTMLDivElement>(null), main = useRef<HTMLElement>(null), stack = useRef<TvView[]>([]), restoreKey = useRef<string | null>(null), qc = useQueryClient();
  const logo = useSiteLogo();
  const profile = useQuery({ queryKey: ["tv-profile", userId], queryFn: async () => { const { data, error } = await supabase.from("profiles").select("id,arabic_name,full_name,avatar_url,theme_color").eq("id", userId).single(); if (error) throw error; return data; } });
  const directory = useQuery({ queryKey: ["tv-directory", userId], queryFn: async () => { const { data, error } = await supabase.from("profiles").select(PROFILE_FIELDS).order("created_at").limit(1000); if (error) throw error; return data as Profile[]; } });
  const roles = useQuery({ queryKey: ["tv-roles", userId], queryFn: async () => { const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId); if (error) throw error; return data || []; } });
  const canManage = !!roles.data?.some(row => ["admin", "chairman", "manager"].includes(row.role));
  const profiles = directory.data || [];
  const navigate = useCallback((next: TvView) => { setDetail(null); setViewer(null); setTree(false); if (next !== view) stack.current.push(view); setView(next); main.current?.scrollTo(0, 0); restoreKey.current = null; setEpoch(n => n + 1); }, [view]);
  const open = (item: TvItem, from: TvView = view) => { restoreKey.current = (document.activeElement as HTMLElement)?.dataset.tvFocus || null; setDetail({ item, view: from }); setViewer(null); };
  const closeDetail = () => { setDetail(null); setViewer(null); setEpoch(n => n + 1); };
  const back = useCallback(() => { if (viewer !== null) { setViewer(null); return true; } if (detail) { closeDetail(); return true; } if (tree) { setTree(false); return true; } const previous = stack.current.pop(); if (previous) { setView(previous); setEpoch(n => n + 1); return true; } if (view !== "home") { setView("home"); return true; } return false; }, [viewer, detail, tree, view]);
  useEffect(() => { window.alsaifTvBack = back; return () => { delete window.alsaifTvBack; }; }, [back]);
  useEffect(() => { const timer = window.setInterval(() => setClock(tvTime(new Date().toISOString())), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const preference = parseThemePreference(profile.data?.theme_color), base = getThemeColor(preference.mode === "preset" ? preference.presetId : preference.baseId);
    const tokens = preference.mode === "custom" ? getCustomThemeTokens(preference, true) : {};
    const bg = tokens["--background"] || base.darkSpace, surface = tokens["--card"] || base.darkSoft, accent = tokens["--primary"] || base.secondary;
    const color = (key: string, value: string) => root.current?.style.setProperty(key, value);
    const nav = tokens["--nav-bg"] || base.darkNavBg;
    color("--tv-bg", bg); color("--tv-surface", surface); color("--tv-nav", nav);
    color("--tv-ink", readableThemeInk(tokens["--foreground"] || base.foreground, bg, 7));
    color("--tv-card-ink", readableThemeInk(tokens["--foreground"] || base.foreground, surface, 7));
    color("--tv-nav-ink", readableThemeInk(tokens["--identity-text-on-nav"] || base.foreground, nav, 7));
    color("--tv-nav-accent", readableThemeInk(accent, nav, 4.5));
    color("--tv-accent", readableThemeInk(accent, bg, 4.5)); color("--tv-button", accent); color("--tv-button-ink", readableThemeInk(tokens["--primary-foreground"] || base.navBg, accent, 7));
  }, [profile.data?.theme_color]);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const focusFirst = () => {
      const scope = !termsReady ? element.nextElementSibling as HTMLElement | null : element.querySelector<HTMLElement>("[data-tv-scope]") || element;
      if (!scope) return;
      const current = document.activeElement;
      if (current instanceof HTMLElement && scope.contains(current) && current.matches("button:not(:disabled),a[href],input")) return;
      const candidates = Array.from(scope.querySelectorAll<HTMLElement>(termsReady ? "[data-tv-focus]:not(:disabled)" : "button:not(:disabled),input:not(:disabled)"));
      const desired = !detail && restoreKey.current ? candidates.find(button => button.dataset.tvFocus === restoreKey.current) : null;
      const target = desired || (detail ? candidates.find(b => b.dataset.tvFocus === (viewer !== null ? "viewer-zoom" : "detail-zoom")) : candidates.find(b => !b.closest("aside"))) || candidates[0];
      target?.focus({ preventScroll: true });
    };
    const observer = new MutationObserver(() => requestAnimationFrame(focusFirst)); observer.observe(element, { childList: true, subtree: true });
    const timer = requestAnimationFrame(focusFirst); return () => { observer.disconnect(); cancelAnimationFrame(timer); };
  }, [view, detail, viewer, tree, epoch, termsReady]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLInputElement && !["checkbox", "radio"].includes(event.target.type))) return;
      if (event.key === "Escape" || event.key === "Backspace") { if (back()) event.preventDefault(); return; }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const scope = !termsReady ? root.current?.nextElementSibling as HTMLElement | null : root.current?.querySelector<HTMLElement>("[data-tv-scope]") || root.current;
      if (!scope) return;
      const pan = scope.querySelector<HTMLElement>('[data-pan="true"]');
      if (pan && (document.activeElement as HTMLElement)?.dataset.tvFocus === "viewer-zoom") { event.preventDefault(); pan.scrollBy({ left: event.key === "ArrowRight" ? 160 : event.key === "ArrowLeft" ? -160 : 0, top: event.key === "ArrowDown" ? 160 : event.key === "ArrowUp" ? -160 : 0, behavior: "auto" }); return; }
      const buttons = Array.from(scope.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled)"))
        .filter(button => { const r = button.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !button.closest("[inert]"); });
      const index = buttons.indexOf(document.activeElement as HTMLElement), next = nearestInDirection(buttons.map(button => button.getBoundingClientRect()), index, event.key as Direction);
      event.preventDefault();
      if (next >= 0) { buttons[next].focus({ preventScroll: true }); buttons[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") { const scrollable = scope.querySelector<HTMLElement>("[data-tv-scroll]") || main.current; scrollable?.scrollBy({ top: event.key === "ArrowDown" ? 150 : -150, behavior: "auto" }); }
    };
    document.addEventListener("keydown", handle); return () => document.removeEventListener("keydown", handle);
  }, [back, termsReady]);
  async function signOut() { await supabase.auth.signOut(); clearPrivateImageCache(); qc.clear(); web("/auth?next=%2Ftv-app%2Findex.html"); }
  const overlay = detail !== null;
  return <div className="tv-app" ref={root} dir="rtl" inert={!termsReady || undefined}>
    <aside className="tv-sidebar" inert={overlay || undefined}><div className="tv-brand"><img src={logo || "/logo-home.png"} alt="شعار عائلة السيف" /><span>مجلس السيف<small>العائلة أقرب</small></span></div><nav aria-label="أقسام العائلة">{views.map(([next, title, Icon]) => <button type="button" key={next} data-tv-focus={`nav-${next}`} aria-current={view === next ? "page" : undefined} onClick={() => navigate(next)}><Icon /><span>{title}</span></button>)}</nav><button type="button" className="tv-settings-link" data-tv-focus="nav-settings" onClick={() => navigate("settings")}><Settings /><span>الإعدادات</span></button></aside>
    <div className="tv-window" inert={overlay || undefined}><header className="tv-top"><div className="tv-account"><Avatar person={profile.data} /><span>{nameOf(profile.data)}</span></div><span className="tv-clock"><Clock3 />{clock}</span></header><main className="tv-main" ref={main} data-tv-scroll>
      {view === "home" ? <HomePage userId={userId} name={nameOf(profile.data)} onNavigate={navigate} onOpen={open} /> : view === "services" ? <Services navigate={navigate} /> : view === "settings" ? <><PageHead title="إعدادات التلفزيون" /><div className="tv-settings"><section><Settings /><h2>ألوان هويتك</h2><p>تُستخدم ألوان حسابك المحفوظة مع درجات واضحة للشاشة الكبيرة.</p><Button id="settings-colors" onClick={() => web("/settings")}>تخصيص ألوان الموقع <ArrowLeft /></Button></section><section><UserRound /><h2>حساب العائلة</h2><p>{nameOf(profile.data)}</p><Button secondary id="settings-refresh" onClick={() => { qc.invalidateQueries(); setEpoch(n => n + 1); }}><RefreshCw />تحديث المحتوى</Button><Button secondary id="settings-logout" onClick={signOut}><LogOut /> تسجيل الخروج</Button></section></div></> : tree ? directory.isError ? <ErrorView retry={() => directory.refetch()} /> : directory.isPending ? <Loading /> : <FamilyTree profiles={profiles} onClose={() => setTree(false)} /> : <Collection key={view} view={view} userId={userId} profiles={profiles} onOpen={item => open(item)} onTree={() => setTree(true)} epoch={epoch} />}
    </main><footer className="tv-footer"><span>الأسهم للتنقل · OK للاختيار · رجوع للعودة</span><span>{__TV_PREVIEW__ ? "صور وقوالب أصلية · بيانات توضيحية" : "مجلس السيف للتلفزيون"}</span></footer></div>
    {detail && viewer === null && <ItemDetail key={`${detail.view}:${detail.item.id}`} view={detail.view} item={detail.item} userId={userId} profiles={profiles} canManage={canManage} onClose={closeDetail} onZoom={(index = 0) => setViewer(index)} onSaved={() => { qc.invalidateQueries({ queryKey: ["tv", userId, "tasks"] }); setEpoch(n => n + 1); }} />}
    {detail && viewer !== null && <ImageViewer key={detail.item.id} view={detail.view} item={detail.item} startPhoto={viewer} onClose={() => setViewer(null)} />}
  </div>;
}

function Entry() {
  const [userId, setUserId] = useState<string | null>(null), [failed, setFailed] = useState(false);
  const check = useCallback(async () => {
    setFailed(false);
    try { const { data, error } = await getCurrentUser(); if (error) throw error; if (data.user) setUserId(data.user.id); else web("/auth?next=%2Ftv-app%2Findex.html"); } catch { setFailed(true); }
  }, []);
  useEffect(() => { check(); const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") { clearPrivateImageCache(); client.clear(); setUserId(null); web("/auth?next=%2Ftv-app%2Findex.html"); } }); return () => data.subscription.unsubscribe(); }, [check]);
  if (failed) return <div className="tv-app tv-entry"><ErrorView retry={check} /></div>;
  if (!userId) return <div className="tv-app tv-entry"><Loading /></div>;
  return <TermsGate><TvApp userId={userId} /></TermsGate>;
}

createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Entry /><Toaster theme="dark" position="top-center" /></QueryClientProvider>);
