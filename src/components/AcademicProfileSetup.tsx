import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { logger } from "@/utils/logger";
import {
  AcademicProfile,
  Curriculum,
  GradeLevel,
  SubjectExamDate,
  CURRICULUM_SUBJECTS,
  GRADE_LEVELS_BY_CURRICULUM,
} from "@/types/academicProfile";

import { CountryStep } from "./academic-profile/CountryStep";
import { CurriculumStep } from "./academic-profile/CurriculumStep";
import { GradeStep } from "./academic-profile/GradeStep";
import { SubjectsStep } from "./academic-profile/SubjectsStep";
import { EmailsStep } from "./academic-profile/EmailsStep";
import { ExamDatesStep } from "./academic-profile/ExamDatesStep";
import { SummaryStep } from "./academic-profile/SummaryStep";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, countryByCode, detectCountry, type CountryCode } from "@/lib/legal";

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

type StepKey = "curriculum" | "grade" | "subjects" | "emails" | "examdates" | "exam";

const STEPS = ["Curriculum", "Grade", "Subjects", "Emails", "Exam Dates", "Summary"];
const STEP_INDEX: Record<StepKey, number> = {
  curriculum: 1,
  grade: 2,
  subjects: 3,
  emails: 4,
  examdates: 5,
  exam: 6,
};

export function AcademicProfileSetup({
  userId: _userId,
  existingProfile,
  onSave,
  onSkip,
  saving = false,
  compact = false,
}: AcademicProfileSetupProps) {
  const [step, setStep] = useState<StepKey>(existingProfile ? "subjects" : "curriculum");
  const [curriculum, setCurriculum] = useState<Curriculum>(
    (existingProfile?.curriculum as Curriculum) || "ZIMSEC"
  );
  const [grade, setGrade] = useState<GradeLevel | "">(
    (existingProfile?.grade as GradeLevel) || ""
  );
  const [subjects, setSubjects] = useState<string[]>(existingProfile?.subjects || []);
  const [examYear, setExamYear] = useState<number | null>(existingProfile?.exam_year || null);
  const [studentEmail, setStudentEmail] = useState(existingProfile?.student_email || "");
  const [guardianEmail, setGuardianEmail] = useState(existingProfile?.guardian_email || "");
  const [examDates, setExamDates] = useState<Record<string, Date>>(() => {
    const initial: Record<string, Date> = {};
    if (existingProfile?.exam_dates) {
      for (const entry of existingProfile.exam_dates) {
        if (entry.subject && entry.date) initial[entry.subject] = new Date(entry.date);
      }
    }
    return initial;
  });

  const toggleSubject = (subject: string) =>
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );

  const handleSave = async () => {
    if (!grade || subjects.length === 0) return;
    const examDatesArray: SubjectExamDate[] = Object.entries(examDates)
      .filter(([subj]) => subjects.includes(subj))
      .map(([subject, date]) => ({ subject, date: date.toISOString().split("T")[0] }));

    logger.info("[AcademicProfileSetup] Saving profile:", {
      curriculum, grade, subjects: subjects.length, examYear,
      examDates: examDatesArray.length,
      hasStudentEmail: !!studentEmail, hasGuardianEmail: !!guardianEmail,
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

  const progressStep = STEP_INDEX[step] || 1;
  const wrapper = compact ? "space-y-4" : "min-h-screen bg-background flex flex-col items-center justify-start px-4 py-8";
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
              Set once. Powers your library, tutors &amp; study plan.
            </p>
          </div>
        )}

        {/* Progress pills */}
        <div className="flex gap-1.5 justify-center mb-6">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 <= progressStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === "curriculum" && (
          <CurriculumStep curriculum={curriculum} onSelect={setCurriculum} onNext={() => setStep("grade")} />
        )}
        {step === "grade" && (
          <GradeStep
            grade={grade}
            availableGrades={GRADE_LEVELS_BY_CURRICULUM[curriculum]}
            onSelect={setGrade}
            onBack={() => setStep("curriculum")}
            onNext={() => setStep("subjects")}
          />
        )}
        {step === "subjects" && (
          <SubjectsStep
            subjects={subjects}
            availableSubjects={CURRICULUM_SUBJECTS[curriculum]}
            onToggle={toggleSubject}
            onBack={() => setStep("grade")}
            onNext={() => setStep("emails")}
          />
        )}
        {step === "emails" && (
          <EmailsStep
            studentEmail={studentEmail}
            guardianEmail={guardianEmail}
            onStudentEmailChange={setStudentEmail}
            onGuardianEmailChange={setGuardianEmail}
            onBack={() => setStep("subjects")}
            onNext={() => setStep("examdates")}
          />
        )}
        {step === "examdates" && (
          <ExamDatesStep
            subjects={subjects}
            examDates={examDates}
            onSetDate={(subject, date) => setExamDates((prev) => ({ ...prev, [subject]: date }))}
            onBack={() => setStep("emails")}
            onNext={() => setStep("exam")}
          />
        )}
        {step === "exam" && (
          <SummaryStep
            curriculum={curriculum}
            grade={grade}
            subjects={subjects}
            examYear={examYear}
            examDates={examDates}
            studentEmail={studentEmail}
            guardianEmail={guardianEmail}
            saving={saving}
            onExamYearChange={setExamYear}
            onBack={() => setStep("examdates")}
            onSave={handleSave}
            onSkip={onSkip}
          />
        )}
      </div>
    </div>
  );
}
