import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MemberDialog } from "@/components/community/member-dialog";
import {
  Lock,
  Plus,
  Send,
  Loader2,
  ShieldCheck,
  Inbox,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

type Visibility = "leadership" | "chairman_only";
type Status = "new" | "seen" | "in_progress" | "awaiting_member" | "resolved" | "closed";

export type PrivateRequest = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  visibility: Visibility;
  status: Status;
  created_at: string;
  updated_at: string;
};

type Msg = {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export const REQUEST_STATUS_META: Record<Status, { label: string; className: string }> = {
  new: { label: "جديد", className: "bg-sky-600" },
  seen: { label: "تم الاطلاع", className: "bg-indigo-600" },
  in_progress: { label: "قيد المعالجة", className: "bg-amber-600" },
  awaiting_member: { label: "بانتظار رد العضو", className: "bg-rose-600" },
  resolved: { label: "تم الحل", className: "bg-emerald-600" },
  closed: { label: "مغلق", className: "bg-slate-600" },
};

const STATUS_ORDER: Status[] = [
  "new",
  "seen",
  "in_progress",
  "awaiting_member",
  "resolved",
  "closed",
];

const VISIBILITY_META: Record<Visibility, string> = {
  leadership: "رئيس المجلس والنائب",
  chairman_only: "رئيس المجلس فقط",
};

export function PrivateRequestsSection() {
  const { userId: meId, isChairman, isCouncilLeadership } = useUserRole();
  const [rows, setRows] = useState<PrivateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "inbox">("mine");

  const load = useCallback(async () => {
    if (!meId) return;
    // RLS returns only the rows this user may see — no client-side hiding.
    const { data, error } = await supabase
      .from("private_requests")
      .select("id,author_id,title,body,visibility,status,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("private_requests fetch error", error);
      toast.error("تعذر تحميل الطلبات الخاصة");
    } else {
      setRows((data ?? []) as PrivateRequest[]);
    }
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel("private-requests-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "private_requests" }, () =>
        void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, load]);

  const mine = rows.filter((r) => r.author_id === meId);
  const inbox = rows.filter((r) => r.author_id !== meId);
  const visible = scope === "mine" ? mine : inbox;
  const openRequest = rows.find((r) => r.id === openId) || null;

  return (
    <section className="private-requests-section px-4 md:px-0 space-y-6" dir="rtl">
      <div className="card-surface p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lock size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl md:text-2xl font-black text-primary">الطلبات الخاصة</h3>
              <p className="text-xs md:text-sm font-bold text-muted-foreground max-w-xl">
                طلباتك الخاصة لا تُنشر في اليوميات — تُرسل مباشرة إلى رئيس المجلس (والنائب إن
                اخترت ذلك) وتُتابع كمحادثة خاصة.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-gold px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-black shadow-lg"
          >
            <Plus size={17} />
            <span>طلب جديد</span>
          </button>
        </div>

        {isCouncilLeadership && (
          <div className="flex flex-wrap gap-2">
            <ScopeChip
              active={scope === "mine"}
              onClick={() => setScope("mine")}
              label={`طلباتي (${mine.length})`}
              Icon={MessageSquare}
            />
            <ScopeChip
              active={scope === "inbox"}
              onClick={() => setScope("inbox")}
              label={`صندوق الطلبات (${inbox.length})`}
              Icon={Inbox}
            />
          </div>
        )}

        {loading ? (
          <div className="py-14 text-center">
            <Loader2 className="animate-spin size-8 mx-auto text-primary opacity-30" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center bg-muted/20 rounded-3xl border-2 border-dashed text-muted-foreground italic text-sm font-bold">
            {scope === "mine" ? "لا توجد طلبات خاصة بعد." : "لا توجد طلبات واردة حالياً."}
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="w-full text-right p-5 rounded-3xl border-2 border-border/50 bg-card hover:border-primary/40 transition-all flex items-start justify-between gap-4"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black text-white",
                        REQUEST_STATUS_META[r.status]?.className || "bg-slate-600",
                      )}
                    >
                      {REQUEST_STATUS_META[r.status]?.label || r.status}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-muted text-muted-foreground inline-flex items-center gap-1.5">
                      <ShieldCheck size={11} /> {VISIBILITY_META[r.visibility]}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-primary truncate">{r.title}</h4>
                  <p className="text-xs font-bold text-muted-foreground line-clamp-2">{r.body}</p>
                </div>
                <ChevronLeft className="text-muted-foreground shrink-0" size={18} />
              </button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddRequestDialog
          meId={meId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
      {openRequest && (
        <RequestThreadDialog
          request={openRequest}
          meId={meId}
          canManageStatus={
            openRequest.visibility === "chairman_only" ? isChairman : isCouncilLeadership
          }
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}

function ScopeChip({ active, onClick, label, Icon }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-2xl text-xs font-black border transition-all flex items-center gap-2",
        active
          ? "bg-primary text-white border-primary shadow-lg"
          : "bg-card text-muted-foreground border-border hover:border-primary/40",
      )}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function AddRequestDialog({ meId, onClose, onSaved }: any) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("leadership");
  const [saving, setSaving] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("أدخل العنوان والتفاصيل");
    setSaving(true);
    const { error } = await supabase.from("private_requests").insert({
      author_id: meId,
      title: title.trim(),
      body: body.trim(),
      visibility,
    } as any);
    setSaving(false);
    if (error) return toast.error("تعذر إرسال الطلب: " + error.message);
    toast.success("تم إرسال طلبك بسرية");
    onSaved();
  };

  return (
    <MemberDialog
      title="طلب خاص جديد"
      description="أرسل طلبك الخاص إلى رئيس المجلس أو القيادة وحدد من يستطيع الاطلاع عليه."
      icon={<Lock size={20} />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="member-dialog-form text-foreground">
        <div className="member-dialog-scroll space-y-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان الطلب..."
            className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border/60 font-black"
            required
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب تفاصيل طلبك..."
            rows={6}
            className="w-full p-5 rounded-2xl bg-muted/40 border border-border/60 font-bold resize-none"
            required
          />
          <div className="space-y-2">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              من يستطيع الاطلاع؟
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(["leadership", "chairman_only"] as Visibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-right space-y-1",
                    visibility === v
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span className="block text-sm font-black">
                    {v === "leadership" ? "القيادة" : "رئيس المجلس فقط"}
                  </span>
                  <span className="block text-[11px] font-bold opacity-70">
                    {VISIBILITY_META[v]} + أنت
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="member-dialog-actions">
          <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground">
            تراجع
          </button>
          <button
            disabled={saving}
            type="submit"
            className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin size-5" /> : <><Send size={17} /><span>إرسال</span></>}
          </button>
        </div>
      </form>
    </MemberDialog>
  );
}

function RequestThreadDialog({ request, meId, canManageStatus, onClose, onChanged }: any) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Record<string, any>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("private_request_messages")
      .select("id,request_id,sender_id,body,created_at")
      .eq("request_id", request.id)
      .order("created_at", { ascending: true });
    if (error) console.error("private_request_messages error", error);
    const list = (data ?? []) as Msg[];
    setMsgs(list);
    const ids = Array.from(new Set([...list.map((m) => m.sender_id), request.author_id]));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url")
        .in("id", ids);
      setPeople(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p])));
    }
    setLoading(false);
  }, [request.id, request.author_id]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`private-request-${request.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_request_messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [request.id, load]);

  const send = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !meId) return;
    setSending(true);
    const { error } = await supabase.from("private_request_messages").insert({
      request_id: request.id,
      sender_id: meId,
      body: text.trim(),
    } as any);
    setSending(false);
    if (error) return toast.error("تعذر إرسال الرد");
    setText("");
    await load();
  };

  const setStatus = async (status: Status) => {
    const { error } = await supabase
      .from("private_requests")
      .update({ status } as any)
      .eq("id", request.id);
    if (error) return toast.error("تعذر تحديث الحالة");
    toast.success("تم تحديث حالة الطلب");
    await onChanged();
  };

  const authorName =
    people[request.author_id]?.arabic_name || people[request.author_id]?.full_name || "عضو";

  return (
    <MemberDialog
      title={request.title}
      description={`محادثة الطلب الخاص — ${VISIBILITY_META[request.visibility as Visibility]}`}
      onClose={onClose}
      wide
    >
      <div className="member-dialog-scroll space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-muted-foreground">
            من: {authorName} · {VISIBILITY_META[request.visibility as Visibility]}
          </p>
          <div className="flex flex-wrap gap-2">
            {canManageStatus ? (
              STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[10px] font-black border transition-all",
                    request.status === s
                      ? `${REQUEST_STATUS_META[s].className} text-white border-transparent`
                      : "bg-card text-muted-foreground border-border hover:border-primary/40",
                  )}
                >
                  {REQUEST_STATUS_META[s].label}
                </button>
              ))
            ) : (
              <span
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-black text-white",
                  REQUEST_STATUS_META[request.status as Status]?.className || "bg-slate-600",
                )}
              >
                {REQUEST_STATUS_META[request.status as Status]?.label || request.status}
              </span>
            )}
          </div>
        </div>
        <div className="p-4 rounded-3xl bg-muted/40 border border-border/50">
          <p className="text-sm font-bold text-foreground whitespace-pre-wrap">{request.body}</p>
        </div>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="animate-spin size-7 mx-auto text-primary opacity-30" />
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === meId;
            const name = people[m.sender_id]?.arabic_name || people[m.sender_id]?.full_name || "عضو";
            return (
              <div key={m.id} className={cn("flex gap-3 items-start", mine && "flex-row-reverse")}>
                <div className="size-9 rounded-2xl overflow-hidden shrink-0">
                  <UserAvatar
                    path={people[m.sender_id]?.avatar_url}
                    name={name}
                    className="size-full"
                    userId={m.sender_id}
                  />
                </div>
                <div
                  className={cn(
                    "flex-1 rounded-3xl p-4 max-w-[80%]",
                    mine ? "bg-primary/10 border border-primary/20" : "bg-muted/40 border border-border/50",
                  )}
                >
                  <p className="text-[11px] font-black text-primary mb-1">{name}</p>
                  <p className="text-sm font-bold text-foreground whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        {!loading && msgs.length === 0 && (
          <p className="text-center text-xs font-bold text-muted-foreground py-4">
            لا توجد ردود بعد.
          </p>
        )}
      </div>

      <form onSubmit={send} className="member-dialog-actions">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رداً خاصاً..."
          aria-label="الرد الخاص"
          className="min-w-0 flex-1 h-12 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none"
        />
        <button
          disabled={sending || !text.trim()}
          type="submit"
          aria-label="إرسال الرد"
          className="size-12 shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center disabled:opacity-40"
        >
          {sending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
    </MemberDialog>
  );
}
