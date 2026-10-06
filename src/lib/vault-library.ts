export type VaultCategory = "will" | "deed" | "heritage" | "private";

export interface VaultProfile {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface VaultItem {
  id: string;
  title: string;
  description: string | null;
  category: VaultCategory | null;
  storage_path: string | null;
  owner_id: string;
  is_encrypted: boolean | null;
  unlock_at: string | null;
  created_at: string;
  shared_with?: string[] | null;
  uploader?: Omit<VaultProfile, "id">;
}

export const VAULT_CATEGORIES: { key: VaultCategory; label: string }[] = [
  { key: "will", label: "الوصايا" },
  { key: "deed", label: "الصكوك والوثائق" },
  { key: "heritage", label: "مخطوطات تاريخية" },
  { key: "private", label: "خاص وسري" },
];

export const VAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Invalid legacy release dates stay closed rather than bypassing the date gate. */
export function vaultIsLocked(item: Pick<VaultItem, "unlock_at">, now = Date.now()) {
  if (!item.unlock_at) return false;
  const release = Date.parse(item.unlock_at);
  return !Number.isFinite(release) || release > now;
}

export function vaultSharingLabel(item: Pick<VaultItem, "shared_with">) {
  const recipients = item.shared_with ?? [];
  if (recipients.includes("all")) return "العائلة";
  return recipients.length ? "أشخاص محددون" : "خاص بي";
}

export function vaultDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function vaultFileKind(path: string | null): "pdf" | "image" | "other" {
  const cleanPath = (path ?? "").split(/[?#]/, 1)[0];
  if (/\.pdf$/i.test(cleanPath)) return "pdf";
  if (/\.(png|jpe?g|webp|gif|avif|bmp|heic|heif|tiff?)$/i.test(cleanPath)) return "image";
  return "other";
}

export function vaultFileError(file: Pick<File, "name" | "type" | "size">) {
  if (file.size === 0) return "الملف فارغ، اختر ملفاً آخر.";
  if (file.size > VAULT_MAX_FILE_BYTES) return "الحد الأقصى لحجم الملف 20 ميجابايت.";
  const kind = vaultFileKind(file.name);
  if (
    (kind === "pdf" && (!file.type || file.type === "application/pdf")) ||
    (kind === "image" && (!file.type || file.type.startsWith("image/")))
  )
    return null;
  return "اختر ملف PDF أو صورة بصيغة مدعومة.";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");
}

export function filterVaultItems(
  items: VaultItem[],
  category: VaultCategory | "all",
  query: string,
) {
  const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    const text = normalizeSearch(
      [item.title, item.description, item.uploader?.arabic_name, item.uploader?.full_name]
        .filter(Boolean)
        .join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}

export interface VaultUpload {
  title: string;
  description: string;
  category: VaultCategory;
  unlockAt: string;
  file: File;
  sharedWith: string[];
}
