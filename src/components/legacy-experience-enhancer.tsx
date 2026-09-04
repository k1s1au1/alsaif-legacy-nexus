import { Link, useLocation } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trees,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LegacyPage = "family-tree" | "heritage";

const SECTION_HOST_ATTR = "data-legacy-section-host";
const CANVAS_HOST_ATTR = "data-legacy-tree-overlay-host";

function isLegacyPage(pathname: string): LegacyPage | null {
  if (pathname === "/family-tree" || pathname.startsWith("/family-tree/")) return "family-tree";
  if (pathname === "/heritage" || pathname.startsWith("/heritage/")) return "heritage";
  return null;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function LegacyExperienceEnhancer() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const page = isLegacyPage(pathname);
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);
  const [canvasHost, setCanvasHost] = useState<HTMLElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(true);
  const [fullscreenSearch, setFullscreenSearch] = useState("");
  const miniMapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!page || typeof document === "undefined") {
      setSectionHost(null);
      setCanvasHost(null);
      setCanvas(null);
      return;
    }

    let sectionNode: HTMLElement | null = null;
    let canvasOverlayNode: HTMLElement | null = null;

    const mountHosts = () => {
      const pageRoot = document.querySelector<HTMLElement>(
        page === "family-tree" ? ".family-tree-page" : ".heritage-page-content",
      );

      if (pageRoot && !sectionNode) {
        sectionNode = document.createElement("div");
        sectionNode.setAttribute(SECTION_HOST_ATTR, "true");
        pageRoot.insertBefore(sectionNode, pageRoot.firstChild);
        setSectionHost(sectionNode);
      }

      if (page === "family-tree" && !canvasOverlayNode) {
        const treeCanvas = document.querySelector<HTMLElement>(".family-tree-canvas");
        if (treeCanvas) {
          canvasOverlayNode = document.createElement("div");
          canvasOverlayNode.setAttribute(CANVAS_HOST_ATTR, "true");
          treeCanvas.appendChild(canvasOverlayNode);
          setCanvas(treeCanvas);
          setCanvasHost(canvasOverlayNode);
        }
      }
    };

    mountHosts();
    const observer = new MutationObserver(mountHosts);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      sectionNode?.remove();
      canvasOverlayNode?.remove();
      setSectionHost(null);
      setCanvasHost(null);
      setCanvas(null);
    };
  }, [page]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTabletLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const shortSide = Math.min(width, height);
      const longSide = Math.max(width, height);
      const touchDevice =
        navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches;
      const isTablet = touchDevice && shortSide >= 600 && longSide <= 1400;

      if (!isTablet) {
        delete document.documentElement.dataset.legacyTabletLayout;
        return;
      }

      document.documentElement.dataset.legacyTabletLayout =
        height >= width ? "portrait" : "landscape";
    };

    syncTabletLayout();
    window.addEventListener("resize", syncTabletLayout);
    window.addEventListener("orientationchange", syncTabletLayout);
    return () => {
      window.removeEventListener("resize", syncTabletLayout);
      window.removeEventListener("orientationchange", syncTabletLayout);
      delete document.documentElement.dataset.legacyTabletLayout;
    };
  }, []);

  useEffect(() => {
    if (!canvas) return;

    if (isFullscreen) {
      canvas.classList.add("legacy-tree-fullscreen");
      document.documentElement.classList.add("legacy-tree-fullscreen-open");
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const sourceSearch = document.querySelector<HTMLInputElement>(
        '.family-tree-page input[type="search"]',
      );
      setFullscreenSearch(sourceSearch?.value ?? "");

      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsFullscreen(false);
      };
      window.addEventListener("keydown", handleKeydown);

      return () => {
        canvas.classList.remove("legacy-tree-fullscreen");
        document.documentElement.classList.remove("legacy-tree-fullscreen-open");
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", handleKeydown);
      };
    }

    canvas.classList.remove("legacy-tree-fullscreen");
    document.documentElement.classList.remove("legacy-tree-fullscreen-open");
    return undefined;
  }, [canvas, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || !miniMapOpen || !canvas || !miniMapRef.current) return;

    let animationFrame = 0;
    const target = miniMapRef.current;

    const syncMiniMap = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const sourceSvg = Array.from(canvas.querySelectorAll<SVGSVGElement>("svg")).find(
          (svg) => !svg.hasAttribute("data-legacy-minimap-clone"),
        );
        if (!sourceSvg || !target) return;

        const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("data-legacy-minimap-clone", "true");
        clone.setAttribute("aria-hidden", "true");
        clone.removeAttribute("tabindex");

        const rect = sourceSvg.getBoundingClientRect();
        if (!clone.getAttribute("viewBox") && rect.width > 0 && rect.height > 0) {
          clone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
        }

        clone.style.width = "100%";
        clone.style.height = "100%";
        clone.style.display = "block";
        clone.style.pointerEvents = "none";
        clone.style.background = "transparent";
        target.replaceChildren(clone);
      });
    };

    syncMiniMap();
    const sourceSvg = Array.from(canvas.querySelectorAll<SVGSVGElement>("svg")).find(
      (svg) => !svg.hasAttribute("data-legacy-minimap-clone"),
    );
    const observer = sourceSvg
      ? new MutationObserver(syncMiniMap)
      : new MutationObserver(syncMiniMap);
    observer.observe(sourceSvg ?? canvas, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["transform", "d", "x", "y", "width", "height", "style"],
    });
    window.addEventListener("resize", syncMiniMap);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", syncMiniMap);
      target.replaceChildren();
    };
  }, [canvas, isFullscreen, miniMapOpen]);

  useEffect(() => {
    if (page !== "family-tree") {
      setIsFullscreen(false);
      setMiniMapOpen(true);
    }
  }, [page]);

  const clickTreeControl = (label: string) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".family-tree-page button[aria-label]"),
    ).find((candidate) => candidate.getAttribute("aria-label") === label);
    button?.click();
  };

  const handleFullscreenSearch = (value: string) => {
    setFullscreenSearch(value);
    const sourceSearch = document.querySelector<HTMLInputElement>(
      '.family-tree-page input[type="search"]',
    );
    if (sourceSearch) setNativeInputValue(sourceSearch, value);
  };

  if (!page) return null;

  return (
    <>
      <style>{`
        [${SECTION_HOST_ATTR}] { display: block; }
        .legacy-section-bar {
          direction: rtl;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          margin-bottom: 16px;
          border: 1px solid #e4dcc8;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,245,236,.98));
          box-shadow: 0 10px 28px rgba(28, 67, 50, .07);
        }
        .legacy-section-copy { min-width: 0; }
        .legacy-section-title {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #153d2f;
          font-weight: 900;
          font-size: 18px;
          line-height: 1.2;
        }
        .legacy-section-subtitle {
          margin-top: 4px;
          color: #7b7b76;
          font-size: 12px;
          font-weight: 700;
        }
        .legacy-section-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(122px, 1fr));
          gap: 6px;
          padding: 5px;
          border-radius: 18px;
          background: #f1eee6;
          flex-shrink: 0;
        }
        .legacy-section-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 14px;
          color: #4c5a53;
          font-size: 13px;
          font-weight: 900;
          transition: background .2s ease, color .2s ease, box-shadow .2s ease;
        }
        .legacy-section-tab[data-active="true"] {
          color: white;
          background: #0f5139;
          box-shadow: 0 8px 18px rgba(15, 81, 57, .18);
        }
        [${CANVAS_HOST_ATTR}] { position: absolute; inset: 0; z-index: 25; pointer-events: none; }
        .legacy-fullscreen-trigger {
          pointer-events: auto;
          position: absolute;
          top: 14px;
          left: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 14px;
          border: 1px solid rgba(15, 81, 57, .15);
          border-radius: 14px;
          background: rgba(255,255,255,.94);
          color: #153d2f;
          box-shadow: 0 8px 24px rgba(31, 55, 45, .12);
          backdrop-filter: blur(14px);
          font-weight: 900;
          font-size: 12px;
        }
        .legacy-tree-fullscreen {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-height: none !important;
          z-index: 9999 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background:
            radial-gradient(circle at 20% 10%, rgba(214,173,75,.08), transparent 28%),
            linear-gradient(180deg, #fbf9f2, #f7f3e8) !important;
          box-shadow: none !important;
        }
        .dark .legacy-tree-fullscreen {
          background: linear-gradient(180deg, #111817, #0d1312) !important;
        }
        .legacy-tree-fullscreen .legacy-fullscreen-trigger { display: none; }
        .legacy-fullscreen-ui { position: absolute; inset: 0; z-index: 40; pointer-events: none; direction: rtl; }
        .legacy-fullscreen-toolbar {
          pointer-events: auto;
          position: absolute;
          top: 14px;
          right: 14px;
          left: 14px;
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border: 1px solid rgba(15,81,57,.13);
          border-radius: 20px;
          background: rgba(255,255,255,.91);
          box-shadow: 0 12px 34px rgba(31,55,45,.12);
          backdrop-filter: blur(18px);
        }
        .dark .legacy-fullscreen-toolbar,
        .dark .legacy-minimap-panel { background: rgba(18,24,23,.92); border-color: rgba(230,194,92,.18); }
        .legacy-fullscreen-title {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-inline: 8px 12px;
          color: #153d2f;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
        }
        .dark .legacy-fullscreen-title { color: #f8fafc; }
        .legacy-fullscreen-search {
          position: relative;
          min-width: 180px;
          max-width: 380px;
          flex: 1;
        }
        .legacy-fullscreen-search input {
          width: 100%;
          min-height: 42px;
          border: 1px solid #e3dccb;
          border-radius: 14px;
          background: rgba(247,245,240,.95);
          padding: 0 39px 0 12px;
          color: #153d2f;
          font-size: 14px;
          font-weight: 800;
          outline: none;
        }
        .legacy-fullscreen-search svg { position: absolute; right: 13px; top: 12px; color: #7b7b76; }
        .legacy-tree-tools { display: flex; align-items: center; gap: 6px; margin-inline-start: auto; }
        .legacy-tree-tool {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border: 1px solid #e3dccb;
          border-radius: 13px;
          background: #f8f6f0;
          color: #153d2f;
        }
        .legacy-tree-tool:hover { background: #0f5139; color: white; border-color: #0f5139; }
        .legacy-tree-exit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 42px;
          padding: 0 13px;
          border-radius: 13px;
          background: #0f5139;
          color: white;
          font-size: 12px;
          font-weight: 900;
        }
        .legacy-minimap-panel {
          pointer-events: auto;
          position: absolute;
          right: 18px;
          bottom: 18px;
          width: min(300px, calc(100% - 36px));
          border: 1px solid rgba(15,81,57,.14);
          border-radius: 20px;
          overflow: hidden;
          background: rgba(255,255,255,.93);
          box-shadow: 0 16px 38px rgba(31,55,45,.14);
          backdrop-filter: blur(16px);
        }
        .legacy-minimap-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 44px;
          padding: 0 12px;
          color: #153d2f;
          font-size: 12px;
          font-weight: 900;
        }
        .dark .legacy-minimap-head { color: #f8fafc; }
        .legacy-minimap-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(15,81,57,.08);
        }
        .legacy-minimap-body {
          height: 170px;
          margin: 0 10px 10px;
          overflow: hidden;
          border: 1px solid #e7e0cf;
          border-radius: 14px;
          background: #f8f5eb;
        }
        .legacy-minimap-collapsed { width: auto; min-width: 155px; }

        html[data-legacy-tablet-layout="portrait"] .family-tree-workspace {
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-areas: "member" "tree" !important;
        }
        html[data-legacy-tablet-layout="portrait"] .family-tree-workspace .member-panel {
          grid-area: member !important;
          width: 100% !important;
        }
        html[data-legacy-tablet-layout="portrait"] .family-tree-canvas:not(.legacy-tree-fullscreen) {
          grid-area: tree !important;
          width: 100% !important;
          height: min(68dvh, 700px) !important;
          min-height: 560px !important;
        }
        html[data-legacy-tablet-layout="portrait"] .heritage-page-content {
          max-width: 760px !important;
          margin-inline: auto !important;
          padding-inline: 16px !important;
        }
        html[data-legacy-tablet-layout="portrait"] .heritage-page-content .heritage-filters {
          flex-direction: column !important;
          align-items: stretch !important;
        }
        html[data-legacy-tablet-layout="portrait"] .heritage-page-content .heritage-filters > * {
          width: 100% !important;
        }
        html[data-legacy-tablet-layout="portrait"] .heritage-page-content [class*="columns-"] {
          columns: 1 !important;
        }
        html[data-legacy-tablet-layout="portrait"] .heritage-hero-section > div > .relative.z-10 {
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
        }

        html[data-legacy-tablet-layout="landscape"] .family-tree-workspace {
          grid-template-columns: minmax(250px, 300px) minmax(0, 1fr) !important;
          grid-template-areas: "member tree" !important;
        }
        html[data-legacy-tablet-layout="landscape"] .family-tree-workspace .member-panel { grid-area: member !important; }
        html[data-legacy-tablet-layout="landscape"] .family-tree-canvas:not(.legacy-tree-fullscreen) {
          grid-area: tree !important;
          height: clamp(620px, 70dvh, 820px) !important;
        }
        html[data-legacy-tablet-layout="landscape"] .heritage-page-content {
          max-width: 72rem !important;
        }
        html[data-legacy-tablet-layout="landscape"] .heritage-page-content .heritage-filters {
          flex-direction: row !important;
          align-items: center !important;
        }
        html[data-legacy-tablet-layout="landscape"] .heritage-page-content [class*="columns-"] {
          columns: 2 !important;
        }

        @media (max-width: 640px) {
          .legacy-section-bar { flex-direction: column; align-items: stretch; padding: 12px; border-radius: 20px; }
          .legacy-section-copy { text-align: right; padding-inline: 4px; }
          .legacy-section-tabs { width: 100%; grid-template-columns: 1fr 1fr; }
          .legacy-fullscreen-trigger { top: 10px; left: 10px; width: 44px; padding: 0; justify-content: center; }
          .legacy-fullscreen-trigger span { display: none; }
          .legacy-fullscreen-toolbar {
            top: 8px;
            right: 8px;
            left: 8px;
            flex-wrap: wrap;
            min-height: 0;
            border-radius: 16px;
          }
          .legacy-fullscreen-title { order: 1; flex: 1; }
          .legacy-tree-exit { order: 2; width: 42px; padding: 0; }
          .legacy-tree-exit span { display: none; }
          .legacy-fullscreen-search { order: 3; flex-basis: calc(100% - 150px); min-width: 150px; }
          .legacy-tree-tools { order: 4; margin-inline-start: 0; }
          .legacy-tree-tool { width: 38px; height: 38px; }
          .legacy-minimap-panel { right: 10px; bottom: 78px; width: min(260px, calc(100% - 20px)); }
          .legacy-minimap-body { height: 130px; }
        }
      `}</style>

      {sectionHost &&
        createPortal(
          <div className="legacy-section-bar" dir="rtl">
            <div className="legacy-section-copy">
              <div className="legacy-section-title">
                <GitBranch size={20} />
                <span>إرث العائلة</span>
              </div>
              <div className="legacy-section-subtitle">النسب والموروث في قسم واحد مرتب ومترابط</div>
            </div>
            <nav className="legacy-section-tabs" aria-label="أقسام إرث العائلة">
              <Link
                to="/family-tree"
                className="legacy-section-tab"
                data-active={page === "family-tree"}
                aria-current={page === "family-tree" ? "page" : undefined}
              >
                <Trees size={17} />
                شجرة العائلة
              </Link>
              <Link
                to="/heritage"
                className="legacy-section-tab"
                data-active={page === "heritage"}
                aria-current={page === "heritage" ? "page" : undefined}
              >
                <BookOpen size={17} />
                الإرث
              </Link>
            </nav>
          </div>,
          sectionHost,
        )}

      {canvasHost &&
        createPortal(
          <>
            {!isFullscreen && (
              <button
                type="button"
                className="legacy-fullscreen-trigger"
                onClick={() => setIsFullscreen(true)}
                aria-label="عرض شجرة العائلة بملء الشاشة"
                title="عرض شجرة العائلة بملء الشاشة"
              >
                <Maximize2 size={18} />
                <span>ملء الشاشة</span>
              </button>
            )}

            {isFullscreen && (
              <div className="legacy-fullscreen-ui">
                <div className="legacy-fullscreen-toolbar">
                  <div className="legacy-fullscreen-title">
                    <Trees size={20} />
                    <span>شجرة عائلة السيف</span>
                  </div>

                  <div className="legacy-fullscreen-search">
                    <Search size={17} />
                    <input
                      type="search"
                      value={fullscreenSearch}
                      onChange={(event) => handleFullscreenSearch(event.target.value)}
                      placeholder="ابحث عن فرد..."
                      aria-label="البحث داخل شجرة العائلة"
                    />
                  </div>

                  <div className="legacy-tree-tools" aria-label="أدوات عرض الشجرة">
                    <button
                      type="button"
                      className="legacy-tree-tool"
                      onClick={() => clickTreeControl("تكبير الشجرة")}
                      aria-label="تكبير"
                      title="تكبير"
                    >
                      <Plus size={18} />
                    </button>
                    <button
                      type="button"
                      className="legacy-tree-tool"
                      onClick={() => clickTreeControl("تصغير الشجرة")}
                      aria-label="تصغير"
                      title="تصغير"
                    >
                      <Minus size={18} />
                    </button>
                    <button
                      type="button"
                      className="legacy-tree-tool"
                      onClick={() => clickTreeControl("إعادة ضبط العرض")}
                      aria-label="احتواء الشجرة"
                      title="احتواء الشجرة"
                    >
                      <RotateCcw size={17} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="legacy-tree-exit"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="الخروج من ملء الشاشة"
                  >
                    <Minimize2 size={17} />
                    <span>إنهاء العرض الكامل</span>
                  </button>
                </div>

                <aside
                  className={cn(
                    "legacy-minimap-panel",
                    !miniMapOpen && "legacy-minimap-collapsed",
                  )}
                  aria-label="خريطة الفروع المصغرة"
                >
                  <div className="legacy-minimap-head">
                    <span className="flex items-center gap-2">
                      <GitBranch size={16} />
                      خريطة الفروع
                    </span>
                    <button
                      type="button"
                      className="legacy-minimap-toggle"
                      onClick={() => setMiniMapOpen((open) => !open)}
                      aria-label={miniMapOpen ? "طي خريطة الفروع" : "فتح خريطة الفروع"}
                      title={miniMapOpen ? "طي الخريطة" : "فتح الخريطة"}
                    >
                      {miniMapOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                    </button>
                  </div>
                  {miniMapOpen && (
                    <div
                      ref={miniMapRef}
                      className="legacy-minimap-body"
                      data-legacy-minimap-body="true"
                    />
                  )}
                </aside>
              </div>
            )}
          </>,
          canvasHost,
        )}
    </>
  );
}
