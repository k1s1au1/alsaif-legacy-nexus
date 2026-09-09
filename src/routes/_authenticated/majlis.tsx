import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  MessageSquare,
  Pin,
  Plus,
  Send,
  Trash2,
  Loader2,
  X,
  Newspaper,
  ChevronLeft,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { sendPushNotification } from "@/lib/api/push.functions";
import { useUserRole } from "@/hooks/use-user-role";
import { Search } from "lucide-react";
import { VoiceSearch } from "@/components/voice-search";
import { OfflineCache } from "@/lib/offline-cache";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأخبار العائلية — السيف" },
      { name: "description", content: "تابع أخبار العائلة وإعلانات المجلس ومستجداتها أولًا بأول." },
    ],
  }),
  component: MajlisPage,
});

type MajlisPost = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  kind: string;
  pinned: boolean;
  created_at: string;
  cleanBody?: string;
  imagePath?: string | null;
  imageUrl?: string | null;
  uiKind?: string;
  author?: { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
};

function MajlisPage() {
  const { userId: meId, isAdmin, isChairman, canManage: canManageSection } = useUserRole();

  // Restricted access: Only Chairman, Technical Admin, or News Section Head
  const canPostNews = isChairman || isAdmin || canManageSection("news");

  const [profile, setProfile] = useState({
    name: "",
    role: "",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [posts, setPosts] = useState<MajlisPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingPost, setEditingPost] = useState<MajlisPost | null>(null);
  const dynamicLogo = useSiteLogo();

  useEffect(() => {
    const cached = OfflineCache.load("majlis_posts");
    if (cached) setPosts(cached);
  }, []);

  const loadData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: roles }, { data: sectionHeads }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
          )
          .eq("id", meId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", meId),
        supabase
          .from("section_heads" as any)
          .select("section")
          .eq("user_id", meId),
      ]);
      const rs = (roles ?? []).map((r) => r.role);
      const sh = (sectionHeads ?? []).map((s: any) => s.section);

      if (p) {
        let displayRole = "عضو";
        if (rs.includes("chairman")) displayRole = "رئيس المجلس";
        else if (rs.includes("admin")) displayRole = "المسؤول التقني";
        else if (sh.includes("majlis") || sh.includes("news")) displayRole = "مسؤول قسم الأخبار";
        else if (rs.includes("manager")) displayRole = "مسؤول قسم";

        setProfile({
          name: p.arabic_name || p.full_name || "عضو",
          role: displayRole,
          initial: (p.arabic_name?.[0] || "ع").toUpperCase(),
          avatarPath: p.avatar_url,
        });
      }

      const { data: rawPosts, error } = await supabase.from("majlis_posts").select("*");
      if (error) console.error("Posts fetch error:", error);

      if (rawPosts) {
        const authorIds = Array.from(
          new Set(rawPosts.map((p: any) => p.author_id).filter(Boolean)),
        );
        const { data: authorProfiles } = authorIds.length
          ? await supabase
              .from("profiles")
              .select("id, arabic_name, full_name, avatar_url")
              .in("id", authorIds)
          : { data: [] };
        const profileMap = new Map((authorProfiles ?? []).map((p: any) => [p.id, p]));

        // Filter out polls from the Majlis feed
        const processed = rawPosts
          .map((p: any) => {
            const kindMatch = p.body?.match(/---kind:(\w+)/);
            const uiKind = kindMatch
              ? kindMatch[1]
              : p.kind === "announcement"
                ? "announcement"
                : p.kind === "complaint"
                  ? "complaint"
                  : "sharing";
            const imageMatch = (p.body || "").match(/---image:([^\n]+)\n?/);
            const imagePath = imageMatch ? imageMatch[1].trim() : null;
            const cleanBody = (p.body || "")
              .replace(/^---image:[^\n]+\n?/, "")
              .replace(/---kind:.*?\n?/, "")
              .replace(/---poll:.*?--- \n?/, "")
              .replace(/^---poll:.*?---/s, "")
              .trim();
            return {
              ...p,
              uiKind,
              imagePath,
              cleanBody: cleanBody || "",
              author: profileMap.get(p.author_id) || null,
            };
          })
          .filter(
            (p: any) =>
              (p.uiKind === "sharing" ||
                p.uiKind === "announcement" ||
                p.kind === "announcement") &&
              !p.body?.includes("---poll:"),
          );

        // Sign image URLs in parallel
        const withImages = await Promise.all(
          processed.map(async (p: any) => {
            if (!p.imagePath) return p;
            const { data } = await supabase.storage
              .from("trip-images")
              .createSignedUrl(p.imagePath, 60 * 60 * 24);
            return { ...p, imageUrl: data?.signedUrl || null };
          }),
        );

        withImages.sort((a: any, b: any) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setPosts(withImages as any);
        OfflineCache.save("majlis_posts", withImages);
      }

      const { data: coms } = await supabase
        .from("majlis_comments")
        .select("*")
        .order("created_at", { ascending: true });
      if (coms) {
        const ids = Array.from(new Set(coms.map((c: any) => c.author_id).filter(Boolean)));
        const { data: cProfs } = ids.length
          ? await supabase
              .from("profiles")
              .select("id, arabic_name, full_name, avatar_url")
              .in("id", ids)
          : { data: [] };
        const cMap = new Map((cProfs ?? []).map((p: any) => [p.id, p]));
        setComments(coms.map((c: any) => ({ ...c, author: cMap.get(c.author_id) || null })));
      }
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("majlis-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () =>
        loadData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, () =>
        loadData(),
      )
      .subscribe();

    const handler = setTimeout(() => setDebouncedQ(q), 300);
    return () => {
      supabase.removeChannel(channel);
      clearTimeout(handler);
    };
  }, [loadData, q]);

  const filteredPosts = useMemo(() => {
    if (!debouncedQ.trim()) return posts;
    const needle = debouncedQ.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(needle) ||
        (p.cleanBody ?? "").toLowerCase().includes(needle) ||
        (p.author?.arabic_name ?? "").toLowerCase().includes(needle),
    );
  }, [posts, debouncedQ]);

  return (
    <AppShell title="الأخبار" user={{ name: "", role: "", initial: "ص" }}>
      <div className="majlis-page mx-auto w-full max-w-[72rem] space-y-8 pb-24 sm:space-y-10 md:space-y-12" dir="rtl">
        <QuickActionsBanner />

        <section className="majlis-hero-section animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div
                className="size-28 md:size-64 logo-alsaif-banner"
                style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
              />
            </div>
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                    أخبار السيف
                  </span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">
                  الأخبار العائلية
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                  تابع أخبار العائلة وإعلانات المجلس ومستجداتها أولًا بأول.
                </p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Newspaper className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        {/* Search Bar with Voice Search */}
        <section className="animate-fade-up px-4 md:px-0" style={{ animationDelay: "150ms" }}>
          <div className="relative group">
            <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
              <Search
                className="size-5 text-muted-foreground group-focus-within:text-primary transition-colors"
                strokeWidth={2.5}
              />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في الأخبار والمنشورات..."
              className="w-full h-16 pr-16 pl-20 rounded-[28px] bg-card border border-border shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg"
            />
            <div className="absolute inset-y-0 left-4 flex items-center">
              <VoiceSearch onResult={(text) => setQ(text)} />
            </div>
          </div>
        </section>

        {canPostNews && (
          <div className="px-4 md:px-0 flex justify-end">
            <button
              onClick={() => setShowAdd(true)}
              className="btn-gold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 shadow-xl text-sm font-black active:scale-95 transition-all"
            >
              <Plus size={20} strokeWidth={3} /> <span>إضافة منشور</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" />
            </div>
          ) : (
            filteredPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                meId={meId}
                isChairman={isAdmin || isChairman}
                canDelete={canPostNews || p.author_id === meId}
                canEdit={canPostNews || p.author_id === meId}
                onEdit={() => setEditingPost(p)}
                onRefresh={loadData}
                comments={comments}
              />
            ))
          )}
          {!loading && filteredPosts.length === 0 && (
            <div className="p-20 text-center bg-muted/20 rounded-[48px] border-4 border-dashed italic text-muted-foreground">
              {q ? "لا توجد نتائج مطابقة لبحثك." : "لا توجد منشورات حالياً."}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddPostDialog
            meId={meId}
            canManageNews={canPostNews}
            onClose={() => setShowAdd(false)}
            onSaved={loadData}
          />
        )}
        {editingPost && (
          <AddPostDialog
            meId={meId}
            canManageNews={canPostNews}
            editPost={editingPost}
            onClose={() => setEditingPost(null)}
            onSaved={loadData}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function PostCard({
  post,
  meId,
  isChairman,
  canDelete,
  canEdit,
  onEdit,
  onRefresh,
  comments,
}: any) {
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";

  const deletePost = async () => {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (!error) {
      toast.success("تم الحذف");
      onRefresh();
    }
  };
  const togglePin = async () => {
    const { error } = await supabase
      .from("majlis_posts")
      .update({ pinned: !post.pinned })
      .eq("id", post.id);
    if (!error) onRefresh();
  };

  const postComments = comments.filter(
    (c: any) => c.post_id === post.id && !c.body.startsWith("[VOTE]:"),
  );

  return (
    <motion.article
      layout
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[0_22px_60px_-44px_rgba(5,20,16,0.72)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_28px_72px_-46px_rgba(5,20,16,0.82)] md:rounded-[38px]",
        post.pinned && "border-gold-primary/40 ring-1 ring-gold-primary/10",
      )}
    >
      {post.pinned && (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-gold-primary px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md">
          <Pin size={13} /> مثبت
        </div>
      )}

      {post.imageUrl ? (
        <a
          href={post.imageUrl}
          target="_blank"
          rel="noreferrer"
          className="relative block overflow-hidden border-b border-border/40 bg-muted/30"
        >
          <img
            src={post.imageUrl}
            alt={post.title || "صورة الإعلان"}
            className="block max-h-[560px] w-full object-contain transition-transform duration-700 group-hover:scale-[1.008]"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="relative flex h-36 items-center justify-center overflow-hidden border-b border-white/10 bg-gradient-to-l from-primary via-[#0d332a] to-[#071c17] text-gold-primary sm:h-44">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(212,175,55,0.18),transparent_34%)]" />
          <Newspaper className="relative size-12 opacity-80 sm:size-16" strokeWidth={1.35} />
          <span className="relative mr-4 text-sm font-black tracking-wide sm:text-base">
            أخبار السيف
          </span>
        </div>
      )}

      <div className="p-5 sm:p-7 md:p-9">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="size-12 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/10 shadow-md sm:size-14">
              <UserAvatar
                path={post.author?.avatar_url}
                name={authorName}
                className="size-full"
                userId={post.author_id}
                showBadges
              />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-base font-black text-primary sm:text-lg">{authorName}</h4>
              <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString("ar-SA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {post.kind === "announcement" && (
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-primary/20 bg-gold-primary/10 px-3.5 py-2 text-xs font-black text-gold-primary">
                <Pin size={12} /> إعلان المجلس
              </span>
            )}

            {(isChairman || canEdit || canDelete) && (
              <div className="flex items-center gap-2">
                {isChairman && (
                  <button
                    onClick={togglePin}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl transition-all shadow-sm",
                      post.pinned
                        ? "bg-gold-primary text-white"
                        : "bg-gold-primary/10 text-gold-primary hover:bg-gold-primary hover:text-white",
                    )}
                    title="تثبيت"
                  >
                    <Pin size={17} />
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={onEdit}
                    className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary hover:text-white"
                    title="تعديل"
                  >
                    <Pencil size={17} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={deletePost}
                    className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 shadow-sm transition-all hover:bg-rose-500 hover:text-white"
                    title="حذف"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="mt-6 space-y-3 border-t border-border/40 pt-6">
          <h3 className="text-2xl font-black leading-tight text-primary sm:text-3xl md:text-4xl">
            {post.title}
          </h3>
          {post.cleanBody && (
            <p className="max-w-5xl whitespace-pre-wrap text-base font-bold leading-8 text-muted-foreground/90 dark:text-white/80 md:text-lg">
              {post.cleanBody}
            </p>
          )}
        </div>

        <CommentsSection
          post={post}
          meId={meId}
          isChairman={isChairman}
          comments={postComments}
          onRefresh={onRefresh}
        />
      </div>
    </motion.article>
  );
}

function CommentsSection({ post, meId, isChairman, comments, onRefresh }: any) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !meId) return;
    setSending(true);
    const { error } = await supabase
      .from("majlis_comments")
      .insert({ post_id: post.id, author_id: meId, body: text.trim() });
    setSending(false);
    if (error) toast.error("تعذر إرسال التعليق");
    else {
      setText("");
      onRefresh();
    }
  };
  const removeComment = async (id: string) => {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await supabase.from("majlis_comments").delete().eq("id", id);
    if (!error) onRefresh();
  };

  return (
    <div className="mt-8 pt-6 border-t border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-black text-primary/70 hover:text-primary transition-all"
      >
        <MessageSquare size={16} />
        <span>{comments.length > 0 ? `${comments.length} تعليق` : "أضف تعليقاً"}</span>
        <ChevronLeft size={14} className={cn("transition-transform", open && "-rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-6">
              {comments.map((c: any) => {
                const name = c.author?.arabic_name || c.author?.full_name || "عضو";
                const canDel = isChairman || c.author_id === meId;
                return (
                  <div key={c.id} className="flex gap-3 items-start group/c">
                    <div className="size-10 rounded-2xl border border-primary/10 overflow-hidden shrink-0">
                      <UserAvatar
                        path={c.author?.avatar_url}
                        name={name}
                        className="size-full"
                        userId={c.author_id}
                      />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-black text-primary">{name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("ar-SA", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {canDel && (
                            <button
                              onClick={() => removeComment(c.id)}
                              className="opacity-0 group-hover/c:opacity-100 text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {c.body}
                      </p>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  لا توجد تعليقات بعد — كن أول من يعلق
                </p>
              )}
              <form onSubmit={submit} className="flex gap-2 pt-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="اكتب تعليقك..."
                  className="flex-1 h-12 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <button
                  disabled={sending || !text.trim()}
                  type="submit"
                  className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shadow-lg"
                >
                  {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddPostDialog({ meId, canManageNews, editPost, onClose, onSaved }: any) {
  const sendPush = useServerFn(sendPushNotification);
  const isEdit = !!editPost;
  const isAnn = isEdit
    ? (editPost.kind === "announcement" || editPost.uiKind === "announcement") && canManageNews
    : canManageNews;

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: editPost?.title || "",
    body: editPost?.cleanBody || "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editPost?.imageUrl || null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(
    editPost?.imagePath || null,
  );

  const pickImage = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
    setExistingImagePath(null);
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
    setExistingImagePath(null);
  };

  const submit = async (e: any) => {
    e.preventDefault();
    const title = form.title.trim(),
      body = form.body.trim();
    if (!title || !body) return toast.error("يرجى إكمال البيانات الأساسية");
    setSaving(true);
    try {
      let imagePath = existingImagePath;
      if (image && isAnn) {
        setUploading(true);
        const ext = image.name.split(".").pop() || "jpg";
        const path = `anns/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("trip-images").upload(path, image);
        setUploading(false);
        if (upErr) {
          toast.error("تعذر رفع الصورة");
          setSaving(false);
          return;
        }
        imagePath = path;
      }

      const imagePrefix = imagePath ? `---image:${imagePath}\n` : "";
      const finalBody = isAnn ? `${imagePrefix}${body}` : `---kind:sharing\n${body}`;

      if (isEdit) {
        const { error } = await supabase
          .from("majlis_posts")
          .update({
            title,
            body: finalBody,
            kind: isAnn ? "announcement" : "discussion",
          })
          .eq("id", editPost.id);
        if (!error) {
          toast.success("تم تحديث الإعلان");
          onSaved();
          onClose();
        } else {
          console.error("Majlis update error:", error);
          toast.error("تعذر التحديث", { description: error.message });
        }
      } else {
        const { error } = await supabase.from("majlis_posts").insert({
          title,
          body: finalBody,
          kind: isAnn ? "announcement" : "discussion",
          author_id: meId,
        });
        if (!error) {
          toast.success(isAnn ? "تم نشر الإعلان" : "تم النشر بنجاح");
          sendPush({ data: {
            title: "خبر جديد",
            body: "تم نشر خبر جديد في مجلس العائلة.",
            type: "news",
            route: "/majlis",
          } }).catch(() => {});
          onSaved();
          onClose();
        } else {
          console.error("Majlis insert error:", error);
          toast.error("تعذر النشر", { description: error.message });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "تعديل الإعلان" : "مشاركة جديدة"}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card w-full max-w-2xl rounded-[32px] sm:rounded-[48px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]"
      >
        <header className="p-5 sm:p-8 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
              {isEdit ? <Pencil size={24} strokeWidth={3} /> : <Plus size={24} strokeWidth={3} />}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-primary">
              {isEdit ? "تعديل الإعلان" : "إعلان جديد"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
          >
            <X size={24} />
          </button>
        </header>
        <form
          onSubmit={submit}
          className="p-5 sm:p-8 space-y-6 overflow-y-auto overscroll-contain no-scrollbar flex-1 text-foreground"
        >
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">
              عنوان الإعلان
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="العنوان..."
              className="w-full h-16 px-8 rounded-3xl bg-muted/40 border border-border/60 font-black text-xl focus:ring-4 focus:ring-primary/5 focus:border-primary shadow-inner outline-none"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">
              التفاصيل
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="اكتب التفاصيل هنا..."
              rows={6}
              className="w-full p-8 rounded-[40px] bg-muted/40 border border-border/60 font-bold text-lg focus:ring-4 focus:ring-primary/5 focus:border-primary resize-none shadow-inner outline-none"
              required
            />
          </div>

          {isAnn && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary px-2">
                صورة الخلفية (تظهر كخلفية في بنر لوحة التحكم)
              </label>
              {imagePreview ? (
                <div className="relative rounded-3xl overflow-hidden border-2 border-gold-primary/30 shadow-xl">
                  <img src={imagePreview} alt="" className="w-full max-h-64 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-3 left-3 size-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="block w-full p-8 rounded-3xl border-2 border-dashed border-gold-primary/40 bg-gold-primary/5 hover:bg-gold-primary/10 cursor-pointer text-center transition-all">
                  {uploading ? (
                    <Loader2 className="animate-spin size-8 mx-auto text-gold-primary" />
                  ) : (
                    <div className="space-y-2">
                      <Plus className="size-10 mx-auto text-gold-primary" />
                      <p className="text-sm font-black text-gold-primary">
                        {isEdit ? "تغيير صورة الخلفية" : "اختر صورة الخلفية"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        PNG / JPG حتى 5MB
                      </p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
                </label>
              )}
            </div>
          )}

          <div className="sticky bottom-0 z-20 -mx-5 sm:-mx-8 flex gap-3 border-t border-border/40 bg-card/95 px-5 sm:px-8 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-5 rounded-[28px] font-black text-muted-foreground hover:bg-muted"
            >
              تراجع
            </button>
            <button
              disabled={saving}
              type="submit"
              className="flex-[2] btn-gold py-5 rounded-[28px] font-black text-xl shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              {saving ? (
                <Loader2 className="animate-spin size-6" />
              ) : (
                <>
                  <Send size={24} /> <span>{isEdit ? "حفظ التعديلات" : "نشر الإعلان"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
