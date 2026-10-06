import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { Check, FileText, Loader2, Lock, Search, Upload, Users, X } from "lucide-react";
import { VAULT_CATEGORIES, vaultFileError } from "@/lib/vault-library";
import type { VaultCategory, VaultProfile, VaultUpload } from "@/lib/vault-library";

export function VaultUploadDialog({
  profiles,
  currentUserId,
  uploading,
  onClose,
  onSubmit,
}: {
  profiles: VaultProfile[];
  currentUserId: string | null;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (input: VaultUpload) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VaultCategory>("will");
  const [unlockAt, setUnlockAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"private" | "all" | "selected">("private");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [error, setError] = useState("");
  const opener = useRef(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement),
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const people = profiles.filter(
    (profile) =>
      profile.id !== currentUserId &&
      `${profile.arabic_name ?? ""} ${profile.full_name ?? ""}`.includes(peopleSearch.trim()),
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !uploading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="vault-dialog-overlay" />
        <Dialog.Content
          className="vault-upload-dialog vault-theme"
          dir="rtl"
          onEscapeKeyDown={(event) => {
            if (uploading) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
        >
          <header className="vault-modal-heading">
            <div>
              <Dialog.Title>إضافة وثيقة</Dialog.Title>
              <Dialog.Description>
                احفظ وثيقتك، وحدد تصنيفها ومن يمكنه الاطلاع عليها.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="vault-icon-button"
                disabled={uploading}
                aria-label="إغلاق إضافة الوثيقة"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </header>
          <form
            className="vault-upload-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (uploading || inFlight.current) return;
              const message = !title.trim()
                ? "اكتب عنوان الوثيقة."
                : !file
                  ? "اختر ملف الوثيقة."
                  : (vaultFileError(file) ??
                    (visibility === "selected" && !recipients.length
                      ? "حدد شخصاً واحداً على الأقل."
                      : ""));
              if (message) {
                setError(message);
                return;
              }
              setError("");
              inFlight.current = true;
              try {
                await onSubmit({
                  title: title.trim(),
                  description: description.trim(),
                  category,
                  unlockAt,
                  file: file!,
                  sharedWith:
                    visibility === "all" ? ["all"] : visibility === "selected" ? recipients : [],
                });
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "تعذر حفظ الوثيقة. حاول مرة أخرى.",
                );
              } finally {
                inFlight.current = false;
              }
            }}
          >
            <div className="vault-form-scroll">
              <label className="vault-field">
                عنوان الوثيقة
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={200}
                  placeholder="مثال: وثيقة ملكية المنزل"
                  disabled={uploading}
                />
              </label>
              <div className="vault-form-columns">
                <label className="vault-field">
                  التصنيف
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as VaultCategory)}
                    disabled={uploading}
                  >
                    {VAULT_CATEGORIES.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="vault-field">
                  موعد الفتح <span className="vault-field-note">اختياري</span>
                  <input
                    type="date"
                    value={unlockAt}
                    onChange={(event) => setUnlockAt(event.target.value)}
                    disabled={uploading}
                  />
                </label>
              </div>
              <label className="vault-field">
                وصف الوثيقة <span className="vault-field-note">اختياري</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="تفاصيل تساعدك على معرفة محتوى الوثيقة"
                  maxLength={5000}
                  disabled={uploading}
                />
              </label>
              <div className="vault-file-field">
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,image/*"
                  tabIndex={-1}
                  aria-label="ملف الوثيقة"
                  disabled={uploading}
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) {
                      const message = vaultFileError(selected);
                      setError(message ?? "");
                      if (!message) setFile(selected);
                    }
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="vault-file-picker"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                >
                  {file ? <FileText size={28} /> : <Upload size={28} />}
                  <span>
                    <strong>{file?.name || "اختر ملفاً أو صورة"}</strong>
                    <small>
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(1)} ميجابايت · اضغط لتغيير الملف`
                        : "PDF أو صور · حتى 20 ميجابايت"}
                    </small>
                  </span>
                </button>
              </div>
              <fieldset className="vault-sharing-field" disabled={uploading}>
                <legend>من يمكنه الاطلاع؟</legend>
                <div className="vault-sharing-options">
                  {(
                    [
                      { key: "private", label: "خاص بي", Icon: Lock },
                      { key: "all", label: "العائلة", Icon: Users },
                      { key: "selected", label: "أشخاص محددون", Icon: Check },
                    ] as const
                  ).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={visibility === key}
                      onClick={() => setVisibility(key)}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
                {visibility === "selected" && (
                  <div className="vault-people-picker">
                    <label className="vault-search">
                      <Search size={17} />
                      <input
                        value={peopleSearch}
                        aria-label="البحث عن شخص"
                        onChange={(event) => setPeopleSearch(event.target.value)}
                        placeholder="ابحث بالاسم"
                      />
                    </label>
                    <div className="vault-people-list">
                      {people.map((profile) => (
                        <label key={profile.id}>
                          <input
                            type="checkbox"
                            checked={recipients.includes(profile.id)}
                            onChange={() =>
                              setRecipients((previous) =>
                                previous.includes(profile.id)
                                  ? previous.filter((id) => id !== profile.id)
                                  : [...previous, profile.id],
                              )
                            }
                          />
                          <span>{profile.arabic_name || profile.full_name || "عضو العائلة"}</span>
                        </label>
                      ))}
                      {!people.length && <p>لا توجد أسماء مطابقة.</p>}
                    </div>
                    <small>{recipients.length} أشخاص محددون</small>
                  </div>
                )}
              </fieldset>
              {error && (
                <p className="vault-form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="vault-form-footer">
              <button className="vault-primary-button" type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="vault-spin" size={18} /> : <Check size={18} />}
                {uploading ? "جاري حفظ الوثيقة…" : "حفظ الوثيقة"}
              </button>
              <Dialog.Close asChild>
                <button className="vault-secondary-button" type="button" disabled={uploading}>
                  إلغاء
                </button>
              </Dialog.Close>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
