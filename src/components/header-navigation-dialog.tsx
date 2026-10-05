import { useState } from "react";
import { Monitor, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NAV_REGISTRY, type NavItemDef, type NavItemKey } from "@/lib/navigation-registry";

interface HeaderNavigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keys: NavItemKey[];
  options: NavItemDef[];
  saving: boolean;
  onChange: (keys: NavItemKey[] | null) => void;
}

const label = (item?: NavItemDef) => item?.id === "chat" ? "الدردشة" : item?.label;

export function HeaderNavigationDialog({
  open, onOpenChange, keys, options, saving, onChange,
}: HeaderNavigationDialogProps) {
  const [slot, setSlot] = useState<0 | 1>(0);

  const choose = (key: NavItemKey) => {
    if (saving || keys[slot] === key) return;
    const next = [...keys];
    const other = slot === 0 ? 1 : 0;
    if (next[other] === key) next[other] = next[slot];
    next[slot] = key;
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="header-navigation-dialog flex max-h-[min(90svh,44rem)] w-[calc(100%_-_2rem)] max-w-xl flex-col gap-5 overflow-hidden rounded-3xl bg-card p-5 sm:p-7"
      >
        <div className="space-y-2 px-5 text-center">
          <Monitor className="mx-auto size-7 text-primary" aria-hidden="true" />
          <DialogTitle className="text-xl font-black text-primary">تخصيص الشريط العلوي</DialogTitle>
          <DialogDescription className="leading-relaxed">
            اختر الخانة ثم الخدمة. تظهر الاختصارات على الكمبيوتر والآيباد بالوضع الأفقي، وتُحفظ في حسابك.
          </DialogDescription>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3" aria-label="خانات الشريط العلوي">
          {([0, 1] as const).map((index) => {
            const item = NAV_REGISTRY.find((entry) => entry.id === keys[index]);
            const Icon = item?.icon;
            return (
              <button
                key={index}
                type="button"
                aria-pressed={slot === index}
                disabled={saving}
                onClick={() => setSlot(index)}
                className={cn(
                  "min-w-0 rounded-2xl border-2 p-3 text-right transition-colors disabled:opacity-60",
                  slot === index ? "border-primary bg-primary/10" : "border-border bg-background",
                )}
              >
                <small className="block text-xs text-muted-foreground">
                  {index === 0 ? "الخانة الأولى · الأقرب للشعار" : "الخانة الثانية"}
                </small>
                <span className="mt-2 flex items-center gap-2 text-sm font-bold text-primary">
                  {Icon && <Icon size={19} className="shrink-0" aria-hidden="true" />}
                  {label(item)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3" aria-label="خدمات الشريط العلوي" aria-busy={saving}>
          {options.map((item) => {
            const selected = keys.indexOf(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected !== -1}
                disabled={saving}
                onClick={() => choose(item.id)}
                className={cn(
                  "relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-primary transition-colors disabled:opacity-60",
                  selected !== -1 ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-primary/5",
                  selected === slot && "ring-2 ring-primary/20",
                )}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="text-xs font-bold">{label(item)}</span>
                {selected !== -1 && <small className="absolute start-2 top-1 text-xs">{selected === 0 ? "١" : "٢"}</small>}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange(null)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-60"
          >
            <RotateCcw size={16} aria-hidden="true" /> استعادة الافتراضي
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="btn-gold rounded-xl px-6 py-2 text-sm font-bold">
            إغلاق
          </button>
          <span role="status" className="sr-only">{saving ? "جارٍ حفظ الاختصارات" : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
