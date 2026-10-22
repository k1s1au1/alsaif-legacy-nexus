import { useId } from "react";
import { Check, Droplets, PanelsTopLeft } from "lucide-react";
import type { InterfaceMaterial } from "@/lib/theme-preferences";

const materials = [
  { id: "classic", label: "الكلاسيكي", description: "المظهر الحالي", icon: PanelsTopLeft },
  { id: "crystal", label: "مجلس بلّوري", description: "زجاج سائل شفاف، انعكاسات وحواف مضيئة", icon: Droplets },
] as const;

export function InterfaceMaterialPicker({
  value,
  disabled = false,
  onChange,
}: {
  value: InterfaceMaterial;
  disabled?: boolean;
  onChange: (material: InterfaceMaterial) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <div className="interface-material-picker" aria-busy={disabled}>
      <h4 id={titleId}>مظهر الواجهة</h4>
      <p id={descriptionId}>يتناسق مع ألوان الهوية التي اخترتها.</p>
      <div
        className="interface-material-options"
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {materials.map(({ id, label, description, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className="interface-material-option"
            data-material={id}
            aria-pressed={value === id}
            disabled={disabled}
            onClick={() => { if (value !== id) onChange(id); }}
          >
            <span className="interface-material-sample" aria-hidden="true">
              <span className="interface-material-sample-bar"><span /><i /><span /></span>
              <span className="interface-material-sample-services"><i /><i /><i /><i /></span>
            </span>
            <span className="interface-material-option-title">
              <Icon size={20} aria-hidden="true" />
              <b>{label}</b>
              {value === id && <Check size={18} aria-hidden="true" />}
            </span>
            <span className="interface-material-option-description">{description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
