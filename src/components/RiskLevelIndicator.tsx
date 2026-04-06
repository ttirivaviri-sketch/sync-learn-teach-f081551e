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

const RISK_CONFIG: Record<RiskLevel, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  on_track: {
    label: "On Track",
    emoji: "OT",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  needs_attention: {
    label: "Needs Attention",
    emoji: "NA",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  at_risk: {
    label: "At Risk",
    emoji: "AR",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
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

  // No exam date set = default to needs_attention
  if (daysUntilExam === null) return "needs_attention";

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
    return (
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${config.bgColor} ${config.borderColor} ${config.color}`}
      >
        {config.emoji} {config.label}
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
          {config.emoji} {subject}: {config.label}
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
  const onTrack = risks.filter((r) => r.riskLevel === "on_track");

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-foreground">Subject Risk Levels</h4>
      <div className="flex flex-wrap gap-1.5">
        {risks
          .sort((a, b) => {
            const order: Record<RiskLevel, number> = { at_risk: 0, needs_attention: 1, on_track: 2 };
            return order[a.riskLevel] - order[b.riskLevel];
          })
          .map((risk) => (
            <RiskLevelIndicator
              key={risk.subject}
              subject={risk.subject}
              riskLevel={risk.riskLevel}
              daysUntilExam={risk.daysUntilExam}
              averageScore={risk.averageScore}
              compact
            />
          ))}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {atRisk.length > 0 && (
          <span className="text-red-600 font-medium">{atRisk.length} at risk</span>
        )}
        {atRisk.length > 0 && needsAttention.length > 0 && " | "}
        {needsAttention.length > 0 && (
          <span className="text-yellow-600">{needsAttention.length} need attention</span>
        )}
        {(atRisk.length > 0 || needsAttention.length > 0) && onTrack.length > 0 && " | "}
        {onTrack.length > 0 && (
          <span className="text-green-600">{onTrack.length} on track</span>
        )}
      </div>
    </div>
  );
}
