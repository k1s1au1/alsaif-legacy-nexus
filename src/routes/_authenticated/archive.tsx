import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { FamilyAlbumBook } from "@/components/family-album-book";
import { FamilyAlbumViewer } from "@/components/family-album-viewer";
import type {
  AlbumItem as ItemWithUrl,
  ArchiveItem,
  AlbumSectionKey as SectionKey,
} from "@/lib/family-album";
import { Users, CalendarDays, Sparkles, Plane } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { roleLabel } from "@/hooks/use-user-role";
import { AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/archive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الألبوم العائلي — السيف" },
      { name: "description", content: "أرشيف الصور ومقاطع الفيديو التذكارية لعائلة السيف." },
    ],
  }),
  component: ArchivePage,
});

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
  hint: string;
  privOnly: boolean;
}[] = [
  {
    key: "family",
    label: "ألبوم العائلة",
    icon: Users,
    hint: "لحظاتنا اليومية العفوية التي تجمعنا سوياً.",
    privOnly: false,
  },
  {
    key: "meetings",
    label: "الاجتماعات",
    icon: CalendarDays,
    hint: "توثيق الاجتماعات الدورية واللقاءات الرسمية.",
    privOnly: true,
  },
  {
    key: "events",
    label: "المناسبات",
    icon: Sparkles,
    hint: "أفراح العائلة، الأعياد، والمناسبات الكبرى.",
    privOnly: true,
  },
  {
    key: "trips",
    label: "الترفيه",
    icon: Plane,
    hint: "أرشيف الرحلات العائلية، الكشتات، والمغامرات.",
    privOnly: true,
  },
];

const MAX_BYTES = 50 * 1024 * 1024;

function ArchivePage() {
  const [profile, setProfile] = useState({
    name: "",
    role: "",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [me, setMe] = useState<{ id: string; isPriv: boolean } | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("family");
  const [selectedItem, setSelectedItem] = useState<ItemWithUrl | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("archive_items")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const uploaderIds = [...new Set((rows ?? []).map((r) => r.uploader_id))];
      const { data: profs } = uploaderIds.length
        ? await supabase
            .from("profiles")
            .select("id, arabic_name, full_name, avatar_url")
            .in("id", uploaderIds)
        : { data: [] };

      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      const withUrls = await Promise.all(
        (rows ?? []).map(async (r) => {
          const { data: signed } = await supabase.storage
            .from("archive-media")
            .createSignedUrl(r.storage_path, 60 * 60);

          const p = profMap.get(r.uploader_id) as any;
          return {
            ...(r as ArchiveItem),
            url: signed?.signedUrl ?? "",
            uploaderName: p?.arabic_name || p?.full_name || "عضو",
            avatar_url: p?.avatar_url,
          };
        }),
      );
      setItems(withUrls);
    } catch (err) {
      console.error("Archive load error:", err);
      toast.error("فشل تحميل الألبوم");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
          )
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const name =
        p?.arabic_name?.trim() ||
        p?.full_name?.trim() ||
        u.user.email?.split("@")[0] ||
        "عضو العائلة";
      const rs = (roles ?? []).map((r) => r.role);
      setProfile({
        name,
        role: roleLabel(
          rs.includes("admin")
            ? "admin"
            : rs.includes("chairman")
              ? "chairman"
              : rs.includes("manager")
                ? "manager"
                : "member",
        ),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
      setMe({
        id: u.user.id,
        isPriv: rs.includes("admin") || rs.includes("manager") || rs.includes("chairman"),
      });
      await load();
    })();

    const ch = supabase
      .channel("archive-items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "archive_items" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const currentSection = SECTIONS.find((s) => s.key === activeSection)!;
  const canUpload = !!me && (!currentSection.privOnly || me.isPriv);
  const filtered = useMemo(
    () => items.filter((i) => i.section === activeSection),
    [items, activeSection],
  );

  const counts = useMemo(() => {
    const c: Record<SectionKey, number> = { family: 0, meetings: 0, events: 0, trips: 0 };
    for (const it of items) c[it.section] = (c[it.section] ?? 0) + 1;
    return c;
  }, [items]);

  async function onPickFiles(files: FileList | null) {
    if (!files || !files.length || !me) return;
    if (!canUpload) {
      toast.error("لا تملك صلاحية الرفع في هذا القسم");
      return;
    }
    setUploading(true);
    toast.loading("جاري رفع الوسائط للألبوم...");
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: الحجم يتجاوز 50 ميجابايت`);
          continue;
        }
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          toast.error(`${file.name}: نوع غير مدعوم`);
          continue;
        }
        const ext = file.name.split(".").pop() || (isImage ? "jpg" : "mp4");
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("archive-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`فشل رفع ${file.name}`);
          continue;
        }
        const { error: insErr } = await supabase.from("archive_items").insert({
          uploader_id: me.id,
          media_type: isImage ? "image" : "video",
          storage_path: path,
          caption: null,
          section: activeSection,
        });
        if (insErr) {
          await supabase.storage.from("archive-media").remove([path]);
          toast.error(`فشل حفظ ${file.name}`);
        }
      }
      toast.dismiss();
      toast.success("تم تحديث الألبوم بنجاح ✨");
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function togglePin(item: ItemWithUrl) {
    const { error } = await supabase
      .from("archive_items")
      .update({ pinned: !item.pinned })
      .eq("id", item.id);
    if (error) toast.error("تعذر التحديث");
    else load();
  }

  async function removeItem(item: ItemWithUrl) {
    if (!confirm("هل تريد حذف هذا الذكرى نهائياً؟")) return;
    const { error } = await supabase.from("archive_items").delete().eq("id", item.id);
    if (error) {
      toast.error("تعذر الحذف");
      return;
    }
    await supabase.storage.from("archive-media").remove([item.storage_path]);
    toast.success("تم حذف الذكرى");
    if (selectedItem?.id === item.id) setSelectedItem(null);
    load();
  }

  const canManage = (item: ItemWithUrl) => {
    if (!me) return false;
    if (item.section === "family") return me.isPriv || item.uploader_id === me.id;
    return me.isPriv;
  };

  return (
    <AppShell title="الألبوم العائلي" user={profile}>
      <FamilyAlbumBook
        items={filtered}
        sections={SECTIONS}
        counts={counts}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        canUpload={canUpload}
        uploading={uploading}
        loading={loading}
        onUpload={() => fileRef.current?.click()}
        onView={setSelectedItem}
        canManage={canManage}
        onTogglePin={togglePin}
        onDelete={removeItem}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        aria-label="إضافة صور أو مقاطع فيديو للألبوم"
        onChange={(e) => onPickFiles(e.target.files)}
      />

      {/* Cinema Mode Lightbox */}
      <AnimatePresence>
        {selectedItem && (
          <FamilyAlbumViewer
            item={selectedItem}
            sectionLabel={
              SECTIONS.find((s) => s.key === selectedItem.section)?.label ?? "ألبوم العائلة"
            }
            onClose={() => setSelectedItem(null)}
            onDelete={canManage(selectedItem) ? () => removeItem(selectedItem) : undefined}
            onDownload={() => window.open(selectedItem.url, "_blank", "noopener,noreferrer")}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
