import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, CalendarDays, ChevronLeft, Image as ImageIcon, ListChecks, Newspaper, Plane, Plus, Sparkles, Users, Wallet, Scroll } from "lucide-react";
import { useDashboardAnnouncements, useUpcomingEvents, useDashboardCounts, useFundBalance, useHeritageSnippet, useProfile } from "@/hooks/use-dashboard-data";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";

const fmtDate=(v?:string|null)=>{if(!v)return"بدون موعد";const d=new Date(v);return Number.isNaN(d.getTime())?"بدون موعد":d.toLocaleDateString("ar-SA",{weekday:"short",day:"numeric",month:"short"})};

export function DesktopDashboardExtras(){
 const path=useRouterState({select:s=>s.location.pathname});
 const {data:eventsData}=useUpcomingEvents();
 const {data:announcementsData}=useDashboardAnnouncements();
 const {data:counts}=useDashboardCounts();
 const {data:fundBalance}=useFundBalance();
 const {data:heritage}=useHeritageSnippet();
 const {data:profile}=useProfile();
 const logo=useSiteLogo();
 const [target,setTarget]=useState<Element|null>(null);
 useEffect(()=>{if(path!=="/dashboard"){setTarget(null);return}const find=()=>setTarget(document.querySelector(".max-w-6xl.mx-auto.space-y-12"));find();const id=window.setTimeout(find,120);return()=>window.clearTimeout(id)},[path]);
 const upcoming=useMemo(()=>{const rows:any[]=[];(eventsData?.meetings||[]).slice(0,3).forEach((x:any)=>rows.push({kind:"اجتماع",title:x.title,date:x.scheduled_at,icon:Users,to:"/meetings"}));(eventsData?.trips||[]).slice(0,3).forEach((x:any)=>rows.push({kind:"رحلة",title:x.title,date:x.start_date,icon:Plane,to:"/trips"}));return rows.sort((a,b)=>new Date(a.date||"9999-12-31").getTime()-new Date(b.date||"9999-12-31").getTime()).slice(0,4)},[eventsData]);
 const tasks=(eventsData?.tasks||[]).slice(0,4),latest=announcementsData?.[0];
 const name=profile?.realName||"عضو العائلة";
 if(path!=="/dashboard"||!target)return null;
 return createPortal(<div className="desktop-rebuild-root hidden lg:block" dir="rtl">
   <section className="desktop-hero-card">
     <div className="desktop-hero-logo">{logo?<img src={logo} alt="شعار العائلة"/>:<Sparkles size={42}/>}</div>
     <div className="desktop-hero-copy"><span>مساء الخير، يا أهل الوفاء</span><h1>{name}</h1><p>كل خطوة تخطونها تبني مجدًا للعائلة.</p></div>
   </section>

   <section className="desktop-main-grid">
     <div className="desktop-services-panel"><QuickActionsBanner /></div>
     <div className="desktop-follow-panel"><IntegratedHub upcomingMeetings={eventsData?.meetings||[]} upcomingTrips={eventsData?.trips||[]} upcomingTasks={eventsData?.tasks||[]} tasksCount={counts?.tasks||0}/></div>
   </section>

   <section className="desktop-command-grid">
    <div className="desktop-widget-card">
      <div className="desktop-widget-head"><div><CalendarDays/><span><b>تقويم العائلة</b><small>أقرب المواعيد القادمة</small></span></div><Link to="/meetings">عرض الكل</Link></div>
      <div className="desktop-list">{upcoming.length?upcoming.map((item:any,i:number)=>{const Icon=item.icon;return <Link key={i} to={item.to}><Icon/><span><b>{item.title}</b><small>{item.kind} · {fmtDate(item.date)}</small></span><ChevronLeft/></Link>}):<p className="desktop-empty">لا توجد مواعيد قريبة حاليًا</p>}</div>
    </div>
    <div className="desktop-widget-card">
      <div className="desktop-widget-head"><div><Plus/><span><b>إضافة سريعة</b><small>ابدأ أهم أعمال العائلة</small></span></div></div>
      <div className="desktop-quick-add">{[{to:"/family-occasions",label:"مناسبة",icon:Sparkles},{to:"/meetings",label:"اجتماع",icon:Users},{to:"/trips",label:"رحلة",icon:Plane},{to:"/tasks",label:"مهمة",icon:ListChecks}].map(x=>{const Icon=x.icon;return <Link key={x.label} to={x.to}><Icon/><span>إضافة {x.label}</span></Link>})}</div>
    </div>
    <div className="desktop-widget-card">
      <div className="desktop-widget-head"><div><ListChecks/><span><b>مهامي القادمة</b><small>ما يحتاج انتباهك الآن</small></span></div><Link to="/tasks">المهام</Link></div>
      <div className="desktop-list">{tasks.length?tasks.map((t:any)=><Link key={t.id} to="/tasks"><ListChecks/><span><b>{t.title}</b><small>{t.due_date?fmtDate(t.due_date):"بدون موعد"}</small></span><ChevronLeft/></Link>):<p className="desktop-empty">لا توجد مهام قادمة</p>}</div>
    </div>
   </section>

   <section className="desktop-stats-row">
    <Link to="/finance"><Wallet/><span>رصيد الصندوق</span><b>{Number(fundBalance||0).toLocaleString("ar-SA")} ر.س</b></Link>
    <Link to="/members"><Users/><span>أفراد العائلة</span><b>{counts?.members||0} عضو</b></Link>
    <Link to="/trips"><Plane/><span>الرحلات القادمة</span><b>{eventsData?.trips?.length||0} رحلة</b></Link>
    <Link to="/tasks"><ListChecks/><span>المهام</span><b>{counts?.tasks||0} مهمة</b></Link>
   </section>

   <section className="desktop-editorial-grid">
    <Link to="/majlis" className="desktop-news-card">{latest?.imageUrl&&<img src={latest.imageUrl} alt=""/>}<div><Newspaper/><span>آخر إعلان عائلي</span><h3>{latest?.title||"مركز أخبار العائلة"}</h3><p>{latest?.cleanBody||"تابع أخبار وإعلانات مجلس العائلة من مكان واحد."}</p></div></Link>
    <div className="desktop-side-stack">
      <Link to="/heritage" className="desktop-mini-card"><Scroll/><div><span>قبس من تاريخ السيف</span><b>{heritage?.title||"إرث العائلة"}</b><small>{heritage?.cleanBody||"تاريخنا يجمعنا."}</small></div></Link>
      <Link to="/archive" className="desktop-mini-card"><ImageIcon/><div><span>معرض العائلة</span><b>الصور والذكريات</b><small>افتح الألبومات المحفوظة</small></div><Archive/></Link>
    </div>
   </section>
 </div>,target)
}
