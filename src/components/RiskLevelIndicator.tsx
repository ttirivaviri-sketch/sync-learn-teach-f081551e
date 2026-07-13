import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RiskLevel, SubjectRisk, SubjectExamDate } from "@/types/academicProfile";

interface RiskLevelIndicatorProps {
  subject: string;
  riskLevel: RiskLevel;
  daysUntilExam?: number | null;
  averageScore?: number | null;
  compact?: boolean;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; dotColor: string; color: string; bgColor: string; borderColor: string }> = {
  on_track: {
    label: "On track",
    dotColor: "bg-green-500",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-50 dark:bg-green-950/40",
    borderColor: "border-green-200 dark:border-green-800",
  },
  needs_attention: {
    label: "Needs attention",
    dotColor: "bg-amber-500",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  at_risk: {
    label: "At risk",
    dotColor: "bg-red-500",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800",
  },
};

/**
 * Calculate risk level for a subject based on exam proximity and performance.
 */
export function calculateRiskLevel(params: {
  daysUntilExam: number | null;
  averageScore: number | null;
  tasksCompleted: number;
  tasksMissed: number;
}): RiskLevel {
  const { daysUntilExam, averageScore, tasksCompleted, tasksMissed } = params;

  // No exam date set: judge on activity alone rather than blanket-flagging
  // every subject as "needs attention" (which made all pills identical).
  if (daysUntilExam === null) {
    const cr =
      tasksCompleted + tasksMissed > 0
        ? tasksCompleted / (tasksCompleted + tasksMissed)
        : null;
    if (averageScore !== null && averageScore < 40) return "at_risk";
    if ((averageScore !== null && averageScore < 60) || (cr !== null && cr < 0.4))
      return "needs_attention";
    return "on_track";
  }

  const completionRate =
    tasksCompleted + tasksMissed > 0
      ? tasksCompleted / (tasksCompleted + tasksMissed)
      : 0;

  const score = averageScore ?? 0;

  // At Risk: exam soon + low score or low completion
  if (daysUntilExam <= 14 && (score < 50 || completionRate < 0.3)) return "at_risk";
  if (daysUntilExam <= 30 && score < 40) return "at_risk";
  if (completionRate < 0.2 && daysUntilExam <= 60) return "at_risk";

  // Needs Attention: moderate concern
  if (daysUntilExam <= 30 && (score < 60 || completionRate < 0.5)) return "needs_attention";
  if (daysUntilExam <= 60 && score < 50) return "needs_attention";
  if (completionRate < 0.4) return "needs_attention";

  return "on_track";
}

/**
 * Build risk assessments for each subject using exam dates and activity data.
 */
export function buildSubjectRisks(params: {
  subjects: string[];
  examDates: SubjectExamDate[];
  activitySummary: Record<string, { tasksCompleted: number; tasksMissed: number; avgScore: number }>;
}): SubjectRisk[] {
  const { subjects, examDates, activitySummary } = params;
  const now = new Date();

  return subjects.map((subject) => {
    const examEntry = examDates.find((e) => e.subject === subject);
    const daysUntilExam = examEntry
      ? Math.ceil((new Date(examEntry.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const activity = activitySummary[subject] || {
      tasksCompleted: 0,
      tasksMissed: 0,
      avgScore: 0,
    };

    const riskLevel = calculateRiskLevel({
      daysUntilExam,
      averageScore: activity.avgScore || null,
      tasksCompleted: activity.tasksCompleted,
      tasksMissed: activity.tasksMissed,
    });

    const indicatorMap: Record<RiskLevel, string> = {
      on_track: "[OK]",
      needs_attention: "[!!]",
      at_risk: "[XX]",
    };

    return {
      subject,
      riskLevel,
      indicator: indicatorMap[riskLevel],
      daysUntilExam,
      averageScore: activity.avgScore || null,
      tasksCompleted: activity.tasksCompleted,
      tasksMissed: activity.tasksMissed,
    };
  });
}

export function RiskLevelIndicator({
  subject,
  riskLevel,
  daysUntilExam,
  averageScore,
  compact = false,
}: RiskLevelIndicatorProps) {
  const config = RISK_CONFIG[riskLevel];

  if (compact) {
    // Always name the subject — a bare tier label ("Needs attention") six
    // times in a row tells the student nothing.
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 gap-1 ${config.bgColor} ${config.borderColor} ${config.color}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor}`} />
        <span className="font-semibold">{subject}</span>
        <span className="opacity-80">· {config.label}</span>
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className={`text-xs px-2 py-0.5 ${config.bgColor} ${config.borderColor} ${config.color}`}
        >
          <span className={`h-2 w-2 rounded-full inline-block mr-1 ${config.dotColor}`} />
          {subject}: {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">{subject} - {config.label}</p>
          {daysUntilExam !== null && daysUntilExam !== undefined && (
            <p>{daysUntilExam} days until exam</p>
          )}
          {averageScore !== null && averageScore !== undefined && (
            <p>Average score: {averageScore}%</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function RiskLevelSummary({ risks }: { risks: SubjectRisk[] }) {
  if (risks.length === 0) return null;

  const atRisk = risks.filter((r) => r.riskLevel === "at_risk");
  const needsAttention = risks.filter((r) => r.riskLevel === "needs_attention");

  // Header counter: surface the most urgent tier (mockup: "2 need attention")
  const headerNote =
    atRisk.length > 0
      ? { text: `${atRisk.length} at risk`, cls: "text-red-600 dark:text-red-400" }
      : needsAttention.length > 0
        ? { text: `${needsAttention.length} need attention`, cls: "text-amber-600 dark:text-amber-400" }
        : { text: "All on track", cls: "text-green-600 dark:text-green-400" };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Subject risk levels</h4>
        <span className={`text-xs font-medium ${headerNote.cls}`}>{headerNote.text}</span>
      </div>
      {/* Full-width tinted rows — subject left, tier right (mockup p.10) */}
      <div className="space-y-1.5">
        {risks.map((risk) => {
          const config = RISK_CONFIG[risk.riskLevel];
          return (
            <Tooltip key={risk.subject}>
              <TooltipTrigger asChild>
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${config.bgColor}`}>
                  <span className={`text-sm font-medium ${config.color}`}>{risk.subject}</span>
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p className="font-medium">{risk.subject} - {config.label}</p>
                  {risk.daysUntilExam !== null && <p>{risk.daysUntilExam} days until exam</p>}
                  {risk.averageScore !== null && <p>Average score: {risk.averageScore}%</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
