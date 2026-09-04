import { Link, useLocation } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  GitBranch,
  Layers3,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Trees,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "./legacy-reference.css";

type LegacyPage = "family-tree" | "heritage";

type FamilyStats = {
  total: number;
  generations: number;
  branches: number;
  heritage: number;
};

type BranchSummary = {
  id: string;
  name: string;
  count: number;
};

const SECTION_HOST_ATTR = "data-legacy-section-host";
const LEFT_HOST_ATTR = "data-legacy-tree-left-host";
const RIGHT_HOST_ATTR = "data-legacy-tree-right-host";
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

function LegacyTabs({ active }: { active: LegacyPage }) {
  return (
    <div className="legacy-reference-tabs" role="tablist" aria-label="إرث العائلة">
      <Link
        to="/family-tree"
        className="legacy-reference-tab"
        data-active={active === "family-tree"}
        role="tab"
        aria-selected={active === "family-tree"}
      >
        <Trees size={17} />
        <span>شجرة العائلة</span>
      </Link>
      <Link
        to="/heritage"
        className="legacy-reference-tab"
        data-active={active === "heritage"}
        role="tab"
        aria-selected={active === "heritage"}
      >
        <BookOpen size={17} />
        <span>الإرث</span>
      </Link>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="legacy-reference-search">
      <Search size={17} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function LegacyExperienceEnhancer() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const page = isLegacyPage(pathname);

  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);
  const [leftHost, setLeftHost] = useState<HTMLElement | null>(null);
  const [rightHost, setRightHost] = useState<HTMLElement | null>(null);
  const [canvasHost, setCanvasHost] = useState<HTMLElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(true);
  const [treeSearch, setTreeSearch] = useState("");
  const [stats, setStats] = useState<FamilyStats>({ total: 0, generations: 0, branches: 0, heritage: 0 });
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [latestMember, setLatestMember] = useState<string>("");
  const miniMapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!page || typeof document === "undefined") {
      setSectionHost(null);
      setLeftHost(null);
      setRightHost(null);
      setCanvasHost(null);
      setCanvas(null);
      return;
    }

    let ownedSection: HTMLElement | null = null;
    let ownedLeft: HTMLElement | null = null;
    let ownedRight: HTMLElement | null = null;
    let ownedCanvas: HTMLElement | null = null;

    const ensureHosts = () => {
      const pageRoot = document.querySelector<HTMLElement>(
        page === "family-tree" ? ".family-tree-page" : ".heritage-page-content",
      );
      if (!pageRoot) return;

      let sectionNode = pageRoot.querySelector<HTMLElement>(`[${SECTION_HOST_ATTR}]`);
      if (!sectionNode) {
        sectionNode = document.createElement("div");
        sectionNode.setAttribute(SECTION_HOST_ATTR, "true");
        pageRoot.insertBefore(sectionNode, pageRoot.firstChild);
        ownedSection = sectionNode;
      }
      setSectionHost(sectionNode);

      if (page !== "family-tree") {
        setLeftHost(null);
        setRightHost(null);
        setCanvasHost(null);
        setCanvas(null);
        return;
      }

      const workspace = pageRoot.querySelector<HTMLElement>(".family-tree-workspace");
      const treeCanvas = pageRoot.querySelector<HTMLElement>(".family-tree-canvas");
      if (!workspace || !treeCanvas) return;

      let leftNode = workspace.querySelector<HTMLElement>(`[${LEFT_HOST_ATTR}]`);
      if (!leftNode) {
        leftNode = document.createElement("aside");
        leftNode.setAttribute(LEFT_HOST_ATTR, "true");
        workspace.insertBefore(leftNode, workspace.firstChild);
        ownedLeft = leftNode;
      }

      let rightNode = workspace.querySelector<HTMLElement>(`[${RIGHT_HOST_ATTR}]`);
      if (!rightNode) {
        rightNode = document.createElement("aside");
        rightNode.setAttribute(RIGHT_HOST_ATTR, "true");
        workspace.appendChild(rightNode);
        ownedRight = rightNode;
      }

      let canvasNode = treeCanvas.querySelector<HTMLElement>(`[${CANVAS_HOST_ATTR}]`);
      if (!canvasNode) {
        canvasNode = document.createElement("div");
        canvasNode.setAttribute(CANVAS_HOST_ATTR, "true");
        treeCanvas.appendChild(canvasNode);
        ownedCanvas = canvasNode;
      }

      setLeftHost(leftNode);
      setRightHost(rightNode);
      setCanvasHost(canvasNode);
      setCanvas(treeCanvas);

      const sourceSearch = pageRoot.querySelector<HTMLInputElement>('header input[type="search"]');
      if (sourceSearch) setTreeSearch(sourceSearch.value ?? "");
    };

    ensureHosts();
    const observer = new MutationObserver(ensureHosts);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      ownedSection?.remove();
      ownedLeft?.remove();
      ownedRight?.remove();
      ownedCanvas?.remove();
      setSectionHost(null);
      setLeftHost(null);
      setRightHost(null);
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
    if (!page) return;
    let cancelled = false;

    void (async () => {
      try {
        const [profilesRes, extrasRes, heritageRes] = await Promise.all([
          supabase.from("profiles").select("id,parent_id,first_name,created_at"),
          (supabase as any).from("family_tree_extras").select("id,parent_id,first_name,created_at"),
          supabase
            .from("majlis_posts")
            .select("id", { count: "exact", head: true })
            .eq("kind", "discussion")
            .ilike("title", "[إرث]%"),
        ]);

        const rows = [
          ...((profilesRes.data ?? []) as any[]),
          ...(((extrasRes as any).data ?? []) as any[]),
        ].map((row) => ({
          id: String(row.id),
          parent_id: row.parent_id ? String(row.parent_id) : null,
          first_name: String(row.first_name ?? "فرد من العائلة"),
          created_at: row.created_at ? String(row.created_at) : "",
        }));

        if (cancelled) return;

        const byId = new Map(rows.map((row) => [row.id, row]));
        const children = new Map<string, string[]>();
        for (const row of rows) {
          if (!row.parent_id || !byId.has(row.parent_id)) continue;
          const list = children.get(row.parent_id) ?? [];
          list.push(row.id);
          children.set(row.parent_id, list);
        }

        const roots = rows.filter((row) => !row.parent_id || !byId.has(row.parent_id));
        const depthCache = new Map<string, number>();
        const getDepth = (id: string, trail = new Set<string>()): number => {
          if (depthCache.has(id)) return depthCache.get(id)!;
          if (trail.has(id)) return 1;
          const row = byId.get(id);
          if (!row?.parent_id || !byId.has(row.parent_id)) return 1;
          const nextTrail = new Set(trail);
          nextTrail.add(id);
          const depth = 1 + getDepth(row.parent_id, nextTrail);
          depthCache.set(id, depth);
          return depth;
        };

        const countDescendants = (id: string, seen = new Set<string>()): number => {
          if (seen.has(id)) return 0;
          const nextSeen = new Set(seen);
          nextSeen.add(id);
          return (children.get(id) ?? []).reduce(
            (total, childId) => total + 1 + countDescendants(childId, nextSeen),
            0,
          );
        };

        const branchRows = roots
          .map((root) => ({
            id: root.id,
            name: root.first_name.startsWith("فرع") ? root.first_name : `فرع ${root.first_name}`,
            count: countDescendants(root.id) + 1,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);

        const latest = [...rows]
          .filter((row) => row.created_at)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

        setBranches(branchRows);
        setLatestMember(latest?.first_name ?? "");
        setStats({
          total: rows.length,
          generations: rows.length ? Math.max(...rows.map((row) => getDepth(row.id))) : 0,
          branches: roots.length,
          heritage: heritageRes.count ?? 0,
        });
      } catch (error) {
        console.warn("Legacy family summary unavailable", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    if (!canvas) return;

    if (isFullscreen) {
      canvas.classList.add("legacy-tree-fullscreen");
      document.documentElement.classList.add("legacy-tree-fullscreen-open");
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

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
    if (!miniMapOpen || !canvas || !miniMapRef.current) return;

    let frame = 0;
    const target = miniMapRef.current;

    const syncMiniMap = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sourceSvg = Array.from(canvas.querySelectorAll<SVGSVGElement>("svg")).find(
          (svg) => !svg.hasAttribute("data-legacy-minimap-clone"),
        );
        if (!sourceSvg || !target) return;

        const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("data-legacy-minimap-clone", "true");
        clone.setAttribute("aria-hidden", "true");
        clone.style.width = "100%";
        clone.style.height = "100%";
        clone.style.pointerEvents = "none";
        clone.style.background = "transparent";
        target.replaceChildren(clone);
      });
    };

    syncMiniMap();
    const sourceSvg = Array.from(canvas.querySelectorAll<SVGSVGElement>("svg")).find(
      (svg) => !svg.hasAttribute("data-legacy-minimap-clone"),
    );
    const observer = new MutationObserver(syncMiniMap);
    observer.observe(sourceSvg ?? canvas, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["transform", "d", "x", "y", "style"],
    });
    window.addEventListener("resize", syncMiniMap);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", syncMiniMap);
      target.replaceChildren();
    };
  }, [canvas, miniMapOpen, isFullscreen]);

  useEffect(() => {
    if (page !== "family-tree") {
      setIsFullscreen(false);
      setMiniMapOpen(true);
    }
  }, [page]);

  const sourceSearch = useMemo(() => {
    if (page !== "family-tree" || typeof document === "undefined") return null;
    return document.querySelector<HTMLInputElement>('.family-tree-page header input[type="search"]');
  }, [page, sectionHost]);

  const handleTreeSearch = (value: string) => {
    setTreeSearch(value);
    if (sourceSearch) setNativeInputValue(sourceSearch, value);
  };

  const clickTreeControl = (label: string) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".family-tree-page button[aria-label]"),
    ).find((candidate) => candidate.getAttribute("aria-label") === label);
    button?.click();
  };

  const clickAddMember = () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".family-tree-page button")).find(
      (candidate) => candidate.textContent?.includes("إضافة فرد"),
    );
    button?.click();
  };

  if (!page) return null;

  const familyHeader = sectionHost
    ? createPortal(
        <section className="legacy-reference-shell" dir="rtl">
          <div className="legacy-tree-header">
            <SearchBox
              value={treeSearch}
              onChange={handleTreeSearch}
              placeholder="ابحث عن اسم أو رقم فرد..."
            />
            <div className="legacy-tree-title">
              <h1>شجرة عائلة السيف</h1>
              <p>إرث العائلة</p>
            </div>
            <div aria-hidden="true" />
          </div>
          <LegacyTabs active="family-tree" />
        </section>,
        sectionHost,
      )
    : null;

  const heritageHeader = sectionHost
    ? createPortal(
        <section className="legacy-reference-shell" dir="rtl">
          <div className="legacy-heritage-hero">
            <div className="legacy-heritage-copy">
              <h1>إرث العائلة</h1>
              <h2>قصص الأجداد ... جذور ممتدة ... وهوية خالدة</h2>
              <p>
                نحفظ تاريخنا لنصنع مستقبلًا يليق بعائلتنا، وفي كل ذكرى حكاية وفي كل فرع امتداد.
              </p>
            </div>
          </div>
          <div className="legacy-heritage-tabs-wrap">
            <LegacyTabs active="heritage" />
          </div>

          <div className="legacy-mobile-stats" aria-label="إحصائيات العائلة">
            <div className="legacy-mobile-stat"><strong>{stats.total}</strong><span>إجمالي الأفراد</span></div>
            <div className="legacy-mobile-stat"><strong>{stats.generations}</strong><span>الأجيال</span></div>
            <div className="legacy-mobile-stat"><strong>{stats.branches}</strong><span>الفروع</span></div>
            <div className="legacy-mobile-stat"><strong>{stats.heritage}</strong><span>الموروثات</span></div>
          </div>

          <div className="legacy-heritage-mobile-card">
            <div className="legacy-heritage-mobile-visual">
              <div className="legacy-tree-emblem"><Trees size={42} /></div>
            </div>
            <div className="legacy-heritage-mobile-copy">
              <h3>اكتشف شجرة عائلتك</h3>
              <p>تصفح الفروع والأفراد وتعرّف على روابط العائلة</p>
              <Link to="/family-tree"><Maximize2 size={17} /> عرض الشجرة</Link>
            </div>
          </div>
        </section>,
        sectionHost,
      )
    : null;

  const leftSidebar = leftHost
    ? createPortal(
        <div className="legacy-tree-side-card" dir="rtl">
          <h3 className="legacy-tree-side-title">إحصائيات العائلة</h3>
          <div className="legacy-stat-list">
            <div className="legacy-stat-row"><span>إجمالي الأفراد</span><strong>{stats.total}</strong></div>
            <div className="legacy-stat-row"><span>الأجيال الموثقة</span><strong>{stats.generations}</strong></div>
            <div className="legacy-stat-row"><span>الفروع الرئيسية</span><strong>{stats.branches}</strong></div>
            <div className="legacy-stat-row"><span>الموروثات</span><strong>{stats.heritage}</strong></div>
          </div>
          <button className="legacy-add-person" type="button" onClick={clickAddMember}>
            <UserPlus size={16} /> إضافة فرد جديد
          </button>
          <div className="legacy-side-quote">
            <b>”</b>
            <p>ما يضيع أصل وله فرع<br />ولا ينقطع ظل وله جذور</p>
          </div>
        </div>,
        leftHost,
      )
    : null;

  const rightSidebar = rightHost
    ? createPortal(
        <div className="legacy-tree-side-card" dir="rtl">
          <h3 className="legacy-tree-side-title">الفروع الرئيسية</h3>
          <div className="legacy-stat-list">
            {branches.length > 0 ? (
              branches.map((branch) => (
                <div className="legacy-branch-row" key={branch.id}>
                  <span>{branch.name}</span>
                  <strong>{branch.count}</strong>
                </div>
              ))
            ) : (
              <div className="legacy-branch-row"><span>جاري تحديد الفروع</span><strong>—</strong></div>
            )}
          </div>
          <div className="legacy-stat-list" style={{ marginTop: "auto" }}>
            <div className="legacy-stat-row"><span>آخر إضافة</span><strong style={{ fontSize: 11 }}>{latestMember || "—"}</strong></div>
            <div className="legacy-stat-row"><span>صلات القرابة</span><UsersRound size={17} /></div>
            <div className="legacy-stat-row"><span>خريطة الفروع</span><GitBranch size={17} /></div>
          </div>
        </div>,
        rightHost,
      )
    : null;

  const canvasOverlay = canvasHost
    ? createPortal(
        <div className="legacy-tree-overlay" dir="rtl">
          <div className="legacy-canvas-tools">
            <button className="legacy-canvas-tool" type="button" aria-label="تكبير" onClick={() => clickTreeControl("تكبير الشجرة")}><Plus size={17} /></button>
            <button className="legacy-canvas-tool" type="button" aria-label="تصغير" onClick={() => clickTreeControl("تصغير الشجرة")}><Minus size={17} /></button>
            <button className="legacy-canvas-tool" type="button" aria-label="إعادة الضبط" onClick={() => clickTreeControl("إعادة ضبط العرض")}><RotateCcw size={16} /></button>
          </div>

          <button className="legacy-fullscreen-button" type="button" onClick={() => setIsFullscreen(true)}>
            <Maximize2 size={16} /> عرض كامل
          </button>

          <div className={`legacy-minimap-shell ${miniMapOpen ? "" : "legacy-minimap-collapsed"}`}>
            <div className="legacy-minimap-head">
              <span>الخريطة المصغرة</span>
              <button type="button" onClick={() => setMiniMapOpen((value) => !value)} aria-label={miniMapOpen ? "طي الخريطة المصغرة" : "فتح الخريطة المصغرة"}>
                {miniMapOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
            {miniMapOpen && <div className="legacy-minimap-body" ref={miniMapRef} />}
          </div>

          {isFullscreen && (
            <div className="legacy-fullscreen-toolbar">
              <div className="legacy-fullscreen-title"><Trees size={18} /><span>شجرة عائلة السيف</span></div>
              <SearchBox value={treeSearch} onChange={handleTreeSearch} placeholder="ابحث عن فرد..." />
              <div className="legacy-fullscreen-actions">
                <button className="legacy-canvas-tool" type="button" onClick={() => clickTreeControl("تكبير الشجرة")}><Plus size={17} /></button>
                <button className="legacy-canvas-tool" type="button" onClick={() => clickTreeControl("تصغير الشجرة")}><Minus size={17} /></button>
                <button className="legacy-canvas-tool" type="button" onClick={() => clickTreeControl("إعادة ضبط العرض")}><RotateCcw size={16} /></button>
              </div>
              <button className="legacy-fullscreen-exit" type="button" onClick={() => setIsFullscreen(false)}>
                <Minimize2 size={15} /> الخروج من ملء الشاشة
              </button>
            </div>
          )}
        </div>,
        canvasHost,
      )
    : null;

  return (
    <>
      {page === "family-tree" ? familyHeader : heritageHeader}
      {page === "family-tree" && leftSidebar}
      {page === "family-tree" && rightSidebar}
      {page === "family-tree" && canvasOverlay}
    </>
  );
}
