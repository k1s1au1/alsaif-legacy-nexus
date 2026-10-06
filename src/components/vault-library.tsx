import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import {
  ArrowUpLeft,
  Clock3,
  Download,
  FileImage,
  FileText,
  FileWarning,
  FolderOpen,
  History,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  VAULT_CATEGORIES,
  filterVaultItems,
  vaultDate,
  vaultFileKind,
  vaultIsLocked,
  vaultSharingLabel,
} from "@/lib/vault-library";
import type { VaultCategory, VaultItem } from "@/lib/vault-library";
import "./vault-library.css";

const PdfPreview = lazy(() => import("./vault-document-preview"));
const WIDE_QUERY = "(min-width: 1024px) and (orientation: landscape), (min-width: 1366px)";
const categoryIcons = { will: FileText, deed: ShieldCheck, heritage: History, private: Lock };

function useWideVault() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

function PreviewMedia({
  item,
  locked,
  getSignedUrl,
}: {
  item: VaultItem;
  locked: boolean;
  getSignedUrl: (item: VaultItem) => Promise<string>;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setUrl("");
    setError(false);
    if (locked || !item.storage_path) return;
    getSignedUrl(item)
      .then((value) => {
        if (!disposed) setUrl(value);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [item, locked, getSignedUrl, attempt]);

  if (locked)
    return (
      <div className="vault-media-message vault-locked-preview">
        <span className="vault-lock-emblem">
          <Lock size={30} />
        </span>
        <strong>وثيقة موقوتة</strong>
        <span>
          {vaultDate(item.unlock_at)
            ? `تُفتح في ${vaultDate(item.unlock_at)}`
            : "موعد الفتح غير متاح"}
        </span>
      </div>
    );
  if (!item.storage_path)
    return (
      <div className="vault-media-message">
        <FileWarning size={30} />
        <strong>ملف الوثيقة غير متاح</strong>
      </div>
    );
  if (error)
    return (
      <div className="vault-media-message" role="status">
        <FileWarning size={30} />
        <strong>تعذر تحميل المعاينة</strong>
        <button
          type="button"
          className="vault-secondary-button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RefreshCw size={16} />
          إعادة المحاولة
        </button>
      </div>
    );
  if (!url)
    return (
      <div className="vault-media-message" role="status">
        <Loader2 className="vault-spin" size={24} />
        <span>جاري تحميل الوثيقة…</span>
      </div>
    );
  const kind = vaultFileKind(item.storage_path);
  if (kind === "pdf")
    return (
      <Suspense
        fallback={
          <div className="vault-media-message" role="status">
            <Loader2 className="vault-spin" size={24} />
            <span>تجهيز المعاينة…</span>
          </div>
        }
      >
        <PdfPreview url={url} title={item.title} />
      </Suspense>
    );
  if (kind === "image")
    return (
      <img
        className="vault-preview-image"
        src={url}
        alt={item.title}
        onError={() => setError(true)}
      />
    );
  return (
    <div className="vault-media-message">
      <FileText size={30} />
      <strong>هذا الملف لا يدعم المعاينة</strong>
      <span>استخدم «فتح» أو «تحميل» لعرضه.</span>
    </div>
  );
}

function DocumentPreview({
  item,
  now,
  getSignedUrl,
  onOpen,
  onDownload,
}: {
  item: VaultItem;
  now: number;
  getSignedUrl: (item: VaultItem) => Promise<string>;
  onOpen: (item: VaultItem) => void;
  onDownload: (item: VaultItem) => void;
}) {
  const locked = vaultIsLocked(item, now);
  const disabled = locked || !item.storage_path;
  const sharing = vaultSharingLabel(item);
  return (
    <>
      <div className="vault-preview-media">
        <PreviewMedia
          key={`${item.id}:${item.storage_path}:${item.unlock_at}`}
          item={item}
          locked={locked}
          getSignedUrl={getSignedUrl}
        />
      </div>
      <div className="vault-preview-details">
        <h3>{item.title}</h3>
        {item.description && <p className="vault-preview-description">{item.description}</p>}
        <dl className="vault-metadata">
          <div>
            <dt>التصنيف</dt>
            <dd>
              {VAULT_CATEGORIES.find((category) => category.key === item.category)?.label ||
                "وثيقة"}
            </dd>
          </div>
          <div>
            <dt>المشاركة</dt>
            <dd>{sharing}</dd>
          </div>
          {item.uploader && (
            <div>
              <dt>أضافها</dt>
              <dd>{item.uploader.arabic_name || item.uploader.full_name || "عضو العائلة"}</dd>
            </div>
          )}
          <div>
            <dt>تاريخ الإضافة</dt>
            <dd>
              <time dateTime={item.created_at}>{vaultDate(item.created_at) || "غير متاح"}</time>
            </dd>
          </div>
          {item.unlock_at && (
            <div>
              <dt>موعد الفتح</dt>
              <dd>{vaultDate(item.unlock_at) || "غير متاح"}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="vault-preview-actions">
        <button
          type="button"
          className="vault-primary-button"
          onClick={() => onOpen(item)}
          disabled={disabled}
        >
          <ArrowUpLeft size={18} />
          فتح
        </button>
        <button
          type="button"
          className="vault-secondary-button"
          onClick={() => onDownload(item)}
          disabled={disabled}
        >
          <Download size={18} />
          تحميل
        </button>
      </div>
    </>
  );
}

export function VaultLibrary({
  items,
  loading,
  loadError,
  currentUserId,
  onAdd,
  onReload,
  onDelete,
  getSignedUrl,
  onOpen,
  onDownload,
}: {
  items: VaultItem[];
  loading: boolean;
  loadError?: string;
  currentUserId: string | null;
  onAdd: () => void;
  onReload: () => void;
  onDelete: (item: VaultItem) => void;
  getSignedUrl: (item: VaultItem) => Promise<string>;
  onOpen: (item: VaultItem) => void;
  onDownload: (item: VaultItem) => void;
}) {
  const wide = useWideVault();
  const [category, setCategory] = useState<VaultCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const opener = useRef<HTMLElement | null>(null);
  const filtered = useMemo(
    () => filterVaultItems(items, category, query),
    [items, category, query],
  );
  const selected =
    filtered.find((item) => item.id === selectedId) ?? (wide ? filtered[0] : undefined);

  useEffect(() => {
    if (wide || !selected) setSheetOpen(false);
  }, [wide, selected]);
  useEffect(() => {
    const nextRelease = items
      .map((item) => Date.parse(item.unlock_at ?? ""))
      .filter((date) => Number.isFinite(date) && date > now)
      .sort((a, b) => a - b)[0];
    if (!nextRelease) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(2_147_483_647, Math.max(1, nextRelease - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [items, now]);

  const previewProps = { now, getSignedUrl, onOpen, onDownload };
  return (
    <section className="vault-library vault-theme" dir="rtl" data-layout={wide ? "split" : "list"}>
      <header className="vault-library-header">
        <div className="vault-library-heading">
          <span className="vault-heading-icon">
            <FolderOpen size={25} />
          </span>
          <div>
            <h1>الخزنة</h1>
            <p>الوصايا والوثائق العائلية</p>
          </div>
        </div>
        <div className="vault-header-tools">
          <label className="vault-search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="البحث في الوثائق"
              placeholder="ابحث عن وثيقة…"
            />
            {query && (
              <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </label>
          <button type="button" className="vault-primary-button vault-add-button" onClick={onAdd}>
            <Plus size={19} />
            <span>إضافة وثيقة</span>
          </button>
        </div>
      </header>
      <nav className="vault-filters" aria-label="تصنيف الوثائق">
        <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
          الكل
        </button>
        {VAULT_CATEGORIES.map(({ key, label }) => {
          const Icon = categoryIcons[key];
          return (
            <button
              type="button"
              key={key}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="vault-workspace">
        <div className="vault-list-panel">
          <div className="vault-list-heading">
            <h2>مكتبة الوثائق</h2>
            <span aria-live="polite">
              {loading && !items.length ? "…" : `${filtered.length} وثيقة`}
            </span>
          </div>
          {loadError ? (
            <div className="vault-empty" role="alert">
              <FileWarning size={38} />
              <h3>تعذر تحميل الوثائق</h3>
              <p>{loadError}</p>
              <button
                type="button"
                className="vault-secondary-button"
                onClick={onReload}
                disabled={loading}
              >
                <RefreshCw size={17} />
                إعادة المحاولة
              </button>
            </div>
          ) : loading && !items.length ? (
            <div className="vault-loading" role="status">
              <Loader2 className="vault-spin" size={25} />
              <p>جاري تحميل الوثائق…</p>
            </div>
          ) : !filtered.length ? (
            <div className="vault-empty">
              <FolderOpen size={40} />
              <h3>{items.length ? "لا توجد وثائق مطابقة" : "هنا تحفظ وثائق العائلة"}</h3>
              <p>
                {items.length
                  ? "جرّب كلمة أخرى أو اعرض جميع التصنيفات."
                  : "أضف أول وثيقة لتظهر في مكتبتك، مع معاينة سهلة لمحتواها."}
              </p>
              <button
                type="button"
                className="vault-secondary-button"
                onClick={() => {
                  if (items.length) {
                    setQuery("");
                    setCategory("all");
                  } else onAdd();
                }}
              >
                {items.length ? "عرض جميع الوثائق" : "إضافة أول وثيقة"}
              </button>
            </div>
          ) : (
            <ul className="vault-document-list" aria-label="الوثائق">
              {filtered.map((item) => {
                const locked = vaultIsLocked(item, now);
                const sharing = vaultSharingLabel(item);
                const Icon = vaultFileKind(item.storage_path) === "image" ? FileImage : FileText;
                const selectedRow = selected?.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={`vault-document-row${selectedRow ? " is-selected" : ""}`}
                    data-document-id={item.id}
                  >
                    <button
                      type="button"
                      className="vault-document-select"
                      aria-pressed={selectedRow}
                      aria-label={`معاينة ${item.title}`}
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        setSelectedId(item.id);
                        setNow(Date.now());
                        if (!wide) setSheetOpen(true);
                      }}
                    >
                      <span className="vault-document-thumb" aria-hidden="true">
                        <Icon size={28} />
                        <small>
                          {vaultFileKind(item.storage_path) === "pdf" ? "PDF" : "وثيقة"}
                        </small>
                      </span>
                      <span className="vault-document-summary">
                        <strong>{item.title}</strong>
                        <span className="vault-document-description">
                          {item.description ||
                            VAULT_CATEGORIES.find((entry) => entry.key === item.category)?.label ||
                            "وثيقة عائلية"}
                        </span>
                        <span className="vault-document-meta">
                          <time dateTime={item.created_at}>{vaultDate(item.created_at)}</time>
                          {locked && (
                            <span>
                              <Clock3 size={13} />
                              موقوتة
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="vault-sharing-badge">
                        {sharing === "خاص بي" ? <Lock size={13} /> : <Users size={13} />}
                        {sharing}
                      </span>
                    </button>
                    <DropdownMenu dir="rtl">
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="vault-icon-button vault-row-menu"
                          aria-label={`خيارات ${item.title}`}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="vault-row-dropdown">
                        <DropdownMenuItem
                          onSelect={() => onOpen(item)}
                          disabled={locked || !item.storage_path}
                        >
                          <ArrowUpLeft size={16} />
                          فتح الوثيقة
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onDownload(item)}
                          disabled={locked || !item.storage_path}
                        >
                          <Download size={16} />
                          تحميل الوثيقة
                        </DropdownMenuItem>
                        {currentUserId === item.owner_id && (
                          <DropdownMenuItem
                            className="vault-delete-action"
                            onSelect={() => onDelete(item)}
                          >
                            <Trash2 size={16} />
                            حذف الوثيقة
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {wide && (
          <aside className="vault-preview-panel" aria-label="معاينة الوثيقة">
            <header className="vault-preview-heading">
              <FileText size={18} />
              <h2>معاينة الوثيقة</h2>
            </header>
            {selected && !loadError ? (
              <DocumentPreview item={selected} {...previewProps} />
            ) : (
              <div className="vault-preview-placeholder">
                <FileText size={42} />
                <h3>وثيقتك عن قرب</h3>
                <p>اختر وثيقة من المكتبة لعرض محتواها وتفاصيلها هنا.</p>
              </div>
            )}
          </aside>
        )}
      </div>
      {!wide && selected && (
        <Drawer.Root
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          shouldScaleBackground={false}
          handleOnly
          autoFocus
        >
          <Drawer.Portal>
            <Drawer.Overlay className="vault-drawer-overlay" />
            <Drawer.Content
              className="vault-preview-drawer vault-theme"
              dir="rtl"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
              }}
            >
              <Drawer.Handle className="vault-drawer-handle" aria-label="اسحب لإغلاق المعاينة" />
              <header className="vault-preview-heading">
                <div>
                  <Drawer.Title>معاينة الوثيقة</Drawer.Title>
                  <Drawer.Description>{selected.title}</Drawer.Description>
                </div>
                <Drawer.Close asChild>
                  <button type="button" className="vault-icon-button" aria-label="إغلاق المعاينة">
                    <X size={20} />
                  </button>
                </Drawer.Close>
              </header>
              <div className="vault-drawer-content">
                <DocumentPreview item={selected} {...previewProps} />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </section>
  );
}
