import { useEffect } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { useDisplayMode } from "@/hooks/use-display-mode";
import { saveDisplayMode } from "@/lib/display-preference";
import { mountDisplayLayout } from "@/lib/display-layout";

export function DisplayPreferenceController() {
  const mode = useDisplayMode();
  useEffect(() => mountDisplayLayout(), []);
  if (mode !== "desktop") return null;
  return (
    <div className="display-mode-return" dir="rtl" role="region" aria-label="طريقة العرض الحالية">
      <span><Monitor size={16} aria-hidden="true" /> عرض الكمبيوتر</span>
      <button type="button" onClick={() => saveDisplayMode("auto")}>
        <Smartphone size={16} aria-hidden="true" /> الرجوع للتلقائي
      </button>
    </div>
  );
}
