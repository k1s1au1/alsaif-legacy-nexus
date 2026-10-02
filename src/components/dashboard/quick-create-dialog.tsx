import { MemberDialog } from "@/components/community/member-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { FamilyOccasionCreateDialog } from "@/pages/family-occasions-page";
import {
  BookOpen,
  CalendarDays,
  HelpCircle,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageCircle,
  Plane,
  Send,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

export type QuickCreateTarget = "meeting" | "trip" | "task" | "occasion" | "community";

type QuickCreateDialogProps = {
  target: QuickCreateTarget;
  userId: string | null;
  onClose: () => void;
  onSaved: (target: QuickCreateTarget) => void | Promise<void>;
};

type FormShellProps = {
  title: string;
  description: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

type SubmitActionsProps = {
  label: string;
  saving: boolean;
  onClose: () => void;
  icon?: ReactNode;
};

type Member = { id: string; name: string };
type TaskPriority = TablesInsert<"tasks">["priority"];
type TripInsertWithAccommodation = TablesInsert<"trips"> & {
  accommodation_type?: string;
};

const fieldClass =
  "w-full min-h-12 rounded-2xl border border-border/70 bg-muted/35 px-4 text-sm font-bold text-foreground shadow-inner outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/5 placeholder:text-muted-foreground/55";
const textAreaClass = `${fieldClass} resize-none py-3`;
const labelClass = "mb-1.5 block px-1 text-[11px] font-black tracking-wide text-primary/75";

function errorDescription(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "");
    if (message.includes("row-level security")) {
      return "ليس لديك الصلاحية اللازمة لتنفيذ هذه الإضافة.";
    }
    if (message) return message;
  }
  return "تحقق من البيانات وحاول مرة أخرى.";
}

function FormShell({ title, description, icon, onClose, children }: FormShellProps) {
  return (
    <MemberDialog title={title} description={description} icon={icon} onClose={onClose} wide>
      {children}
    </MemberDialog>
  );
}

function SubmitActions({ label, saving, onClose, icon }: SubmitActionsProps) {
  return (
    <div className="member-dialog-actions">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="flex-1 rounded-2xl py-3.5 text-sm font-black text-muted-foreground transition hover:bg-muted disabled:opacity-50"
      >
        إلغاء
      </button>
      <button
        type="submit"
        disabled={saving}
        className="btn-gold flex-[2] rounded-2xl py-3.5 text-sm font-black shadow-lg disabled:opacity-60"
      >
        <span className="flex items-center justify-center gap-2">
          {saving ? <Loader2 className="size-5 animate-spin" /> : icon}
          {label}
        </span>
      </button>
    </div>
  );
}

function MeetingQuickForm({ userId, onClose, onSaved }: QuickCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [locationUrl, setLocationUrl] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return toast.error("تعذّر التحقق من حسابك");
    if (!title.trim() || !when) return toast.error("العنوان والموعد مطلوبان");

    setSaving(true);
    try {
      const { error } = await supabase.from("meetings").insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        location_url: locationUrl.trim() || null,
        scheduled_at: new Date(when).toISOString(),
        duration_minutes: duration ? Number(duration) : null,
        minutes: null,
        created_by: userId,
      });
      if (error) throw error;
      toast.success("تمت جدولة اللقاء");
      await onSaved("meeting");
      onClose();
    } catch (error) {
      toast.error("تعذّر حفظ الاجتماع", { description: errorDescription(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell
      title="جدولة لقاء عائلي"
      description="إضافة اجتماع عائلي من دون مغادرة لوحة العائلة."
      icon={<Users className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="member-dialog-form">
        <div className="member-dialog-scroll space-y-4">
          <Field label="عنوان الاجتماع">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: اجتماع العائلة السنوي"
              className={fieldClass}
              required
            />
          </Field>
          <Field label="وصف موجز">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="ماذا سنناقش في هذا اللقاء؟"
              rows={3}
              className={textAreaClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="موعد اللقاء">
              <input
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                className={fieldClass}
                required
              />
            </Field>
            <Field label="المدة (دقيقة)">
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="60"
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="مكان الاجتماع">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="مثال: مجلس العائلة"
              className={fieldClass}
            />
          </Field>
          <Field label="رابط الموقع على الخريطة">
            <input
              type="url"
              value={locationUrl}
              onChange={(event) => setLocationUrl(event.target.value)}
              placeholder="https://maps.google.com/..."
              className={fieldClass}
            />
          </Field>
        </div>
        <SubmitActions
          label="تأكيد الجدولة"
          saving={saving}
          onClose={onClose}
          icon={<CalendarDays className="size-5" />}
        />
      </form>
    </FormShell>
  );
}

function TripQuickForm({ userId, onClose, onSaved }: QuickCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    badge: "",
    location: "",
    location_url: "",
    accommodation_type: "مخيم عائلي فاخر",
    start_date: "",
    end_date: "",
    description: "",
  });
  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return toast.error("تعذّر التحقق من حسابك");
    if (!form.title.trim()) return toast.error("عنوان الرحلة مطلوب");

    setSaving(true);
    try {
      let imagePath: string | undefined;
      if (imageFile) {
        const extension = imageFile.name.split(".").pop() || "jpg";
        imagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("trip-images")
          .upload(imagePath, imageFile);
        if (uploadError) throw uploadError;
      }

      const payload: TripInsertWithAccommodation = {
        ...form,
        title: form.title.trim(),
        status: "upcoming",
        created_by: userId,
      };
      if (imagePath) payload.image_url = imagePath;

      let { error } = await supabase.from("trips").insert(payload);
      if (error?.message?.includes("accommodation_type")) {
        const { accommodation_type: _ignored, ...legacyPayload } = payload;
        ({ error } = await supabase.from("trips").insert(legacyPayload));
      }
      if (error) throw error;

      toast.success("تم حفظ الرحلة");
      await onSaved("trip");
      onClose();
    } catch (error) {
      toast.error("تعذّر حفظ الرحلة", { description: errorDescription(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell
      title="إضافة رحلة عائلية"
      description="إضافة رحلة من دون مغادرة لوحة العائلة."
      icon={<Plane className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="member-dialog-form">
        <div className="member-dialog-scroll space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="عنوان الرحلة">
              <input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="مثال: شتاء العائلة"
                className={fieldClass}
                required
              />
            </Field>
            <Field label="الوسم المختصر">
              <input
                value={form.badge}
                onChange={(event) => update("badge", event.target.value)}
                placeholder="رحلة شتوية"
                className={fieldClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="تاريخ البداية">
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => update("start_date", event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="تاريخ النهاية">
              <input
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(event) => update("end_date", event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="الوجهة">
              <input
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="اسم الوجهة"
                className={fieldClass}
              />
            </Field>
            <Field label="نوع الإقامة">
              <input
                value={form.accommodation_type}
                onChange={(event) => update("accommodation_type", event.target.value)}
                placeholder="شاليه، مخيم، فندق..."
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="رابط الموقع">
            <input
              type="url"
              value={form.location_url}
              onChange={(event) => update("location_url", event.target.value)}
              placeholder="https://maps.google.com/..."
              className={fieldClass}
            />
          </Field>
          <Field label="وصف الرحلة">
            <textarea
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="التفاصيل والبرنامج..."
              rows={3}
              className={textAreaClass}
            />
          </Field>
          <Field label="صورة الوجهة">
            <label className="flex min-h-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="معاينة صورة الرحلة"
                  className="h-32 w-full object-cover"
                />
              ) : (
                <span className="flex items-center gap-2 text-xs font-black">
                  <ImageIcon className="size-5" /> اختيار صورة
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              />
            </label>
          </Field>
        </div>
        <SubmitActions
          label="حفظ الرحلة"
          saving={saving}
          onClose={onClose}
          icon={<Plane className="size-5" />}
        />
      </form>
    </FormShell>
  );
}

function TaskQuickForm({ userId, onClose, onSaved }: QuickCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    due_date: "",
    assignee_id: "none",
  });

  useEffect(() => {
    let alive = true;
    void supabase
      .from("profiles")
      .select("id, arabic_name, full_name")
      .then(({ data }) => {
        if (!alive) return;
        setMembers(
          (data || []).map((profile) => ({
            id: profile.id,
            name: profile.arabic_name || profile.full_name || "عضو",
          })),
        );
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return toast.error("تعذّر التحقق من حسابك");
    if (!form.title.trim()) return toast.error("عنوان المهمة مطلوب");

    setSaving(true);
    try {
      const payload: TablesInsert<"tasks"> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assignee_id: form.assignee_id === "none" ? null : form.assignee_id,
        progress: 0,
        status: "todo",
        completed_at: null,
        created_by: userId,
      };
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;

      toast.success("تمت إضافة المهمة");
      await onSaved("task");
      onClose();
    } catch (error) {
      toast.error("تعذّر حفظ المهمة", { description: errorDescription(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell
      title="مبادرة جديدة"
      description="إضافة مهمة عائلية من دون مغادرة لوحة العائلة."
      icon={<ListChecks className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="member-dialog-form">
        <div className="member-dialog-scroll space-y-4">
          <Field label="عنوان المهمة">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="ما هي المهمة؟"
              className={fieldClass}
              required
            />
          </Field>
          <Field label="التفاصيل والأهداف">
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="اكتب وصفاً تفصيلياً..."
              rows={4}
              className={textAreaClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="الأولوية">
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as TaskPriority })
                }
                className={fieldClass}
              >
                <option value="low">عادية</option>
                <option value="medium">متوسطة الأهمية</option>
                <option value="high">عاجلة جداً</option>
              </select>
            </Field>
            <Field label="تاريخ الإنجاز">
              <input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="المسؤول عن التنفيذ">
            <select
              value={form.assignee_id}
              onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}
              className={fieldClass}
            >
              <option value="none">— اختر الفرد المسؤول —</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SubmitActions
          label="تأكيد المهمة"
          saving={saving}
          onClose={onClose}
          icon={<ListChecks className="size-5" />}
        />
      </form>
    </FormShell>
  );
}

function OccasionQuickForm({ onClose, onSaved }: QuickCreateDialogProps) {
  return <FamilyOccasionCreateDialog onClose={onClose} onSaved={() => onSaved("occasion")} />;
}

function CommunityQuickForm({ userId, onClose, onSaved }: QuickCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<"diary" | "question">("diary");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [withPoll, setWithPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const upload = async (files: FileList | null) => {
    if (!files || !userId) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
        const { error } = await supabase.storage
          .from("community-media")
          .upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = await supabase.storage
          .from("community-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setImages((current) => [...current, ...urls]);
    } catch (error) {
      toast.error("تعذّر رفع الصورة", { description: errorDescription(error) });
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return toast.error("تعذّر التحقق من حسابك");
    if (!title.trim()) return toast.error("أدخل عنواناً للمشاركة");
    const options = withPoll
      ? pollOptions
          .map((option) => option.trim())
          .filter(Boolean)
          .map((label) => ({ label }))
      : null;
    if (withPoll && (!options || options.length < 2)) {
      return toast.error("التصويت يحتاج خيارَين على الأقل");
    }

    setSaving(true);
    try {
      const payload: TablesInsert<"member_posts"> = {
        author_id: userId,
        kind,
        title: title.trim(),
        body: body.trim() || null,
        image_urls: images,
        poll_options: options,
      };
      const { error } = await supabase.from("member_posts").insert(payload);
      if (error) throw error;

      toast.success("تم نشر المشاركة");
      await onSaved("community");
      onClose();
    } catch (error) {
      toast.error("تعذّر نشر المشاركة", { description: errorDescription(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell
      title="مشاركة جديدة"
      description="نشر يومية أو سؤال للعائلة من دون مغادرة لوحة العائلة."
      icon={<MessageCircle className="size-5" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="member-dialog-form">
        <div className="member-dialog-scroll space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceButton active={kind === "diary"} onClick={() => setKind("diary")}>
              <span className="flex items-center justify-center gap-2">
                <BookOpen className="size-4" /> يوميات
              </span>
            </ChoiceButton>
            <ChoiceButton active={kind === "question"} onClick={() => setKind("question")}>
              <span className="flex items-center justify-center gap-2">
                <HelpCircle className="size-4" /> سؤال للعائلة
              </span>
            </ChoiceButton>
          </div>
          <Field label="عنوان المشاركة">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="عنوان المشاركة..."
              className={fieldClass}
              required
            />
          </Field>
          <Field label="التفاصيل">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="اكتب تفاصيل المشاركة..."
              rows={5}
              className={textAreaClass}
            />
          </Field>
          <Field label="الصور">
            <div className="flex flex-wrap gap-2">
              {images.map((url, index) => (
                <div key={url} className="relative size-20 overflow-hidden rounded-2xl">
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, itemIndex) => itemIndex !== index))}
                    className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-black/65 text-white"
                    aria-label="حذف الصورة"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <label className="grid size-20 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/50">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ImageIcon className="size-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void upload(event.target.files)}
                />
              </label>
            </div>
          </Field>
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-black">
              <input
                type="checkbox"
                checked={withPoll}
                onChange={(event) => setWithPoll(event.target.checked)}
              />
              <Vote className="size-4" /> إضافة تصويت
            </label>
            {withPoll && (
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    value={option}
                    onChange={(event) => {
                      const next = [...pollOptions];
                      next[index] = event.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`الخيار ${index + 1}`}
                    className={fieldClass}
                  />
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="min-h-11 w-full rounded-xl border-2 border-dashed border-border text-xs font-black text-muted-foreground"
                  >
                    + إضافة خيار
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <SubmitActions
          label="نشر"
          saving={saving || uploading}
          onClose={onClose}
          icon={<Send className="size-5" />}
        />
      </form>
    </FormShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-2xl border px-3 text-xs font-black transition ${
        active
          ? "border-primary bg-primary text-white shadow-md"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function QuickCreateDialog(props: QuickCreateDialogProps) {
  switch (props.target) {
    case "meeting":
      return <MeetingQuickForm {...props} />;
    case "trip":
      return <TripQuickForm {...props} />;
    case "task":
      return <TaskQuickForm {...props} />;
    case "occasion":
      return <OccasionQuickForm {...props} />;
    case "community":
      return <CommunityQuickForm {...props} />;
  }
}
