import { albumDestination, albumMediaError } from "./family-album";
import type { AlbumSectionKey, BuiltinAlbumKey } from "./family-album";

export type AlbumUploadInput = { files: File[]; album: AlbumSectionKey; caption: string };
export type AlbumUploadResult = {
  uploaded: File[];
  errors: { file: File; message: string }[];
};
type UploadPorts = {
  upload: (path: string, file: File) => Promise<void>;
  insert: (item: {
    uploader_id: string;
    media_type: "image" | "video";
    storage_path: string;
    section: BuiltinAlbumKey;
    album_id: string | null;
    caption: string | null;
  }) => Promise<void>;
  remove: (path: string) => Promise<void>;
  onProgress?: (completed: number, total: number) => void;
};

// A batch uses one destination snapshot. Failed files stay in the dialog for
// retry, and retrying cannot re-upload the files already saved successfully.
export async function uploadAlbumMemories(
  userId: string,
  input: AlbumUploadInput,
  ports: UploadPorts,
): Promise<AlbumUploadResult> {
  const destination = albumDestination(input.album);
  const caption = input.caption.trim().slice(0, 500) || null;
  const files = [...input.files];
  const result: AlbumUploadResult = { uploaded: [], errors: [] };
  for (const [index, file] of files.entries()) {
    const invalid = albumMediaError(file);
    if (invalid) {
      result.errors.push({ file, message: invalid });
      ports.onProgress?.(index + 1, files.length);
      continue;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    const safeExtension =
      extension && /^[a-z0-9]{1,10}$/.test(extension)
        ? extension
        : file.type.startsWith("image/")
          ? "jpg"
          : "mp4";
    const path = `${userId}/${crypto.randomUUID()}.${safeExtension}`;
    let stored = false;
    try {
      await ports.upload(path, file);
      stored = true;
      await ports.insert({
        ...destination,
        uploader_id: userId,
        media_type: file.type.startsWith("image/") ? "image" : "video",
        storage_path: path,
        caption,
      });
      result.uploaded.push(file);
    } catch {
      let message = stored
        ? "تعذر حفظ الذكرى في الألبوم. أعد المحاولة."
        : "تعذر رفع الملف. أعد المحاولة.";
      if (stored) {
        try {
          await ports.remove(path);
        } catch {
          message += " وتعذر تنظيف الملف المرفوع.";
        }
      }
      result.errors.push({ file, message });
    }
    ports.onProgress?.(index + 1, files.length);
  }
  return result;
}
