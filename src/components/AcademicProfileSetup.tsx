import { useState } from "react";
import { GraduationCap, BookOpen, ChevronRight, Check, Sparkles, Calendar, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  AcademicProfile,
  Curriculum,
  GradeLevel,
  SubjectExamDate,
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
  { key: "ZIMSEC", label: "ZIMSEC (Zimbabwe)", flag: "ZW" },
  { key: "CAMB", label: "Cambridge (CIE)", flag: "GB" },
  { key: "IEB", label: "IEB (South Africa)", flag: "ZA" },
  { key: "NSC", label: "NSC / Matric (SA)", flag: "ZA" },
  { key: "IGCSE", label: "IGCSE", flag: "INT" },
  { key: "OTHER", label: "Other / General", flag: "OTH" },
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
  const [step, setStep] = useState<"curriculum" | "grade" | "subjects" | "emails" | "examdates" | "exam">(
    existingProfile ? "subjects" : "curriculum"
  );
  const [curriculum, setCurriculum] = useState<Curriculum>(
    (existingProfile?.curriculum as Curriculum) || "ZIMSEC"
  );
  const [grade, setGrade] = useState<GradeLevel | "">(
    (existingProfile?.grade as GradeLevel) || ""
  );
  const [subjects, setSubjects] = useState<string[]>(
    existingProfile?.subjects || []
  );
  const [examYear, setExamYear] = useState<number | null>(
    existingProfile?.exam_year || null
  );
  const [studentEmail, setStudentEmail] = useState<string>(
    existingProfile?.student_email || ""
  );
  const [guardianEmail, setGuardianEmail] = useState<string>(
    existingProfile?.guardian_email || ""
  );
  // Per-subject exam dates
  const [examDates, setExamDates] = useState<Record<string, Date>>(() => {
    const initial: Record<string, Date> = {};
    if (existingProfile?.exam_dates) {
      for (const entry of existingProfile.exam_dates) {
        if (entry.subject && entry.date) {
          initial[entry.subject] = new Date(entry.date);
        }
      }
    }
    return initial;
  });

  const availableGrades = GRADE_LEVELS_BY_CURRICULUM[curriculum];
  const availableSubjects = CURRICULUM_SUBJECTS[curriculum];

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleSave = async () => {
    if (!grade || subjects.length === 0) return;

    // Build exam_dates array from the date picker state
    const examDatesArray: SubjectExamDate[] = Object.entries(examDates)
      .filter(([subj]) => subjects.includes(subj))
      .map(([subject, date]) => ({
        subject,
        date: date.toISOString().split("T")[0],
      }));

    console.log("[AcademicProfileSetup] Saving profile:", {
      curriculum,
      grade,
      subjects: subjects.length,
      examYear,
      examDates: examDatesArray.length,
      hasStudentEmail: !!studentEmail,
      hasGuardianEmail: !!guardianEmail,
    });

    await onSave({
      curriculum,
      grade: grade as GradeLevel,
      subjects,
      exam_year: examYear,
      student_email: studentEmail || null,
      guardian_email: guardianEmail || null,
      exam_dates: examDatesArray,
    });
  };

  const steps = ["Curriculum", "Grade", "Subjects", "Emails", "Exam Dates", "Summary"];
  const stepMap: Record<string, number> = {
    curriculum: 1,
    grade: 2,
    subjects: 3,
    emails: 4,
    examdates: 5,
    exam: 6,
  };
  const progressStep = stepMap[step] || 1;

  const wrapper = compact
    ? "space-y-4"
    : "min-h-screen bg-background flex flex-col items-center justify-start px-4 py-8";

  const inner = compact ? "" : "w-full max-w-lg";

  const isValidEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
        <div className="flex gap-1.5 justify-center mb-6">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 <= progressStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Curriculum */}
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
                      <span className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{c.flag}</span>
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

        {/* Step 2: Grade */}
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

        {/* Step 3: Subjects */}
        {step === "subjects" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Select your subjects</h2>
              <Badge variant="secondary">{subjects.length} selected</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tap to toggle. Select all subjects you study.
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
                onClick={() => setStep("emails")}
                disabled={subjects.length === 0}
              >
                Next: Contact Info
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Student & Guardian Emails */}
        {step === "emails" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Contact Information</h2>
            <p className="text-xs text-muted-foreground">
              Optional. Your emails are private and only visible to you.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="student-email" className="text-sm flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Your Email
                </Label>
                <Input
                  id="student-email"
                  type="email"
                  placeholder="you@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                />
                {studentEmail && !isValidEmail(studentEmail) && (
                  <p className="text-xs text-destructive">Please enter a valid email</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guardian-email" className="text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Guardian/Parent Email
                </Label>
                <Input
                  id="guardian-email"
                  type="email"
                  placeholder="parent@example.com"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                />
                {guardianEmail && !isValidEmail(guardianEmail) && (
                  <p className="text-xs text-destructive">Please enter a valid email</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your guardian will receive weekly progress reports via email. They do not need to create an account.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Privacy:</span> Your email and guardian email are only visible to you. Tutors cannot see these details.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep("subjects")} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("examdates")}
                disabled={
                  (!!studentEmail && !isValidEmail(studentEmail)) ||
                  (!!guardianEmail && !isValidEmail(guardianEmail))
                }
              >
                Next: Exam Dates
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Per-Subject Exam Dates */}
        {step === "examdates" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Set Exam Dates</h2>
            <p className="text-xs text-muted-foreground">
              Set a date for each subject. This powers countdowns, calendar highlights, and study prioritisation.
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {subjects.map((subject) => (
                <div key={subject} className="p-3 rounded-xl border border-border">
                  <Label className="font-medium text-sm text-foreground mb-2 block">{subject}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {examDates[subject]
                          ? format(examDates[subject], "PPP")
                          : "Select exam date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarWidget
                        mode="single"
                        selected={examDates[subject]}
                        onSelect={(date) =>
                          date && setExamDates((prev) => ({ ...prev, [subject]: date }))
                        }
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {examDates[subject] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.ceil(
                        (examDates[subject].getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      )}{" "}
                      days away
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Selected dates summary */}
            {Object.keys(examDates).filter((s) => subjects.includes(s)).length > 0 && (
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-xs font-medium text-foreground mb-1.5">Exam dates set:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(examDates)
                    .filter(([s]) => subjects.includes(s))
                    .sort(([, a], [, b]) => a.getTime() - b.getTime())
                    .map(([subject, date]) => (
                      <Badge key={subject} variant="outline" className="text-xs">
                        {subject}: {format(date, "dd MMM yyyy")}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("emails")} className="flex-1">
                Back
              </Button>
              <Button className="flex-1" onClick={() => setStep("exam")}>
                Next: Review
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Exam Year + Summary + Save */}
        {step === "exam" && (
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
                  {Object.keys(examDates).filter((s) => subjects.includes(s)).length > 0 && (
                    <>
                      <span className="text-muted-foreground">Exam Dates</span>
                      <span className="font-medium">
                        {Object.keys(examDates).filter((s) => subjects.includes(s)).length} set
                      </span>
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
              <Button variant="outline" onClick={() => setStep("examdates")} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || subjects.length === 0}
              >
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">...</span> Saving...
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
