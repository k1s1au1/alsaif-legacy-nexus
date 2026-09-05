import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Pencil, Plus, Scroll, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { toast } from "sonner";

export type SpiritualQuote = {
  id: string;
  text: string;
  source: string;
  type: "quran" | "hadith" | "wisdom";
  category: "general" | "friday" | "mon_thu" | "white_days";
  enabled: boolean;
};

const DEFAULT_QUOTES: SpiritualQuote[] = [
  {
    id: "friday-quran",
    text: "يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ",
    source: "سورة الجمعة",
    type: "quran",
    category: "friday",
    enabled: true,
  },
  {
    id: "friday-hadith",
    text: "إِنَّ مِنْ أَفْضَلِ أَيَّامِكُمْ يَوْمَ الْجُمُعَةِ، فَأَكْثِرُوا عَلَيَّ مِنَ الصَّلَاةِ فِيهِ",
    source: "حديث شريف (رواه أبو داود)",
    type: "hadith",
    category: "friday",
    enabled: true,
  },
  {
    id: "mon-thu",
    text: "تُعْرَضُ الأَعْمَالُ يَوْمَ الاثْنَيْنِ وَالْخَمِيسِ، فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ",
    source: "حديث شريف (رواه الترمذي)",
    type: "hadith",
    category: "mon_thu",
    enabled: true,
  },
  {
    id: "white-days",
    text: "صِيَامُ ثَلاثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ صِيَامُ الدَّهْرِ، وَهِيَ أَيَّامُ الْبِيضِ",
    source: "حديث شريف (رواه النسائي)",
    type: "hadith",
    category: "white_days",
    enabled: true,
  },
  {
    id: "general-1",
    text: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    source: "سورة آل عمران",
    type: "quran",
    category: "general",
    enabled: true,
  },
  {
    id: "general-2",
    text: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
    source: "سورة المائدة",
    type: "quran",
    category: "general",
    enabled: true,
  },
  {
    id: "general-3",
    text: "إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ",
    source: "سورة الحجرات",
    type: "quran",
    category: "general",
    enabled: true,
  },
];

const categoryLabels: Record<SpiritualQuote["category"], string> = {
  general: "عام",
  friday: "الجمعة",
  mon_thu: "الاثنين والخميس",
  white_days: "الأيام البيض",
};

const typeLabels: Record<SpiritualQuote["type"], string> = {
  quran: "آية قرآنية",
  hadith: "حديث",
  wisdom: "حكمة / أثر",
};

function normalizeRow(row: any): SpiritualQuote {
  return {
    id: String(row.id),
    text: String(row.text || ""),
    source: String(row.source || ""),
    type: ["quran", "hadith", "wisdom"].includes(row.quote_type)
      ? row.quote_type
      : "quran",
    category: ["general", "friday", "mon_thu", "white_days"].includes(row.category)
      ? row.category
      : "general",
    enabled: row.enabled !== false,
  };
}

function pickQuote(quotes: SpiritualQuote[]) {
  const enabled = quotes.filter((q) => q.enabled && q.text.trim() && q.source.trim());
  if (!enabled.length) return DEFAULT_QUOTES[4];

  const now = new Date();
  const dayOfWeek = now.getDay();
  let hijriDay = 1;
  try {
    hijriDay = parseInt(
      new Intl.DateTimeFormat("en-u-ca-islamic-uma-nu-latn", { day: "numeric" }).format(now),
    );
  } catch {}

  let category: SpiritualQuote["category"] = "general";
  if ([13, 14, 15].includes(hijriDay)) category = "white_days";
  else if (dayOfWeek === 5) category = "friday";
  else if (dayOfWeek === 1 || dayOfWeek === 4) category = "mon_thu";

  const categoryPool = enabled.filter((q) => q.category === category);
  const generalPool = enabled.filter((q) => q.category === "general");
  const candidates = categoryPool.length ? categoryPool : generalPool.length ? generalPool : enabled;
  const daySeed = Math.floor(Date.now() / 86_400_000);
  return candidates[Math.abs(daySeed) % candidates.length];
}

export function SpiritualQuotesWidget({ variant = "dashboard" }: { variant?: "dashboard" | "desktop" }) {
  const { userId, canManageSection, isLoading: roleLoading } = useUserRole();
  const canManage = !roleLoading && canManageSection("faith");
  const [quotes, setQuotes] = useState<SpiritualQuote[]>(DEFAULT_QUOTES);
  const [drafts, setDrafts] = useState<SpiritualQuote[]>(DEFAULT_QUOTES);
  const [databaseIds, setDatabaseIds] = useState<string[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedFromDatabase, setLoadedFromDatabase] = useState(false);

  const loadQuotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("faith_quotes" as any)
      .select("id,text,source,quote_type,category,enabled,sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      // The fallback keeps the current site usable before the migration reaches production.
      console.warn("Unable to load faith quotes:", error.message);
      setLoadedFromDatabase(false);
      setQuotes(DEFAULT_QUOTES);
      setDrafts(DEFAULT_QUOTES);
      setDatabaseIds([]);
      return;
    }

    const rows = Array.isArray(data) ? (data as any[]) : [];
    if (!rows.length) {
      setLoadedFromDatabase(false);
      setQuotes(DEFAULT_QUOTES);
      setDrafts(DEFAULT_QUOTES);
      setDatabaseIds([]);
      return;
    }

    const normalized = rows.map(normalizeRow);
    setQuotes(normalized);
    setDrafts(normalized);
    setDatabaseIds(normalized.map((q) => q.id));
    setLoadedFromDatabase(true);
  }, []);

  useEffect(() => {
    loadQuotes();
    window.addEventListener("focus", loadQuotes);
    return () => window.removeEventListener("focus", loadQuotes);
  }, [loadQuotes]);

  const currentQuote = useMemo(() => pickQuote(quotes), [quotes]);

  const openManager = () => {
    setDrafts(quotes.map((q) => ({ ...q })));
    setShowManager(true);
  };

  const addQuote = () => {
    setDrafts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "",
        source: "",
        type: "quran",
        category: "general",
        enabled: true,
      },
    ]);
  };

  const updateQuote = (id: string, patch: Partial<SpiritualQuote>) => {
    setDrafts((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const saveQuotes = async () => {
    if (!canManage || !userId) {
      toast.error("لا تملك صلاحية إدارة نفحات إيمانية");
      return;
    }

    const cleaned = drafts
      .map((q) => ({ ...q, text: q.text.trim(), source: q.source.trim() }))
      .filter((q) => q.text || q.source);

    if (!cleaned.length) {
      toast.error("أضف نفحة واحدة على الأقل قبل الحفظ");
      return;
    }
    if (cleaned.some((q) => !q.text || !q.source)) {
      toast.error("أكمل نص النفحة والمصدر لجميع العناصر");
      return;
    }

    setSaving(true);
    try {
      const payload = cleaned.map((q, index) => ({
        id: q.id,
        text: q.text,
        source: q.source,
        quote_type: q.type,
        category: q.category,
        enabled: q.enabled,
        sort_order: (index + 1) * 10,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from("faith_quotes" as any)
        .upsert(payload as any, { onConflict: "id" });
      if (upsertError) throw upsertError;

      const keptIds = new Set(cleaned.map((q) => q.id));
      const removedIds = databaseIds.filter((id) => !keptIds.has(id));
      if (removedIds.length) {
        const { error: deleteError } = await supabase
          .from("faith_quotes" as any)
          .delete()
          .in("id", removedIds);
        if (deleteError) throw deleteError;
      }

      setQuotes(cleaned);
      setDrafts(cleaned);
      setDatabaseIds(cleaned.map((q) => q.id));
      setLoadedFromDatabase(true);
      setShowManager(false);
      toast.success("تم تحديث نفحات إيمانية");
    } catch (error: any) {
      console.error("Unable to save faith quotes:", error);
      toast.error("تعذر حفظ النفحات", {
        description: error?.message || "حدث خطأ غير متوقع",
      });
    } finally {
      setSaving(false);
    }
  };

  const manageButton = canManage ? (
    <button
      type="button"
      onClick={openManager}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#b99755]/30 bg-white/75 px-2.5 py-1.5 text-[11px] font-black text-[#8b6b23] shadow-sm backdrop-blur transition hover:bg-white"
      title="إدارة نفحات إيمانية"
      aria-label="إدارة نفحات إيمانية"
    >
      <Pencil size={13} />
      <span className="hidden lg:inline">إدارة النفحات</span>
    </button>
  ) : null;

  const content =
    variant === "desktop" ? (
      <div className="desktop-faith-strip relative">
        <div className="desktop-faith-label">
          <Scroll size={16} aria-hidden="true" />
          <b>نفحات إيمانية</b>
        </div>
        <p style={{ fontFamily: "'Amiri', serif" }}>"{currentQuote.text}"</p>
        <span>{currentQuote.source}</span>
        {manageButton && <div className="absolute left-3 top-1/2 -translate-y-1/2">{manageButton}</div>}
      </div>
    ) : (
      <section className="dashboard-spiritual dashboard-faith-strip animate-fade-up relative">
        <div className="dashboard-faith-meta">
          <div className="dashboard-faith-label">
            <Scroll size={16} aria-hidden="true" />
            <span>نفحات إيمانية</span>
          </div>
          <span className="dashboard-faith-source">{currentQuote.source}</span>
        </div>
        <p style={{ fontFamily: "'Amiri', serif" }}>"{currentQuote.text}"</p>
        {manageButton && <div className="absolute left-3 top-1/2 -translate-y-1/2">{manageButton}</div>}
      </section>
    );

  return (
    <>
      {content}
      {showManager &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm md:items-center md:p-6"
            dir="rtl"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setShowManager(false);
            }}
          >
            <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] bg-[#fffdf7] shadow-2xl md:rounded-[30px]">
              <header className="flex items-center justify-between border-b border-[#d8c79e]/35 px-5 py-4 md:px-7">
                <div>
                  <p className="text-xs font-black text-[#b08a39]">مسؤول نفحات إيمانية</p>
                  <h2 className="text-xl font-black text-[#0d4f3c]">إدارة النفحات</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    أضف أو عدّل الآيات والأحاديث والحِكم التي تظهر لأفراد العائلة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManager(false)}
                  className="grid size-10 place-items-center rounded-full bg-black/5 text-slate-600 hover:bg-black/10"
                  aria-label="إغلاق"
                >
                  <X size={19} />
                </button>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-7">
                {!loadedFromDatabase && (
                  <div className="rounded-2xl border border-[#b99755]/20 bg-[#b99755]/10 px-4 py-3 text-xs font-bold text-[#7b642d]">
                    تظهر الآن النفحات الافتراضية. عند الحفظ ستصبح القائمة مُدارة من مسؤول القسم.
                  </div>
                )}

                {drafts.map((quote, index) => (
                  <article
                    key={quote.id}
                    className="rounded-3xl border border-[#d8c79e]/35 bg-white p-4 shadow-sm md:p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-[#0d5b46] text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <div>
                          <b className="text-sm text-[#0d4f3c]">{typeLabels[quote.type]}</b>
                          <p className="text-[10px] font-bold text-slate-400">{categoryLabels[quote.category]}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuote(quote.id, { enabled: !quote.enabled })}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black ${
                            quote.enabled
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Check size={12} /> {quote.enabled ? "مفعلة" : "مخفية"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => prev.filter((q) => q.id !== quote.id))
                          }
                          className="grid size-9 place-items-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                          aria-label="حذف النفحة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-black text-slate-600">
                        النوع
                        <select
                          value={quote.type}
                          onChange={(e) =>
                            updateQuote(quote.id, {
                              type: e.target.value as SpiritualQuote["type"],
                            })
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                        >
                          <option value="quran">آية قرآنية</option>
                          <option value="hadith">حديث</option>
                          <option value="wisdom">حكمة / أثر</option>
                        </select>
                      </label>

                      <label className="space-y-1.5 text-xs font-black text-slate-600">
                        وقت الظهور
                        <select
                          value={quote.category}
                          onChange={(e) =>
                            updateQuote(quote.id, {
                              category: e.target.value as SpiritualQuote["category"],
                            })
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                        >
                          {Object.entries(categoryLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 block space-y-1.5 text-xs font-black text-slate-600">
                      النص
                      <textarea
                        value={quote.text}
                        onChange={(e) => updateQuote(quote.id, { text: e.target.value })}
                        rows={3}
                        placeholder="اكتب الآية أو الحديث أو الحكمة..."
                        className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold leading-8 text-slate-900 outline-none focus:border-[#b99755]"
                        style={{ fontFamily: "'Amiri', serif" }}
                      />
                    </label>

                    <label className="mt-3 block space-y-1.5 text-xs font-black text-slate-600">
                      المصدر
                      <input
                        value={quote.source}
                        onChange={(e) => updateQuote(quote.id, { source: e.target.value })}
                        placeholder="مثال: سورة آل عمران / رواه البخاري"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#b99755]"
                      />
                    </label>
                  </article>
                ))}

                <button
                  type="button"
                  onClick={addQuote}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#b99755]/35 bg-[#b99755]/5 py-4 text-sm font-black text-[#8b6b23] hover:bg-[#b99755]/10"
                >
                  <Plus size={18} /> إضافة نفحة جديدة
                </button>
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#d8c79e]/35 bg-white px-5 py-4 md:px-7">
                <button
                  type="button"
                  onClick={() => setShowManager(false)}
                  className="rounded-xl px-5 py-3 text-sm font-black text-slate-500 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveQuotes}
                  disabled={saving}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-[#0d5b46] px-6 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  حفظ التغييرات
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
