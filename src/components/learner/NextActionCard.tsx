/**
 * NextActionCard — the universal "do this next" surface for learners.
 * Single source: useNextAction → learning-next-action edge function.
 */
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, AlertTriangle, BookOpen, GraduationCap, TrendingUp, FileText, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNextAction, type NextAction } from "@/hooks/useNextAction";
import { haptic } from "@/lib/haptics";

const ICON: Record<NextAction["kind"], typeof Sparkles> = {
  remediate: AlertTriangle,
  practice: BookOpen,
  advance: TrendingUp,
  homework: FileText,
  lesson_recap: PlayCircle,
  onboard: GraduationCap,
};

const TONE: Record<NextAction["kind"], string> = {
  remediate: "from-destructive/20 to-destructive/5 border-destructive/30",
  practice: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  advance: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  homework: "from-primary/20 to-primary/5 border-primary/30",
  lesson_recap: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  onboard: "from-muted to-background border-border",
};

import { usePlanRebalance } from "@/hooks/usePlanRebalance";

export function NextActionCard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useNextAction(session?.user?.id);
  usePlanRebalance(session?.user?.id);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-9 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  const primary = data?.primary;
  if (!primary) return null;
  const Icon = ICON[primary.kind] ?? Sparkles;

  const go = (a: NextAction) => {
    haptic("medium");
    if (a.route) navigate(a.route);
  };

  const secondary = (data?.actions ?? []).filter((a) => a !== primary).slice(0, 3);

  return (
    <Card className={`bg-gradient-to-br ${TONE[primary.kind]} border shadow-sm overflow-hidden animate-fade-in`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background/60 text-[10px] font-semibold uppercase tracking-wide">
            <Sparkles className="h-3 w-3 mr-1" />Next for you
          </Badge>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-background/70 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">{primary.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{primary.reason}</div>
          </div>
        </div>
        <Button onClick={() => go(primary)} className="w-full active:scale-[0.98] transition-transform" size="sm">
          {primary.cta ?? "Start now"} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        {secondary.length > 0 && (
          <div className="pt-1 border-t border-border/40 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Also queued</div>
            {secondary.map((a, i) => {
              const SubIcon = ICON[a.kind] ?? Sparkles;
              return (
                <button
                  key={i}
                  onClick={() => go(a)}
                  className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-background/60 active:scale-[0.98] transition-all"
                >
                  <SubIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{a.title}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
