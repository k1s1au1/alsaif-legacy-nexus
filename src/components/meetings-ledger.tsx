import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/day-lifecycle";
import {
  formatMeetingDate,
  MEETING_LOCALE,
  type Attendee,
  type Meeting,
  type ProfileLite,
  type Rsvp,
} from "@/lib/meetings-ledger";
import { UserAvatar } from "@/components/user-avatar";
import { MeetingPresentations } from "@/components/meeting-presentations";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { addToCalendar } from "@/lib/calendar";
import { FamilySharing } from "@/lib/native-bridge";
import "./meetings-ledger.css";

type LedgerProps = {
  upcoming: Meeting[];
  previous: Meeting[];
  attendees: Attendee[];
  profiles: Record<string, ProfileLite>;
  userId: string | null;
  canManage: boolean;
  ready: boolean;
  loading: boolean;
  savingRsvp: string | null;
  onCreate: () => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
  onRsvp: (id: string, rsvp: Rsvp, companions?: number) => void;
  onRemind: (meeting: Meeting) => void;
  onShowMinutes: (meeting: Meeting) => void;
};

function DateTile({ meeting, featured = false }: { meeting: Meeting; featured?: boolean }) {
  const date = formatMeetingDate(meeting.scheduled_at);
  return (
    <time
      dateTime={meeting.scheduled_at}
      className={cn("meeting-ledger-date", featured && "is-featured")}
    >
      <span>
        {date.month} {date.year}
      </span>
      <strong>{date.day}</strong>
      <span>{date.weekday}</span>
    </time>
  );
}

function MeetingMeta({ meeting }: { meeting: Meeting }) {
  const date = formatMeetingDate(meeting.scheduled_at);
  return (
    <div className="meeting-ledger-meta">
      <span>
        <CalendarDays size={17} aria-hidden="true" />
        {date.time}
      </span>
      <span>
        <MapPin size={17} aria-hidden="true" />
        {meeting.location || "المكان يحدّد لاحقًا"}
      </span>
    </div>
  );
}

function AttendancePreview({
  attendees,
  profiles,
}: {
  attendees: Attendee[];
  profiles: Record<string, ProfileLite>;
}) {
  const going = attendees.filter((attendee) => attendee.rsvp === "going");
  const visible = going.slice(0, 3);
  const total = going.reduce((sum, attendee) => sum + 1 + (attendee.companions_count || 0), 0);
  return (
    <div className="meeting-ledger-attendance">
      <span>
        {total > 0 ? `${total} من أفراد العائلة سيحضرون` : "بانتظار تأكيد حضور أفراد العائلة"}
      </span>
      {visible.length > 0 && (
        <div className="meeting-ledger-avatars" aria-label={`${going.length} عضوًا أكدوا الحضور`}>
          {visible.map((attendee) => {
            const profile = profiles[attendee.user_id];
            const name = profile?.arabic_name || profile?.full_name || "عضو العائلة";
            return (
              <div key={attendee.user_id} className="meeting-ledger-avatar" title={name}>
                <UserAvatar
                  name={name}
                  path={profile?.avatar_url}
                  className="size-full object-cover"
                />
              </div>
            );
          })}
          {going.length > visible.length && (
            <span className="meeting-ledger-avatar meeting-ledger-more" dir="ltr">
              +{going.length - visible.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RsvpControls({
  meeting,
  attendees,
  userId,
  ready,
  saving,
  onRsvp,
  compact = false,
}: {
  meeting: Meeting;
  attendees: Attendee[];
  userId: string | null;
  ready: boolean;
  saving: boolean;
  onRsvp: LedgerProps["onRsvp"];
  compact?: boolean;
}) {
  const mine = attendees.find((attendee) => attendee.user_id === userId);
  const [showChoices, setShowChoices] = useState(false);
  const [companionsDraft, setCompanionsDraft] = useState<string | null>(null);
  const companions = mine?.companions_count || 0;
  const value = companionsDraft ?? String(companions);
  const saveCompanions = () => {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    if (count !== companions) onRsvp(meeting.id, "going", count);
    setCompanionsDraft(null);
  };
  return (
    <div className={cn("meeting-ledger-rsvp", compact && "is-compact")}>
      {compact && !showChoices ? (
        <button
          type="button"
          className={cn("meeting-ledger-response", mine?.rsvp === "not_going" && "is-declined")}
          disabled={!ready || saving}
          onClick={() => setShowChoices(true)}
          aria-label={`تغيير رد الحضور: ${meeting.title}`}
        >
          {saving ? (
            <Loader2 size={17} className="animate-spin" />
          ) : mine?.rsvp === "not_going" ? (
            <XCircle size={17} />
          ) : mine?.rsvp === "going" ? (
            <CheckCircle2 size={17} />
          ) : (
            <Users size={17} />
          )}
          {mine?.rsvp === "going"
            ? "سأحضر"
            : mine?.rsvp === "not_going"
              ? "أعتذر"
              : mine?.rsvp === "maybe"
                ? "ربما أحضر"
                : "تأكيد الحضور"}
        </button>
      ) : (
        <div
          className="meeting-ledger-rsvp-options"
          role="group"
          aria-label={`حضور ${meeting.title}`}
        >
          <button
            type="button"
            className={cn("meeting-ledger-going", mine?.rsvp === "going" && "is-selected")}
            aria-pressed={mine?.rsvp === "going"}
            disabled={!ready || saving}
            onClick={() => {
              onRsvp(meeting.id, "going", companions);
              setShowChoices(false);
            }}
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={18} />}
            سأحضر
          </button>
          <button
            type="button"
            className={cn("meeting-ledger-decline", mine?.rsvp === "not_going" && "is-selected")}
            aria-pressed={mine?.rsvp === "not_going"}
            disabled={!ready || saving}
            onClick={() => {
              onRsvp(meeting.id, "not_going");
              setShowChoices(false);
            }}
          >
            <XCircle size={18} />
            أعتذر
          </button>
        </div>
      )}
      {!compact && mine?.rsvp === "going" && (
        <label className="meeting-ledger-companions">
          <span>عدد المرافقين</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={value}
            aria-label={`عدد المرافقين في ${meeting.title}`}
            disabled={saving || !ready}
            onChange={(event) => setCompanionsDraft(event.target.value)}
            onBlur={saveCompanions}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
      )}
    </div>
  );
}

export function MeetingsLedger(props: LedgerProps) {
  const { upcoming, previous, attendees, profiles, userId, canManage, loading } = props;
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const nearest = upcoming[0];
  const currentList = tab === "upcoming" ? upcoming : previous;
  const visibleList = selectedDay
    ? currentList.filter((meeting) => localDayKey(meeting.scheduled_at) === selectedDay)
    : currentList;
  const selected = [...upcoming, ...previous].find((meeting) => meeting.id === selectedId);
  const isPrevious = selected ? previous.some((meeting) => meeting.id === selected.id) : false;
  const calendarMonth = month ?? new Date(currentList[0]?.scheduled_at || Date.now());
  const year = calendarMonth.getFullYear();
  const monthNumber = calendarMonth.getMonth();
  const firstWeekday = new Date(year, monthNumber, 1).getDay();
  const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
  const monthMeetings = currentList
    .filter((meeting) => {
      const date = new Date(meeting.scheduled_at);
      return date.getFullYear() === year && date.getMonth() === monthNumber;
    })
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const meetingDays = new Set(monthMeetings.map((meeting) => localDayKey(meeting.scheduled_at)));
  const meetingAttendees = (id: string) =>
    attendees.filter((attendee) => attendee.meeting_id === id);
  const rsvpProps = (meeting: Meeting) => ({
    meeting,
    attendees: meetingAttendees(meeting.id),
    userId,
    ready: props.ready,
    saving: props.savingRsvp === meeting.id,
    onRsvp: props.onRsvp,
  });
  const selectTab = (value: "upcoming" | "previous") => {
    setTab(value);
    setSelectedDay(null);
    setMonth(null);
  };
  const calendar = (
    <div className="meeting-ledger-calendar-content">
      <div className="meeting-ledger-calendar-heading">
        <button
          type="button"
          aria-label="الشهر السابق"
          onClick={() => {
            setMonth(new Date(year, monthNumber - 1, 1));
            setSelectedDay(null);
          }}
        >
          <ChevronRight size={18} />
        </button>
        <h3>{calendarMonth.toLocaleString(MEETING_LOCALE, { month: "long", year: "numeric" })}</h3>
        <button
          type="button"
          aria-label="الشهر التالي"
          onClick={() => {
            setMonth(new Date(year, monthNumber + 1, 1));
            setSelectedDay(null);
          }}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="meeting-ledger-calendar-grid" dir="ltr">
        {["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map((day) => (
          <span className="meeting-ledger-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`empty-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(year, monthNumber, index + 1);
          const key = localDayKey(date);
          const hasMeeting = meetingDays.has(key);
          const isSelected =
            selectedDay === key ||
            (!selectedDay && tab === "upcoming" && key === localDayKey(nearest?.scheduled_at));
          return (
            <button
              type="button"
              key={key}
              className={cn(hasMeeting && "has-meeting", isSelected && "is-selected")}
              aria-pressed={selectedDay === key}
              aria-current={key === localDayKey() ? "date" : undefined}
              aria-label={`${date.toLocaleDateString(MEETING_LOCALE, { day: "numeric", month: "long", year: "numeric" })}${hasMeeting ? "، يوجد اجتماع" : ""}`}
              onClick={() => {
                setSelectedDay(selectedDay === key ? null : key);
                setMobileCalendarOpen(false);
              }}
            >
              {index + 1}
              {hasMeeting && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="meeting-ledger-month-list">
        <h4>الاجتماعات في هذا الشهر</h4>
        {monthMeetings.length === 0 ? (
          <p>لا توجد لقاءات {tab === "upcoming" ? "قادمة" : "سابقة"} في هذا الشهر.</p>
        ) : (
          monthMeetings.map((meeting) => (
            <button
              type="button"
              key={meeting.id}
              onClick={() => {
                setMobileCalendarOpen(false);
                setSelectedId(meeting.id);
              }}
            >
              <strong>{formatMeetingDate(meeting.scheduled_at).day}</strong>
              <span>{meeting.title}</span>
              <i aria-hidden="true" />
            </button>
          ))
        )}
      </div>
      <Link to="/calendar" className="meeting-ledger-full-calendar">
        <CalendarDays size={19} />
        عرض تقويم الشهر الكامل
      </Link>
    </div>
  );

  return (
    <section className="meetings-ledger" dir="rtl" aria-label="دفتر اللقاءات العائلية">
      <header className="meeting-ledger-header">
        <h1>اجتماعات العائلة</h1>
        {canManage && (
          <button type="button" className="meeting-ledger-add" onClick={props.onCreate}>
            <Plus size={20} />
            إضافة اجتماع
          </button>
        )}
      </header>

      {loading && upcoming.length === 0 ? (
        <div className="meeting-ledger-loading" role="status">
          <Loader2 size={28} className="animate-spin" />
          <span>جارٍ تحميل اللقاءات…</span>
        </div>
      ) : nearest ? (
        <article className="meeting-ledger-featured" aria-label="الاجتماع القادم">
          <DateTile meeting={nearest} featured />
          <div className="meeting-ledger-featured-copy">
            <p className="meeting-ledger-kicker">الاجتماع القادم</p>
            <button
              type="button"
              className="meeting-ledger-title-button"
              onClick={() => setSelectedId(nearest.id)}
            >
              <h2>{nearest.title}</h2>
            </button>
            <MeetingMeta meeting={nearest} />
            <AttendancePreview attendees={meetingAttendees(nearest.id)} profiles={profiles} />
          </div>
          <RsvpControls key={nearest.id} {...rsvpProps(nearest)} />
        </article>
      ) : (
        <div className="meeting-ledger-empty-feature">
          <CalendarDays size={32} />
          <div>
            <h2>موعدنا القادم يبدأ من هنا</h2>
            <p>تظهر هنا تفاصيل أقرب اجتماع بعد جدولته.</p>
          </div>
          {canManage && (
            <button type="button" className="meeting-ledger-add" onClick={props.onCreate}>
              <Plus size={18} />
              جدولة لقاء
            </button>
          )}
        </div>
      )}

      <div className="meeting-ledger-layout">
        <div className="meeting-ledger-list-panel">
          <div className="meeting-ledger-tabs" role="tablist" aria-label="اللقاءات">
            <button
              type="button"
              id="meetings-upcoming-tab"
              role="tab"
              aria-controls="meetings-list"
              aria-selected={tab === "upcoming"}
              className={cn(tab === "upcoming" && "is-active")}
              onClick={() => selectTab("upcoming")}
            >
              القادمة <span>({upcoming.length})</span>
            </button>
            <button
              type="button"
              id="meetings-previous-tab"
              role="tab"
              aria-controls="meetings-list"
              aria-selected={tab === "previous"}
              className={cn(tab === "previous" && "is-active")}
              onClick={() => selectTab("previous")}
            >
              السابقة <span>({previous.length})</span>
            </button>
          </div>
          {selectedDay && (
            <button
              type="button"
              className="meeting-ledger-day-filter"
              onClick={() => setSelectedDay(null)}
            >
              <X size={16} />
              عرض جميع اللقاءات
            </button>
          )}
          <div
            id="meetings-list"
            role="tabpanel"
            aria-labelledby={tab === "upcoming" ? "meetings-upcoming-tab" : "meetings-previous-tab"}
            className="meeting-ledger-list"
            aria-busy={loading}
          >
            {visibleList.map((meeting) => (
              <article className="meeting-ledger-row" key={meeting.id}>
                <DateTile meeting={meeting} />
                <div className="meeting-ledger-row-copy">
                  <button
                    type="button"
                    className="meeting-ledger-title-button"
                    onClick={() => setSelectedId(meeting.id)}
                  >
                    <h3>{meeting.title}</h3>
                  </button>
                  <MeetingMeta meeting={meeting} />
                  <AttendancePreview attendees={meetingAttendees(meeting.id)} profiles={profiles} />
                </div>
                <div className="meeting-ledger-row-actions">
                  {tab === "upcoming" ? (
                    <RsvpControls key={meeting.id} {...rsvpProps(meeting)} compact />
                  ) : (
                    <span
                      className={cn(
                        "meeting-ledger-past-status",
                        meeting.status === "cancelled" && "is-cancelled",
                      )}
                    >
                      {meeting.status === "cancelled" ? "ملغي" : "منتهي"}
                    </span>
                  )}
                  <button
                    type="button"
                    className="meeting-ledger-details-button"
                    aria-label={`تفاصيل ${meeting.title}`}
                    onClick={() => setSelectedId(meeting.id)}
                  >
                    التفاصيل <ChevronLeft size={17} />
                  </button>
                </div>
              </article>
            ))}
            {!loading && visibleList.length === 0 && (
              <div className="meeting-ledger-empty">
                <CalendarDays size={30} />
                <h3>
                  {selectedDay
                    ? "لا توجد لقاءات في هذا اليوم"
                    : tab === "upcoming"
                      ? "لا توجد اجتماعات قادمة"
                      : "لا توجد اجتماعات سابقة"}
                </h3>
                <p>
                  {selectedDay
                    ? "اختر يومًا آخر أو اعرض جميع اللقاءات."
                    : tab === "upcoming"
                      ? "ستظهر اللقاءات هنا فور جدولتها."
                      : "اللقاءات المنتهية تظهر هنا للاطلاع على تفاصيلها ومحاضرها."}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="meeting-ledger-mobile-calendar"
            onClick={() => setMobileCalendarOpen(true)}
          >
            <CalendarDays size={20} />
            عرض تقويم الشهر الكامل
          </button>
        </div>
        <aside className="meeting-ledger-calendar" aria-label="تقويم الاجتماعات">
          {calendar}
        </aside>
      </div>

      <Dialog open={mobileCalendarOpen} onOpenChange={setMobileCalendarOpen}>
        <DialogContent className="meeting-ledger-calendar-dialog" dir="rtl">
          <DialogTitle>تقويم اللقاءات</DialogTitle>
          <DialogDescription>اختر يومًا لعرض لقاءاته.</DialogDescription>
          {calendar}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        {selected && (
          <DialogContent className="meeting-ledger-dialog" dir="rtl">
            <div className="meeting-ledger-dialog-header">
              <DateTile meeting={selected} />
              <div>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {formatMeetingDate(selected.scheduled_at).weekday}،{" "}
                  {formatMeetingDate(selected.scheduled_at).day}{" "}
                  {formatMeetingDate(selected.scheduled_at).month}{" "}
                  {formatMeetingDate(selected.scheduled_at).year}
                </DialogDescription>
                <MeetingMeta meeting={selected} />
              </div>
            </div>
            <div className="meeting-ledger-dialog-scroll">
              <section className="meeting-ledger-agenda">
                <h3>
                  <FileText size={18} />
                  جدول اللقاء
                </h3>
                <p>{selected.description || "لم يُضف جدول أعمال لهذا اللقاء بعد."}</p>
                {selected.duration_minutes != null && (
                  <span>
                    <Clock size={16} />
                    المدة: {selected.duration_minutes} دقيقة
                  </span>
                )}
              </section>
              {!isPrevious && <RsvpControls key={selected.id} {...rsvpProps(selected)} />}
              <section className="meeting-ledger-attendee-list">
                <h3>
                  <Users size={18} />
                  الحضور المؤكد
                </h3>
                <AttendancePreview attendees={meetingAttendees(selected.id)} profiles={profiles} />
                {meetingAttendees(selected.id)
                  .filter((attendee) => attendee.rsvp === "going")
                  .map((attendee) => (
                    <div key={attendee.user_id}>
                      <Check size={16} />
                      <span>
                        {profiles[attendee.user_id]?.arabic_name ||
                          profiles[attendee.user_id]?.full_name ||
                          "عضو العائلة"}
                      </span>
                      {(attendee.companions_count || 0) > 0 && (
                        <small>+{attendee.companions_count} مرافقين</small>
                      )}
                    </div>
                  ))}
              </section>
              <div className="meeting-ledger-dialog-actions">
                {selected.location_url && (
                  <a href={selected.location_url} target="_blank" rel="noopener noreferrer">
                    <MapPin size={18} />
                    فتح الموقع
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    addToCalendar({
                      title: selected.title,
                      description: selected.description || "",
                      location: selected.location || "",
                      startTime: selected.scheduled_at,
                    })
                  }
                >
                  <CalendarDays size={18} />
                  إضافة للتقويم
                </button>
                <button
                  type="button"
                  onClick={() =>
                    FamilySharing.shareInvitation({
                      title: selected.title,
                      date: `${formatMeetingDate(selected.scheduled_at).weekday} ${formatMeetingDate(selected.scheduled_at).day} ${formatMeetingDate(selected.scheduled_at).month}`,
                      location: selected.location || "المجلس",
                    })
                  }
                >
                  <Share2 size={18} />
                  مشاركة الدعوة
                </button>
                {selected.minutes && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      props.onShowMinutes(selected);
                    }}
                  >
                    <FileText size={18} />
                    محضر الاجتماع
                  </button>
                )}
              </div>
              <MeetingPresentations meetingId={selected.id} userId={userId} canManage={canManage} />
              {canManage && (
                <div className="meeting-ledger-management">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      props.onEdit(selected);
                    }}
                  >
                    <Pencil size={17} />
                    تعديل الاجتماع
                  </button>
                  {!isPrevious && (
                    <button type="button" onClick={() => props.onRemind(selected)}>
                      <Bell size={17} />
                      إرسال تذكير
                    </button>
                  )}
                  <button
                    type="button"
                    className="meeting-ledger-delete"
                    onClick={() => props.onDelete(selected.id)}
                  >
                    <Trash2 size={17} />
                    حذف الاجتماع
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
