import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Curriculum, GradeLevel } from "@/types/academicProfile";

const CURRENT_YEAR = new Date().getFullYear();
const EXAM_YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

interface SummaryStepProps {
  curriculum: Curriculum;
  grade: GradeLevel | "";
  subjects: string[];
  examYear: number | null;
  examDates: Record<string, Date>;
  studentEmail: string;
  guardianEmail: string;
  saving: boolean;
  onExamYearChange: (yr: number | null) => void;
  onBack: () => void;
  onSave: () => void;
  onSkip?: () => void;
}

export function SummaryStep({
  curriculum,
  grade,
  subjects,
  examYear,
  examDates,
  studentEmail,
  guardianEmail,
  saving,
  onExamYearChange,
  onBack,
  onSave,
  onSkip,
}: SummaryStepProps) {
  const setDateCount = Object.keys(examDates).filter((s) => subjects.includes(s)).length;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">When are your exams?</h2>
      <p className="text-xs text-muted-foreground">
        Optional exam year helps set countdown timers and prioritise revision.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {EXAM_YEARS.map((yr) => (
          <Card
            key={yr}
            className={`cursor-pointer transition-all text-center ${
              examYear === yr ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
            onClick={() => onExamYearChange(examYear === yr ? null : yr)}
          >
            <CardContent className="p-3">
              <p className="font-semibold text-base">{yr}</p>
              <p className="text-xs text-muted-foreground">
                {yr === CURRENT_YEAR
                  ? "This year"
                  : yr === CURRENT_YEAR + 1
                  ? "Next year"
                  : "In two years"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Your Profile Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">Curriculum</span>
            <span className="font-medium">{curriculum}</span>
            <span className="text-muted-foreground">Grade</span>
            <span className="font-medium">{grade}</span>
            <span className="text-muted-foreground">Subjects</span>
            <span className="font-medium">
              {subjects.slice(0, 3).join(", ")}
              {subjects.length > 3 ? ` +${subjects.length - 3}` : ""}
            </span>
            {examYear && (
              <>
                <span className="text-muted-foreground">Exam Year</span>
                <span className="font-medium">{examYear}</span>
              </>
            )}
            {setDateCount > 0 && (
              <>
                <span className="text-muted-foreground">Exam Dates</span>
                <span className="font-medium">{setDateCount} set</span>
              </>
            )}
            {studentEmail && (
              <>
                <span className="text-muted-foreground">Your Email</span>
                <span className="font-medium truncate">{studentEmail}</span>
              </>
            )}
            {guardianEmail && (
              <>
                <span className="text-muted-foreground">Guardian Email</span>
                <span className="font-medium truncate">{guardianEmail}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={saving || subjects.length === 0}>
          {saving ? (
            <>
              <span className="animate-spin mr-2">...</span> Saving...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4 mr-1" />
              Save &amp; Personalise
            </>
          )}
        </Button>
      </div>

      {onSkip && (
        <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={onSkip}>
          Skip for now
        </Button>
      )}
    </div>
  );
}
