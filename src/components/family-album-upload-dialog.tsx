import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Check, FolderPlus, ImagePlus, Loader2, Lock, Plus, Upload, X } from "lucide-react";
import { albumMediaError, albumNameError } from "@/lib/family-album";
import type { AlbumSectionKey } from "@/lib/family-album";
import type { AlbumUploadInput, AlbumUploadResult } from "@/lib/family-album-upload";
import "./family-album-upload-dialog.css";

export type UploadAlbumOption = { key: AlbumSectionKey; label: string; canUpload: boolean };

export function FamilyAlbumUploadDialog({
  albums,
  initialAlbum,
  createOnly = false,
  canCreateAlbum,
  uploading,
  progress,
  onCreateAlbum,
  onSubmit,
  onClose,
}: {
  albums: UploadAlbumOption[];
  initialAlbum: AlbumSectionKey;
  createOnly?: boolean;
  canCreateAlbum: boolean;
  uploading: boolean;
  progress: { completed: number; total: number };
  onCreateAlbum: (title: string) => Promise<AlbumSectionKey>;
  onSubmit: (input: AlbumUploadInput) => Promise<AlbumUploadResult>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [album, setAlbum] = useState(initialAlbum);
  const [caption, setCaption] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [creating, setCreating] = useState(createOnly);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [error, setError] = useState("");
  const [fileErrors, setFileErrors] = useState<AlbumUploadResult["errors"]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pickButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const destinationInput = useRef<HTMLSelectElement>(null);
  const inFlight = useRef(false);
  const opener = useRef(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement),
  );
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [files]);
  useEffect(() => {
    if (creating) nameInput.current?.focus();
  }, [creating]);
  const busy = uploading || savingAlbum;
  const preview = previews[Math.min(previewIndex, Math.max(0, previews.length - 1))];
  const selectedAlbum = albums.find((option) => option.key === album);

  async function createAlbum() {
    if (inFlight.current || busy) return;
    const invalid = albumNameError(
      albumName,
      albums.map((a) => a.label),
    );
    if (invalid) {
      setError(invalid);
      nameInput.current?.focus();
      return;
    }
    inFlight.current = true;
    setSavingAlbum(true);
    setError("");
    try {
      const key = await onCreateAlbum(albumName.trim());
      setAlbum(key);
      setCreating(false);
      setAlbumName("");
      if (createOnly) onClose();
      else requestAnimationFrame(() => destinationInput.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الألبوم. حاول مرة أخرى.");
    } finally {
      inFlight.current = false;
      setSavingAlbum(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy && !inFlight.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="album-upload-overlay" />
        <Dialog.Content
          className="album-upload-dialog"
          dir="rtl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (createOnly ? nameInput.current : pickButton.current)?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy || inFlight.current) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
        >
          <header className="album-upload-heading">
            <div className="album-upload-heading-icon">
              {createOnly ? <FolderPlus size={23} /> : <ImagePlus size={23} />}
            </div>
            <div>
              <Dialog.Title>{createOnly ? "إنشاء ألبوم" : "إضافة ذكرى"}</Dialog.Title>
              <Dialog.Description>
                {createOnly
                  ? "أضف مساحة جديدة لذكريات العائلة."
                  : "اختر الصورة أو الفيديو، ثم حدد الألبوم الذي تود حفظها فيه."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="album-upload-icon-button"
                disabled={busy}
                aria-label="إغلاق نافذة الألبوم"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </header>
          <form
            className="album-upload-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || inFlight.current) return;
              if (creating) {
                await createAlbum();
                return;
              }
              if (!files.length) {
                setError("اختر صورة أو مقطع فيديو أولاً.");
                pickButton.current?.focus();
                return;
              }
              if (!selectedAlbum?.canUpload) {
                setError("اختر ألبوماً تملك صلاحية الإضافة إليه.");
                destinationInput.current?.focus();
                return;
              }
              setError("");
              setFileErrors([]);
              inFlight.current = true;
              try {
                const result = await onSubmit({ files, album, caption });
                setFiles((previous) => previous.filter((file) => !result.uploaded.includes(file)));
                setPreviewIndex(0);
                setFileErrors(result.errors);
                if (result.errors.length)
                  setError("بقيت الملفات التي تعذر حفظها. يمكنك إعادة المحاولة.");
              } catch {
                setError("تعذر حفظ الذكرى. حاول مرة أخرى.");
              } finally {
                inFlight.current = false;
              }
            }}
          >
            <div className="album-upload-body" data-create-only={createOnly}>
              {!createOnly && (
                <section className="album-upload-media" aria-label="الوسائط المختارة">
                  <div className="album-upload-preview">
                    {preview ? (
                      preview.file.type.startsWith("video/") ? (
                        <video
                          src={preview.url}
                          controls
                          playsInline
                          preload="metadata"
                          aria-label={preview.file.name}
                        />
                      ) : (
                        <img src={preview.url} alt={preview.file.name} />
                      )
                    ) : (
                      <div className="album-upload-empty">
                        <ImagePlus size={42} />
                        <b>خلّد لحظة جميلة</b>
                        <p>صورة أو فيديو يجمعنا</p>
                      </div>
                    )}
                  </div>
                  <button
                    ref={pickButton}
                    type="button"
                    className="album-upload-pick"
                    disabled={busy || creating}
                    onClick={() => input.current?.click()}
                  >
                    <ImagePlus size={19} />
                    {files.length ? "إضافة صور أو فيديو" : "اختيار صورة أو فيديو"}
                  </button>
                  <input
                    ref={input}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    aria-label="اختيار ملفات الذكرى"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (busy || creating) return;
                      const valid: File[] = [],
                        invalid: string[] = [];
                      selected.forEach((file) => {
                        const message = albumMediaError(file);
                        if (message) invalid.push(`${file.name}: ${message}`);
                        else valid.push(file);
                      });
                      setFiles((previous) => [
                        ...previous,
                        ...valid.filter(
                          (file) =>
                            !previous.some(
                              (p) =>
                                p.name === file.name &&
                                p.size === file.size &&
                                p.lastModified === file.lastModified,
                            ),
                        ),
                      ]);
                      setError(invalid.join(" "));
                      setFileErrors([]);
                    }}
                  />
                  {!!files.length && (
                    <ul className="album-upload-files">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                          <button
                            type="button"
                            className="album-upload-file-name"
                            aria-pressed={index === previewIndex}
                            disabled={busy || creating}
                            onClick={() => setPreviewIndex(index)}
                          >
                            {file.name}
                          </button>
                          <button
                            type="button"
                            className="album-upload-icon-button"
                            aria-label={`إزالة ${file.name}`}
                            disabled={busy || creating}
                            onClick={() => {
                              setFiles((previous) => previous.filter((_, i) => i !== index));
                              setFileErrors((previous) => previous.filter((e) => e.file !== file));
                              setPreviewIndex(0);
                            }}
                          >
                            <X size={15} />
                          </button>
                          {fileErrors.find((e) => e.file === file) && (
                            <p>{fileErrors.find((e) => e.file === file)?.message}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <small className="album-upload-size">حتى 50 ميجابايت لكل صورة أو مقطع</small>
                </section>
              )}
              <section className="album-upload-fields">
                {creating ? (
                  <div className="album-upload-create">
                    <FolderPlus size={30} />
                    <h3>ألبوم جديد للعائلة</h3>
                    <p>بيظهر كتَبويب مستقل، ويقدر أفراد العائلة يضيفون ذكرياتهم فيه.</p>
                    <label htmlFor="new-family-album">اسم الألبوم</label>
                    <input
                      ref={nameInput}
                      id="new-family-album"
                      value={albumName}
                      maxLength={60}
                      disabled={busy}
                      placeholder="مثلاً: ذكريات الصيف"
                      onChange={(event) => {
                        setAlbumName(event.target.value);
                        setError("");
                      }}
                    />
                    {!createOnly && (
                      <button
                        type="button"
                        className="album-upload-link"
                        disabled={busy}
                        onClick={() => {
                          setCreating(false);
                          setError("");
                          requestAnimationFrame(() => destinationInput.current?.focus());
                        }}
                      >
                        العودة لإضافة الذكرى
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="album-upload-step">
                      <span>1</span>
                      <div>
                        <b>اختر ذكرياتك</b>
                        <small>
                          {files.length
                            ? `${files.length} ملف جاهز للحفظ`
                            : "تظهر المعاينة هنا قبل الحفظ"}
                        </small>
                      </div>
                      {!!files.length && <Check size={18} />}
                    </div>
                    <div className="album-upload-destination">
                      <label htmlFor="memory-album">2 · أين نحفظ الذكرى؟</label>
                      <select
                        ref={destinationInput}
                        id="memory-album"
                        value={album}
                        disabled={busy}
                        onChange={(event) => {
                          setAlbum(event.target.value as AlbumSectionKey);
                          setError("");
                        }}
                      >
                        {albums.map((option) => (
                          <option key={option.key} value={option.key} disabled={!option.canUpload}>
                            {option.label}
                            {!option.canUpload ? " — يحتاج صلاحية القسم" : ""}
                          </option>
                        ))}
                      </select>
                      {!selectedAlbum?.canUpload && (
                        <p className="album-upload-access">
                          <Lock size={14} />
                          هذا الألبوم متاح لمسؤول القسم.
                        </p>
                      )}
                      {canCreateAlbum && (
                        <button
                          type="button"
                          className="album-upload-new"
                          disabled={busy}
                          onClick={() => {
                            setCreating(true);
                            setError("");
                          }}
                        >
                          <Plus size={17} />
                          إنشاء ألبوم جديد
                        </button>
                      )}
                    </div>
                    <label htmlFor="memory-caption">
                      وصف الذكرى <small>(اختياري)</small>
                    </label>
                    <textarea
                      id="memory-caption"
                      value={caption}
                      maxLength={500}
                      rows={3}
                      disabled={busy}
                      placeholder="اكتب شيئاً عن هذه اللحظة…"
                      onChange={(event) => setCaption(event.target.value)}
                    />
                  </>
                )}
              </section>
            </div>
            {error && (
              <p className="album-upload-error" role="alert">
                {error}
              </p>
            )}
            <footer className="album-upload-footer">
              <span role="status" aria-live="polite">
                {uploading
                  ? `جاري الحفظ ${progress.completed} / ${progress.total}`
                  : savingAlbum
                    ? "جاري إنشاء الألبوم…"
                    : createOnly || creating
                      ? "ذكريات جديدة في مكان واحد"
                      : files.length
                        ? `${files.length} ملف · ${selectedAlbum?.label ?? "اختر الألبوم"}`
                        : "الصور تبقى في انتظار اختيارك"}
              </span>
              <div>
                <button
                  type="button"
                  className="album-upload-cancel"
                  disabled={busy}
                  onClick={() => {
                    if (!inFlight.current) onClose();
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="album-upload-save"
                  disabled={busy || (!creating && (!files.length || !selectedAlbum?.canUpload))}
                >
                  {busy ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : creating ? (
                    <FolderPlus size={17} />
                  ) : (
                    <Upload size={17} />
                  )}
                  {creating
                    ? "إنشاء الألبوم"
                    : fileErrors.length
                      ? "إعادة محاولة الحفظ"
                      : "حفظ الذكرى"}
                </button>
              </div>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
