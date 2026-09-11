/**
 * TutorDashboardTab — bookings snapshot, message inbox and student progress.
 *
 * Composed into the tutor Home tab. Styling mirrors the learner app's
 * rounded card + chip language so both apps feel like one product.
 */
import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle, ChevronRight, CalendarClock, CheckCircle2, Hourglass,
  Users, FileText, Video, Clock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useTutorInbox } from "@/hooks/useTutorInbox";
import { logger } from "@/utils/logger";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";

interface Props {
  tutorId?: string;
  bookings: BookingRequest[];
  loading: boolean;
  onAccept: (b: BookingRequest) => void | Promise<void>;
  onDecline: (b: BookingRequest) => void | Promise<void>;
  onJoinSession: (b: BookingRequest) => void;
  onOpenChat: (learnerId: string, learnerName: string) => void;
  onOpenAllMessages?: () => void;
  onOpenBookings: (filter: "requested" | "confirmed" | "completed") => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
};

const countdown = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.round(hrs / 24)} days`;
};

interface StudentRow {
  id: string;
  name: string;
  subject: string;
  completed: number;
  upcoming: number;
  lastSession?: string;
  hasReport: boolean;
}

export const TutorDashboardTab = ({
  tutorId,
  bookings,
  loading,
  onAccept,
  onDecline,
  onJoinSession,
  onOpenChat,
  onOpenBookings,
}: Props) => {
  const { items: inbox, loading: inboxLoading } = useTutorInbox(tutorId);
  const [reportLearnerIds, setReportLearnerIds] = useState<Set<string>>(new Set());
  const [openStudent, setOpenStudent] = useState<StudentRow | null>(null);
  const [tick, setTick] = useState(0);

  // Re-render every minute so the next-session countdown stays honest.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!tutorId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("progress_reports")
          .select("learner_id")
          .eq("tutor_id", tutorId)
          .eq("audience", "tutor");
        setReportLearnerIds(new Set(((data as any[]) ?? []).map((r) => r.learner_id)));
      } catch (e) {
        logger.warn("progress report lookup failed", e);
      }
    })();
  }, [tutorId]);

  const pending = useMemo(() => bookings.filter((b) => b.status === "requested"), [bookings]);
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "confirmed" && new Date(b.scheduled_at).getTime() > Date.now() - 60 * 60000)
        .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)),
    [bookings, tick],
  );
  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return bookings.filter((b) => b.status === "completed" && +new Date(b.scheduled_at) >= weekAgo);
  }, [bookings]);

  const nextSession = upcoming[0];
  const joinable =
    nextSession &&
    Date.now() >= +new Date(nextSession.scheduled_at) - 15 * 60000 &&
    Date.now() < +new Date(nextSession.scheduled_at) + nextSession.duration_minutes * 60000;

  const students = useMemo<StudentRow[]>(() => {
    const map = new Map<string, StudentRow>();
    for (const b of bookings) {
      const existing = map.get(b.learner_id);
      const row: StudentRow = existing ?? {
        id: b.learner_id,
        name: b.learner_profile?.full_name || "Student",
        subject: b.tutor_subjects?.subject || "Tutoring",
        completed: 0,
        upcoming: 0,
        hasReport: reportLearnerIds.has(b.learner_id),
      };
      if (b.status === "completed") {
        row.completed += 1;
        if (!row.lastSession || +new Date(b.scheduled_at) > +new Date(row.lastSession)) {
          row.lastSession = b.scheduled_at;
        }
      }
      if (b.status === "confirmed" || b.status === "requested") row.upcoming += 1;
      row.hasReport = reportLearnerIds.has(b.learner_id);
      map.set(b.learner_id, row);
    }
    return [...map.values()].sort((a, b) => b.completed + b.upcoming - (a.completed + a.upcoming)).slice(0, 6);
  }, [bookings, reportLearnerIds]);

  const studentSessions = useMemo(
    () =>
      openStudent
        ? bookings
            .filter((b) => b.learner_id === openStudent.id)
            .sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at))
        : [],
    [openStudent, bookings],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Pending requests — act without leaving Home ── */}
      {pending.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Hourglass className="h-4 w-4 text-primary" /> Booking requests
            </h3>
            <Badge variant="secondary" className="text-[10px]">{pending.length}</Badge>
          </div>
          {pending.slice(0, 2).map((b) => (
            <div key={b.id} className="rounded-xl bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.learner_profile?.full_name || "Student"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.tutor_subjects?.subject} · {new Date(b.scheduled_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-primary shrink-0">R{b.price}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8" onClick={() => onAccept(b)}>Accept</Button>
                <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => onDecline(b)}>Decline</Button>
              </div>
            </div>
          ))}
          {pending.length > 2 && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onOpenBookings("requested")}>
              See all {pending.length} requests
            </Button>
          )}
        </section>
      )}

      {/* ── Next session ── */}
      {nextSession && (
        <section className="rounded-2xl p-4 shadow-md" style={{ background: "linear-gradient(135deg, hsl(258 70% 56%), hsl(243 65% 58%))" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-white/70">Next session</p>
              <h3 className="text-sm font-bold text-white truncate">
                {nextSession.learner_profile?.full_name || "Student"} · {nextSession.tutor_subjects?.subject}
              </h3>
              <p className="text-xs text-white/80 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {countdown(nextSession.scheduled_at)} · {nextSession.duration_minutes} min
              </p>
            </div>
            {joinable && (
              <Button size="sm" variant="secondary" className="gap-1 shrink-0" onClick={() => onJoinSession(nextSession)}>
                <Video className="h-3.5 w-3.5" /> Join
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ── Bookings snapshot ── */}
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Pending", value: pending.length, icon: <Hourglass className="h-4 w-4 text-amber-500" />, filter: "requested" as const },
          { label: "Upcoming", value: upcoming.length, icon: <CalendarClock className="h-4 w-4 text-primary" />, filter: "confirmed" as const },
          { label: "Done · 7d", value: completedThisWeek.length, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, filter: "completed" as const },
        ].map((tile) => (
          <button
            key={tile.label}
            onClick={() => onOpenBookings(tile.filter)}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:bg-muted/40"
          >
            {tile.icon}
            <p className="mt-1.5 text-xl font-bold leading-none">{tile.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{tile.label}</p>
          </button>
        ))}
      </section>

      {/* ── Messages ── */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-primary" /> Messages
          </h3>
          {inbox.length > 0 && (
            <button
              onClick={() => onOpenChat(inbox[0].learnerId, inbox[0].learnerName)}
              className="text-xs font-medium text-primary"
            >
              See all
            </button>
          )}
        </div>
        {inboxLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : inbox.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground">
            No messages yet. Students can message you once they book.
          </p>
        ) : (
          <div className="px-4 pb-2">
            {inbox.map((c) => (
              <button
                key={c.conversationId}
                onClick={() => onOpenChat(c.learnerId, c.learnerName)}
                className="flex w-full items-center gap-3 border-b border-border/50 py-3 last:border-0 text-left active:bg-muted/40"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={c.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">{c.learnerName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{c.learnerName}</p>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label={`${c.unread} unread`} />
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Student progress ── */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> My students
          </h3>
        </div>
        {students.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground">
            Students appear here once you have bookings with them.
          </p>
        ) : (
          <div className="px-4 pb-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => setOpenStudent(s)}
                className="flex w-full items-center gap-3 border-b border-border/50 py-3 last:border-0 text-left active:bg-muted/40"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{s.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.subject} · {s.completed} session{s.completed === 1 ? "" : "s"}
                    {s.lastSession ? ` · last ${new Date(s.lastSession).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {s.hasReport && <FileText className="h-4 w-4 text-primary shrink-0" />}
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Student detail ── */}
      <Sheet open={!!openStudent} onOpenChange={(o) => !o && setOpenStudent(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{openStudent?.name}</SheetTitle>
          </SheetHeader>
          {openStudent && (
            <div className="space-y-4 pb-6">
              <div className="flex gap-2 pt-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  {openStudent.subject}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  {openStudent.completed} completed
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  {openStudent.upcoming} upcoming
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => { onOpenChat(openStudent.id, openStudent.name); setOpenStudent(null); }}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Message
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  disabled={!openStudent.hasReport}
                  onClick={() => { onOpenBookings("completed"); setOpenStudent(null); }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {openStudent.hasReport ? "View report" : "No report yet"}
                </Button>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Session history
                </p>
                <div className="space-y-2">
                  {studentSessions.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.tutor_subjects?.subject || "Session"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{b.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
