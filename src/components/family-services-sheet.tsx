import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { Drawer } from "vaul";
import {
  Archive,
  Handshake,
  ListChecks,
  Lock,
  MessageCircle,
  Newspaper,
  PartyPopper,
  Search,
  Settings,
  Ticket,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { LineageLegacyIcon } from "@/components/icons/lineage-legacy-icon";
import "./family-services-sheet.css";

// Keep the launcher routes and guest permissions used by the previous services menu.
// The glyphs and alternating tones match the services underneath the dashboard model.
const services = [
  { to: "/chat", label: "محادثة", icon: MessageCircle, permission: "chat", tone: "primary" },
  { to: "/trips", label: "ترفيه", icon: Ticket, permission: "trips", tone: "primary" },
  { to: "/meetings", label: "اجتماعات", icon: Users, permission: "meetings", tone: "accent" },
  {
    to: "/family-occasions",
    label: "مناسبات العائلة",
    icon: PartyPopper,
    permission: "family-occasions",
    tone: "primary",
  },
  { to: "/tasks", label: "مهام", icon: ListChecks, permission: "tasks", tone: "accent" },
  { to: "/majlis", label: "الأخبار", icon: Newspaper, permission: "news", tone: "accent" },
  {
    to: "/community",
    label: "ركن الأعضاء",
    icon: Handshake,
    permission: "community",
    tone: "accent",
  },
  { to: "/archive", label: "الألبوم", icon: Archive, permission: "archive", tone: "primary" },
  {
    to: "/family-tree",
    label: "نسب وأثر",
    icon: LineageLegacyIcon,
    permission: "tree",
    tone: "primary",
  },
  { to: "/vault", label: "الخزنة", icon: Lock, permission: "vault", tone: "accent" },
  { to: "/finance", label: "الصندوق", icon: Wallet, permission: "finance", tone: "primary" },
  { to: "/profile", label: "ملفي", icon: User, permission: null, tone: "accent" },
  { to: "/settings", label: "الإعدادات", icon: Settings, permission: null, tone: "primary" },
];

type FamilyServicesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTabletPortrait: boolean;
  isGuest: boolean;
  allowedSections: readonly string[];
  onRestricted: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

function searchText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

export function FamilyServicesSheet({
  open,
  onOpenChange,
  isTabletPortrait,
  isGuest,
  allowedSections,
  onRestricted,
  triggerRef,
}: FamilyServicesSheetProps) {
  const [query, setQuery] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const [bounds, setBounds] = useState({ dock: 82, header: 130 });
  const results = services.filter((service) =>
    searchText(service.label).includes(searchText(query)),
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dock = triggerRef.current?.closest(".app-shell-bottom-dock");
    const header = document.querySelector(".app-shell-header-wrap");
    const measure = () => {
      const viewport = window.visualViewport;
      const keyboardHeight = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const dockHeight = Math.max(
        keyboardHeight,
        dock ? Math.max(0, window.innerHeight - dock.getBoundingClientRect().top) : 82,
      );
      const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) + 12 : 130;
      setBounds((previous) =>
        previous.dock === dockHeight && previous.header === headerBottom
          ? previous
          : { dock: dockHeight, header: headerBottom },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (dock) observer.observe(dock);
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open, isTabletPortrait, triggerRef]);

  const panelStyle = {
    "--services-dock-height": `${bounds.dock}px`,
    "--services-header-bottom": `${bounds.header}px`,
  } as CSSProperties;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      setBackgroundColorOnScale={false}
      handleOnly
      fixed
      autoFocus
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="family-services-sheet-overlay" style={panelStyle} />
        <Drawer.Content
          id="family-services-sheet"
          className="family-services-sheet"
          style={panelStyle}
          data-tablet-portrait={isTabletPortrait || undefined}
          dir="rtl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <Drawer.Handle className="family-services-sheet__handle" preventCycle />
          <div className="family-services-sheet__header">
            <Drawer.Title>خدمات العائلة</Drawer.Title>
            <Drawer.Description className="sr-only">
              ابحث عن الخدمة التي تريد فتحها. اسحب المقبض لأسفل لإغلاق اللوحة.
            </Drawer.Description>
            <Drawer.Close asChild>
              <button
                ref={closeRef}
                type="button"
                className="family-services-sheet__close"
                aria-label="إغلاق خدمات العائلة"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </Drawer.Close>
          </div>
          <div className="family-services-sheet__search">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              placeholder="ابحث عن خدمة"
              aria-label="ابحث عن خدمة"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}>
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="family-services-sheet__scroll" data-vaul-no-drag>
            <div className="family-services-sheet__grid">
              {results.map((service) => {
                const Icon = service.icon;
                const restricted =
                  isGuest &&
                  service.permission !== null &&
                  !allowedSections.includes(service.permission);
                const content = (
                  <>
                    <span
                      className="family-services-sheet__icon"
                      data-tone={service.tone}
                      aria-hidden="true"
                    >
                      <Icon size={28} strokeWidth={1.8} />
                      {restricted && <Lock size={12} className="family-services-sheet__lock" />}
                    </span>
                    <span>{service.label}</span>
                  </>
                );
                return restricted ? (
                  <button
                    key={service.to}
                    type="button"
                    className="family-services-sheet__service is-restricted"
                    aria-disabled="true"
                    aria-label={`${service.label} — خاص بالعائلة`}
                    onClick={onRestricted}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    key={service.to}
                    to={service.to}
                    className="family-services-sheet__service"
                    onClick={() => onOpenChange(false)}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="family-services-sheet__empty" role="status">
                لا توجد خدمة بهذا الاسم
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
