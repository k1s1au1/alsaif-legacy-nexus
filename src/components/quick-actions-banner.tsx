import {
  MessageCircle,
  Ticket,
  CalendarDays,
  ListChecks,
  Newspaper,
  Trees,
  Wallet,
  History,
  Archive,
  Users,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useEffect } from "react";
import { Link } from "@tanstack/react-router";

interface QuickActionProps {
  to: string;
  label: string;
  icon: any;
  color: string;
}

function QuickAction({ to, label, icon, color }: QuickActionProps) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-3 shrink-0 focus:outline-none">
      <div
        className={cn(
          "size-14 md:size-16 rounded-[24px] flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1.5",
          "shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-2xl relative overflow-hidden",
          color,
        )}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {React.cloneElement(icon, { size: 28, strokeWidth: 1.5 })}
      </div>
      <span className="text-[11px] md:text-[13px] font-black text-primary/80 group-hover:text-primary transition-colors whitespace-nowrap tracking-tight text-center">
        {label}
      </span>
    </Link>
  );
}

export function QuickActionsBanner() {
  useEffect(() => {
    // The dashboard hero lives immediately above this component. Tag it so the
    // responsive treatment stays isolated to mobile/tablet and desktop remains untouched.
    const candidates = Array.from(document.querySelectorAll<HTMLDivElement>("div"));
    const hero = candidates.find((el) => el.classList.contains("bg-[#051410]"));
    if (!hero) return;

    hero.classList.add("alsaif-mobile-hero");

    const layout = Array.from(hero.children).find(
      (el) => el instanceof HTMLDivElement && el.classList.contains("z-10"),
    ) as HTMLDivElement | undefined;
    layout?.classList.add("alsaif-mobile-hero-layout");

    const medallion = layout?.children?.[0] as HTMLElement | undefined;
    medallion?.classList.add("alsaif-mobile-hero-medallion");

    const identity = layout?.children?.[1] as HTMLElement | undefined;
    identity?.classList.add("alsaif-mobile-hero-identity");

    return () => {
      hero.classList.remove("alsaif-mobile-hero");
      layout?.classList.remove("alsaif-mobile-hero-layout");
      medallion?.classList.remove("alsaif-mobile-hero-medallion");
      identity?.classList.remove("alsaif-mobile-hero-identity");
    };
  }, []);

  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .alsaif-mobile-hero {
            width: 100% !important;
            min-height: 0 !important;
            border-radius: 28px !important;
            box-shadow: 0 18px 50px -24px rgba(0, 0, 0, 0.72) !important;
            overflow: hidden !important;
          }

          .alsaif-mobile-hero-layout {
            min-height: 250px !important;
            padding: 24px 22px !important;
            gap: 18px !important;
            flex-direction: column !important;
            justify-content: center !important;
          }

          .alsaif-mobile-hero-medallion > div > div:nth-child(2) {
            width: 104px !important;
            height: 104px !important;
          }

          .alsaif-mobile-hero-medallion > div > div:nth-child(2) > div {
            padding: 12px !important;
          }

          .alsaif-mobile-hero-identity {
            width: 100% !important;
            text-align: center !important;
          }

          .alsaif-mobile-hero-identity > div {
            gap: 12px !important;
          }

          .alsaif-mobile-hero-identity h2 {
            font-size: clamp(2rem, 8vw, 3.25rem) !important;
            line-height: 1.05 !important;
            margin: 0 !important;
          }

          .alsaif-mobile-hero-identity p {
            max-width: 100% !important;
          }
        }

        @media (max-width: 599px) {
          .alsaif-mobile-hero {
            border-radius: 24px !important;
          }

          .alsaif-mobile-hero-layout {
            min-height: 220px !important;
            padding: 20px 16px !important;
            gap: 14px !important;
          }

          .alsaif-mobile-hero-medallion > div > div:nth-child(2) {
            width: 88px !important;
            height: 88px !important;
          }

          .alsaif-mobile-hero-identity h2 {
            font-size: clamp(1.9rem, 9vw, 2.65rem) !important;
          }

          .alsaif-mobile-hero-identity .h-8 {
            height: auto !important;
            min-height: 28px !important;
          }

          .alsaif-mobile-hero-identity .text-lg {
            font-size: 0.9rem !important;
            line-height: 1.45 !important;
          }
        }
      `}</style>

      <section className="animate-fade-up w-full px-4 md:px-0 py-8 hidden md:block">
        <div className="flex items-center justify-center gap-4 mb-10 opacity-30">
          <div className="h-[1px] w-12 bg-primary" />
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">
            الوصول السريع للمجلس
          </h3>
          <div className="h-[1px] w-12 bg-primary" />
        </div>

        {/* Desktop: Centered Row of Actions */}
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 px-4 pb-4">
          <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-[#065F46]" />
          <QuickAction to="/trips" label="ترفيه" icon={<Ticket />} color="bg-[#D4AF37]" />
          <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-[#1B3022]" />
          <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-[#947D4C]" />
          <QuickAction to="/majlis" label="الأخبار" icon={<Newspaper />} color="bg-[#064E3B]" />
          <QuickAction to="/community" label="ركن الأعضاء" icon={<Users />} color="bg-[#3D8557]" />
          <QuickAction to="/archive" label="الألبوم" icon={<Archive />} color="bg-[#C5A87C]" />
          <QuickAction to="/heritage" label="الإرث" icon={<History />} color="bg-[#8E7745]" />
          <QuickAction to="/family-tree" label="شجرة العائلة" icon={<Trees />} color="bg-[#153221]" />
          <QuickAction to="/vault" label="الخزنة" icon={<Lock />} color="bg-[#7c2d12]" />
          <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-[#BF953F]" />
        </div>
      </section>
    </>
  );
}
