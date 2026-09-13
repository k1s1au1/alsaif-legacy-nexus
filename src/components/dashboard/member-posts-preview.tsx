import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, HelpCircle, Loader2, MessageCircle, Pause, Play, RefreshCw, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { OfflineCache } from "@/lib/offline-cache";
import { MEMBER_POST_PREVIEW_SIZE, MEMBER_POST_ROTATION_MS, PUBLIC_MEMBER_POST_KINDS, sampleMemberPostOffsets } from "@/lib/member-post-rotation";

type PostRow = Database["public"]["Tables"]["member_posts"]["Row"];
type PreviewPost = Pick<PostRow, "id" | "author_id" | "kind" | "title" | "body" | "image_urls" | "created_at"> & {
  author?: { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
  commentCount?: number;
};
type Snapshot = { userId: string; posts: PreviewPost[]; total: number };
const POST_FIELDS = "id, author_id, kind, title, body, image_urls, created_at";

function publicPosts(rows: PreviewPost[]) {
  return rows.filter((post) => post?.id && PUBLIC_MEMBER_POST_KINDS.includes(post.kind));
}

function postTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "";
  const format = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (elapsed < 60_000) return "الآن";
  if (elapsed < 3_600_000) return format.format(-Math.floor(elapsed / 60_000), "minute");
  if (elapsed < 86_400_000) return format.format(-Math.floor(elapsed / 3_600_000), "hour");
  return format.format(-Math.floor(elapsed / 86_400_000), "day");
}

export function MemberPostsPreview({ userId, authLoading, headingId }: {
  userId: string | null;
  authLoading: boolean;
  headingId: string;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [online, setOnline] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const refreshRef = useRef<() => void>(() => {});
  const pendingRef = useRef<Snapshot | null>(null);
  const pausedRef = useRef(false);
  const visibleRef = useRef(false);
  const paused = manualPause || hovered || focused || touching;
  const current = snapshot?.userId === userId ? snapshot : null;

  useEffect(() => {
    pausedRef.current = paused;
    visibleRef.current = inView && tabVisible;
    if (!paused && inView && tabVisible && pendingRef.current?.userId === userId) {
      setSnapshot(pendingRef.current);
      pendingRef.current = null;
    }
  }, [paused, inView, tabVisible, userId]);

  useEffect(() => {
    const syncVisibility = () => setTabVisible(document.visibilityState === "visible");
    const syncNetwork = () => setOnline(navigator.onLine);
    syncVisibility();
    syncNetwork();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return () => {
        document.removeEventListener("visibilitychange", syncVisibility);
        window.removeEventListener("online", syncNetwork);
        window.removeEventListener("offline", syncNetwork);
      };
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
    };
  }, []);

  useEffect(() => {
    pendingRef.current = null;
    if (!userId) {
      setLoading(false);
      setSnapshot(null);
      refreshRef.current = () => {};
      return;
    }
    let alive = true;
    let busy = false;
    let hasPosts = false;
    let lastOffsets: number[] = [];
    let lastTotal = -1;
    const cacheKey = `member_corner_preview:v1:${userId}`;
    const cached = OfflineCache.load(cacheKey);
    setFailed(false);
    setLoading(true);
    if (cached?.userId === userId && Array.isArray(cached.posts)) {
      const posts = publicPosts(cached.posts).slice(0, MEMBER_POST_PREVIEW_SIZE);
      hasPosts = posts.length > 0;
      setSnapshot({ userId, posts, total: Math.max(posts.length, Number(cached.total) || 0) });
      setLoading(false);
    }

    const read = async () => {
      if (busy) return;
      if (!navigator.onLine) {
        if (alive && !hasPosts) setLoading(false);
        return;
      }
      busy = true;
      try {
        const { count, error } = await supabase.from("member_posts")
          .select("id", { count: "exact", head: true }).in("kind", PUBLIC_MEMBER_POST_KINDS);
        if (error) throw error;
        const total = count ?? 0;
        const offsets = sampleMemberPostOffsets(total, total === lastTotal ? lastOffsets : []);
        // Read only the three chosen rows, not every post/image/comment in the corner.
        const pages = await Promise.all(offsets.map((offset) => supabase.from("member_posts")
          .select(POST_FIELDS).in("kind", PUBLIC_MEMBER_POST_KINDS)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset)));
        const pageError = pages.find((page) => page.error)?.error;
        if (pageError) throw pageError;
        const posts = publicPosts(pages.flatMap((page) => page.data ?? []))
          .filter((post, index, all) => all.findIndex((row) => row.id === post.id) === index);
        const authorIds = [...new Set(posts.map((post) => post.author_id))];
        const [profiles, counts] = await Promise.all([
          authorIds.length ? supabase.from("profiles").select("id, arabic_name, full_name, avatar_url")
            .in("id", authorIds) : Promise.resolve({ data: [] }),
          Promise.all(posts.map((post) => supabase.from("member_post_comments")
            .select("id", { count: "exact", head: true }).eq("post_id", post.id))),
        ]);
        if (!alive) return;
        const authors = new Map<string, NonNullable<PreviewPost["author"]>>();
        for (const profile of profiles.data ?? []) authors.set(profile.id, profile);
        const next: Snapshot = { userId, total, posts: posts.map((post, index) => ({
          ...post,
          body: post.body?.slice(0, 500) ?? null,
          image_urls: (post.image_urls ?? []).slice(0, 1),
          author: authors.get(post.author_id),
          commentCount: counts[index].error ? undefined : counts[index].count ?? 0,
        })) };
        if (hasPosts && (pausedRef.current || !visibleRef.current)) pendingRef.current = next;
        else setSnapshot(next);
        hasPosts = next.posts.length > 0;
        lastOffsets = offsets;
        lastTotal = total;
        setFailed(false);
        setLoading(false);
        OfflineCache.save(cacheKey, next);
      } catch {
        if (alive) {
          setFailed(true);
          setLoading(false);
        }
      } finally {
        busy = false;
      }
    };
    refreshRef.current = () => { void read(); };
    void read();
    const refresh = () => {
      if (!pausedRef.current && visibleRef.current) void read();
    };
    const channel = supabase.channel(`member-preview-${headingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_posts" }, refresh)
      .subscribe();
    window.addEventListener("online", refresh);
    return () => {
      alive = false;
      refreshRef.current = () => {};
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, headingId]);

  useEffect(() => {
    if (userId && online && inView && tabVisible && !pausedRef.current) refreshRef.current();
  }, [userId, online, inView, tabVisible]);

  useEffect(() => {
    if (!userId || paused || !inView || !tabVisible || !online || (current?.total ?? 0) <= MEMBER_POST_PREVIEW_SIZE) return;
    const timer = window.setInterval(() => refreshRef.current(), MEMBER_POST_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [userId, paused, inView, tabVisible, online, current?.total]);

  return (
    <section ref={sectionRef} className="family-agenda__posts" aria-labelledby={headingId}>
      <div className="family-agenda__section-head">
        <span><MessageCircle aria-hidden="true" /><b id={headingId}>مشاركات الأعضاء</b></span>
        <Link to="/community">عرض ركن الأعضاء<ChevronLeft aria-hidden="true" /></Link>
      </div>
      <div className="family-agenda__posts-summary">
        <span>مختارات من المشاركات العامة</span>
        {current && <b>{current.posts.length.toLocaleString("ar-SA")} من {current.total.toLocaleString("ar-SA")} مشاركة</b>}
      </div>
      <div className="family-agenda__post-list" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        onPointerDown={() => setTouching(true)} onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)} onPointerLeave={() => setTouching(false)}>
        {authLoading || (loading && !current) ? (
          <div className="family-agenda__empty" role="status"><Loader2 className="family-agenda__spinner" aria-hidden="true" /><b>جاري تحميل المشاركات…</b></div>
        ) : current?.posts.length ? current.posts.map((post) => {
          const name = post.author?.arabic_name || post.author?.full_name || "عضو العائلة";
          const question = post.kind === "question";
          const Icon = question ? HelpCircle : BookOpen;
          return (
            <Link key={post.id} to="/community" search={{ post: post.id }}
              className={`family-agenda__post-row ${post.image_urls[0] ? "has-image" : ""}`}
              aria-label={`${post.title}، مشاركة ${name}`}>
              <span className="family-agenda__post-copy">
                <span className="family-agenda__post-meta">
                  <span className="family-agenda__post-avatar"><UserAvatar path={post.author?.avatar_url} name={name} className="family-agenda__post-avatar-image" /></span>
                  <b>{name}</b><time dateTime={post.created_at}>{postTime(post.created_at)}</time>
                  <span className="family-agenda__post-kind" data-kind={question ? "question" : "diary"}><Icon aria-hidden="true" />{question ? "سؤال للعائلة" : "يوميات"}</span>
                </span>
                <strong>{post.title}</strong>
                {post.body && <span className="family-agenda__post-excerpt">{post.body.replace(/\s+/g, " ")}</span>}
                <span className="family-agenda__post-engagement"><MessageCircle aria-hidden="true" />{post.commentCount === undefined ? "فتح المشاركة" : `${post.commentCount.toLocaleString("ar-SA")} تعليق`}<ChevronLeft aria-hidden="true" /></span>
              </span>
              {post.image_urls[0] && <span className="family-agenda__post-image"><img src={post.image_urls[0]} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /></span>}
            </Link>
          );
        }) : (
          <div className="family-agenda__empty" role="status"><MessageCircle aria-hidden="true" /><b>{failed ? "تعذر تحميل المشاركات" : !online ? "لا توجد مشاركات محفوظة" : "لا توجد مشاركات عامة بعد"}</b><span>{failed ? "حاول التحديث عند توفر الاتصال." : "ستظهر هنا يوميات الأعضاء وأسئلتهم للعائلة."}</span></div>
        )}
      </div>
      <div className="family-agenda__posts-controls">
        <span><Shuffle aria-hidden="true" />{!online ? "عرض محفوظ بدون اتصال" : (current?.total ?? 0) <= 3 ? "متابعة المزيد في ركن الأعضاء" : paused ? "التبديل متوقف مؤقتًا" : "تتغيّر عشوائيًا كل دقيقة"}</span>
        <div>
          {(current?.total ?? 0) > 3 && <button type="button" onClick={() => setManualPause((value) => !value)} aria-label={manualPause ? "تشغيل التبديل العشوائي" : "إيقاف التبديل العشوائي"} aria-pressed={manualPause}>{manualPause ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{manualPause ? "تشغيل" : "إيقاف"}</button>}
          {failed && online && <button type="button" onClick={() => refreshRef.current()}><RefreshCw aria-hidden="true" />تحديث</button>}
        </div>
      </div>
    </section>
  );
}
