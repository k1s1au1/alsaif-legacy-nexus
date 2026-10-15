const visitorNumber = new Intl.NumberFormat("en-US");

export function visitorCountLabel(count: number | null) {
  return count === null ? "" : `شرّف مجلسنا ${visitorNumber.format(count)} زائرًا`;
}

function VisitorOrnament() {
  return (
    <span className="council-visitor-ornament" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M8 0C7 5 5 7 0 8c5 1 7 3 8 8 1-5 3-7 8-8-5-1-7-3-8-8Z" fill="currentColor" />
      </svg>
    </span>
  );
}

/** The approved, quiet welcome ornament; the number comes from saved visits. */
export function CouncilVisitorCounter({ count }: { count: number | null }) {
  return (
    <div
      className="council-visitor-counter"
      dir="rtl"
      title="عدد الحسابات التي زارت المجلس؛ يُحسب الحساب مرة واحدة عبر أجهزته"
    >
      <VisitorOrnament />
      <span className="council-visitor-text">
        <span>شرّف مجلسنا</span>
        <bdi className="council-visitor-number" dir="ltr">
          {count === null ? "—" : visitorNumber.format(count)}
        </bdi>
        <span>زائرًا</span>
      </span>
      <VisitorOrnament />
    </div>
  );
}
