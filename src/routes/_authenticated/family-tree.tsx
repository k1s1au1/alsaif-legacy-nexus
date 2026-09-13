import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LineageLegacyIcon } from "@/components/icons/lineage-legacy-icon";
import { UserAvatar } from "@/components/user-avatar";
import {
  setMemberParent,
  addExtraMember,
  deleteExtraMember,
} from "@/lib/api/family-tree.functions";
import {
  Loader2,
  Pencil,
  Check,
  Trees,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  ShieldCheck,
  UserPlus,
  Trash2,
  UserCircle2,
  GitBranch,
  IdCard,
  UsersRound,
  X,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export const Route = createFileRoute("/_authenticated/family-tree")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "نسب وأثر" },
      {
        name: "description",
        content: "أنساب عائلة السيف وإرثها المحفوظ عبر الأجيال.",
      },
    ],
  }),
  component: FamilyTreePage,
});

type Member = {
  id: string;
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  parent_id: string | null;
  kind: "profile" | "extra";
};

const NODE_W = 184;
const NODE_H = 116;

function shouldUseNativeIOSNodes() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent;
  const isClassicIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isModernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isClassicIOS || isModernIPad;
}

function shortenNodeLabel(value: string | null | undefined, maxLength = 15) {
  const label = value?.trim() || "—";
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function memberDisplayName(member: Member) {
  return (
    member.full_name?.trim() ||
    [member.first_name, member.father_name, member.grandfather_name]
      .filter(Boolean)
      .join(" ") ||
    "فرد من العائلة"
  );
}

function memberCardName(member: Member) {
  return [member.first_name, member.father_name].filter(Boolean).join(" ") || "فرد من العائلة";
}

function FamilyTreePage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
    id?: string;
  } | null>(null);
  const [isPriv, setIsPriv] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.68);
  const [translate, setTranslate] = useState({ x: 200, y: 100 });
  const [addOpen, setAddOpen] = useState(false);
  const [pathIds, setPathIds] = useState<Set<string>>(new Set());
  const [useNativeIOSNodes] = useState(shouldUseNativeIOSNodes);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastContainerWidthRef = useRef(0);
  const mobileTreeInitializedRef = useRef(false);

  // Normalizing Arabic text for better search
  const normalize = (text: string) => {
    return text
      ? text
          .replace(/[أإآ]/g, "ا")
          .replace(/ة/g, "ه")
          .replace(/ى/g, "ي")
          .trim()
      : "";
  };

  const setParentFn = useServerFn(setMemberParent);
  const addExtraFn = useServerFn(addExtraMember);
  const deleteExtraFn = useServerFn(deleteExtraMember);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        const rs = (roles ?? []).map((r) => r.role);
        const isAdmin = rs.includes("admin") || rs.includes("manager") || rs.includes("chairman");
        const profileName = profile?.arabic_name || profile?.full_name || "عضو";
        setMe({
          name: profileName,
          role: rs.includes("admin")
            ? "مسؤول تقني"
            : rs.includes("chairman")
              ? "رئيس المجلس"
              : rs.includes("manager")
                ? "مسؤول قسم"
                : "عضو",
          initial: (profileName[0] || "ع").toUpperCase(),
          avatarPath: profile?.avatar_url,
          id: user.id,
        });
        setSelectedId(user.id);
        setIsPriv(isAdmin);
        await load();
      } catch (err) {
        console.error("Initialization failed", err);
      }
    })();
  }, []);

  useRealtimeSync(["profiles", "family_tree_extras", "user_roles"], () => {
    void load();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frameId = 0;
    const syncTreePosition = (force = false) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const width = container.getBoundingClientRect().width;
        if (!width) return;

        if (force || Math.abs(width - lastContainerWidthRef.current) > 1) {
          lastContainerWidthRef.current = width;
          const isMobileTree = width < 768;
          setTranslate({ x: width / 2, y: isMobileTree ? 150 : useNativeIOSNodes ? 112 : 96 });
          if (isMobileTree && !mobileTreeInitializedRef.current) {
            mobileTreeInitializedRef.current = true;
            setZoom(0.52);
          }
        }
      });
    };

    syncTreePosition(true);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => syncTreePosition());
    resizeObserver?.observe(container);

    const handleOrientationChange = () => syncTreePosition(true);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [members.length, useNativeIOSNodes]);

  async function load() {
    setLoading(true);
    try {
      const [profilesRes, extrasRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
          )
          .order("first_name", { ascending: true }),
        supabase
          .from("family_tree_extras" as any)
          .select("*")
          .order("first_name", { ascending: true }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      const profileMembers: Member[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        father_name: p.father_name,
        grandfather_name: p.grandfather_name,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        parent_id: p.parent_id,
        kind: "profile",
      }));
      const extraMembers: Member[] = ((extrasRes.data as any[]) ?? []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        father_name: p.father_name,
        grandfather_name: p.grandfather_name,
        full_name: [p.first_name, p.father_name, p.grandfather_name].filter(Boolean).join(" "),
        avatar_url: null,
        parent_id: p.parent_id,
        kind: "extra",
      }));
      setMembers([...profileMembers, ...extraMembers]);
    } catch (e: any) {
      toast.error("حدث خطأ أثناء تحميل البيانات", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  const treeData = useMemo<RawNodeDatum[]>(() => {
    if (members.length === 0) return [];
    const byId = new Map<string, Member>();
    const byParent = new Map<string | null, Member[]>();
    for (const m of members) byId.set(m.id, m);
    for (const m of members) {
      const key = m.parent_id && byId.has(m.parent_id) ? m.parent_id : null;
      const arr = byParent.get(key) ?? [];
      arr.push(m);
      byParent.set(key, arr);
    }
    const build = (m: Member): RawNodeDatum => {
      const kids = byParent.get(m.id) ?? [];
      return {
        name: m.first_name || "—",
        attributes: { memberId: m.id } as any,
        children: kids.map(build),
      };
    };
    const roots = byParent.get(null) ?? [];
    if (!roots.length) return [];
    return [
      {
        name: "عائلة السيف",
        attributes: { memberId: "__root__" } as any,
        children: roots.map(build),
      },
    ];
  }, [members]);

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const getAncestorIds = (memberId: string) => {
    const ids: string[] = [];
    let current = membersById.get(memberId);
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      ids.push(current.id);
      visited.add(current.id);
      current = current.parent_id ? membersById.get(current.parent_id) : undefined;
    }

    return ids;
  };

  const highlightRelationship = (memberId: string) => {
    const targetAncestors = getAncestorIds(memberId);

    if (!me?.id) {
      setPathIds(new Set(targetAncestors));
      return;
    }

    const myAncestors = getAncestorIds(me.id);
    const commonAncestor = myAncestors.find((id) => targetAncestors.includes(id));

    if (!commonAncestor) {
      setPathIds(new Set(targetAncestors));
      return;
    }

    const relationshipPath = new Set<string>();
    for (const id of myAncestors) {
      relationshipPath.add(id);
      if (id === commonAncestor) break;
    }
    for (const id of targetAncestors) {
      relationshipPath.add(id);
      if (id === commonAncestor) break;
    }
    setPathIds(relationshipPath);
  };

  const selectedMember = selectedId ? membersById.get(selectedId) ?? null : null;
  const selectedLineage = useMemo(() => {
    if (!selectedId) return [];
    return getAncestorIds(selectedId)
      .reverse()
      .map((id) => membersById.get(id)?.first_name)
      .filter((name): name is string => Boolean(name));
  }, [membersById, selectedId]);

  async function saveParent(member: Member) {
    setSaving(true);
    try {
      await setParentFn({ data: { userId: member.id, parentId: draftParent, kind: member.kind } });
      toast.success("تم التحديث بنجاح");
      setEditing(null);
      await load();
      router.invalidate();
    } catch (e: any) {
      toast.error("فشل الحفظ", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: Member) {
    if (!confirm(`حذف ${member.first_name} من الشجرة؟`)) return;
    try {
      await deleteExtraFn({ data: { id: member.id } });
      toast.success("تم الحذف");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error("فشل الحذف", { description: e.message });
    }
  }

  const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
    const memberId = nodeDatum.attributes?.memberId as string | undefined;
    const m = memberId ? members.find((mem) => mem.id === memberId) : null;
    const isRoot = memberId === "__root__";
    const isMe = me?.id && m && m.id === me.id;
    const isInPath = memberId && pathIds.has(memberId);
    const isSelected = Boolean(memberId && memberId === selectedId);

    const handleNodeClick = () => {
      if (isRoot) {
        setSelectedId(null);
        setPathIds(new Set());
        toggleNode();
        return;
      }

      if (!memberId) return;
      setSelectedId(memberId);
      highlightRelationship(memberId);

      toggleNode();
    };

    // Improved search matching with normalization
    const isSearchMatch =
      search &&
      m &&
      (normalize(m.first_name || "").includes(normalize(search)) ||
       normalize(m.full_name || "").includes(normalize(search)));

    const isExtra = m?.kind === "extra";

    if (useNativeIOSNodes) {
      const nodeName = isRoot ? nodeDatum.name : m ? memberCardName(m) : "فرد من العائلة";
      const nodeSubtitle = isRoot ? "جذور العائلة" : isExtra ? "قيد التسجيل" : "عضو العائلة";
      const initial = isRoot ? "س" : shortenNodeLabel(m?.first_name, 2).slice(0, 1);
      const cardFill = isRoot
        ? "#0F5139"
        : isSelected
          ? "#D6AD4B"
          : isInPath
            ? "#FFF2C7"
            : isExtra
              ? "#FFF9E9"
              : "#FFFEFA";
      const cardStroke = isRoot || isSelected || isSearchMatch ? "#C79A32" : "#D8CCAB";
      const primaryText = isRoot ? "#FFFFFF" : "#153D2F";
      const secondaryText = isRoot ? "#F7D98A" : "#8A713A";

      return (
        <g
          className="ios-native-tree-node"
          onClick={handleNodeClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleNodeClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${nodeName}، ${nodeSubtitle}`}
          style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
        >
          {(isSearchMatch || isSelected) && (
            <rect
              x={-97}
              y={-59}
              width={194}
              height={118}
              rx={26}
              fill="none"
              stroke="#C79A32"
              strokeWidth={isSearchMatch ? 5 : 3}
              opacity={0.82}
            />
          )}

          <rect
            x={-91}
            y={-53}
            width={182}
            height={106}
            rx={22}
            fill={cardFill}
            stroke={cardStroke}
            strokeWidth={isSelected ? 3 : 2}
          />

          <circle
            cx={0}
            cy={-51}
            r={25}
            fill={isRoot || isSelected || isMe ? "#0F5139" : "#FFFFFF"}
            stroke="#D6AD4B"
            strokeWidth={3}
          />
          <text
            x={0}
            y={-50}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isRoot || isSelected || isMe ? "#F7D98A" : "#153D2F"}
            fontSize={20}
            fontWeight={700}
            direction="rtl"
          >
            {initial}
          </text>

          <text
            x={0}
            y={7}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={primaryText}
            fontSize={15}
            fontWeight={700}
            direction="rtl"
          >
            {shortenNodeLabel(nodeName, 20)}
          </text>
          <text
            x={0}
            y={31}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={secondaryText}
            fontSize={11}
            fontWeight={500}
            direction="rtl"
          >
            {nodeSubtitle}
          </text>

          {isPriv && !isRoot && m && (
            <g
              transform="translate(74 -43)"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(m.id);
                setDraftParent(m.parent_id);
              }}
              role="button"
              aria-label={`تعديل ارتباط ${m.first_name || "الفرد"}`}
            >
              <circle r={15} fill="#FFFFFF" stroke="#C79A32" strokeWidth={2} />
              <text
                x={0}
                y={1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#153D2F"
                fontSize={15}
                fontWeight={900}
              >
                ✎
              </text>
            </g>
          )}
        </g>
      );
    }

    return (
      <g className="node-group">
        <foreignObject width={NODE_W} height={NODE_H} x={-NODE_W / 2} y={-NODE_H / 2}>
          <div
            {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
            onClick={handleNodeClick}
            className={cn(
              "tree-node-content relative cursor-pointer group transition-transform duration-300",
              isSearchMatch && "scale-105",
            )}
          >
            <div
              className={cn(
                "absolute inset-x-1 top-5 bottom-1 rounded-[22px] border-2 px-3 pb-3 pt-9 text-center shadow-[0_10px_24px_rgba(34,51,42,0.12)] transition-all duration-300",
                isRoot
                  ? "border-[#C79A32] bg-[#0F5139] text-white"
                  : isSelected
                    ? "border-[#0F5139] bg-[#D6AD4B] text-[#153D2F] shadow-[0_14px_30px_rgba(199,154,50,0.28)]"
                    : isInPath
                      ? "border-[#D6AD4B] bg-[#FFF2C7] text-[#153D2F]"
                      : isExtra
                        ? "border-[#DCCB9E] bg-[#FFF9E9] text-[#153D2F]"
                        : "border-[#DED4B9] bg-[#FFFEFA] text-[#153D2F]",
                isSearchMatch && "ring-4 ring-[#D6AD4B]/45",
              )}
            >
              <div
                className={cn(
                  "absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#D6AD4B] bg-white shadow-md",
                  (isRoot || isSelected || isMe) && "bg-[#0F5139]",
                )}
              >
                {isRoot ? (
                  <Trees size={25} className="text-[#F5CF73]" />
                ) : isExtra ? (
                  <UserCircle2 size={30} className="text-[#90753C]" />
                ) : (
                  <UserAvatar
                    name={m?.first_name || "ع"}
                    path={m?.avatar_url}
                    className="size-full"
                    userId={m?.id}
                  />
                )}
              </div>

              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-black tracking-tight">
                {isRoot ? nodeDatum.name : m ? memberCardName(m) : "فرد من العائلة"}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] font-bold",
                  isRoot ? "text-[#F5CF73]" : "text-[#8A713A]",
                )}
              >
                {isRoot ? "جذور العائلة" : isExtra ? "قيد التسجيل" : "عضو العائلة"}
              </p>
            </div>

            {isPriv && !isRoot && m && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(m.id);
                  setDraftParent(m.parent_id);
                }}
                aria-label={`تعديل ارتباط ${m.first_name || "الفرد"}`}
                className="absolute right-0 top-1 z-10 flex size-8 items-center justify-center rounded-full border-2 border-[#D6AD4B] bg-white text-[#153D2F] shadow-md transition-colors hover:bg-[#0F5139] hover:text-white"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </foreignObject>
      </g>
    );
  };

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-gold-primary" />
      </div>
    );
  }

  const editingMember = editing ? members.find((m) => m.id === editing) : null;

  return (
    <AppShell title="نسب وأثر" user={me}>
      <div className="family-tree-page space-y-4 px-1 md:px-0">
        <header className="rounded-[24px] border border-[#E7E0CF] bg-white p-4 shadow-[0_12px_34px_rgba(30,59,47,0.08)] md:rounded-[30px] md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F5139] shadow-lg shadow-[#0F5139]/15 md:size-14">
                <LineageLegacyIcon className="size-6 text-[#F5CF73] md:size-7" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black text-[#153D2F] md:text-2xl">
                  نسب وأثر
                </h1>
                <p className="mt-0.5 text-sm font-bold text-[#7B7B76]">
                  أنساب العائلة وإرثها
                </p>
              </div>
            </div>

            {isPriv && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn-gold flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black shadow-md"
              >
                <UserPlus className="size-4" />
                <span>إضافة فرد</span>
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#8E8E88]" />
              <input
                type="search"
                placeholder="ابحث عن فرد..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-transparent bg-[#F6F4EF] pr-12 pl-4 text-base font-bold text-[#153D2F] outline-none transition focus:border-[#D6AD4B] focus:bg-white focus:ring-4 focus:ring-[#D6AD4B]/10"
              />
            </div>

            <div className="flex items-center justify-center gap-2 md:justify-start">
              <ControlBtn
                label="تكبير الشجرة"
                onClick={() => setZoom((value) => Math.min(2, value + 0.15))}
                icon={<ZoomIn size={19} />}
              />
              <ControlBtn
                label="تصغير الشجرة"
                onClick={() => setZoom((value) => Math.max(0.1, value - 0.15))}
                icon={<ZoomOut size={19} />}
              />
              <ControlBtn
                label="إعادة ضبط العرض"
                onClick={() => {
                  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
                  setZoom(mobile ? 0.52 : 0.68);
                  if (containerRef.current) {
                    setTranslate({
                      x: containerRef.current.clientWidth / 2,
                      y: mobile ? 150 : useNativeIOSNodes ? 112 : 96,
                    });
                  }
                }}
                icon={<Maximize2 size={19} />}
              />
            </div>
          </div>
        </header>

        <div className="family-tree-workspace">
          <aside className="member-panel">
            {selectedMember ? (
              <div className="member-panel-content">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#F6D37E]">
                    <IdCard className="size-5" />
                    <span className="text-sm font-black">بطاقة الفرد</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setPathIds(new Set());
                    }}
                    aria-label="إغلاق بطاقة الفرد"
                    className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/15"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="member-summary">
                  <div className="member-avatar">
                    {selectedMember.kind === "extra" ? (
                      <UserCircle2 className="size-12 text-[#8B713B]" />
                    ) : (
                      <UserAvatar
                        name={selectedMember.first_name || "ع"}
                        path={selectedMember.avatar_url}
                        className="size-full"
                        userId={selectedMember.id}
                      />
                    )}
                  </div>
                  <div className="member-summary-copy min-w-0">
                    <h2 className="text-xl font-black leading-snug text-white">
                      {memberDisplayName(selectedMember)}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-[#F6D37E]">
                      {selectedMember.kind === "extra" ? "فرد مضاف إلى الشجرة" : "عضو مرتبط بالنظام"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/10 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black text-white/70">
                    <GitBranch className="size-4 text-[#F6D37E]" />
                    مسار العائلة
                  </div>
                  <p className="text-sm font-black leading-7 text-[#F8E7B5]">
                    {selectedLineage.length > 0 ? selectedLineage.join(" ← ") : "غير محدد"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <div className="member-info-row">
                    <span>الفرع</span>
                    <strong>
                      {selectedMember.father_name ? `فرع ${selectedMember.father_name}` : "جذور العائلة"}
                    </strong>
                  </div>
                  <div className="member-info-row">
                    <span>السجل</span>
                    <strong>{selectedMember.kind === "extra" ? "مضاف يدويًا" : "حساب معتمد"}</strong>
                  </div>
                </div>

                <div className="mt-auto grid gap-2 pt-1">
                  {selectedMember.kind === "profile" && (
                    <button
                      type="button"
                      onClick={() =>
                        router.navigate({
                          to: "/members/$userId",
                          params: { userId: selectedMember.id },
                        })
                      }
                      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D6AD4B] px-4 text-sm font-black text-[#153D2F] shadow-lg shadow-black/10 transition hover:bg-[#E1BB5C]"
                    >
                      عرض الملف
                      <ArrowLeft className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => highlightRelationship(selectedMember.id)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#D6AD4B] bg-transparent px-4 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    <GitBranch className="size-4 text-[#F6D37E]" />
                    تحديد صلة القرابة
                  </button>
                  {isPriv && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(selectedMember.id);
                        setDraftParent(selectedMember.parent_id);
                      }}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-black text-[#F8E7B5] transition hover:bg-white/10"
                    >
                      <Pencil className="size-4" />
                      تعديل الارتباط
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-52 flex-col items-center justify-center px-5 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-[#D6AD4B]/40 bg-white/5 text-[#F6D37E]">
                  <UsersRound className="size-8" />
                </div>
                <h2 className="mt-4 text-lg font-black text-white">اختر فردًا من الشجرة</h2>
                <p className="mt-2 max-w-56 text-sm font-bold leading-6 text-white/60">
                  ستظهر هنا بياناته ومسار صلة القرابة به.
                </p>
              </div>
            )}
          </aside>

          <div
            ref={containerRef}
            className="family-tree-canvas family-tree-approved relative w-full overflow-hidden rounded-[28px] border border-[#DCCDA8] shadow-[0_18px_45px_rgba(40,58,48,0.14)] md:rounded-[34px]"
          >
            <div className="family-tree-approved-heading">
              <div className="family-tree-approved-copy">
                <span className="family-tree-approved-icon"><Trees size={22} /></span>
                <div>
                  <h2>شجرة العائلة</h2>
                  <p>اكتشف روابط العائلة وتعرّف على أصولك</p>
                </div>
              </div>
              <button
                type="button"
                className="family-tree-approved-fit"
                onClick={() => {
                  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
                  setZoom(mobile ? 0.52 : 0.68);
                  if (containerRef.current) {
                    setTranslate({
                      x: containerRef.current.clientWidth / 2,
                      y: mobile ? 148 : useNativeIOSNodes ? 112 : 96,
                    });
                  }
                }}
              >
                <Maximize2 size={17} />
                <span>عرض الكل</span>
              </button>
            </div>
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FAF7EE]/75 backdrop-blur-sm">
                <Loader2 className="size-10 animate-spin text-[#B78A2B]" />
              </div>
            ) : treeData.length > 0 ? (
              <Tree
                data={treeData[0]}
                orientation="vertical"
                translate={translate}
                zoom={zoom}
                onUpdate={(state) => {
                  if (Math.abs(state.zoom - zoom) > 0.01) setZoom(state.zoom);
                  if (
                    Math.abs(state.translate.x - translate.x) > 1 ||
                    Math.abs(state.translate.y - translate.y) > 1
                  ) {
                    setTranslate(state.translate);
                  }
                }}
                pathFunc="diagonal"
                pathClassFunc={(link) => {
                  const targetId = link.target.data.attributes?.memberId as string;
                  const sourceId = link.source.data.attributes?.memberId as string;
                  if (pathIds.has(targetId) && pathIds.has(sourceId)) return "tree-link-active";
                  return "tree-link-curved";
                }}
                nodeSize={{ x: NODE_W + 72, y: NODE_H + 74 }}
                renderCustomNodeElement={renderNode}
                collapsible={false}
                zoomable
                draggable
                transitionDuration={useNativeIOSNodes ? 0 : 500}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-[#6F766F]">
                <Trees className="mb-3 size-9 text-[#B78A2B]" />
                <p className="text-base font-black">لا توجد بيانات لعرضها في الشجرة</p>
              </div>
            )}
          </div>
        </div>

        {editingMember && (
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <div
              dir="rtl"
              className="w-full max-w-sm rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 space-y-5 shadow-2xl animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full overflow-hidden ring-2 ring-gold-primary/10 bg-[#D4AF37]/20 flex items-center justify-center">
                  {editingMember.kind === "extra" ? (
                    <UserCircle2 className="size-7 text-[#8E7745]" />
                  ) : (
                    <UserAvatar
                      name={editingMember.first_name || "ع"}
                      path={editingMember.avatar_url}
                      className="size-full"
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1B4332]">
                    تعديل ارتباط {editingMember.first_name}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
                    {editingMember.kind === "extra" ? (
                      "فرد مضاف بدون حساب"
                    ) : (
                      <>
                        <ShieldCheck size={12} /> حساب معتمد ومرتبط بالنظام
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">
                  والد العضو
                </label>
                <select
                  value={draftParent ?? ""}
                  onChange={(e) => setDraftParent(e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all"
                >
                  <option value="">— لا أب (رأس شجرة) —</option>
                  {members
                    .filter((x) => x.id !== editingMember.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {(x.full_name || x.first_name) + (x.kind === "extra" ? " (بدون حساب)" : "")}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingMember.kind === "extra" && (
                  <button
                    onClick={() => handleDelete(editingMember)}
                    className="p-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                    title="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => saveParent(editingMember)}
                  disabled={saving}
                  className="flex-[2] btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Check size={16} />} حفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {addOpen && isPriv && (
          <AddMemberDialog
            members={members}
            onClose={() => setAddOpen(false)}
            onSubmit={async (payload) => {
              try {
                await addExtraFn({ data: payload });
                toast.success("تمت الإضافة بنجاح");
                setAddOpen(false);
                await load();
              } catch (e: any) {
                toast.error("فشل الإضافة", { description: e.message });
                throw e;
              }
            }}
          />
        )}
      </div>

      <style>{`
        .family-tree-workspace {
          display: grid;
          grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
          grid-template-areas: "member tree";
          gap: 16px;
          align-items: stretch;
          direction: ltr;
        }

        .member-panel {
          grid-area: member;
          direction: rtl;
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(214, 173, 75, 0.48);
          border-radius: 30px;
          color: white;
          background:
            radial-gradient(circle at 14% 8%, rgba(246, 211, 126, 0.14), transparent 28%),
            linear-gradient(155deg, #0f5a3f 0%, #073b2c 100%);
          box-shadow: 0 18px 45px rgba(25, 60, 44, 0.18);
        }

        .member-panel-content {
          display: flex;
          height: 100%;
          min-height: 0;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
        }

        .member-summary {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding-block: 4px;
          text-align: center;
        }

        .member-summary-copy {
          text-align: center;
        }

        .member-avatar {
          display: flex;
          width: 88px;
          height: 88px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 4px solid #d6ad4b;
          border-radius: 999px;
          background: #fffdf7;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
        }

        .member-info-row {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          padding: 12px 13px;
          font-size: 13px;
        }

        .member-info-row span {
          color: rgba(255, 255, 255, 0.62);
          font-weight: 700;
        }

        .member-info-row strong {
          min-width: 0;
          overflow: hidden;
          color: #f8e7b5;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tree-link-curved {
          fill: none;
          stroke: #b99745;
          stroke-width: 2.8px;
          stroke-linecap: round;
          opacity: 0.62;
          transition: all 0.35s ease;
        }

        .tree-link-active {
          fill: none;
          stroke: #0f5a3f;
          stroke-width: 5px;
          stroke-linecap: round;
          opacity: 1;
          filter: drop-shadow(0 3px 5px rgba(15, 90, 63, 0.26));
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-path 1s ease forwards;
        }

        @keyframes draw-path {
          to {
            stroke-dashoffset: 0;
          }
        }

        .rd3t-tree-container {
          width: 100%;
          height: 100%;
          background: transparent;
        }

        .family-tree-canvas {
          grid-area: tree;
          direction: rtl;
          height: min(760px, calc(100vh - 250px));
          min-height: 600px;
          overscroll-behavior: contain;
          -webkit-user-select: none;
          user-select: none;
        }

        @supports (height: 100dvh) {
          .family-tree-canvas {
            height: min(760px, calc(100dvh - 250px - env(safe-area-inset-bottom, 0px)));
          }
        }

        .family-tree-canvas .rd3t-tree-container,
        .family-tree-canvas .rd3t-tree-container > svg {
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .family-tree-approved-heading {
          position: absolute;
          z-index: 25;
          top: 16px;
          right: 18px;
          left: 18px;
          display: none;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          pointer-events: none;
        }

        .family-tree-approved-copy {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          color: #0f5139;
          text-align: right;
        }

        .family-tree-approved-icon {
          display: grid;
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          place-items: center;
          color: #0f5a3f;
        }

        .family-tree-approved-copy h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .family-tree-approved-copy p {
          margin: 3px 0 0;
          color: #68736d;
          font-size: 11px;
          line-height: 1.45;
          font-weight: 700;
        }

        .family-tree-approved-fit {
          pointer-events: auto;
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #e1d6b9;
          border-radius: 15px;
          background: rgba(255, 253, 247, 0.9);
          padding: 0 13px;
          color: #0f5139;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 8px 22px rgba(55, 68, 59, 0.08);
          backdrop-filter: blur(10px);
        }

        .node-group {
          filter: drop-shadow(0 8px 14px rgba(38, 54, 46, 0.1));
        }

        .tree-node-content {
          width: ${NODE_W}px;
          height: ${NODE_H}px;
          box-sizing: border-box;
        }

        foreignObject {
          overflow: visible;
        }

        .ios-native-tree-node:focus-visible {
          outline: none;
        }

        /* SVG labels inherit the same selected family/royal mode as HTML cards.
           Reset D3's inherited node stroke so Arabic glyphs stay clear on Apple. */
        .family-tree-canvas .ios-native-tree-node text {
          font-family: inherit;
          stroke: none;
          stroke-width: 0;
          font-synthesis: none;
          letter-spacing: normal;
        }

        .ios-native-tree-node:focus-visible > rect {
          stroke: #0f5a3f;
          stroke-width: 4px;
        }

        @supports (-webkit-touch-callout: none) {
          .node-group {
            filter: none;
          }

          foreignObject {
            transform: none !important;
            -webkit-transform: none !important;
          }

          .tree-node-content {
            transform: none;
            -webkit-transform: none;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .tree-link-active {
            filter: none;
          }
        }

        @media (max-width: 1023px) {
          .family-tree-workspace {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas:
              "member"
              "tree";
            gap: 12px;
          }

          .member-panel {
            border-radius: 26px;
          }

          .member-panel-content {
            gap: 13px;
            padding: 17px;
          }

          .member-summary {
            flex-direction: row;
            justify-content: flex-start;
            text-align: right;
          }

          .member-summary-copy {
            text-align: right;
          }

          .member-avatar {
            width: 70px;
            height: 70px;
          }

          .family-tree-canvas {
            height: min(68vh, 700px);
            min-height: 520px;
          }

          @supports (height: 100dvh) {
            .family-tree-canvas {
              height: min(68dvh, 700px);
            }
          }
        }

        @media (max-width: 767px) {
          .family-tree-workspace {
            display: block;
          }

          .family-tree-workspace > .member-panel {
            display: none;
          }

          .family-tree-canvas.family-tree-approved {
            height: clamp(360px, 42dvh, 470px);
            min-height: 0;
            border-radius: 24px;
            overscroll-behavior-y: auto;
          }

          .family-tree-approved-heading {
            display: flex;
          }

          .family-tree-approved .rd3t-tree-container,
          .family-tree-approved .rd3t-tree-container > svg {
            touch-action: pan-y !important;
            overscroll-behavior-y: auto;
          }

          .family-tree-approved .rd3t-tree-container > svg {
            padding-top: 54px;
            box-sizing: border-box;
          }
        }

        @media (max-width: 560px) {
          .member-panel-content {
            padding: 15px;
          }

          .member-info-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 3px;
          }

          .family-tree-canvas:not(.family-tree-approved) {
            min-height: 500px;
          }
        }

        @media (orientation: landscape) and (max-height: 700px) {
          .family-tree-workspace {
            grid-template-columns: minmax(230px, 270px) minmax(0, 1fr);
            grid-template-areas: "member tree";
          }

          .member-panel-content {
            gap: 10px;
            overflow-y: auto;
            padding: 14px;
          }

          .member-summary {
            flex-direction: row;
            gap: 10px;
            text-align: right;
          }

          .member-summary-copy {
            text-align: right;
          }

          .member-avatar {
            width: 58px;
            height: 58px;
          }

          .family-tree-canvas {
            height: calc(100dvh - 190px - env(safe-area-inset-bottom, 0px));
            min-height: 430px;
          }
        }
      `}</style>

      {/* SVG Gradients for Links */}
      <svg style={{ width: 0, height: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="link-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
    </AppShell>
  );
}

function ControlBtn({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#E3DCCB] bg-[#F7F5F0] text-[#153D2F] shadow-sm transition-all hover:border-[#0F5139] hover:bg-[#0F5139] hover:text-white"
    >
      {icon}
    </button>
  );
}

type AddPayload = {
  firstName: string;
  fatherName?: string | null;
  grandfatherName?: string | null;
  relation: "child" | "father" | "grandfather" | "root";
  targetId?: string | null;
  targetKind?: "profile" | "extra" | null;
};

function AddMemberDialog({
  members,
  onClose,
  onSubmit,
}: {
  members: Member[];
  onClose: () => void;
  onSubmit: (payload: AddPayload) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [grandfatherName, setGrandfatherName] = useState("");
  const [relation, setRelation] = useState<AddPayload["relation"]>("child");
  const [targetId, setTargetId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const target = members.find((m) => m.id === targetId);

  async function handleSubmit() {
    if (!firstName.trim()) return toast.error("الاسم الأول مطلوب");
    if (relation !== "root" && !target) return toast.error("اختر العضو المرجعي");
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        fatherName: fatherName.trim() || null,
        grandfatherName: grandfatherName.trim() || null,
        relation,
        targetId: target?.id ?? null,
        targetKind: target?.kind ?? null,
      });
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="w-full max-w-md rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 space-y-4 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center">
            <UserPlus className="size-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1B4332]">إضافة فرد إلى الشجرة</h3>
            <p className="text-[10px] font-bold text-[#8E7745]">بدون الحاجة لإنشاء حساب</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Field label="الاسم الأول *">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الأب">
              <input
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              />
            </Field>
            <Field label="اسم الجد">
              <input
                value={grandfatherName}
                onChange={(e) => setGrandfatherName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              />
            </Field>
          </div>

          <Field label="صلة القرابة">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as AddPayload["relation"])}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
            >
              <option value="child">ابن لـ ...</option>
              <option value="father">أب لـ ...</option>
              <option value="grandfather">جد لـ ...</option>
              <option value="root">رأس شجرة (بدون أب)</option>
            </select>
          </Field>

          {relation !== "root" && (
            <Field label="العضو المرجعي">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F2F2F7] border-none text-xs font-bold text-primary"
              >
                <option value="">— اختر —</option>
                {members.map((x) => (
                  <option key={x.id} value={x.id}>
                    {(x.full_name || x.first_name) + (x.kind === "extra" ? " (بدون حساب)" : "")}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <p className="text-[10px] font-bold text-[#8E7745] leading-relaxed bg-[#FFF8E7] rounded-xl p-3">
            {relation === "child" && "سيتم إضافة الفرد الجديد كابن مباشر للعضو المختار."}
            {relation === "father" &&
              "سيتم إضافة الفرد كأب للعضو المختار، وسيرث ارتباط جدّه إن وجد."}
            {relation === "grandfather" &&
              "سيتم إضافة الفرد كجد، أي والداً لأب العضو المختار. يجب أن يكون للعضو أب مسجّل."}
            {relation === "root" && "سيظهر الفرد كرأس شجرة مستقل."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-[#F2F2F7] transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}{" "}
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">
        {label}
      </label>
      {children}
    </div>
  );
}
