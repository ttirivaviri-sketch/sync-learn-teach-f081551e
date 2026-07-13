/**
 * HomeTodayHero — Home owns "today". Matches UI spec page 3 mockup:
 *   1. Large greeting ("Morning, Ashlie" / "Let's clear today's N things")
 *   2. Full-width gradient streak hero: 🔥 N day streak · XP earned, with a
 *      ring on the right showing today's task completion (e.g. 2/3)
 *   3. TODAY agenda — one item per source, colour-coded left borders:
 *      red = school homework, blue = study plan, dark card + Join = tutor session
 *   4. Caption: "Full booking history and cancellations live in Activity."
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flame, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProgress } from "@/studymode/hooks/useUserProgress";
import { useMySchoolMemberships } from "@/hooks/useSchools";
import { useStudentTodayFeed } from "@/hooks/useSchoolAcademics";
import { haptic } from "@/lib/haptics";

interface HomeTodayHeroProps {
  displayName?: string | null;
  upcomingBookings?: any[];
  onOpenStudy: () => void;
  onOpenActivity: () => void;
}

function useTodayStudyTasks() {
  return useQuery({
    queryKey: ["home-today-study-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { total: 0, done: 0, next: null as null | { topic_name: string; task_type: string } };
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("study_schedule")
        .select("id, topic_name, task_type, is_completed")
        .eq("user_id", user.id)
        .eq("scheduled_date", today);
      const rows = data ?? [];
      const done = rows.filter((r: any) => r.is_completed).length;
      const next = rows.find((r: any) => !r.is_completed) ?? null;
      return { total: rows.length, done, next };
    },
    staleTime: 60_000,
  });
}

/** Small ring showing done/total for the gradient hero (white on primary). */
function TasksRing({ done, total }: { done: number; total: number }) {
  const size = 52;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-white/25" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
          strokeLinecap="round" stroke="white"
          strokeDasharray={`${pct * circumference} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {done}/{Math.max(total, 1)}
      </span>
    </div>
  );
}

export function HomeTodayHero({
  displayName,
  upcomingBookings = [],
  onOpenStudy,
  onOpenActivity,
}: HomeTodayHeroProps) {
  const navigate = useNavigate();
  const { progress } = useUserProgress();
  const studyTasks = useTodayStudyTasks();

  const memberships = useMySchoolMemberships();
  const studentMembership = (memberships.data ?? []).find(
    (m) => m.membership.role === "school_student"
  );
  const schoolFeed = useStudentTodayFeed(studentMembership?.school.id);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const firstName = (displayName || "").trim().split(" ")[0];

  // ── TODAY agenda — max one item per source, mockup card styles ────────────
  const hw = schoolFeed.data?.assignments?.[0] ?? schoolFeed.data?.quizzes?.[0];
  const study = studyTasks.data?.next;
  const lesson = upcomingBookings[0];

  const thingsCount = useMemo(
    () => [hw, study, lesson].filter(Boolean).length,
    [hw, study, lesson]
  );

  return (
    <div className="space-y-3">
      {/* 1 — Greeting (large, not in a card) */}
      <div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {thingsCount > 0
            ? `Let's clear today's ${thingsCount} thing${thingsCount === 1 ? "" : "s"}`
            : "You're all caught up for today"}
        </p>
      </div>

      {/* 2 — Gradient streak hero with task-completion ring */}
      <div className="rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md"
        style={{ background: "linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))" }}>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <Flame className="h-5 w-5 text-orange-300 self-center shrink-0" />
            <span className="text-2xl font-extrabold text-white leading-none">{progress?.streak ?? 0}</span>
            <span className="text-sm font-medium text-white/85">day streak</span>
          </div>
          <p className="text-xs text-white/70 mt-1">
            {(progress?.xp ?? 0).toLocaleString()} XP earned
          </p>
        </div>
        <TasksRing done={studyTasks.data?.done ?? 0} total={studyTasks.data?.total ?? 0} />
      </div>

      {/* 3 — TODAY agenda */}
      {thingsCount > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Today
          </p>
          <div className="space-y-2">
            {/* School homework — red left border */}
            {hw && studentMembership && (
              <button
                onClick={() => { haptic("light"); navigate(`/school/${studentMembership.school.id}/learn`); }}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border border-l-4 border-l-red-500 px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{(hw as any).title}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {studentMembership.school.name}
                    {(hw as any).due_at ? ` · ${new Date((hw as any).due_at).toLocaleTimeString("en-ZA", { hour: "numeric", minute: "2-digit" })}` : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              </button>
            )}

            {/* Study plan — blue left border */}
            {study && (
              <button
                onClick={() => { haptic("light"); onOpenStudy(); }}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border border-l-4 border-l-blue-500 px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">Continue {study.topic_name}</span>
                  <span className="block text-xs text-muted-foreground truncate capitalize">
                    {(study.task_type || "study task").replace(/-/g, " ")}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              </button>
            )}

            {/* Tutor session — dark card with Join pill */}
            {lesson && (
              <button
                onClick={() => { haptic("light"); onOpenActivity(); }}
                className="w-full flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-800 px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.99]"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">
                    Tutor session with {lesson.tutor_profile?.full_name?.split(" ")[0] || "your tutor"}
                  </span>
                  <span className="block text-xs text-white/60 truncate">
                    {lesson.tutor_subjects?.subject || "Lesson"} · {new Date(lesson.scheduled_at).toLocaleString("en-ZA", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-bold text-white">
                  Join
                </span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Full booking history and cancellations live in Activity.
          </p>
        </div>
      )}
    </div>
  );
}
