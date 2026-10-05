import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Archive,
  BellOff,
  Check,
  CheckCheck,
  Search,
  Users,
  X,
  Plus,
  Clock,
  MessageCircle,
  Trash2,
} from "lucide-react";
import {
  chatTimeLabel,
  Conversation,
  conversationAvatarInitial,
  conversationTitle,
  displayName,
  initialOf,
  Message,
  messagePreview,
  Participant,
  Profile,
} from "@/lib/chat";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { useChatViewport } from "@/hooks/use-chat-viewport";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import "@/chat-workspace.css";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المحادثات — السيف" },
      { name: "description", content: "محادثات فردية وجماعية مباشرة." },
    ],
  }),
  component: ChatLayout,
});

type ConversationListItem = {
  conversation: Conversation;
  participants: Participant[];
  lastMessage?: Message;
  unread: number;
  myParticipant?: Participant;
};

function ChatLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isConvOpen = /^\/chat\/[^/]+/.test(path);
  const viewportRef = useChatViewport();

  const [meId, setMeId] = useState<string | null>(null);
  const [shellUser, setShellUser] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath: string | null;
  }>({ name: "عضو", role: "عضو", initial: "ص", avatarPath: null });
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [showNew, setShowNew] = useState<"chat" | "group" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMeId(u.user.id);

    const [{ data: myParts }, { data: profs }, { data: myProf }] = await Promise.all([
      supabase.from("conversation_participants").select("*").eq("user_id", u.user.id),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle(),
    ]);

    const pmap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => (pmap[p.id] = p as Profile));
    setProfiles(pmap);

    const meName = displayName({
      id: u.user.id,
      arabic_name: myProf?.arabic_name ?? null,
      full_name: myProf?.full_name ?? null,
      avatar_url: null,
    });
    setShellUser({
      name: meName,
      role: "عضو العائلة",
      initial: initialOf(meName),
      avatarPath: myProf?.avatar_url ?? null,
    });

    const convIds = (myParts ?? []).map((p) => p.conversation_id);
    if (convIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: convs }, { data: allParts }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase.from("conversation_participants").select("*").in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const partsByConv: Record<string, Participant[]> = {};
    (allParts ?? []).forEach((p) => {
      (partsByConv[p.conversation_id] ??= []).push(p as Participant);
    });

    const lastByConv: Record<string, Message> = {};
    const unreadByConv: Record<string, number> = {};
    const myPartByConv: Record<string, Participant> = {};
    (myParts ?? []).forEach((p) => (myPartByConv[p.conversation_id] = p as Participant));

    (msgs ?? []).forEach((m) => {
      const mm = m as Message;
      if (!lastByConv[mm.conversation_id]) lastByConv[mm.conversation_id] = mm;
      const myP = myPartByConv[mm.conversation_id];
      if (
        myP &&
        mm.sender_id !== u.user!.id &&
        new Date(mm.created_at) > new Date(myP.last_read_at)
      ) {
        unreadByConv[mm.conversation_id] = (unreadByConv[mm.conversation_id] ?? 0) + 1;
      }
    });

    const built: ConversationListItem[] = (convs ?? [])
      .map((c) => ({
        conversation: c as Conversation,
        participants: partsByConv[c.id] ?? [],
        lastMessage: lastByConv[c.id],
        unread: unreadByConv[c.id] ?? 0,
        myParticipant: myPartByConv[c.id],
      }))
      .sort(
        (a, b) =>
          new Date(b.conversation.last_message_at).getTime() -
          new Date(a.conversation.last_message_at).getTime(),
      );

    setItems(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const filtered = useMemo(() => {
    return items
      .filter((it) =>
        showArchive ? it.myParticipant?.archived_at : !it.myParticipant?.archived_at,
      )
      .filter((it) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const title = conversationTitle(
          it.conversation,
          it.participants,
          profiles,
          meId,
        ).toLowerCase();
        return title.includes(q) || messagePreview(it.lastMessage).toLowerCase().includes(q);
      });
  }, [items, profiles, meId, search, showArchive]);

  const handleToggleArchive = async (item: ConversationListItem) => {
    if (!item.myParticipant) return;
    const isArchiving = !item.myParticipant.archived_at;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) =>
        it.conversation.id === item.conversation.id
          ? {
              ...it,
              myParticipant: { ...it.myParticipant!, archived_at: isArchiving ? now : null },
            }
          : it,
      ),
    );
    const { error } = await supabase
      .from("conversation_participants")
      .update({ archived_at: isArchiving ? now : null })
      .eq("id", item.myParticipant.id);
    if (error) {
      toast.error("حدث خطأ");
      load();
    } else {
      toast.success(isArchiving ? "تمت الأرشفة" : "تمت الاستعادة");
    }
  };

  const handleDeleteOrLeave = async (item: ConversationListItem) => {
    if (!item.myParticipant) return;
    const isOwner = item.myParticipant.role === "owner";
    const isGroup = item.conversation.kind === "group";
    const msg =
      isOwner && isGroup
        ? "هل تود حذف هذه المجموعة نهائياً؟"
        : isGroup
          ? "هل تود مغادرة هذه المجموعة؟"
          : "هل تود حذف هذه المحادثة؟";
    if (!confirm(msg)) return;
    let error;
    if (isOwner && isGroup) {
      error = (await supabase.from("conversations").delete().eq("id", item.conversation.id)).error;
    } else {
      error = (
        await supabase.from("conversation_participants").delete().eq("id", item.myParticipant.id)
      ).error;
    }
    if (error) {
      toast.error("فشل الإجراء");
    } else {
      toast.success("تم الحذف");
      load();
    }
  };

  return (
    <AppShell title="المحادثات" user={shellUser} fullWidth={true}>
      <div
        ref={viewportRef}
        className="chat-workspace"
        data-conversation-open={isConvOpen ? "true" : "false"}
        dir="rtl"
      >
        <aside className="chat-sidebar" aria-label="قائمة المحادثات">
          <div className="chat-sidebar-top">
            <div className="chat-sidebar-heading">
              <div>
                <span className="chat-sidebar-eyebrow">مجلس السيف</span>
                <h2>المحادثات</h2>
              </div>
              <button
                onClick={() => setShowNew("chat")}
                className="chat-sidebar-new"
                aria-label="بدء محادثة جديدة"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <div className="chat-sidebar-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في المحادثات..."
                aria-label="البحث في المحادثات"
              />
            </div>
            <div className="chat-sidebar-tabs">
              <button onClick={() => setShowArchive(false)} aria-pressed={!showArchive}>
                النشطة
              </button>
              <button onClick={() => setShowArchive(true)} aria-pressed={showArchive}>
                <Archive size={12} /> المؤرشفة
              </button>
            </div>
          </div>
          <div className="chat-conversation-list custom-scrollbar">
            {loading ? (
              <div className="py-20 text-center opacity-30">
                <Clock className="size-8 mx-auto animate-spin mb-2" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 px-8 text-center opacity-40 text-xs font-bold leading-relaxed">
                {showArchive ? "لا توجد محادثات مؤرشفة" : "ابدأ تواصلك الأول مع أفراد العائلة"}
              </div>
            ) : (
              filtered.map((it) => (
                <ConversationRow
                  key={it.conversation.id}
                  item={it}
                  meId={meId}
                  profiles={profiles}
                  active={path === `/chat/${it.conversation.id}`}
                  onArchive={() => handleToggleArchive(it)}
                  onDelete={() => handleDeleteOrLeave(it)}
                />
              ))
            )}
          </div>
        </aside>
        <section className="chat-main" aria-label="المحادثة">
          {!isConvOpen && (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <MessageCircle size={32} />
              </div>
              <h3>مجلس العائلة</h3>
              <p>اختر محادثة من القائمة أو ابدأ محادثة جديدة مع أفراد العائلة.</p>
              <button onClick={() => setShowNew("chat")} className="chat-primary-button">
                بدء مجلس جديد
              </button>
            </div>
          )}
          {isConvOpen && <Outlet />}
        </section>
      </div>
      <AnimatePresence>
        {showNew && meId && (
          <NewConversationDialog
            mode={showNew}
            meId={meId}
            profiles={profiles}
            onClose={() => setShowNew(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ConversationRow({
  item,
  meId,
  profiles,
  active,
  onArchive,
  onDelete,
}: {
  item: ConversationListItem;
  meId: string | null;
  profiles: Record<string, Profile>;
  active: boolean;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const title = conversationTitle(item.conversation, item.participants, profiles, meId);
  const initial = conversationAvatarInitial(item.conversation, item.participants, profiles, meId);
  const other =
    item.conversation.kind === "direct"
      ? item.participants.find((p) => p.user_id !== meId)
      : undefined;
  const otherAvatarPath = other ? (profiles[other.user_id]?.avatar_url ?? null) : null;
  const lastMine = item.lastMessage?.sender_id === meId;
  const isArchived = !!item.myParticipant?.archived_at;
  const [dragX, setDragX] = useState(0);

  return (
    <div className="chat-conversation-row group/row">
      {/* BACKGROUND ACTIONS - Only visible when dragging */}
      <div className="absolute inset-0 flex items-center justify-between px-8 z-0">
        <div
          style={{ opacity: Math.max(0, dragX / 60) }}
          className="flex flex-col items-center gap-1 text-emerald-500 transition-opacity"
        >
          <div className="size-10 rounded-full flex items-center justify-center bg-emerald-500/10 shadow-sm">
            <Archive className="size-5" />
          </div>
          <span className="text-[11px] font-black uppercase">
            {isArchived ? "استعادة" : "أرشفة"}
          </span>
        </div>
        <div
          style={{ opacity: Math.max(0, -dragX / 60) }}
          className="flex flex-col items-center gap-1 text-red-500 transition-opacity"
        >
          <div className="size-10 rounded-full flex items-center justify-center bg-red-500/10 shadow-sm">
            <Trash2 className="size-5" />
          </div>
          <span className="text-[11px] font-black uppercase">حذف</span>
        </div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragSnapToOrigin
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={(_, info) => {
          setDragX(0);
          if (info.offset.x > 70) onArchive();
          else if (info.offset.x < -70) onDelete();
        }}
        className="relative z-10"
      >
        <Link
          to="/chat/$conversationId"
          params={{ conversationId: item.conversation.id }}
          className="chat-conversation-link"
          aria-current={active ? "page" : undefined}
        >
          <div className="relative shrink-0">
            <div className="chat-conversation-avatar">
              {item.conversation.kind === "group" ? (
                <div className="size-full flex items-center justify-center">
                  <Users className="size-5" />
                </div>
              ) : (
                <UserAvatar
                  path={otherAvatarPath}
                  name={title}
                  initial={initial}
                  fallbackClassName="chat-avatar-initial"
                  className="size-full rounded-full overflow-hidden"
                  userId={other?.user_id ?? null}
                  presenceDotClassName="absolute -bottom-1 -left-1 size-3.5 ring-2 ring-card shadow-lg z-20"
                />
              )}
            </div>
            {item.unread > 0 && <span className="chat-unread-badge">{item.unread}</span>}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5 text-right">
            <div className="flex items-center justify-between gap-2">
              <h3 className="chat-conversation-title">{title}</h3>
              <span className="chat-conversation-time">
                {item.lastMessage ? chatTimeLabel(item.lastMessage.created_at) : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <p className="chat-conversation-preview">
                {lastMine && item.lastMessage && (
                  <CheckCheck className={cn("size-3 inline ml-1 opacity-50")} />
                )}
                {messagePreview(item.lastMessage)}
              </p>
              {item.myParticipant?.muted && !active && (
                <BellOff className="size-2.5 text-muted-foreground/30 shrink-0" />
              )}
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}

function NewConversationDialog({
  mode,
  meId,
  profiles,
  onClose,
}: {
  mode: "chat" | "group";
  meId: string;
  profiles: Record<string, Profile>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const list = Object.values(profiles)
    .filter((p) => p.id !== meId)
    .filter((p) => !q.trim() || displayName(p).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "ar"));
  function toggle(id: string) {
    if (mode === "chat") setSelected(new Set([id]));
    else {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
    }
  }
  async function create() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      if (mode === "chat") {
        const { data, error } = await supabase.rpc("find_or_create_direct", {
          _other: Array.from(selected)[0],
        });
        if (error) throw error;
        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: String(data) } });
      } else {
        if (!title.trim()) {
          toast.error("اكتب اسماً للمجموعة");
          setBusy(false);
          return;
        }
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ kind: "group", title: title.trim(), created_by: meId })
          .select()
          .single();
        if (convErr || !conv) throw convErr || new Error("Failed to create group");
        const rows = [
          { conversation_id: conv.id, user_id: meId, role: "owner" as const },
          ...Array.from(selected).map((uid) => ({
            conversation_id: conv.id,
            user_id: uid,
            role: "member" as const,
          })),
        ];
        const { error: addErr } = await supabase.from("conversation_participants").insert(rows);
        if (addErr) throw addErr;
        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id } });
      }
    } catch (err: any) {
      toast.error("تعذّر إنشاء المحادثة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-card border border-border rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        dir="rtl"
      >
        <div className="p-8 space-y-6 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-primary">
              {mode === "chat" ? "محادثة جديدة" : "مجلس عائلي جديد"}
            </h3>
            <button
              onClick={onClose}
              className="size-10 rounded-full hover:bg-muted text-muted-foreground transition-all flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {mode === "group" && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="اسم المجلس..."
                className="w-full bg-muted border border-border rounded-xl px-5 py-3.5 font-bold text-sm"
              />
            )}
            <div className="relative">
              <Search className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن عضو..."
                className="w-full bg-muted border border-border rounded-xl pl-4 pr-11 py-3.5 font-bold text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-4">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-2xl border-2 transition-all",
                  selected.has(p.id)
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <div className="size-10 rounded-lg overflow-hidden border border-border">
                  <UserAvatar path={p.avatar_url} name={displayName(p)} className="size-full" />
                </div>
                <span
                  className={cn(
                    "text-sm font-black",
                    selected.has(p.id) ? "text-primary" : "text-foreground",
                  )}
                >
                  {displayName(p)}
                </span>
                {selected.has(p.id) && (
                  <div className="ms-auto size-5 rounded-full bg-primary flex items-center justify-center text-white">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={selected.size === 0 || busy}
            className="w-full btn-gold py-5 rounded-[24px] text-lg font-black shadow-xl disabled:opacity-50"
          >
            {busy ? "جاري التأسيس..." : `تأكيد (${selected.size})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
