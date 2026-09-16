import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ArrowLeft, GitBranch, Link2, Loader2, Search, UserCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";

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

type RelationshipResult = {
  label: string;
  path: Member[];
};

function normalizeArabic(value: string) {
  return value
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(member: Member | null | undefined) {
  if (!member) return "غير متاح";
  return (
    member.full_name?.trim() ||
    [member.first_name, member.father_name, member.grandfather_name].filter(Boolean).join(" ") ||
    "فرد من العائلة"
  );
}

function cardName(member: Member) {
  return [member.first_name, member.father_name].filter(Boolean).join(" ") || displayName(member);
}

function findMembersByVisibleName(members: Member[], visibleName: string) {
  const wanted = normalizeArabic(visibleName);
  if (!wanted || wanted === normalizeArabic("عائلة السيف")) return [];

  return members.filter((member) => {
    const candidates = [displayName(member), cardName(member), member.first_name || ""]
      .map(normalizeArabic)
      .filter(Boolean);

    return candidates.some(
      (candidate) =>
        candidate === wanted ||
        candidate.startsWith(wanted) ||
        wanted.startsWith(candidate),
    );
  });
}

export function FamilyRelationshipFinder() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onFamilyTree = pathname.includes("/family-tree");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!onFamilyTree) {
      setOpen(false);
      return;
    }

    // The old standalone relationship button is intentionally removed.
    // Relationship lookup now starts by clicking the person's name in the tree.
    const hiddenButtons = new Map<HTMLElement, string>();
    const hideLegacyButtons = () => {
      document.querySelectorAll("button").forEach((button) => {
        if (!button.textContent?.includes("تحديد صلة القرابة")) return;
        const element = button as HTMLElement;
        if (!hiddenButtons.has(element)) hiddenButtons.set(element, element.style.display);
        element.style.display = "none";
      });
    };

    hideLegacyButtons();
    const observer = new MutationObserver(hideLegacyButtons);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      hiddenButtons.forEach((display, element) => {
        element.style.display = display;
      });
    };
  }, [onFamilyTree]);

  useEffect(() => {
    if (!onFamilyTree || members.length > 0 || loading) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("تعذر تحديد حسابك الحالي");

        const [profilesRes, extrasRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, first_name, father_name, grandfather_name, avatar_url, parent_id"),
          supabase
            .from("family_tree_extras" as any)
            .select("id, first_name, father_name, grandfather_name, parent_id"),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (extrasRes.error) throw extrasRes.error;
        if (cancelled) return;

        const profileMembers: Member[] = (profilesRes.data ?? []).map((member: any) => ({
          id: member.id,
          first_name: member.first_name,
          father_name: member.father_name,
          grandfather_name: member.grandfather_name,
          full_name: member.full_name,
          avatar_url: member.avatar_url,
          parent_id: member.parent_id,
          kind: "profile",
        }));

        const extraMembers: Member[] = ((extrasRes.data as any[]) ?? []).map((member: any) => ({
          id: member.id,
          first_name: member.first_name,
          father_name: member.father_name,
          grandfather_name: member.grandfather_name,
          full_name: [member.first_name, member.father_name, member.grandfather_name]
            .filter(Boolean)
            .join(" "),
          avatar_url: null,
          parent_id: member.parent_id,
          kind: "extra",
        }));

        setMeId(user.id);
        setMembers([...profileMembers, ...extraMembers]);
      } catch (loadError: any) {
        if (!cancelled) setError(loadError?.message || "تعذر تحميل بيانات شجرة العائلة");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [onFamilyTree, members.length, loading]);

  useEffect(() => {
    if (!onFamilyTree) return;

    const handleNameClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const target = event.target;
      let visibleName = "";
      let isPersonName = false;

      // Desktop / Android / most browsers: anywhere inside the tree node content card.
      const htmlNode = target.closest(".tree-node-content");
      if (htmlNode) {
        const nameElement = htmlNode.querySelector("p");
        if (nameElement) {
          visibleName = nameElement.textContent?.trim() || "";
          isPersonName = true;
        }
      }

      // iPhone / iPad native SVG node: anywhere inside the native tree node element.
      const iosNode = target.closest(".ios-native-tree-node");
      if (!isPersonName && iosNode) {
        const textElements = iosNode.querySelectorAll("text");
        for (const txt of textElements) {
          if (txt.getAttribute("y") === "7") {
            visibleName = txt.textContent?.trim() || "";
            isPersonName = true;
            break;
          }
        }
      }

      // Also make the person's name or picture in the side card behave the same way.
      if (!isPersonName) {
        const summaryCard = target.closest(".member-panel-content") || target.closest(".member-summary");
        if (summaryCard) {
          const summaryName = summaryCard.querySelector(".member-summary-copy h2");
          if (summaryName) {
            visibleName = summaryName.textContent?.trim() || "";
            isPersonName = true;
          }
        }
      }

      if (!isPersonName || !visibleName) return;

      const matches = findMembersByVisibleName(members, visibleName).filter((member) => member.id !== meId);
      if (!matches.length) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (matches.length === 1) {
        setTargetId(matches[0].id);
        setQuery(displayName(matches[0]));
      } else {
        // If two relatives have the same visible name, open the same window already filtered by that name.
        setTargetId(null);
        setQuery(visibleName);
      }
      setOpen(true);
    };

    document.addEventListener("click", handleNameClick, true);
    return () => document.removeEventListener("click", handleNameClick, true);
  }, [onFamilyTree, members, meId]);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const matches = useMemo(() => {
    const normalizedQuery = normalizeArabic(query);
    return members
      .filter((member) => member.id !== meId)
      .filter((member) => {
        if (!normalizedQuery) return true;
        return [member.full_name, cardName(member), member.first_name, member.father_name]
          .filter(Boolean)
          .some((value) => normalizeArabic(String(value)).includes(normalizedQuery));
      })
      .slice(0, 12);
  }, [members, meId, query]);

  const relationship = useMemo<RelationshipResult | null>(() => {
    if (!meId || !targetId) return null;
    const current = membersById.get(meId);
    const target = membersById.get(targetId);
    if (!current || !target) return null;

    const currentAncestors = new Map<string, { member: Member; distance: number }>();
    let cursor: Member | undefined = current;
    let distance = 0;
    const visitedCurrent = new Set<string>();

    while (cursor && !visitedCurrent.has(cursor.id)) {
      visitedCurrent.add(cursor.id);
      currentAncestors.set(cursor.id, { member: cursor, distance });
      cursor = cursor.parent_id ? membersById.get(cursor.parent_id) : undefined;
      distance += 1;
    }

    const targetChain: { member: Member; distance: number }[] = [];
    cursor = target;
    distance = 0;
    const visitedTarget = new Set<string>();

    while (cursor && !visitedTarget.has(cursor.id)) {
      visitedTarget.add(cursor.id);
      targetChain.push({ member: cursor, distance });
      cursor = cursor.parent_id ? membersById.get(cursor.parent_id) : undefined;
      distance += 1;
    }

    const common = targetChain.find((entry) => currentAncestors.has(entry.member.id));
    if (!common) return null;

    const up = currentAncestors.get(common.member.id)?.distance ?? 0;
    const down = common.distance;

    const upwardPath: Member[] = [];
    cursor = current;
    const visitedPath = new Set<string>();
    while (cursor && !visitedPath.has(cursor.id)) {
      visitedPath.add(cursor.id);
      upwardPath.push(cursor);
      if (cursor.id === common.member.id) break;
      cursor = cursor.parent_id ? membersById.get(cursor.parent_id) : undefined;
    }

    const downwardPath = targetChain
      .slice(0, down + 1)
      .map((entry) => entry.member)
      .reverse();
    const path = [...upwardPath, ...downwardPath.slice(1)];

    let label = "صلة قرابة";
    if (up === 0 && down === 0) label = "أنت";
    else if (up === 1 && down === 0) label = "والدك / والدتك";
    else if (up === 2 && down === 0) label = "جدك / جدتك";
    else if (up > 2 && down === 0) label = `من أجدادك (${up} أجيال)`;
    else if (up === 0 && down === 1) label = "ابنك / ابنتك";
    else if (up === 0 && down === 2) label = "حفيدك / حفيدتك";
    else if (up === 0 && down > 2) label = `من ذريتك (${down} أجيال)`;
    else if (up === 1 && down === 1) label = "أخ / أخت";
    else if (up === 2 && down === 1) label = "عم / عمة / خال / خالة بحسب الفرع";
    else if (up === 1 && down === 2) label = "ابن / ابنة أخ أو أخت";
    else if (up >= 2 && down >= 2 && up === down) {
      label = `ابن / ابنة عم أو خال من الدرجة ${Math.min(up, down) - 1}`;
    } else if (up > 0 && down > 0) {
      label = `قريب من فرع مشترك (${up + down} درجات في المسار)`;
    }

    return { label, path };
  }, [meId, targetId, membersById]);

  if (!onFamilyTree) return null;

  const me = meId ? membersById.get(meId) : null;
  const selected = targetId ? membersById.get(targetId) : null;

  return open ? (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        dir="rtl"
        className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[#D6AD4B]/40 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#E7E0CF] bg-[#FBF9F2] p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F5139]">
            <GitBranch className="size-6 text-[#F6D37E]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-[#153D2F]">صلة القرابة</h2>
            <p className="mt-1 text-xs font-bold text-[#7B7B76]">
              اضغط على اسم أي فرد في الشجرة لمعرفة صلة القرابة بينكما.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[#6F766F] transition hover:bg-black/5"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-black text-[#153D2F]">
              <Loader2 className="size-5 animate-spin text-[#B78A2B]" />
              جاري تحميل شجرة العائلة...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
              {error}
            </div>
          ) : (
            <>
              {!selected && (
                <>
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#8E8E88]" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="اختر الشخص المطابق..."
                      className="w-full rounded-2xl border border-[#E7E0CF] bg-[#F8F7F3] py-3 pl-4 pr-11 text-sm font-bold text-[#153D2F] outline-none focus:border-[#D6AD4B]"
                    />
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[#E7E0CF]">
                    {matches.length ? (
                      matches.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setTargetId(member.id);
                            setQuery(displayName(member));
                          }}
                          className="flex w-full items-center gap-3 border-b border-[#EEE9DD] px-4 py-3 text-right transition last:border-b-0 hover:bg-[#FBF9F2]"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2EEE2] ring-1 ring-[#E2D5B5]">
                            {member.kind === "extra" ? (
                              <UserCircle2 className="size-6 text-[#8E7745]" />
                            ) : (
                              <UserAvatar
                                name={member.first_name || "ع"}
                                path={member.avatar_url}
                                userId={member.id}
                                className="size-full"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-[#153D2F]">{displayName(member)}</p>
                            <p className="mt-0.5 text-[10px] font-bold text-[#8E8E88]">
                              {member.father_name ? `والده: ${member.father_name}` : "فرد في شجرة العائلة"}
                            </p>
                          </div>
                          <ArrowLeft className="size-4 shrink-0 text-[#B78A2B]" />
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-center text-sm font-bold text-[#7B7B76]">لا يوجد فرد مطابق للاسم.</div>
                    )}
                  </div>
                </>
              )}

              {selected && (
                <div className="space-y-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <PersonCard member={me} label="أنت" />
                    <div className="flex size-10 items-center justify-center rounded-full border border-[#D6AD4B]/40 bg-[#FFF8E7]">
                      <Link2 className="size-4 text-[#8E7745]" />
                    </div>
                    <PersonCard member={selected} label="الفرد المختار" />
                  </div>

                  {relationship ? (
                    <div className="rounded-[24px] border border-[#D6AD4B]/35 bg-[#F8FBF8] p-4">
                      <p className="text-center text-[10px] font-black tracking-widest text-[#8E7745]">صلة القرابة</p>
                      <p className="mt-1 text-center text-xl font-black text-[#153D2F]">{relationship.label}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        {relationship.path.map((member, index) => (
                          <div key={`${member.id}-${index}`} className="flex items-center gap-2">
                            <span className="rounded-xl border border-[#E7E0CF] bg-white px-3 py-2 text-xs font-black text-[#153D2F] shadow-sm">
                              {member.id === meId ? "أنت" : member.first_name || displayName(member)}
                            </span>
                            {index < relationship.path.length - 1 && (
                              <ArrowLeft className="size-3 text-[#B78A2B]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#D6AD4B]/30 bg-[#FFF8E7] p-4 text-center">
                      <p className="text-sm font-black text-[#6E5A21]">لم نجد مسار قرابة متصلًا بينكما.</p>
                      <p className="mt-1 text-[10px] font-bold text-[#8E7745]">
                        تأكد من ربط الفردين داخل نفس جذور الشجرة.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTargetId(null);
                      setQuery("");
                    }}
                    className="w-full rounded-xl bg-[#F2F0EA] py-3 text-xs font-black text-[#153D2F] transition hover:bg-[#0F5139] hover:text-white"
                  >
                    اختيار شخص آخر
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;
}

function PersonCard({ member, label }: { member: Member | null | undefined; label: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E7E0CF] bg-white p-3 text-center shadow-sm">
      <div className="mx-auto mb-2 flex size-12 items-center justify-center overflow-hidden rounded-full bg-[#F2EEE2] ring-1 ring-[#E2D5B5]">
        {member?.kind === "extra" ? (
          <UserCircle2 className="size-7 text-[#8E7745]" />
        ) : member ? (
          <UserAvatar
            name={member.first_name || "ع"}
            path={member.avatar_url}
            userId={member.id}
            className="size-full"
          />
        ) : (
          <UserCircle2 className="size-7 text-[#8E8E88]" />
        )}
      </div>
      <p className="text-[10px] font-black text-[#8E7745]">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-[#153D2F]">{displayName(member)}</p>
    </div>
  );
}
