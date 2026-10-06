import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { FamilyAlbumBook } from "@/components/family-album-book";
import { FamilyAlbumViewer } from "@/components/family-album-viewer";
import { FamilyAlbumUploadDialog } from "@/components/family-album-upload-dialog";
import {
  albumItemKey,
  albumNameError,
  canCreateFamilyAlbums,
  canManageAlbumItem,
  canUploadToAlbum,
} from "@/lib/family-album";
import type { AlbumItem, AlbumSectionKey, CustomAlbum } from "@/lib/family-album";
import { uploadAlbumMemories } from "@/lib/family-album-upload";
import type { AlbumUploadInput } from "@/lib/family-album-upload";
import { BookImage, CalendarDays, Sparkles, Plane, Images } from "lucide-react";
import { toast } from "sonner";
import { roleLabel, useUserRole } from "@/hooks/use-user-role";
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

const SECTIONS = [
  {
    key: "family" as const,
    label: "ألبوم العائلة",
    icon: BookImage,
    hint: "لحظاتنا اليومية العفوية التي تجمعنا سوياً.",
  },
  {
    key: "meetings" as const,
    label: "الاجتماعات",
    icon: CalendarDays,
    hint: "توثيق الاجتماعات الدورية واللقاءات الرسمية.",
  },
  {
    key: "events" as const,
    label: "المناسبات",
    icon: Sparkles,
    hint: "أفراح العائلة، الأعياد، والمناسبات الكبرى.",
  },
  {
    key: "trips" as const,
    label: "الرحلات",
    icon: Plane,
    hint: "أرشيف الرحلات العائلية، الكشتات، والمغامرات.",
  },
];

function ArchivePage() {
  const { userId, roles, sectionHeads, primaryRole, isLoading: roleLoading } = useUserRole();
  const access = { userId, roles, sectionHeads };
  const [profile, setProfile] = useState({
    name: "",
    role: "",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [customAlbums, setCustomAlbums] = useState<CustomAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [activeSection, setActiveSection] = useState<AlbumSectionKey>("family");
  const [selectedItem, setSelectedItem] = useState<AlbumItem | null>(null);
  const [dialog, setDialog] = useState<"memory" | "album" | null>(null);
  const requestId = useRef(0);
  const uploadBusy = useRef(false);
  const sections = useMemo(
    () => [
      ...SECTIONS,
      ...customAlbums.map((album) => ({
        key: `custom:${album.id}` as const,
        label: album.title,
        icon: Images,
        hint: `ذكريات العائلة في ألبوم ${album.title}.`,
      })),
    ],
    [customAlbums],
  );
  const uploadOptions = sections.map((section) => ({
    key: section.key,
    label: section.label,
    canUpload: !roleLoading && canUploadToAlbum(access, section.key),
  }));
  const canCreateAlbum = !roleLoading && canCreateFamilyAlbums(access);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const [memories, albums] = await Promise.all([
        supabase
          .from("archive_items")
          .select("*")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("archive_albums").select("*").order("created_at"),
      ]);
      if (memories.error) throw memories.error;
      if (albums.error) throw albums.error;
      const rows = memories.data ?? [];
      const uploaderIds = [...new Set(rows.map((row) => row.uploader_id))];
      const { data: profiles } = uploaderIds.length
        ? await supabase
            .from("profiles")
            .select("id, arabic_name, full_name, avatar_url")
            .in("id", uploaderIds)
        : { data: [] };
      const profileMap = new Map<
        string,
        { arabic_name: string | null; full_name: string | null; avatar_url: string | null }
      >((profiles ?? []).map((profile) => [profile.id, profile]));
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from("archive-media")
            .createSignedUrl(row.storage_path, 3600);
          const uploader = profileMap.get(row.uploader_id);
          return {
            ...row,
            url: signed?.signedUrl ?? "",
            uploaderName: uploader?.arabic_name || uploader?.full_name || "عضو",
            avatar_url: uploader?.avatar_url,
          };
        }),
      );
      if (request !== requestId.current) return;
      setCustomAlbums(albums.data ?? []);
      setItems(withUrls);
      setActiveSection((key) =>
        key.startsWith("custom:") &&
        !(albums.data ?? []).some((album) => `custom:${album.id}` === key)
          ? "family"
          : key,
      );
    } catch (err) {
      if (request === requestId.current) {
        console.error("Archive load error:", err);
        toast.error("تعذر تحميل الألبوم. حاول مرة أخرى.");
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("arabic_name, full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const name = data?.arabic_name?.trim() || data?.full_name?.trim() || "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: data?.avatar_url ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, primaryRole]);

  const permissionKey = `${roles.join(",")}|${sectionHeads.join(",")}`;
  useEffect(() => {
    if (roleLoading) return;
    if (!userId) {
      setLoading(false);
      setItems([]);
      setCustomAlbums([]);
      return;
    }
    void load();
    const channel = supabase
      .channel("archive-items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "archive_items" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "archive_albums" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      requestId.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [userId, roleLoading, permissionKey, load]);

  const filtered = useMemo(
    () => items.filter((item) => albumItemKey(item) === activeSection),
    [items, activeSection],
  );
  const counts = useMemo(() => {
    const result: Partial<Record<AlbumSectionKey, number>> = {};
    for (const item of items) {
      const key = albumItemKey(item);
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [items]);

  async function createAlbum(title: string): Promise<AlbumSectionKey> {
    if (!userId || !canCreateAlbum)
      throw new Error("إنشاء الألبومات متاح لمسؤول الألبوم ورئيس المجلس ونائبه.");
    const invalid = albumNameError(title, [...sections.map((section) => section.label), "الترفيه"]);
    if (invalid) throw new Error(invalid);
    const { data, error } = await supabase
      .from("archive_albums")
      .insert({ title: title.trim(), created_by: userId })
      .select("*")
      .single();
    if (error)
      throw new Error(
        error.code === "23505"
          ? "يوجد ألبوم بهذا الاسم؛ اختر اسماً آخر."
          : "تعذر إنشاء الألبوم. تحقق من صلاحيتك وحاول مرة أخرى.",
      );
    // Cancel a pre-creation snapshot while its signed URLs are still loading.
    requestId.current += 1;
    setLoading(false);
    setCustomAlbums((previous) =>
      previous.some((album) => album.id === data.id) ? previous : [...previous, data],
    );
    const key: AlbumSectionKey = `custom:${data.id}`;
    setActiveSection(key);
    void load();
    toast.success("تم إنشاء الألبوم");
    return key;
  }

  async function saveMemories(input: AlbumUploadInput) {
    if (
      !userId ||
      roleLoading ||
      !sections.some((section) => section.key === input.album) ||
      !canUploadToAlbum(access, input.album)
    ) {
      throw new Error("لا تملك صلاحية الإضافة إلى الألبوم المحدد.");
    }
    if (uploadBusy.current) throw new Error("جاري حفظ الذكريات.");
    uploadBusy.current = true;
    setUploading(true);
    setProgress({ completed: 0, total: input.files.length });
    try {
      const result = await uploadAlbumMemories(userId, input, {
        upload: async (path, file) => {
          const { error } = await supabase.storage
            .from("archive-media")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw error;
        },
        insert: async (item) => {
          const { error } = await supabase.from("archive_items").insert(item);
          if (error) throw error;
        },
        remove: async (path) => {
          const { error } = await supabase.storage.from("archive-media").remove([path]);
          if (error) throw error;
        },
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      if (result.uploaded.length) {
        setActiveSection(input.album);
        toast.success(`تم حفظ ${result.uploaded.length} من الذكريات في الألبوم`);
        await load();
      }
      if (!result.errors.length && result.uploaded.length) setDialog(null);
      return result;
    } finally {
      uploadBusy.current = false;
      setUploading(false);
    }
  }

  async function togglePin(item: AlbumItem) {
    if (!canManageAlbumItem(access, item)) return;
    const { data, error } = await supabase
      .from("archive_items")
      .update({ pinned: !item.pinned })
      .eq("id", item.id)
      .select("id")
      .maybeSingle();
    if (error || !data) toast.error("تعذر التحديث");
    else void load();
  }

  async function removeItem(item: AlbumItem) {
    if (!canManageAlbumItem(access, item) || !confirm("هل تريد حذف هذه الذكرى نهائياً؟")) return;
    const { data, error } = await supabase
      .from("archive_items")
      .delete()
      .eq("id", item.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("تعذر الحذف");
      return;
    }
    const { error: storageError } = await supabase.storage
      .from("archive-media")
      .remove([item.storage_path]);
    if (storageError) toast.error("تم حذف الذكرى من الألبوم، وتعذر تنظيف ملفها.");
    else toast.success("تم حذف الذكرى");
    if (selectedItem?.id === item.id) setSelectedItem(null);
    void load();
  }

  return (
    <AppShell title="الألبوم العائلي" user={profile}>
      <FamilyAlbumBook
        items={filtered}
        sections={sections}
        counts={counts}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        canUpload={uploadOptions.some((option) => option.canUpload)}
        uploading={uploading}
        loading={loading}
        onUpload={() => setDialog("memory")}
        onCreateAlbum={canCreateAlbum ? () => setDialog("album") : undefined}
        onView={setSelectedItem}
        canManage={(item) => canManageAlbumItem(access, item)}
        onTogglePin={togglePin}
        onDelete={removeItem}
      />
      {dialog && (
        <FamilyAlbumUploadDialog
          albums={uploadOptions}
          initialAlbum={
            uploadOptions.find((option) => option.key === activeSection && option.canUpload)?.key ??
            uploadOptions.find((option) => option.canUpload)?.key ??
            "family"
          }
          createOnly={dialog === "album"}
          canCreateAlbum={canCreateAlbum}
          uploading={uploading}
          progress={progress}
          onCreateAlbum={createAlbum}
          onSubmit={saveMemories}
          onClose={() => {
            if (!uploadBusy.current) setDialog(null);
          }}
        />
      )}
      <AnimatePresence>
        {selectedItem && (
          <FamilyAlbumViewer
            item={selectedItem}
            sectionLabel={
              sections.find((section) => section.key === albumItemKey(selectedItem))?.label ??
              "ألبوم العائلة"
            }
            onClose={() => setSelectedItem(null)}
            onDelete={
              canManageAlbumItem(access, selectedItem) ? () => removeItem(selectedItem) : undefined
            }
            onDownload={() => window.open(selectedItem.url, "_blank", "noopener,noreferrer")}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
