import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  HelpCircle,
  Loader2,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Send,
  Trash2,
  Vote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { memberPostImages } from "@/lib/member-post-carousel";
import { PostGallery } from "./post-gallery";
import "./community-feed.css";

type Author = { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
export type CommunityPost = {
  id: string;
  author_id: string;
  kind: string;
  title: string;
  body: string | null;
  image_urls: string[];
  poll_options: { label: string }[] | null;
  pinned: boolean;
  created_at: string;
  author?: Author | null;
};
type Comment = { id: string; author_id: string; body: string; author?: Author | null };
type PollVote = { id: string; voter_id: string; option_index: number };
type PostCardProps = {
  post: CommunityPost;
  meId: string | null;
  isHead: boolean;
  canDelete: boolean;
  comments: Comment[];
  votes: PollVote[];
  onRefresh: () => void | Promise<void>;
};

export function PostCard({
  post,
  meId,
  isHead,
  canDelete,
  comments,
  votes,
  onRefresh,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [bodyOverflow, setBodyOverflow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const mutationRef = useRef(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const commentsId = useId();
  const bodyId = useId();
  const images = memberPostImages(post.image_urls);
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";
  const question = post.kind === "question";
  const KindIcon = question ? HelpCircle : BookOpen;
  const myVote = votes.find((vote) => vote.voter_id === meId);
  const totals = votes.reduce<Record<number, number>>((result, vote) => {
    result[vote.option_index] = (result[vote.option_index] || 0) + 1;
    return result;
  }, {});

  useEffect(() => {
    if (!images.length) setImageOpen(false);
  }, [images.length]);

  useEffect(() => {
    const element = bodyRef.current;
    if (!element || bodyOpen) return;
    const measure = () => setBodyOverflow(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [post.body, bodyOpen]);

  async function mutate(
    action: string,
    operation: () => PromiseLike<{ error: { message: string } | null }>,
    success?: string,
  ) {
    if (!meId || mutationRef.current) return;
    mutationRef.current = true;
    setBusy(action);
    try {
      const { error } = await operation();
      if (error) throw error;
      if (success) toast.success(success);
      await onRefresh();
    } catch {
      toast.error(
        action === "vote" ? "تعذر حفظ التصويت، حاول مرة أخرى" : "تعذر حفظ التغيير، حاول مرة أخرى",
      );
    } finally {
      mutationRef.current = false;
      setBusy(null);
    }
  }

  function castVote(index: number) {
    if (myVote?.option_index === index) return;
    void mutate("vote", () =>
      myVote
        ? supabase.from("member_post_votes").update({ option_index: index }).eq("id", myVote.id)
        : supabase
            .from("member_post_votes")
            .insert({ post_id: post.id, voter_id: meId!, option_index: index }),
    );
  }

  return (
    <article
      className={cn("community-post", images.length > 0 && "community-post-with-media")}
      aria-label={post.title}
    >
      <div className="community-post-summary">
        <div className="community-post-header">
          <div className="community-post-author">
            <UserAvatar
              path={post.author?.avatar_url}
              name={authorName}
              className="community-author-avatar"
              userId={post.author_id}
              showBadges
            />
            <div>
              <p>{authorName}</p>
              <time dateTime={post.created_at}>
                {new Date(post.created_at).toLocaleDateString("ar-SA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </div>
          <span className="community-kind">
            <KindIcon size={13} />
            {question ? "سؤال للعائلة" : "يوميات"}
          </span>
          <div className="community-post-tools">
            {post.pinned && (
              <span className="community-pinned" aria-label="مشاركة مثبتة" title="مشاركة مثبتة">
                <Pin size={16} />
              </span>
            )}
            {canDelete && (
              <DropdownMenu dir="rtl">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="community-icon-button"
                    aria-label="خيارات المشاركة"
                    disabled={!!busy}
                  >
                    {busy && busy !== "vote" ? (
                      <Loader2 className="animate-spin" size={19} />
                    ) : (
                      <MoreHorizontal size={21} />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="community-post-menu">
                  {isHead && (
                    <DropdownMenuItem
                      onSelect={() => {
                        void mutate("pin", () =>
                          supabase
                            .from("member_posts")
                            .update({ pinned: !post.pinned })
                            .eq("id", post.id),
                        );
                      }}
                    >
                      {post.pinned ? <PinOff /> : <Pin />}
                      {post.pinned ? "إلغاء التثبيت" : "تثبيت المشاركة"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="community-delete"
                    onSelect={() => {
                      if (confirm("حذف المشاركة؟"))
                        void mutate(
                          "delete",
                          () => supabase.from("member_posts").delete().eq("id", post.id),
                          "تم حذف المشاركة",
                        );
                    }}
                  >
                    <Trash2 />
                    حذف المشاركة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="community-post-copy">
          <h3>{post.title}</h3>
          {post.body && (
            <>
              <p
                ref={bodyRef}
                id={bodyId}
                className={cn("community-post-body", !bodyOpen && "community-post-body-clamped")}
              >
                {post.body}
              </p>
              {(bodyOverflow || bodyOpen) && (
                <button
                  type="button"
                  className="community-text-button"
                  aria-expanded={bodyOpen}
                  aria-controls={bodyId}
                  onClick={() => setBodyOpen(!bodyOpen)}
                >
                  {bodyOpen ? "عرض أقل" : "قراءة المزيد"}
                  <ChevronDown size={14} className={bodyOpen ? "rotate-180" : ""} />
                </button>
              )}
            </>
          )}
        </div>

        {post.poll_options && post.poll_options.length >= 2 && (
          <section className="community-poll" aria-label="تصويت العائلة">
            <div className="community-poll-meta">
              <span>
                <Vote size={15} />
                {votes.length} مشارك في التصويت
              </span>
              {myVote && (
                <button
                  type="button"
                  className="community-text-button"
                  disabled={!!busy}
                  onClick={() => {
                    void mutate("vote", () =>
                      supabase.from("member_post_votes").delete().eq("id", myVote.id),
                    );
                  }}
                >
                  إلغاء تصويتي
                </button>
              )}
              {busy === "vote" && (
                <Loader2 size={15} className="animate-spin" aria-label="جاري حفظ التصويت" />
              )}
            </div>
            <div className="community-poll-options">
              {post.poll_options.map((option, index) => {
                const mine = myVote?.option_index === index;
                const percent = votes.length
                  ? Math.round(((totals[index] || 0) / votes.length) * 100)
                  : 0;
                return (
                  <button
                    type="button"
                    key={index}
                    className="community-poll-option"
                    aria-pressed={mine}
                    disabled={!meId || !!busy}
                    onClick={() => castVote(index)}
                  >
                    <span
                      className="community-poll-fill"
                      style={{ width: `${percent}%` }}
                      aria-hidden="true"
                    />
                    <span className="community-poll-label">
                      {mine && <Check size={17} />}
                      <span>
                        {option.label}
                        {mine && <small>اختيارك</small>}
                      </span>
                    </span>
                    {votes.length > 0 && (
                      <span className="community-poll-percent" dir="ltr">
                        {percent}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <footer className="community-post-footer">
          <button
            type="button"
            aria-expanded={commentsOpen}
            aria-controls={commentsId}
            onClick={() => setCommentsOpen(!commentsOpen)}
          >
            <MessageSquare size={18} />
            <span>{comments.length > 0 ? `${comments.length} تعليق` : "أضف تعليقاً"}</span>
          </button>
          {images.length > 0 && (
            <button type="button" onClick={() => setImageOpen(true)}>
              <Maximize2 size={16} />
              <span>تكبير الصورة</span>
            </button>
          )}
        </footer>
      </div>
      {images.length > 0 && (
        <div className="community-post-media">
          <PostGallery
            images={images}
            title={post.title}
            expanded={imageOpen}
            onExpandedChange={setImageOpen}
          />
        </div>
      )}
      {commentsOpen && (
        <CommentsSection
          id={commentsId}
          postId={post.id}
          meId={meId}
          isHead={isHead}
          comments={comments}
          onRefresh={onRefresh}
        />
      )}
    </article>
  );
}

function CommentsSection({
  id,
  postId,
  meId,
  isHead,
  comments,
  onRefresh,
}: {
  id: string;
  postId: string;
  meId: string | null;
  isHead: boolean;
  comments: Comment[];
  onRefresh: () => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const sendingRef = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || !meId || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const { error } = await supabase
        .from("member_post_comments")
        .insert({ post_id: postId, author_id: meId, body: text.trim() });
      if (error) throw error;
      setText("");
      await onRefresh();
    } catch {
      toast.error("تعذر إرسال التعليق");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  async function removeComment(commentId: string) {
    if (deleting || !confirm("حذف التعليق؟")) return;
    setDeleting(commentId);
    try {
      const { error } = await supabase.from("member_post_comments").delete().eq("id", commentId);
      if (error) throw error;
      await onRefresh();
    } catch {
      toast.error("تعذر حذف التعليق");
    } finally {
      setDeleting(null);
    }
  }
  return (
    <section id={id} className="community-comments" aria-label="تعليقات المشاركة">
      <div className="community-comment-list">
        {comments.length === 0 ? (
          <p className="community-empty-comments">لا توجد تعليقات بعد</p>
        ) : (
          comments.map((comment) => {
            const name = comment.author?.arabic_name || comment.author?.full_name || "عضو";
            return (
              <div key={comment.id} className="community-comment">
                <UserAvatar
                  path={comment.author?.avatar_url}
                  name={name}
                  className="community-comment-avatar"
                  userId={comment.author_id}
                />
                <div className="community-comment-bubble">
                  <div>
                    <strong>{name}</strong>
                    {(isHead || comment.author_id === meId) && (
                      <button
                        type="button"
                        className="community-icon-button community-delete"
                        aria-label="حذف التعليق"
                        disabled={!!deleting}
                        onClick={() => void removeComment(comment.id)}
                      >
                        {deleting === comment.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    )}
                  </div>
                  <p>{comment.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={submit} className="community-comment-form">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="اكتب تعليقك..."
          aria-label="تعليقك"
          disabled={!meId || sending}
        />
        <button
          type="submit"
          disabled={!meId || sending || !text.trim()}
          aria-label="إرسال التعليق"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </form>
    </section>
  );
}
