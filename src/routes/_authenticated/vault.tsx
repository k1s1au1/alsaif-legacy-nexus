import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { VaultLibrary } from "@/components/vault-library";
import { VaultUploadDialog } from "@/components/vault-upload-dialog";
import { vaultFileError, vaultIsLocked } from "@/lib/vault-library";
import type { VaultItem, VaultProfile, VaultUpload } from "@/lib/vault-library";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export const Route = createFileRoute("/_authenticated/vault")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "خزنة الوثائق والوصايا — السيف" },
      { name: "description", content: "مكتبة الوثائق العائلية والوصايا." },
    ],
  }),
  component: SecureVaultPage,
});

function SecureVaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<VaultProfile[]>([]);
  const loadVersion = useRef(0);
  const uploadInFlight = useRef(false);

  useEffect(() => {
    const requestVersions = loadVersion;
    let disposed = false;
    supabase
      .from("profiles")
      .select("id, arabic_name, full_name, avatar_url")
      .then(({ data }) => {
        if (!disposed && data)
          setAllProfiles(
            data.sort((a, b) =>
              (a.arabic_name || a.full_name || "").localeCompare(
                b.arabic_name || b.full_name || "",
                "ar",
              ),
            ),
          );
      });
    supabase.auth.getUser().then(({ data }) => {
      if (!disposed) setCurrentUserId(data.user?.id || null);
    });
    return () => {
      disposed = true;
      requestVersions.current++;
    };
  }, []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("secure_vault")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const vaultItems = (data || []) as VaultItem[];
      const uploaderIds = [...new Set(vaultItems.map((item) => item.owner_id))];
      let owners: VaultProfile[] = [];
      if (uploaderIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, arabic_name, full_name, avatar_url")
          .in("id", uploaderIds);
        owners = profiles || [];
      }
      if (version === loadVersion.current) {
        const ownerMap = new Map(owners.map((profile) => [profile.id, profile]));
        setItems(vaultItems.map((item) => ({ ...item, uploader: ownerMap.get(item.owner_id) })));
      }
    } catch (reason) {
      console.error("Vault load error", reason);
      if (version === loadVersion.current) {
        setItems([]);
        setLoadError("لم نتمكن من الاتصال بالخزنة. حاول مرة أخرى.");
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeSync(["secure_vault"], load);

  const getSignedUrl = useCallback(async (item: VaultItem) => {
    if (vaultIsLocked(item)) throw new Error("هذه الوثيقة لا تزال مقفلة زمنياً");
    if (!item.storage_path) throw new Error("ملف الوثيقة غير متاح");
    const { data, error } = await supabase.storage
      .from("vault-media")
      .createSignedUrl(item.storage_path, 600);
    if (error || !data?.signedUrl) throw error || new Error("تعذر فتح الوثيقة");
    return data.signedUrl;
  }, []);

  const handleOpen = (item: VaultItem) => {
    if (vaultIsLocked(item) || !item.storage_path) {
      toast.error(
        vaultIsLocked(item) ? "هذه الوثيقة لا تزال مقفلة زمنياً" : "ملف الوثيقة غير متاح",
      );
      return;
    }
    // Open synchronously on the user's gesture, including browsers on iPad/iPhone.
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("اسمح بفتح النوافذ المنبثقة لعرض الوثيقة.");
      return;
    }
    tab.opener = null;
    getSignedUrl(item)
      .then((url) => tab.location.replace(url))
      .catch(() => {
        tab.close();
        toast.error("تعذر فتح الوثيقة. حاول مرة أخرى.");
      });
  };

  const handleDownload = async (item: VaultItem) => {
    if (vaultIsLocked(item) || !item.storage_path) {
      toast.error(
        vaultIsLocked(item) ? "هذه الوثيقة لا تزال مقفلة زمنياً" : "ملف الوثيقة غير متاح",
      );
      return;
    }
    const toastId = toast.loading("جاري تجهيز التحميل…");
    try {
      const { data, error } = await supabase.storage
        .from("vault-media")
        .download(item.storage_path);
      if (error || !data) throw error || new Error("File unavailable");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      const extension = item.storage_path.match(/\.[a-z0-9]+$/i)?.[0] || "";
      link.href = url;
      link.download = item.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 150) + extension;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("تم تجهيز الوثيقة للتحميل", { id: toastId });
    } catch {
      toast.error("تعذر تحميل الوثيقة. حاول مرة أخرى.", { id: toastId });
    }
  };

  const handleUpload = async (input: VaultUpload) => {
    if (uploadInFlight.current) return;
    const fileError = vaultFileError(input.file);
    if (fileError) throw new Error(fileError);
    if (!input.title.trim()) throw new Error("اكتب عنوان الوثيقة.");
    uploadInFlight.current = true;
    setUploading(true);
    const toastId = toast.loading("جاري حفظ الوثيقة…");
    let uploadedPath: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("سجّل الدخول لإضافة الوثيقة.");
      const extension = input.file.name.split(".").pop()!.toLowerCase();
      const filePath = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("vault-media")
        .upload(filePath, input.file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error("تعذر رفع الملف. حاول مرة أخرى.");
      uploadedPath = filePath;
      // Keep the existing vault record and recipient format used by the application.
      const record = {
        title: input.title.trim(),
        description: input.description || null,
        category: input.category,
        storage_path: filePath,
        owner_id: userData.user.id,
        unlock_at: input.unlockAt || null,
        is_encrypted: true,
        shared_with: input.sharedWith,
      };
      const { error: dbError } = await supabase.from("secure_vault").insert(record);
      if (dbError) throw dbError;
      uploadedPath = null;
      toast.success("تمت إضافة الوثيقة إلى الخزنة", { id: toastId });
      setShowAdd(false);
      await load();
    } catch (reason) {
      if (uploadedPath) {
        try {
          await supabase.storage.from("vault-media").remove([uploadedPath]);
        } catch (cleanupError) {
          console.error("Vault upload cleanup error", cleanupError);
        }
      }
      console.error("Vault upload error", reason);
      toast.error("تعذر حفظ الوثيقة. حاول مرة أخرى.", { id: toastId });
      throw new Error("تعذر حفظ الوثيقة. لم تتغير بيانات النموذج، ويمكنك إعادة المحاولة.");
    } finally {
      setUploading(false);
      uploadInFlight.current = false;
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (currentUserId !== item.owner_id || !confirm("هل أنت متأكد من حذف هذه الوثيقة نهائياً؟"))
      return;
    try {
      const { error } = await supabase
        .from("secure_vault")
        .delete()
        .eq("id", item.id)
        .eq("owner_id", currentUserId);
      if (error) throw error;
      if (item.storage_path) await supabase.storage.from("vault-media").remove([item.storage_path]);
      toast.success("تم حذف الوثيقة");
      await load();
    } catch {
      toast.error("تعذر حذف الوثيقة. حاول مرة أخرى.");
    }
  };

  return (
    <AppShell title="الخزنة">
      <VaultLibrary
        items={items}
        loading={loading}
        loadError={loadError}
        currentUserId={currentUserId}
        onAdd={() => setShowAdd(true)}
        onReload={() => void load()}
        onDelete={handleDelete}
        getSignedUrl={getSignedUrl}
        onOpen={handleOpen}
        onDownload={handleDownload}
      />
      {showAdd && (
        <VaultUploadDialog
          profiles={allProfiles}
          currentUserId={currentUserId}
          uploading={uploading}
          onClose={() => {
            if (!uploadInFlight.current) setShowAdd(false);
          }}
          onSubmit={handleUpload}
        />
      )}
    </AppShell>
  );
}
