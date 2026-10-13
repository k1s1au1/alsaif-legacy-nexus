import { Capacitor, registerPlugin } from "@capacitor/core";

type BackupFile = { fileName: string; zipBase64: string };
type NativeFileSave = {
  save(options: { fileName: string; base64Data: string }): Promise<{ saved: boolean }>;
};
type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable(): Promise<{
      write(data: Blob): Promise<void>;
      close(): Promise<void>;
      abort(): Promise<void>;
    }>;
  }>;
};

const FileSave = registerPlugin<NativeFileSave>("FamilyFileSave");
export type BackupSaveOutcome = "saved" | "cancelled" | "download-started";

export async function saveBackupFile(backup: BackupFile): Promise<BackupSaveOutcome> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("FamilyFileSave")) {
      throw new Error("حدّث التطبيق لتفعيل حفظ الملفات، أو افتح الموقع في Chrome لتنزيل النسخة.");
    }
    const result = await FileSave.save({
      fileName: backup.fileName,
      base64Data: backup.zipBase64,
    });
    return result.saved ? "saved" : "cancelled";
  }

  const binary = atob(backup.zipBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/zip" });
  const pickerWindow = window as FilePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    let handle: Awaited<ReturnType<NonNullable<FilePickerWindow["showSaveFilePicker"]>>> | undefined;
    try {
      // Called directly from the save button to retain the user's activation.
      handle = await pickerWindow.showSaveFilePicker({
        suggestedName: backup.fileName,
        types: [{ description: "نسخة احتياطية ZIP", accept: { "application/zip": [".zip"] } }],
      });
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return "cancelled";
      // Embedded web previews can disallow this picker; normal downloads still work there.
      if ((error as { name?: string }).name !== "SecurityError") throw error;
    }
    if (handle) {
      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
        return "saved";
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backup.fileName;
  document.body.appendChild(link);
  try {
    link.click();
  } catch (error) {
    link.remove();
    URL.revokeObjectURL(url);
    throw error;
  }
  // WebKit and download managers may consume the blob after the click has returned.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
  return "download-started";
}
