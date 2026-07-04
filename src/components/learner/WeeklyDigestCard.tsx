/**
 * WeeklyDigestCard — 7-day learner rollup pulled from learner_weekly_digest.
 * Shown on the learner Home tab.
 */
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, AlertTriangle, Award } from "lucide-react";
import { useLearnerWeeklyDigest } from "@/hooks/useLearnerWeeklyDigest";
import { useAuth } from "@/hooks/useAuth";

export function WeeklyDigestCard() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { data, isLoading } = useLearnerWeeklyDigest(userId);

  if (!userId) return null;
  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  if (!data || data.events_7d === 0) return null;

  return (
    <Card className="p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Your week at a glance</h3>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Stat label="Sessions" value={data.events_7d} />
        <Stat label="Avg score" value={data.avg_score_7d != null ? `${Math.round(data.avg_score_7d)}%` : "—"} />
        <Stat label="Mastered" value={data.topics_mastered} icon={Award} tone="text-emerald-600" />
        <Stat label="At risk" value={data.topics_at_risk} icon={AlertTriangle} tone="text-destructive" />
      </div>
      {(data.top_strength || data.top_struggle) && (
        <div className="text-xs space-y-1 border-t pt-2">
          {data.top_strength && (
            <div className="flex items-center gap-2"><TrendingUp className="h-3 w-3 text-emerald-600" /><span className="text-muted-foreground">Strongest:</span> <span className="font-medium">{data.top_strength}</span></div>
          )}
          {data.top_struggle && (
            <div className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-destructive" /><span className="text-muted-foreground">Focus on:</span> <span className="font-medium">{data.top_struggle}</span></div>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon?: any; tone?: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold flex items-center justify-center gap-1 ${tone ?? ""}`}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
