import { useState } from "react";
import { GraduationCap, BookOpen, ChevronRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AcademicProfile,
  Curriculum,
  GradeLevel,
  CURRICULUM_SUBJECTS,
  GRADE_LEVELS_BY_CURRICULUM,
} from "@/types/academicProfile";

interface AcademicProfileSetupProps {
  userId: string;
  existingProfile?: AcademicProfile | null;
  onSave: (
    data: Omit<AcademicProfile, "id" | "user_id" | "created_at" | "updated_at">
  ) => Promise<boolean>;
  onSkip?: () => void;
  saving?: boolean;
  /** If true, renders as a compact inline card rather than full-page */
  compact?: boolean;
}

const CURRICULUMS: { key: Curriculum; label: string; flag: string }[] = [
  { key: "ZIMSEC", label: "ZIMSEC (Zimbabwe)", flag: "🇿🇼" },
  { key: "CAMB", label: "Cambridge (CIE)", flag: "🇬🇧" },
  { key: "IEB", label: "IEB (South Africa)", flag: "🇿🇦" },
  { key: "NSC", label: "NSC / Matric (SA)", flag: "🇿🇦" },
  { key: "IGCSE", label: "IGCSE", flag: "🌍" },
  { key: "OTHER", label: "Other / General", flag: "📚" },
];

const CURRENT_YEAR = new Date().getFullYear();
const EXAM_YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

export function AcademicProfileSetup({
  userId: _userId,
  existingProfile,
  onSave,
  onSkip,
  saving = false,
  compact = false,
}: AcademicProfileSetupProps) {
  const [step, setStep] = useState<"curriculum" | "grade" | "subjects" | "exam">(
    existingProfile ? "subjects" : "curriculum"
  );
  const [curriculum, setCurriculum] = useState<Curriculum>(
    existingProfile?.curriculum || "ZIMSEC"
  );
  const [grade, setGrade] = useState<GradeLevel | "">(
    existingProfile?.grade || ""
  );
  const [subjects, setSubjects] = useState<string[]>(
    existingProfile?.subjects || []
  );
  const [examYear, setExamYear] = useState<number | null>(
    existingProfile?.exam_year || null
  );

  const availableGrades = GRADE_LEVELS_BY_CURRICULUM[curriculum];
  const availableSubjects = CURRICULUM_SUBJECTS[curriculum];

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleSave = async () => {
    if (!grade || subjects.length === 0) return;
    await onSave({
      curriculum,
      grade: grade as GradeLevel,
      subjects,
      exam_year: examYear,
    });
  };

  const progressStep = step === "curriculum" ? 1 : step === "grade" ? 2 : step === "subjects" ? 3 : 4;

  const wrapper = compact
    ? "space-y-4"
    : "min-h-screen bg-background flex flex-col items-center justify-start px-4 py-8";

  const inner = compact ? "" : "w-full max-w-lg";

  return (
    <div className={wrapper}>
      <div className={inner}>
        {/* Header */}
        {!compact && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Your Academic Profile</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Set once. Powers your library, tutors & study plan.
            </p>
          </div>
        )}

        {/* Progress pills */}
        <div className="flex gap-2 justify-center mb-6">
          {["Curriculum", "Grade", "Subjects", "Exam Year"].map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 <= progressStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Curriculum ── */}
        {step === "curriculum" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Choose your curriculum</h2>
            <div className="grid grid-cols-1 gap-2">
              {CURRICULUMS.map((c) => (
                <Card
                  key={c.key}
                  className={`cursor-pointer transition-all ${
                    curriculum === c.key
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                  onClick={() => setCurriculum(c.key)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.flag}</span>
                      <span className="font-medium text-sm">{c.label}</span>
                    </div>
                    {curriculum === c.key && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button className="w-full mt-2" onClick={() => setStep("grade")}>
              Next: Choose Grade
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Grade ── */}
        {step === "grade" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">What grade / year are you in?</h2>
            <Select
              value={grade}
              onValueChange={(v) => setGrade(v as GradeLevel)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your grade" />
              </SelectTrigger>
              <SelectContent>
                {availableGrades.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("curriculum")} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("subjects")}
                disabled={!grade}
              >
                Next: Subjects
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Subjects ── */}
        {step === "subjects" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Select your subjects</h2>
              <Badge variant="secondary">{subjects.length} selected</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tap to toggle — select all subjects you study.
            </p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {availableSubjects.map((subject) => {
                const selected = subjects.includes(subject);
                return (
                  <Badge
                    key={subject}
                    variant={selected ? "default" : "outline"}
                    className={`cursor-pointer select-none transition-all ${
                      selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleSubject(subject)}
                  >
                    {selected && <Check className="h-3 w-3 mr-1" />}
                    {subject}
                  </Badge>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep("grade")} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("exam")}
                disabled={subjects.length === 0}
              >
                Next: Exam Year
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Exam Year ── */}
        {step === "exam" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">When are your exams?</h2>
            <p className="text-xs text-muted-foreground">
              Optional — helps us set countdown timers and prioritize revision.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {EXAM_YEARS.map((yr) => (
                <Card
                  key={yr}
                  className={`cursor-pointer transition-all text-center ${
                    examYear === yr
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                  onClick={() => setExamYear(examYear === yr ? null : yr)}
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
                  <span className="font-medium">{subjects.slice(0, 3).join(", ")}{subjects.length > 3 ? ` +${subjects.length - 3}` : ""}</span>
                  {examYear && (
                    <>
                      <span className="text-muted-foreground">Exam Year</span>
                      <span className="font-medium">{examYear}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("subjects")} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || subjects.length === 0}
              >
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Saving...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-1" />
                    Save & Personalise
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
        )}
      </div>
    </div>
  );
}
