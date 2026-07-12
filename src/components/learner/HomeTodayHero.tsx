/**
 * HomeTodayHero — Home owns "today".
 *
 * Greeting + streak/XP hero, followed by a TODAY agenda that shows at most
 * one item per source (study plan, school homework, booked lesson) per the
 * UI spec. Each row deep-links to the surface that owns the work.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flame, Zap, ChevronRight, BookOpen, ClipboardList, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface AgendaItem {
  key: string;
  icon: typeof BookOpen;
  dotClass: string;
  title: string;
  source: string;
  onClick: () => void;
}

function useTodayStudyTask() {
  return useQuery({
    queryKey: ["home-today-study-task"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("study_schedule")
        .select("id, topic_name, task_type")
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .eq("is_completed", false)
        .limit(1);
      return data?.[0] ?? null;
    },
    staleTime: 60_000,
  });
}

export function HomeTodayHero({
  displayName,
  upcomingBookings = [],
  onOpenStudy,
  onOpenActivity,
}: HomeTodayHeroProps) {
  const navigate = useNavigate();
  const { progress } = useUserProgress();
  const studyTask = useTodayStudyTask();

  const memberships = useMySchoolMemberships();
  const studentMembership = (memberships.data ?? []).find(
    (m) => m.membership.role === "school_student"
  );
  const schoolFeed = useStudentTodayFeed(studentMembership?.school.id);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (displayName || "").trim().split(" ")[0];

  const agenda = useMemo(() => {
    const items: AgendaItem[] = [];

    // 1) Study plan — max one item
    if (studyTask.data) {
      items.push({
        key: "study",
        icon: BookOpen,
        dotClass: "bg-blue-500",
        title: studyTask.data.topic_name,
        source: "Study plan",
        onClick: () => { haptic("light"); onOpenStudy(); },
      });
    }

    // 2) School homework/quiz due — max one item
    const hw = schoolFeed.data?.assignments?.[0] ?? schoolFeed.data?.quizzes?.[0];
    if (hw && studentMembership) {
      items.push({
        key: "homework",
        icon: ClipboardList,
        dotClass: "bg-amber-500",
        title: (hw as any).title,
        source: "My School",
        onClick: () => {
          haptic("light");
          navigate(`/school/${studentMembership.school.id}/learn`);
        },
      });
    }

    // 3) Next booked lesson — max one item
    const lesson = upcomingBookings[0];
    if (lesson) {
      const tutorName = lesson.tutor_profile?.full_name || "Tutor";
      const when = new Date(lesson.scheduled_at).toLocaleString("en-ZA", {
        weekday: "short", hour: "2-digit", minute: "2-digit",
      });
      items.push({
        key: "lesson",
        icon: Video,
        dotClass: "bg-emerald-500",
        title: `${lesson.tutor_subjects?.subject || "Lesson"} with ${tutorName} · ${when}`,
        source: "Booked lesson",
        onClick: () => { haptic("light"); onOpenActivity(); },
      });
    }

    return items;
  }, [studyTask.data, schoolFeed.data, upcomingBookings, studentMembership, navigate, onOpenStudy, onOpenActivity]);

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-4 space-y-3">
        {/* Greeting + streak/XP hero */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {greeting}{firstName ? `, ${firstName}` : ""} 👋
            </h2>
            <p className="text-xs text-muted-foreground">Here's your day at a glance</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {progress?.streak ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">
                {(progress?.xp ?? 0).toLocaleString()} XP
              </span>
            </div>
          </div>
        </div>

        {/* TODAY agenda — max one item per source */}
        {agenda.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Today
            </p>
            <div className="space-y-1.5">
              {agenda.map((item) => (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 active:scale-[0.99]"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotClass}`} />
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{item.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.source}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
