import { supabase } from "@/integrations/supabase/client";
import { listOccasions } from "@/lib/api/occasions";
import { isTaskActive, isTripActive, isMeetingArchived } from "@/lib/day-lifecycle";
import { PUBLIC_MEMBER_POST_KINDS } from "@/lib/member-post-rotation";
import { parsePost, safeImageUrl, type TvItem, type TvView } from "./model";

export const PROFILE_FIELDS = "id,arabic_name,full_name,first_name,father_name,grandfather_name,avatar_url,parent_id,gender";
const imageCache = new Map<string, { url: string; expiry: number }>();

export async function signedImage(bucket: string, path: string | null | undefined) {
  if (!path) return "";
  const external = safeImageUrl(path);
  if (external) return external;
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) return "";
  const key = `${bucket}:${path}`, cached = imageCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return "";
  imageCache.set(key, { url: data.signedUrl, expiry: Date.now() + 50 * 60000 });
  return data.signedUrl;
}

export function clearPrivateImageCache() { imageCache.clear(); }

export async function loadTvItems(view: TvView, userId: string): Promise<TvItem[]> {
  if (view === "events") {
    const rows = await listOccasions({ userId, canManageOccasions: false });
    return rows.map(row => ({ id: row.id, title: row.title || "مناسبة العائلة", date: row.date, time: row.time, place: row.location, raw: row }));
  }
  if (view === "members") {
    const { data, error } = await supabase.from("member_posts").select("id,author_id,title,body,image_urls,created_at,kind")
      .in("kind", PUBLIC_MEMBER_POST_KINDS as any).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return Promise.all((data || []).map(async row => {
      const images = await Promise.all((row.image_urls || []).map(path => signedImage("community-media", path)));
      return { id: row.id, title: row.title, body: row.body || "", images: images.filter(Boolean), image: images.find(Boolean), authorId: row.author_id, date: row.created_at, raw: row };
    }));
  }
  if (view === "news" || view === "heritage") {
    let query = supabase.from("majlis_posts").select("id,title,body,kind,author_id,created_at,pinned");
    query = view === "heritage" ? query.eq("kind", "discussion").ilike("title", "[إرث]%") : query.eq("kind", "announcement");
    const { data, error } = await query.order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return Promise.all((data || []).filter(row => !row.body?.includes("---poll:")).map(async row => {
      const post = parsePost(row.body);
      return { id: row.id, title: row.title.replace(/^\[إرث\]\s*/, ""), body: post.body, image: await signedImage("trip-images", post.image), authorId: row.author_id, date: row.created_at, raw: row };
    }));
  }
  if (view === "trips") {
    const { data, error } = await supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return Promise.all((data || []).filter(row => isTripActive(row)).map(async row => ({
      id: row.id, title: row.title, body: row.description || "", date: row.start_date || undefined,
      place: row.location || "", image: await signedImage("trip-images", row.image_url), raw: row,
    })));
  }
  if (view === "meetings") {
    const { data, error } = await supabase.from("meetings").select("*").neq("status", "cancelled").order("scheduled_at", { ascending: false }).limit(60);
    if (error) throw error;
    const rows = (data || []).map(row => ({ id: row.id, title: row.title, body: row.description || "", date: row.scheduled_at, place: row.location || "", archived: isMeetingArchived(row), raw: row }));
    return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || (a.archived ? Date.parse(b.date) - Date.parse(a.date) : Date.parse(a.date) - Date.parse(b.date)));
  }
  if (view === "tasks") {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(120);
    if (error) throw error;
    return (data || []).filter(row => isTaskActive(row)).map(row => ({
      id: row.id, title: row.title, body: row.description || "", authorId: row.assignee_id || undefined,
      date: row.due_date || undefined, progress: row.progress ?? (row.status === "done" ? 100 : row.status === "in_progress" ? 40 : 0), raw: row,
    }));
  }
  if (view === "albums") {
    const { data, error } = await supabase.from("archive_items").select("*").eq("media_type", "image")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return Promise.all((data || []).map(async row => ({ id: row.id, title: row.caption || "من ألبوم العائلة", date: row.created_at, authorId: row.uploader_id, image: await signedImage("archive-media", row.storage_path), raw: row })));
  }
  return [];
}

export async function setAttendance(kind: "events" | "meetings", id: string, userId: string, rsvp: string | null) {
  const table = kind === "events" ? "event_attendees" : "meeting_attendees";
  const key = kind === "events" ? "event_id" : "meeting_id";
  if (!rsvp) {
    const { error } = await supabase.from(table).delete().eq(key, id).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from(table).upsert({ [key]: id, user_id: userId, rsvp } as any, { onConflict: `${key},user_id` }).select("rsvp").single();
    if (error) throw error;
    if (data?.rsvp !== rsvp) throw new Error("Attendance response was not saved");
  }
}
