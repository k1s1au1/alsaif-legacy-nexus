import { supabase } from "@/integrations/supabase/client";
import {
  decodeFamilyOccasionEventDescription,
  encodeFamilyOccasionEventDescription,
} from "@/lib/family-occasion-events";
import { isFamilyOccasionActive } from "@/lib/day-lifecycle";

export type OccasionVisibility = "public" | "private" | "official";

export type OccasionRecord = {
  id: string;
  type: string;
  design: number;
  title: string;
  date: string;
  time: string;
  location: string;
  details: string;
  birthDate?: string;
  birthdayAudience?: "adult" | "child";
  visibility: OccasionVisibility;
  createdBy: string;
  inviteeCount: number;
  attendeeCount: number;
  canEdit: boolean;
};

const EVENT_TYPE_MAP: Record<string, string> = {
  wedding: "wedding",
  birthday: "birthday",
  graduation: "graduation",
  ramadan: "religious",
  eid_fitr: "religious",
  eid_adha: "religious",
  condolence: "religious",
  gathering: "social",
  newborn: "social",
  promotion: "social",
  recovery: "social",
};

const eventTypeFor = (type: string) => EVENT_TYPE_MAP[type] ?? "other";

const startIso = (date: string, time: string) => {
  const d = date || new Date().toISOString().slice(0, 10);
  const t = time || "12:00";
  const value = new Date(`${d}T${t}:00`);
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
};

type Payload = Omit<
  OccasionRecord,
  "visibility" | "createdBy" | "inviteeCount" | "attendeeCount" | "canEdit"
>;

export async function listOccasions(opts: {
  userId: string | null;
  canManageOccasions: boolean;
}): Promise<OccasionRecord[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,title,description,location,starts_at,status,visibility,pinned,created_by,event_invitees(count),event_attendees(count)",
    )
    .order("starts_at", { ascending: true });
  if (error) throw error;

  const items: OccasionRecord[] = [];
  for (const row of (data ?? []) as any[]) {
    const occasion = decodeFamilyOccasionEventDescription<Payload>(row.description);
    if (!occasion) continue;
    if (!isFamilyOccasionActive(row)) continue;
    const visibility = (row.visibility ?? "public") as OccasionVisibility;
    items.push({
      ...occasion,
      id: row.id,
      title: occasion.title ?? row.title ?? "",
      location: occasion.location ?? row.location ?? "",
      visibility,
      createdBy: row.created_by,
      inviteeCount: row.event_invitees?.[0]?.count ?? 0,
      attendeeCount: row.event_attendees?.[0]?.count ?? 0,
      canEdit:
        (!!opts.userId && row.created_by === opts.userId && visibility !== "official") ||
        opts.canManageOccasions,
    });
  }

  // Official occasions first, then by date.
  return items.sort((a, b) => {
    if (a.visibility === "official" && b.visibility !== "official") return -1;
    if (b.visibility === "official" && a.visibility !== "official") return 1;
    return (a.date || "9999").localeCompare(b.date || "9999");
  });
}

export async function saveOccasion(input: {
  id?: string | null;
  payload: Payload;
  visibility: OccasionVisibility;
  inviteeIds: string[];
}): Promise<string> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("يجب تسجيل الدخول لإنشاء مناسبة");
  const userId = auth.user.id;

  const row = {
    title: input.payload.title?.trim() || "مناسبة عائلية",
    description: encodeFamilyOccasionEventDescription({ ...input.payload, id: undefined }),
    event_type: eventTypeFor(input.payload.type) as any,
    location: input.payload.location || null,
    starts_at: startIso(input.payload.date, input.payload.time),
    status: "scheduled" as const,
    visibility: input.visibility as any,
    created_by: userId,
  };

  let eventId = input.id ?? null;
  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("events").insert(row).select("id").single();
    if (error) throw error;
    eventId = data.id;
  }

  if (input.visibility === "private") {
    const { error: clearError } = await supabase
      .from("event_invitees")
      .delete()
      .eq("event_id", eventId!);
    if (clearError) throw new Error("تم حفظ المناسبة لكن تعذّر تحديث قائمة المدعوين");
    const unique = [...new Set([...input.inviteeIds, userId])];
    if (unique.length) {
      const { error: inviteError } = await supabase
        .from("event_invitees")
        .insert(unique.map((user_id) => ({ event_id: eventId!, user_id })));
      if (inviteError) throw new Error("تم حفظ المناسبة لكن تعذّر إضافة المدعوين");
    }
  } else {
    await supabase.from("event_invitees").delete().eq("event_id", eventId!);
  }

  return eventId!;
}

export async function deleteOccasion(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function listOccasionInvitees(eventId: string) {
  const { data, error } = await supabase
    .from("event_invitees")
    .select("user_id")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id);
}

export async function listFamilyMembers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,arabic_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.arabic_name || p.full_name || "عضو",
  }));
}
