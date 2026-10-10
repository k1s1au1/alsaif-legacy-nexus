import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Hourglass,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setPreparationState } from "@/lib/api/trip-planning";
import { preparationPermissions, type TripPreparation } from "@/lib/trip-planning";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./trip-planning.css";

function message(error: unknown) {
  return (error as { message?: string })?.message || "تعذر الحفظ، حاول مرة أخرى";
}

export function TripPreparations({
  tripId,
  userId,
  canManage,
  readOnly = false,
}: {
  tripId: string;
  userId: string | null;
  canManage: boolean;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<TripPreparation[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TripPreparation | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busy = useRef(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("trip_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        setError("تعذر تحميل التجهيزات");
        setLoading(false);
        return;
      }
      const rows = (data || []) as TripPreparation[];
      setItems(rows);
      setError("");
      setLoading(false);
      const ids = [...new Set(rows.flatMap((i) => [i.created_by, i.assigned_to]).filter(Boolean))];
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,arabic_name,full_name")
        .in("id", ids);
      if (active)
        setNames(
          Object.fromEntries(
            (profiles || []).map((p) => [
              p.id,
              p.arabic_name?.trim() || p.full_name?.trim() || "عضو العائلة",
            ]),
          ),
        );
    }
    void load();
    const channel = supabase
      .channel(`trip-preparations-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_items", filter: `trip_id=eq.${tripId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);
  const ready = items.filter((i) => i.completed_at).length;
  const name = (id: string | null) =>
    id === userId ? "أنا" : id ? names[id] || "عضو العائلة" : "بانتظار متطوع";
  async function act(
    item: TripPreparation,
    action: "claim" | "release" | "complete" | "reopen" | "delete",
  ) {
    if (readOnly || busy.current) return;
    if (action === "delete" && !confirm(`حذف تجهيز «${item.name}»؟`)) return;
    busy.current = true;
    setBusyId(item.id);
    try {
      if (action === "delete") {
        const { data, error } = await supabase
          .from("trip_items")
          .delete()
          .eq("id", item.id)
          .select("id")
          .single();
        if (error) throw error;
        if (!data) throw new Error("تعذر التحقق من حذف التجهيز");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        const saved = await setPreparationState(item.id, action);
        setItems((prev) => prev.map((i) => (i.id === item.id ? saved : i)));
      }
      toast.success(
        action === "claim"
          ? "شكراً لتطوعك"
          : action === "complete"
            ? "تم تسجيل التجهيز جاهزاً"
            : "تم تحديث قائمة التجهيزات",
      );
    } catch (e) {
      toast.error(message(e));
      setRefresh((v) => v + 1);
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  }
  return (
    <section className="trip-system trip-system__panel" aria-label="تجهيزات الرحلة">
      <div className="trip-system__heading">
        <div>
          <h3 className="flex gap-2 items-center">
            <ListChecks size={22} /> تجهيزات الرحلة
          </h3>
          <p className="trip-system__muted">
            {ready} من {items.length} تجهيزات جاهزة
          </p>
        </div>
        {!!userId && !readOnly && (
          <button
            className="trip-system__button trip-system__button--primary"
            onClick={() => setEditing("new")}
          >
            <Plus size={18} /> إضافة تجهيز
          </button>
        )}
      </div>
      <div
        className="trip-system__progress"
        role="progressbar"
        aria-label="التجهيزات الجاهزة"
        aria-valuemin={0}
        aria-valuemax={items.length || 1}
        aria-valuenow={ready}
      >
        <span style={{ width: `${items.length ? (ready / items.length) * 100 : 0}%` }} />
      </div>
      {error ? (
        <div className="trip-system__actions">
          <p className="trip-system__error" role="alert">
            {error}
          </p>
          <button className="trip-system__button" onClick={() => setRefresh((v) => v + 1)}>
            إعادة المحاولة
          </button>
        </div>
      ) : loading ? (
        <p role="status">جاري تحميل التجهيزات…</p>
      ) : !items.length ? (
        <p className="trip-system__muted text-center py-6">
          لم تضف تجهيزات بعد. أضف ما تحتاجه الرحلة وتطوع لما يناسبك.
        </p>
      ) : (
        <div className="trip-system__stack">
          {items.map((item) => {
            const permissions = preparationPermissions(
              item,
              readOnly ? null : userId,
              canManage && !readOnly,
            );
            const done = !!item.completed_at;
            return (
              <article className="trip-system__item" key={item.id} aria-label={item.name}>
                <div className="trip-system__item-top">
                  <h4>{item.name}</h4>
                  <span className={`trip-system__badge ${done ? "trip-system__badge--done" : ""}`}>
                    {done ? (
                      <CheckCircle2 size={16} />
                    ) : item.assigned_to ? (
                      <Hourglass size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                    {done ? "جاهز" : item.assigned_to ? "قيد التجهيز" : "متاح للتطوع"}
                  </span>
                </div>
                {item.notes && <p>{item.notes}</p>}
                <div className="trip-system__muted">
                  <p>المسؤول: {name(item.assigned_to)}</p>
                  <p>أضافه: {name(item.created_by)}</p>
                </div>
                <div className="trip-system__actions">
                  {permissions.claim && (
                    <button
                      disabled={!!busyId}
                      className="trip-system__button trip-system__button--primary"
                      onClick={() => void act(item, "claim")}
                    >
                      <Plus size={17} /> أتولى التجهيز
                    </button>
                  )}
                  {permissions.complete && (
                    <button
                      disabled={!!busyId}
                      className="trip-system__button trip-system__button--primary"
                      onClick={() => void act(item, done ? "reopen" : "complete")}
                    >
                      <Check size={17} />
                      {done ? "إرجاع إلى قيد التجهيز" : "تم التجهيز"}
                    </button>
                  )}
                  {permissions.release && (
                    <button
                      disabled={!!busyId}
                      className="trip-system__button"
                      onClick={() => void act(item, "release")}
                    >
                      {item.assigned_to === userId ? "إلغاء تطوعي" : "إتاحة للمتطوعين"}
                    </button>
                  )}
                  {permissions.edit && (
                    <button
                      disabled={!!busyId}
                      className="trip-system__button"
                      onClick={() => setEditing(item)}
                    >
                      <Pencil size={16} /> تعديل
                    </button>
                  )}
                  {permissions.remove && (
                    <button
                      disabled={!!busyId}
                      className="trip-system__button trip-system__button--danger"
                      onClick={() => void act(item, "delete")}
                    >
                      <Trash2 size={16} /> حذف
                    </button>
                  )}
                  {busyId === item.id && (
                    <Loader2 size={20} className="animate-spin" aria-label="جاري الحفظ" />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing && userId && (
        <PreparationDialog
          tripId={tripId}
          userId={userId}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(item) =>
            setItems((prev) =>
              prev.some((i) => i.id === item.id)
                ? prev.map((i) => (i.id === item.id ? item : i))
                : [...prev, item],
            )
          }
        />
      )}
    </section>
  );
}

function PreparationDialog({
  tripId,
  userId,
  item,
  onClose,
  onSaved,
}: {
  tripId: string;
  userId: string;
  item: TripPreparation | null;
  onClose: () => void;
  onSaved: (item: TripPreparation) => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [self, setSelf] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !name.trim()) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), notes: notes.trim() || null };
      const query = item
        ? supabase.from("trip_items").update(payload).eq("id", item.id)
        : supabase
            .from("trip_items")
            .insert({
              ...payload,
              trip_id: tripId,
              created_by: userId,
              assigned_to: self ? userId : null,
            });
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      if (!data || data.name !== payload.name) throw new Error("تعذر التحقق من حفظ التجهيز");
      onSaved(data as TripPreparation);
      toast.success(item ? "تم تعديل التجهيز" : "تمت إضافة التجهيز");
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="trip-system trip-system__modal" dir="rtl">
        <DialogTitle>{item ? "تعديل التجهيز" : "إضافة تجهيز"}</DialogTitle>
        <DialogDescription>
          {item ? "عدّل اسم التجهيز أو ملاحظاته." : "أضف ما تحتاجه الرحلة وتولّه أو اتركه لمتطوع."}
        </DialogDescription>
        <form onSubmit={save} className="trip-system__stack">
          <label className="trip-system__field">
            اسم التجهيز
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تجهيز الضيافة"
            />
          </label>
          <label className="trip-system__field">
            الملاحظات (اختياري)
            <textarea
              maxLength={1000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ما الذي يحتاجه هذا التجهيز؟"
            />
          </label>
          {!item && (
            <fieldset>
              <legend className="font-bold">المسؤولية</legend>
              <div className="trip-system__choices">
                <label className="trip-system__choice">
                  <input
                    type="radio"
                    name="responsibility"
                    checked={self}
                    onChange={() => setSelf(true)}
                  />
                  <strong>أتولى التجهيز</strong>
                </label>
                <label className="trip-system__choice">
                  <input
                    type="radio"
                    name="responsibility"
                    checked={!self}
                    onChange={() => setSelf(false)}
                  />
                  <strong>متاح للمتطوعين</strong>
                </label>
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="trip-system__error">
              {error}
            </p>
          )}
          <div className="trip-system__actions">
            <button
              type="submit"
              disabled={saving}
              className="trip-system__button trip-system__button--primary"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {item ? "حفظ التعديل" : "إضافة التجهيز"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="trip-system__button"
            >
              إلغاء
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
