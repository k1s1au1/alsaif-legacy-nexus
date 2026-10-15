import type { CSSProperties } from "react";
import { ListChecks, Plane, Users, Wallet } from "lucide-react";
import "./family-stats-strip.css";

type Props = {
  balance: number;
  members: number;
  trips: number;
  tasks: number;
  className?: string;
};

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const format = (value: number) => number.format(Number.isFinite(value) ? value : 0);

/** A shared, non-interactive summary of the existing dashboard data. */
export function FamilyStatsStrip({ balance, members, trips, tasks, className = "" }: Props) {
  const amount = format(balance);
  const metrics = [
    { key: "tasks", label: "مهام قيد التنفيذ", value: tasks, unit: tasks === 1 ? "مهمة" : "مهام", icon: ListChecks },
    { key: "members", label: "أفراد العائلة", value: members, unit: "عضو", icon: Users },
    { key: "trips", label: "ترفيه عائلي", value: trips, unit: trips === 1 ? "وجهة" : "وجهات", icon: Plane },
  ];

  return (
    <section className={`family-stats-strip ${className}`} dir="rtl" aria-label="إحصائيات العائلة" data-stats-mode="display-only">
      <div className="family-stats-strip__layout">
        <div className="family-stats-strip__fund" style={{ "--balance-characters": Math.max(amount.length, 7) } as CSSProperties}>
          <Wallet className="family-stats-strip__wallet" aria-hidden="true" />
          <dl>
            <dt>رصيد الصندوق</dt>
            <dd>
              <bdi dir="ltr">{amount}</bdi>
              <span>ر.س</span>
            </dd>
          </dl>
        </div>
        <dl className="family-stats-strip__metrics">
          {metrics.map(({ key, label, value, unit, icon: Icon }) => (
            <div key={key} className="family-stats-strip__metric" data-stat={key}>
              <dt>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </dt>
              <dd>
                <bdi dir="ltr" style={{ "--count-characters": Math.max(format(value).length, 3) } as CSSProperties}>{format(value)}</bdi>
                <span>{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
