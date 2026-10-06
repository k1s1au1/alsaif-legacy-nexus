import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  MoreVertical,
  Pin,
  PinOff,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ALBUM_BOOK_QUERY,
  albumCaption,
  albumDate,
  albumPageSize,
  albumPosition,
  albumSpread,
  albumTurnTarget,
  albumYears,
  filterAlbumItems,
} from "@/lib/family-album";
import type { AlbumItem, AlbumLayout, AlbumSectionKey, TurnDirection } from "@/lib/family-album";
import "./family-album-book.css";

type Section = {
  key: AlbumSectionKey;
  label: string;
  icon: import("lucide-react").LucideIcon;
  hint: string;
};
type PhotoActions = {
  canManage: (item: AlbumItem) => boolean;
  onView: (item: AlbumItem) => void;
  onTogglePin: (item: AlbumItem) => void;
  onDelete: (item: AlbumItem) => void;
};
type Props = PhotoActions & {
  items: AlbumItem[];
  sections: Section[];
  counts: Record<AlbumSectionKey, number>;
  activeSection: AlbumSectionKey;
  onSectionChange: (section: AlbumSectionKey) => void;
  canUpload: boolean;
  uploading: boolean;
  loading: boolean;
  onUpload: () => void;
};

function useAlbumLayout() {
  const [layout, setLayout] = useState<AlbumLayout>("phone");
  useEffect(() => {
    const book = window.matchMedia(ALBUM_BOOK_QUERY);
    const phone = window.matchMedia("(max-width: 600px)");
    const update = () => setLayout(book.matches ? "book" : phone.matches ? "phone" : "page");
    update();
    book.addEventListener("change", update);
    phone.addEventListener("change", update);
    return () => {
      book.removeEventListener("change", update);
      phone.removeEventListener("change", update);
    };
  }, []);
  return layout;
}

type Turn = { from: number; to: number; direction: TurnDirection; token: number };

export function FamilyAlbumBook(props: Props) {
  const {
    items,
    sections,
    counts,
    activeSection,
    onSectionChange,
    canUpload,
    uploading,
    loading,
    onUpload,
  } = props;
  const layout = useAlbumLayout();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [anchor, setAnchor] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnToken = useRef(0);
  const turnBusy = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const pageSize = albumPageSize(layout);
  const years = useMemo(() => albumYears(items), [items]);
  const filtered = useMemo(() => filterAlbumItems(items, query, year), [items, query, year]);
  const { page, pages } = albumPosition(filtered.length, pageSize, anchor);
  const section = sections.find((s) => s.key === activeSection)!;
  // Signed URL refreshes don't reset a reader, but additions, reordering and
  // deletions must cancel an old leaf before it can commit the wrong spread.
  const contentKey = filtered.map((item) => item.id).join("|");

  function cancelTurn() {
    turnToken.current += 1;
    turnBusy.current = false;
    setTurn(null);
  }

  useEffect(() => {
    cancelTurn();
    setAnchor((value) => Math.min(value, Math.max(0, filtered.length - 1)));
  }, [layout, contentKey, filtered.length, query, year, activeSection, loading]);

  useEffect(
    () => () => {
      turnToken.current += 1;
      turnBusy.current = false;
    },
    [],
  );

  useEffect(() => {
    const strip = thumbRef.current;
    const thumb = strip?.querySelector<HTMLElement>(`[data-photo-index="${page * pageSize}"]`);
    if (!strip || !thumb) return;
    const viewport = strip.getBoundingClientRect();
    const photo = thumb.getBoundingClientRect();
    const delta =
      photo.left < viewport.left
        ? photo.left - viewport.left
        : photo.right > viewport.right
          ? photo.right - viewport.right
          : 0;
    // Move only the thumbnail strip; scrollIntoView also jumps the whole
    // document to the footer on phones when the album first opens.
    if (delta) strip.scrollBy({ left: delta, behavior: "instant" });
  }, [page, pageSize]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function navigate(direction: TurnDirection) {
    if (turnBusy.current || loading) return;
    const target = albumTurnTarget(page, pages, direction);
    if (target === null) return;
    if (layout !== "book" || reduceMotion) {
      setAnchor(target * pageSize);
      return;
    }
    turnBusy.current = true;
    const token = ++turnToken.current;
    setTurn({ from: page, to: target, direction, token });
  }

  function finishTurn(completed: Turn) {
    if (completed.token !== turnToken.current) return;
    setAnchor(completed.to * pageSize);
    turnBusy.current = false;
    setTurn(null);
  }

  function switchSection(key: AlbumSectionKey) {
    cancelTurn();
    setQuery("");
    setYear("all");
    setAnchor(0);
    onSectionChange(key);
  }

  function onBookKeyDown(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("input, select, [role=menu]")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(event.key === "ArrowRight" ? "right" : "left");
    }
  }

  const actions: PhotoActions = props;
  const spread = albumSpread(filtered, page);
  const nextSpread = turn ? albumSpread(filtered, turn.to) : spread;
  const staticLeft = turn?.direction === "right" ? nextSpread.left : spread.left;
  const staticRight = turn?.direction === "left" ? nextSpread.right : spread.right;
  const staticLeftPage = turn?.direction === "right" ? turn.to : page;
  const staticRightPage = turn?.direction === "left" ? turn.to : page;
  const busy = !!turn || loading;

  return (
    <section className="family-album" data-layout={layout} dir="rtl" aria-label="دفتر العائلة">
      <header className="album-header">
        <div className="album-heading">
          <h1>ألبوم العائلة</h1>
          <p>صور نحفظها.. وذكريات نعيشها</p>
        </div>
        <div className="album-tools">
          <label className="album-year">
            <span className="sr-only">السنة</span>
            <select
              aria-label="السنة"
              value={year}
              onChange={(e) => {
                cancelTurn();
                setAnchor(0);
                setYear(e.target.value);
              }}
            >
              <option value="all">كل السنوات</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="album-icon-button"
            aria-label={searchOpen ? "إغلاق البحث" : "بحث في الذكريات"}
            aria-expanded={searchOpen}
            aria-controls="album-search"
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setQuery("");
            }}
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
          <button
            type="button"
            className="album-add"
            onClick={onUpload}
            disabled={!canUpload || uploading}
            title={!canUpload ? "إضافة الذكريات في هذا القسم متاحة للإدارة" : undefined}
          >
            {uploading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : canUpload ? (
              <Plus size={17} />
            ) : (
              <Lock size={15} />
            )}
            <span>{uploading ? "جاري الرفع" : "إضافة ذكرى"}</span>
          </button>
        </div>
      </header>

      <nav className="album-sections" aria-label="أقسام الألبوم">
        {sections.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className={key === activeSection ? "is-active" : ""}
            aria-pressed={key === activeSection}
            onClick={() => switchSection(key)}
          >
            <Icon size={16} />
            <span>{label}</span>
            <small>{counts[key]}</small>
          </button>
        ))}
      </nav>

      {searchOpen && (
        <label className="album-search" id="album-search">
          <Search size={18} />
          <span className="sr-only">البحث بالوصف أو اسم الناشر</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="ابحث بالوصف أو اسم الناشر…"
            onChange={(e) => {
              cancelTurn();
              setAnchor(0);
              setQuery(e.target.value);
            }}
          />
        </label>
      )}

      <div className="album-section-caption">
        <p>{section.hint}</p>
        <span>{filtered.length} ذكرى</span>
      </div>

      {loading && items.length === 0 ? (
        <div className="album-empty" role="status">
          <Loader2 size={30} className="animate-spin" />
          <p>نفتح دفتر الذكريات…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="album-empty">
          <BookOpen size={38} />
          <h2>{query || year !== "all" ? "ما لقينا ذكريات بهذا البحث" : "صفحات تنتظر ذكرياتكم"}</h2>
          <p>
            {query || year !== "all"
              ? "جرّب وصفاً آخر أو اعرض كل السنوات."
              : "أضف أول صورة أو فيديو ليبدأ دفتر العائلة."}
          </p>
          {query || year !== "all" ? (
            <button
              type="button"
              className="album-add"
              onClick={() => {
                setQuery("");
                setYear("all");
              }}
            >
              عرض كل الذكريات
            </button>
          ) : (
            canUpload && (
              <button type="button" className="album-add" disabled={uploading} onClick={onUpload}>
                <Plus size={17} />
                إضافة ذكرى
              </button>
            )
          )}
        </div>
      ) : (
        <>
          <div
            className="album-reader"
            onKeyDown={onBookKeyDown}
            tabIndex={0}
            aria-label="صفحات دفتر العائلة"
            aria-busy={busy}
          >
            {layout === "book" ? (
              <>
                <button
                  type="button"
                  className="album-edge-arrow album-edge-left"
                  aria-label="الصفحتان السابقتان"
                  disabled={busy || page === 0}
                  onClick={() => navigate("left")}
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="album-book" data-turning={turn?.direction ?? "idle"}>
                  <div className="album-book-cover" />
                  <div className="album-spread">
                    <div className="album-stationary-page album-page-left">
                      <BookPage
                        items={staticLeft}
                        side="left"
                        folio={staticLeftPage * 2 + 2}
                        actions={actions}
                        interactive={!turn}
                      />
                    </div>
                    <div className="album-stationary-page album-page-right">
                      <BookPage
                        items={staticRight}
                        side="right"
                        folio={staticRightPage * 2 + 1}
                        actions={actions}
                        interactive={!turn}
                      />
                    </div>
                    {turn && (
                      <TurningLeaf
                        key={turn.token}
                        turn={turn}
                        frontItems={turn.direction === "right" ? spread.left : spread.right}
                        backItems={turn.direction === "right" ? nextSpread.right : nextSpread.left}
                        actions={actions}
                        onComplete={() => finishTurn(turn)}
                      />
                    )}
                  </div>
                  <div className="album-spine" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  className="album-edge-arrow album-edge-right"
                  aria-label="الصفحتان التاليتان"
                  disabled={busy || page === pages - 1}
                  onClick={() => navigate("right")}
                >
                  <ChevronRight size={24} />
                </button>
              </>
            ) : (
              <div className="album-single-page">
                <BookPage
                  items={filtered.slice(page * pageSize, (page + 1) * pageSize)}
                  side="single"
                  folio={page + 1}
                  actions={actions}
                />
              </div>
            )}
          </div>

          <div className="album-pagination" dir="ltr">
            <button
              type="button"
              className="album-icon-button"
              aria-label="الصفحة السابقة"
              disabled={busy || page === 0}
              onClick={() => navigate("left")}
            >
              <ChevronLeft size={18} />
            </button>
            <span role="status" aria-live="polite" aria-label={`صفحة ${page + 1} من ${pages}`}>
              {page + 1}
              <span className="album-pagination-divider">/</span>
              {pages}
            </span>
            <button
              type="button"
              className="album-icon-button"
              aria-label="الصفحة التالية"
              disabled={busy || page === pages - 1}
              onClick={() => navigate("right")}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="album-thumbnails" ref={thumbRef} aria-label="الوصول إلى الذكريات">
            {filtered.map((item, index) => (
              <button
                type="button"
                key={item.id}
                data-photo-index={index}
                className={Math.floor(index / pageSize) === page ? "is-current" : ""}
                aria-current={Math.floor(index / pageSize) === page ? "page" : undefined}
                aria-label={`انتقل إلى ${albumCaption(item)}`}
                disabled={busy}
                onClick={() => setAnchor(index)}
              >
                {item.media_type === "image" ? (
                  <img src={item.url} alt="" loading="lazy" />
                ) : (
                  <>
                    <video src={item.url} muted playsInline preload="metadata" />
                    <Play size={15} />
                  </>
                )}
              </button>
            ))}
          </div>
          {loading && (
            <p className="album-refresh" role="status">
              <Loader2 size={14} className="animate-spin" />
              جاري تحديث الذكريات
            </p>
          )}
        </>
      )}
    </section>
  );
}

function PhotoFrame({
  item,
  actions,
  interactive = true,
}: {
  item: AlbumItem;
  actions: PhotoActions;
  interactive?: boolean;
}) {
  const caption = albumCaption(item);
  const days = item.expires_at
    ? Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / 86400000))
    : null;
  const media = (
    <>
      {item.media_type === "image" ? (
        <img
          src={item.url}
          alt={caption}
          loading={interactive ? "lazy" : "eager"}
          draggable={false}
        />
      ) : (
        <>
          <video src={item.url} muted playsInline preload="metadata" aria-label={caption} />
          <span className="album-video-play">
            <Play size={22} fill="currentColor" />
          </span>
        </>
      )}
      {item.pinned && (
        <span className="album-pin" title="ذكرى مثبتة">
          <Pin size={14} fill="currentColor" />
        </span>
      )}
    </>
  );
  return (
    <article className="album-photo" data-item-id={item.id}>
      {interactive ? (
        <button
          type="button"
          className="album-photo-media"
          aria-label={`عرض ${caption}`}
          onClick={() => actions.onView(item)}
        >
          {media}
        </button>
      ) : (
        <div className="album-photo-media">{media}</div>
      )}
      <div className="album-photo-caption">
        <h3 title={caption}>{caption}</h3>
        <time dateTime={item.created_at}>{albumDate(item.created_at)}</time>
        {days !== null && (
          <span className="album-expiry">{days === 0 ? "يُحذف قريباً" : `باقي ${days} أيام`}</span>
        )}
      </div>
      {interactive && actions.canManage(item) && (
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <button type="button" className="album-photo-menu" aria-label={`خيارات ${caption}`}>
              <MoreVertical size={17} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onTogglePin(item)}>
              {item.pinned ? <PinOff /> : <Pin />}
              {item.pinned ? "إلغاء التثبيت" : "تثبيت الذكرى"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => actions.onDelete(item)}>
              <Trash2 />
              حذف الذكرى
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}

function BookPage({
  items,
  side,
  folio,
  actions,
  interactive = true,
}: {
  items: AlbumItem[];
  side: "left" | "right" | "single";
  folio: number;
  actions: PhotoActions;
  interactive?: boolean;
}) {
  return (
    <div className="album-paper" data-side={side} dir="rtl">
      {items.length ? (
        <div className="album-page-grid" data-count={items.length}>
          {items.map((item) => (
            <PhotoFrame key={item.id} item={item} actions={actions} interactive={interactive} />
          ))}
        </div>
      ) : (
        <div className="album-paper-end">
          <BookOpen size={28} />
          <p>لكل ذكرى صفحة في دفترنا</p>
        </div>
      )}
      <span className="album-folio" aria-hidden="true">
        {folio}
      </span>
    </div>
  );
}

// Eight hinged paper strips share the same full-page artwork on both faces.
// The outer strips lag at mid-turn and flatten at the end, creating a curl
// rather than rotating a single rigid rectangle or sliding the photos.
function TurningLeaf({
  turn,
  frontItems,
  backItems,
  actions,
  onComplete,
}: {
  turn: Turn;
  frontItems: AlbumItem[];
  backItems: AlbumItem[];
  actions: PhotoActions;
  onComplete: () => void;
}) {
  const sign = turn.direction === "right" ? 1 : -1;
  const frontSide = turn.direction === "right" ? "left" : "right";
  const backSide = frontSide === "left" ? "right" : "left";
  const frontFolio = turn.from * 2 + (frontSide === "left" ? 2 : 1);
  const backFolio = turn.to * 2 + (backSide === "left" ? 2 : 1);
  const transition = { duration: 0.92, times: [0, 0.25, 0.5, 0.78, 1], ease: "easeInOut" as const };
  const strips = 8;

  function strip(index: number): ReactNode {
    const frontCrop = sign === 1 ? strips - 1 - index : index;
    const backCrop = strips - 1 - frontCrop;
    const angles =
      index === 0
        ? [0, sign * 48, sign * 110, sign * 161, sign * 180]
        : [0, -sign * (4 + index * 0.65), -sign * (6 + index * 1.2), -sign * (2 + index * 0.4), 0];
    return (
      <motion.div
        className="album-leaf-strip"
        data-strip={index}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: angles }}
        transition={transition}
        onAnimationComplete={index === strips - 1 ? onComplete : undefined}
      >
        <div className="album-leaf-face album-leaf-front">
          <div className="album-leaf-artwork" style={{ left: `${-frontCrop * 100}%` }}>
            <BookPage
              items={frontItems}
              side={frontSide}
              folio={frontFolio}
              actions={actions}
              interactive={false}
            />
          </div>
          <motion.div
            className="album-leaf-shade"
            animate={{ opacity: [0, 0.04 + index * 0.008, 0.16 + index * 0.012, 0.05, 0] }}
            transition={transition}
          />
        </div>
        <div className="album-leaf-face album-leaf-back">
          <div className="album-leaf-artwork" style={{ left: `${-backCrop * 100}%` }}>
            <BookPage
              items={backItems}
              side={backSide}
              folio={backFolio}
              actions={actions}
              interactive={false}
            />
          </div>
          <motion.div
            className="album-leaf-shade"
            animate={{ opacity: [0, 0.06 + index * 0.008, 0.14 + index * 0.01, 0.04, 0] }}
            transition={transition}
          />
        </div>
        {index < strips - 1 && strip(index + 1)}
      </motion.div>
    );
  }

  return (
    <div className="album-turning-leaf" data-direction={turn.direction} aria-hidden="true" inert>
      {strip(0)}
    </div>
  );
}
