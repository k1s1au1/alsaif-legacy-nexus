import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Archive,
  Bell,
  BellOff,
  CheckCheck,
  Download,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Reply,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Trash2,
  Users,
  X,
  Clock,
  ChevronLeft,
  Info,
  Mic,
  Square,
  FileText,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { PresenceDot, usePresenceFor } from "@/lib/presence";
import {
  chatTimeLabel,
  conversationTitle,
  dayKey,
  dayLabel,
  displayName,
  EMOJI_PICKER,
  EMOJI_QUICK,
  formatBytes,
  formatDuration,
  getSignedAttachmentUrl,
  initialOf,
  lastSeenLabel,
  type Conversation,
  type Delivery,
  type Message,
  type Participant,
  type Presence,
  type Profile,
  type Reaction,
  timeLabel,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  ssr: false,
  component: ConversationRoute,
});

function ConversationRoute() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();

  const [meId, setMeId] = useState<string | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoad = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const input = draftRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = draft ? `${Math.min(input.scrollHeight, 112)}px` : "40px";
  }, [draft]);

  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === meId),
    [participants, meId],
  );
  const isAdmin = myParticipant?.role === "owner" || myParticipant?.role === "admin";
  const canSend = useMemo(() => {
    if (!conv || !myParticipant) return false;
    if (conv.kind === "direct") return true;
    const perm = conv.send_permission ?? "all";
    if (perm === "all") return true;
    if (perm === "admins") return isAdmin;
    return isAdmin || myParticipant.can_send;
  }, [conv, myParticipant, isAdmin]);

  useEffect(() => {
    let active = true;
    setNotFound(false);
    setConv(null);
    setMessages([]);
    setLoading(true);

    const loadData = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!active || !user) return;
        setMeId(user.id);

        const [{ data: c, error: cErr }, { data: parts }, { data: msgs }] = await Promise.all([
          supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle(),
          supabase
            .from("conversation_participants")
            .select("*")
            .eq("conversation_id", conversationId),
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(150),
        ]);
        if (!active) return;
        if (cErr || !c) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setConv(c as unknown as Conversation);
        const partList = (parts ?? []) as unknown as Participant[];
        setParticipants(partList);
        const msgList = ((msgs ?? []) as Message[]).reverse();
        setMessages(msgList);
        setLoading(false);

        // Secondary data loads in the background without blocking the chat.
        const userIds = Array.from(
          new Set([...partList.map((p) => p.user_id), ...msgList.map((m) => m.sender_id)]),
        ).filter(Boolean) as string[];
        const ids = msgList.map((m) => m.id);
        const [profRes, presRes, rxRes, dlRes] = await Promise.all([
          userIds.length
            ? supabase
                .from("profiles")
                .select("id, arabic_name, full_name, avatar_url")
                .in("id", userIds)
            : Promise.resolve({ data: [] as any[] }),
          userIds.length
            ? supabase.from("user_presence").select("*").in("user_id", userIds)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("message_reactions").select("*").in("message_id", ids)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from("message_deliveries").select("*").in("message_id", ids)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        if (!active) return;
        const pmap: Record<string, Profile> = {};
        (profRes.data ?? []).forEach((p: any) => {
          if (p.id) pmap[p.id] = p as Profile;
        });
        setProfiles(pmap);
        const pm: Record<string, Presence> = {};
        (presRes.data ?? []).forEach((x: any) => {
          if (x.user_id) pm[x.user_id] = x as Presence;
        });
        setPresence(pm);
        setReactions((rxRes.data ?? []) as Reaction[]);
        setDeliveries((dlRes.data ?? []) as Delivery[]);
      } catch (err) {
        console.error("Chat loading error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [conversationId]);

  // 1. Initialize Presence Channel ONCE per conversation
  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!meId || !conversationId) return;

    const channel = supabase.channel(`chat-presence-${conversationId}`, {
      config: { presence: { key: meId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing: string[] = [];
        Object.entries(state).forEach(([userId, presences]: [string, any]) => {
          if (userId !== meId && presences.some((p: any) => p.isTyping)) {
            typing.push(userId);
          }
        });
        setTypingUsers(typing);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, meId]);

  // 2. Track typing status based on draft changes
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !meId) return;

    const isTyping = draft.trim().length > 0;

    const updateTyping = async (typing: boolean) => {
      if (channel.state === "joined") {
        await channel.track({ isTyping: typing, last_seen: new Date().toISOString() });
      }
    };

    updateTyping(isTyping);

    let timeout: ReturnType<typeof setTimeout>;
    if (isTyping) {
      timeout = setTimeout(() => updateTyping(false), 3000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [draft, meId]);

  const markedReadRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    markedReadRef.current = new Set();
  }, [conversationId]);
  useEffect(() => {
    if (!meId || !messages.length) return;
    const readSet = new Set(
      deliveries.filter((d) => d.user_id === meId && d.read_at).map((d) => d.message_id),
    );
    const unreadIds = messages
      .filter(
        (m) =>
          m.sender_id !== meId && !readSet.has(m.id) && !markedReadRef.current.has(m.id),
      )
      .map((m) => m.id);
    if (!unreadIds.length) return;
    unreadIds.forEach((id) => markedReadRef.current.add(id));
    const t = setTimeout(() => {
      void supabase.from("message_deliveries").upsert(
        unreadIds.map((mid) => ({
          message_id: mid,
          conversation_id: conversationId,
          user_id: meId,
          read_at: new Date().toISOString(),
        })),
        { onConflict: "message_id,user_id" },
      );
    }, 400);
    return () => clearTimeout(t);
  }, [messages, meId, deliveries, conversationId]);

  useEffect(() => {
    if (!meId) return;
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          if (payload.eventType === "DELETE")
            setReactions((prev) => prev.filter((r) => r.id !== (payload.old as Reaction).id));
          else setReactions((prev) => [...prev, payload.new as Reaction]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_deliveries",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const d = payload.new as Delivery;
          if (!d || !d.id) return;
          setDeliveries((prev) => {
            const exists = prev.some((x) => x.id === d.id);
            if (exists) return prev.map((x) => (x.id === d.id ? d : x));
            return [...prev, d];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, meId]);

  const scrollToBottom = useCallback((immediate = false) => {
    if (!scrollRef.current) return;
    const scrollContainer = scrollRef.current;

    if (immediate) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    } else {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to allow DOM to update with new messages
      const timeout = setTimeout(
        () => {
          scrollToBottom(isInitialLoad.current);
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
          }
        },
        isInitialLoad.current ? 50 : 0,
      );
      return () => clearTimeout(timeout);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    // Reset initial load flag when conversation changes
    isInitialLoad.current = true;
  }, [conversationId]);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !meId || !conv || sending) return;

    if (isImage && !file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }

    setSending(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);

      if (upErr) throw upErr;

      let duration: number | null = null;
      if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        duration = await readMediaDuration(file);
      }

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: meId,
        kind: isImage
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "file",
        attachment_url: path,
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_mime: file.type,
        attachment_duration_ms: duration,
        reply_to_id: replyTo?.id ?? null,
      });

      if (msgErr) throw msgErr;
      setReplyTo(null);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("فشل رفع الملف");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) return;

        const file = new File([audioBlob], "voice-message.webm", { type: "audio/webm" });
        await sendVoiceMessage(file);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("لا يمكن الوصول للميكروفون");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  }

  async function sendVoiceMessage(file: File) {
    setSending(true);
    try {
      const path = `${conversationId}/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (upErr) throw upErr;

      const duration = await readMediaDuration(file);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: meId,
        kind: "audio",
        attachment_url: path,
        attachment_name: "رسالة صوتية",
        attachment_size: file.size,
        attachment_mime: file.type,
        attachment_duration_ms: duration,
      });
    } catch (err) {
      toast.error("فشل إرسال الرسالة الصوتية");
    } finally {
      setSending(false);
    }
  }

  async function sendText(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !meId || !conv || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: meId,
      kind: "text",
      body,
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (!error) {
      setDraft("");
      setReplyTo(null);
    }
  }

  const title = conversationTitle(conv || ({} as any), participants, profiles, meId);
  const otherInDirect = participants.find((p) => p.user_id !== meId);
  const otherPresenceState = usePresenceFor(otherInDirect?.user_id);
  const statusLabel =
    conv?.kind === "direct"
      ? otherPresenceState === "online"
        ? "متصل الآن"
        : "غير متصل"
      : `${participants.length} عضو`;

  if (loading)
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4">
        <div className="size-12 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
          تأمين المجلس...
        </p>
      </div>
    );

  if (notFound)
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6">
        <Archive size={40} className="text-muted-foreground opacity-20" />
        <h3 className="text-xl font-black text-primary">المجلس غير متاح</h3>
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="btn-gold px-8 py-3 rounded-full font-black text-sm"
        >
          العودة للرئيسية
        </button>
      </div>
    );

  async function toggleMute() {
    if (!myParticipant) return;
    await supabase
      .from("conversation_participants")
      .update({ muted: !myParticipant.muted })
      .eq("id", myParticipant.id);
    toast.success(myParticipant.muted ? "تم تفعيل التنبيهات" : "تم كتم التنبيهات");
  }

  async function deleteConversation() {
    if (!conv || !meId) return;
    const isOwner = myParticipant?.role === "owner";
    const msg =
      isOwner && conv.kind === "group"
        ? "هل تريد حذف هذا المجلس نهائياً لجميع الأعضاء؟"
        : "هل تريد حذف هذه المحادثة من قائمتك؟";
    if (!confirm(msg)) return;

    if (isOwner && conv.kind === "group") {
      await supabase.from("conversations").delete().eq("id", conv.id);
    } else {
      await supabase.from("conversation_participants").delete().eq("id", myParticipant?.id);
    }
    navigate({ to: "/chat" });
  }

  return (
    <div className="chat-thread" dir="rtl">
      {/* INTEGRATED HEADER */}
      <header className="chat-thread-header">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate({ to: "/chat" })}
            className="chat-back-button chat-icon-button"
            aria-label="العودة إلى المحادثات"
          >
            <ChevronLeft className="size-6" />
          </button>

          <button
            className="chat-thread-identity"
            onClick={() => setShowInfo(true)}
            aria-label={`تفاصيل ${title}`}
          >
            <div className="relative shrink-0">
              <div className="chat-thread-avatar">
                {conv?.kind === "group" ? (
                  <div className="size-full flex items-center justify-center">
                    <Users className="size-5" />
                  </div>
                ) : (
                  <UserAvatar
                    path={
                      otherInDirect ? (profiles[otherInDirect.user_id]?.avatar_url ?? null) : null
                    }
                    name={title}
                    fallbackClassName="chat-avatar-initial"
                    className="size-full object-cover rounded-full overflow-hidden"
                    userId={otherInDirect?.user_id ?? null}
                    presenceDotClassName="absolute -bottom-1 -left-1 size-3 lg:size-4 ring-2 ring-card shadow-lg z-20"
                  />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="chat-thread-title">{title}</h2>
              <p className="chat-thread-status">{statusLabel}</p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 lg:gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="chat-icon-button"
            aria-label="البحث في الرسائل"
            aria-expanded={showSearch}
          >
            <Search className="size-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="chat-icon-button"
            aria-label="تفاصيل المجلس"
          >
            <Info className="size-5" />
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="chat-message-search">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في رسائل المجلس..."
            aria-label="البحث في رسائل المجلس"
          />
          <button
            className="chat-icon-button"
            aria-label="إغلاق البحث"
            onClick={() => {
              setShowSearch(false);
              setSearch("");
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* MESSAGES AREA */}
      <div ref={scrollRef} className="chat-messages custom-scrollbar">
        <div className="chat-message-list">
          <AnimatePresence initial={false}>
            {renderGroupedMessages({
              messages:
                showSearch && search.trim()
                  ? messages.filter((message) =>
                      `${message.body ?? ""} ${message.attachment_name ?? ""}`
                        .toLowerCase()
                        .includes(search.trim().toLowerCase()),
                    )
                  : messages,
              meId,
              profiles,
              participants,
              reactions,
              deliveries,
              onReply: setReplyTo,
              onReact: (id: string) => setReactingTo(id),
              onDelete: (m: Message) => {
                if (m.sender_id === meId || isAdmin)
                  supabase
                    .from("messages")
                    .update({ deleted_at: new Date().toISOString() })
                    .eq("id", m.id);
              },
              isAdmin,
              reactingTo,
              onPickReaction: (mid: string, e: string) => {
                supabase
                  .from("message_reactions")
                  .insert({ message_id: mid, user_id: meId!, emoji: e });
                setReactingTo(null);
              },
              closeReactingTo: () => setReactingTo(null),
              onMediaLoad: () => scrollToBottom(false),
            })}
          </AnimatePresence>

          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-full w-fit border border-border/50"
            >
              <div className="flex gap-1">
                <span className="size-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1 bg-primary rounded-full animate-bounce" />
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {typingUsers.length === 1
                  ? `${displayName(profiles[typingUsers[0]])} يكتب...`
                  : "عدة أشخاص يكتبون..."}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="chat-composer">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="mb-2 bg-muted/50 backdrop-blur-xl border border-border rounded-xl lg:rounded-2xl p-3 lg:p-4 flex items-center gap-3 shadow-sm border-r-4 border-r-gold-primary"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] lg:text-[11px] font-black uppercase text-gold-primary tracking-widest mb-0.5 lg:mb-1">
                  الرد على {displayName(profiles[replyTo.sender_id])}
                </p>
                <p className="text-[11px] lg:text-xs font-bold text-muted-foreground truncate">
                  {replyTo.body || `[مرفق]`}
                </p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="إلغاء الرد"
                className="size-7 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center transition-all"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={sendText} className="chat-compose-form">
          <div className="chat-compose-input">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-black tabular-nums">
                    {formatDuration(recordingTime * 1000)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="chat-compose-tool"
                  aria-label="إرفاق ملف"
                  disabled={!canSend || sending}
                >
                  <Paperclip className="size-4 lg:size-5" strokeWidth={2.5} />
                </button>
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={canSend ? "اكتب رسالة..." : "الإرسال غير متاح لك في هذا المجلس"}
                  aria-label="نص الرسالة"
                  disabled={!canSend || sending}
                  rows={1}
                  className="chat-draft custom-scrollbar"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                />
                <div className="chat-compose-tools">
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="chat-compose-tool"
                    aria-label="إضافة رمز تعبيري"
                    aria-expanded={showEmoji}
                    disabled={!canSend || sending}
                  >
                    <Smile className="size-5 lg:size-5.5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="chat-compose-tool"
                    aria-label="إرفاق صورة"
                    disabled={!canSend || sending}
                  >
                    <ImageIcon className="size-5 lg:size-5.5" strokeWidth={2.5} />
                  </button>
                </div>
              </>
            )}
          </div>

          {!draft.trim() && !isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="chat-send-button"
              aria-label="تسجيل رسالة صوتية"
              disabled={!canSend || sending}
            >
              <Mic className="size-5 lg:size-6" strokeWidth={2.5} />
            </button>
          ) : isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="chat-send-button is-recording"
              aria-label="إيقاف التسجيل وإرسال الرسالة الصوتية"
            >
              <Square className="size-5 lg:size-6" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sending || !canSend}
              className="chat-send-button"
              aria-label="إرسال الرسالة"
            >
              {sending ? (
                <div className="size-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                <Send className="size-5 lg:size-6" strokeWidth={2.5} />
              )}
            </button>
          )}
        </form>
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="chat-emoji-picker"
            >
              <div className="chat-emoji-picker-grid custom-scrollbar" dir="ltr">
                {EMOJI_PICKER.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setDraft((value) => value + emoji);
                      setShowEmoji(false);
                    }}
                    className="chat-emoji-choice"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => onFileSelected(e, false)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileSelected(e, true)}
      />

      <AnimatePresence>
        {showInfo && (
          <InfoDrawer
            conversation={conv}
            participants={participants}
            profiles={profiles}
            meId={meId}
            myParticipant={myParticipant}
            onMute={toggleMute}
            onDelete={deleteConversation}
            onClose={() => setShowInfo(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function renderGroupedMessages(opts: any) {
  const {
    messages,
    meId,
    profiles,
    participants,
    reactions,
    deliveries,
    onReply,
    onReact,
    onDelete,
    isAdmin,
    reactingTo,
    onPickReaction,
    closeReactingTo,
    onMediaLoad,
  } = opts;
  const nodes: React.ReactNode[] = [];
  let lastDay = "";
  const byId: Record<string, Message> = {};
  messages.forEach((m: Message) => (byId[m.id] = m));

  messages.forEach((m: Message) => {
    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      nodes.push(
        <div key={`day-${day}`} className="chat-day-separator">
          <span>{dayLabel(m.created_at)}</span>
        </div>,
      );
      lastDay = day;
    }
    nodes.push(
      <MessageBubble
        key={m.id}
        m={m}
        meId={meId}
        profiles={profiles}
        replyTo={m.reply_to_id ? byId[m.reply_to_id] : undefined}
        reactions={reactions.filter((r: any) => r.message_id === m.id)}
        deliveries={deliveries.filter((d: any) => d.message_id === m.id)}
        onReply={() => onReply(m)}
        onReact={() => onReact(m.id)}
        onDelete={() => onDelete(m)}
        isAdmin={isAdmin}
        reacting={reactingTo === m.id}
        onPickReaction={(mid: string, e: string) => onPickReaction(mid, e)}
        closeReacting={closeReactingTo}
        onMediaLoad={onMediaLoad}
      />,
    );
  });
  return nodes;
}

function MessageBubble({
  m,
  meId,
  profiles,
  replyTo,
  reactions,
  deliveries,
  onReply,
  onReact,
  onDelete,
  isAdmin,
  reacting,
  onPickReaction,
  closeReacting,
  onMediaLoad,
}: any) {
  const mine = m.sender_id === meId;
  const profile = profiles[m.sender_id];
  const name = displayName(profile);
  const canDelete = mine || isAdmin;
  const [showActions, setShowActions] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const isRead = useMemo(() => {
    if (!mine) return true;
    return deliveries.some((d: any) => d.user_id !== meId && d.read_at);
  }, [deliveries, mine, meId]);

  useEffect(() => {
    if (m.attachment_url && !m.deleted_at) {
      getSignedAttachmentUrl(m.attachment_url).then(setSignedUrl);
    }
  }, [m.attachment_url, m.deleted_at]);

  const rxGrouped = reactions.reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === meId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("chat-message group/msg", mine && "is-mine")}
    >
      {!mine && (
        <div className="shrink-0 pt-1">
          <div className="size-9 rounded-xl overflow-hidden border border-border shadow-sm">
            <UserAvatar
              path={profile?.avatar_url ?? null}
              name={name}
              className="size-full"
              userId={m.sender_id}
              presenceDotClassName="absolute -bottom-0.5 -left-0.5 size-2.5 ring-2 ring-card z-20"
            />
          </div>
        </div>
      )}

      <div className={cn("chat-message-content")}>
        {!mine && <span className="chat-message-sender">{name}</span>}

        <div onClick={() => setShowActions(!showActions)} className="chat-bubble">
          {replyTo && (
            <div
              className={cn(
                "mb-2.5 p-3 rounded-xl border-r-4 text-[11px] font-bold",
                mine
                  ? "bg-black/10 border-white/30 text-white/80"
                  : "bg-muted border-border text-muted-foreground",
              )}
            >
              <p className="truncate italic">
                "{replyTo.deleted_at ? "رسالة محذوفة" : replyTo.body || "[مرفق]"}"
              </p>
            </div>
          )}

          <div className="chat-bubble-body">
            {m.deleted_at ? (
              <em className="opacity-30 font-medium italic">🚫 تم حذف الرسالة</em>
            ) : (
              <div className="space-y-2">
                {m.kind === "image" && signedUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/5 group-relative">
                    <img
                      src={signedUrl}
                      alt=""
                      onLoad={onMediaLoad}
                      className="max-w-full h-auto object-cover max-h-[300px] hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                {m.kind === "audio" && signedUrl && (
                  <AudioPlayer url={signedUrl} duration={m.attachment_duration_ms} mine={mine} />
                )}
                {m.kind === "file" && signedUrl && (
                  <a href={signedUrl} target="_blank" rel="noreferrer" className="chat-file">
                    <div className="chat-file-icon">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs font-black truncate">{m.attachment_name}</p>
                      <p className="text-[11px] opacity-60 uppercase font-black">
                        {formatBytes(m.attachment_size)}
                      </p>
                    </div>
                    <Download size={16} className="opacity-40" />
                  </a>
                )}
                {m.body && <p>{m.body}</p>}
              </div>
            )}
          </div>

          <div className="chat-bubble-meta">
            <span className="tabular-nums">{timeLabel(m.created_at)}</span>
            {mine && !m.deleted_at && (
              <CheckCheck className="size-3" data-read={isRead ? "true" : "false"} />
            )}
          </div>
        </div>

        {Object.keys(rxGrouped).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-0.5", mine ? "justify-end" : "")}>
            {Object.entries(rxGrouped).map(([emoji, info]: any) => (
              <button
                key={emoji}
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 transition-all shadow-sm",
                  info.mine
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-card border-border text-muted-foreground",
                )}
              >
                <span>{emoji}</span>
                <span>{info.count}</span>
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {!m.deleted_at && (showActions || reacting) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn("flex items-center gap-1 mt-1", mine ? "flex-row-reverse" : "flex-row")}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReact();
                }}
                aria-label="التفاعل مع الرسالة"
                className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:text-primary transition-all shadow-sm border border-border"
              >
                <Smile size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
                aria-label="الرد على الرسالة"
                className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:text-primary transition-all shadow-sm border border-border"
              >
                <Reply size={14} />
              </button>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m);
                  }}
                  aria-label="حذف الرسالة"
                  className="p-2 rounded-full bg-red-500/5 text-red-500/50 hover:text-red-500 transition-all shadow-sm border border-red-500/10"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {reacting && (
            <motion.div
              initial={{ y: 10, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.9 }}
              className="chat-reaction-picker"
            >
              {EMOJI_QUICK.map((e) => (
                <button
                  key={e}
                  onClick={() => onPickReaction(m.id, e)}
                  className="size-10 flex items-center justify-center text-xl hover:bg-muted rounded-xl transition-all active:scale-125"
                >
                  {e}
                </button>
              ))}
              <button
                onClick={closeReacting}
                aria-label="إغلاق التفاعلات"
                className="size-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function InfoDrawer({
  conversation,
  participants,
  profiles,
  meId,
  myParticipant,
  onMute,
  onDelete,
  onClose,
}: any) {
  const otherUser = participants.find((p: Participant) => p.user_id !== meId);
  const otherProfile = otherUser ? profiles[otherUser.user_id] : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="تفاصيل المجلس"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="relative w-[80vw] sm:w-[320px] bg-card h-full shadow-2xl flex flex-col border-r border-border"
      >
        <header className="h-20 shrink-0 border-b border-border flex items-center justify-between px-8">
          <h3 className="text-lg font-black text-primary">تفاصيل المجلس</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق تفاصيل المجلس"
            className="size-10 rounded-full hover:bg-muted flex items-center justify-center transition-all text-muted-foreground"
          >
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-8 space-y-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="size-24 lg:size-32 rounded-[28px] lg:rounded-[32px] bg-muted border border-border flex items-center justify-center relative overflow-hidden group">
              {conversation.kind === "group" ? (
                <Users className="size-12 text-primary/20" />
              ) : (
                <UserAvatar
                  path={otherProfile?.avatar_url}
                  name={displayName(otherProfile)}
                  className="size-full object-cover"
                />
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-black text-foreground">
                {conversationTitle(conversation, participants, profiles, meId)}
              </h4>
              <p className="text-[10px] font-black uppercase tracking-widest text-gold-primary">
                {conversation.kind === "group" ? "مجلس عائلي" : "محادثة خاصة"}
              </p>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onMute}
              className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/40 hover:bg-muted transition-all border border-border/40 group"
            >
              <div className="size-10 rounded-2xl bg-card flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                {myParticipant?.muted ? (
                  <Bell className="size-5 text-gold-primary" />
                ) : (
                  <BellOff className="size-5 text-muted-foreground" />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">
                {myParticipant?.muted ? "تفعيل" : "كتم"}
              </span>
            </button>
            <button
              onClick={onDelete}
              className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-red-500/5 hover:bg-red-500/10 transition-all border border-red-500/10 group text-red-500"
            >
              <div className="size-10 rounded-2xl bg-card flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Trash2 className="size-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">حذف</span>
            </button>
          </div>

          <div className="space-y-6">
            <h5 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 text-center">
              أعضاء الجلسة
            </h5>
            <div className="space-y-2">
              {participants.map((p: any) => {
                const prof = profiles[p.user_id];
                const name = displayName(prof);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/50"
                  >
                    <div className="size-10 rounded-xl overflow-hidden border border-border">
                      <UserAvatar path={prof?.avatar_url} name={name} className="size-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-foreground truncate">{name}</p>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">
                        {p.role === "owner" ? "مؤسس" : "عضو"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AudioPlayer({
  url,
  duration,
  mine,
}: {
  url: string;
  duration?: number | null;
  mine: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setProgress((audio.currentTime / audio.duration) * 100);
    const ended = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("ended", ended);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("ended", ended);
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play();
    setPlaying(!playing);
  };

  return (
    <div className="chat-audio">
      <audio ref={audioRef} src={url} className="hidden" />
      <button
        onClick={toggle}
        className="chat-audio-play"
        aria-label={playing ? "إيقاف الرسالة الصوتية مؤقتًا" : "تشغيل الرسالة الصوتية"}
      >
        {playing ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="chat-audio-progress">
          <div className="h-full bg-current transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[11px] font-black opacity-60 tabular-nums text-right">
          <span>{formatDuration(duration)}</span>
          <span>
            {formatDuration(
              audioRef.current?.currentTime ? audioRef.current.currentTime * 1000 : 0,
            )}
          </span>
        </div>
      </div>
      <Mic size={14} className="opacity-40" />
    </div>
  );
}

async function readMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(
      file.type.startsWith("video/") ? "video" : "audio",
    ) as HTMLMediaElement;
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round((el.duration || 0) * 1000));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}
