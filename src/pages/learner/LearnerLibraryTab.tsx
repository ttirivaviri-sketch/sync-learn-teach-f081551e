/**
 * LearnerLibraryTab — StudySyncLibrary with academic-profile gating.
 */
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudySyncLibrary from "@/components/StudySyncLibrary";
import { StruggleRecRail } from "@/components/learner/StruggleRecRail";

interface AcademicProfile {
  curriculum?: string | null;
  grade?: string | null;
  subjects?: string[] | null;
  exam_year?: number | null;
  study_level?: string | null;
  exam_board?: string | null;
  school_name?: string | null;
  target_grade?: string | null;
  learning_style?: string | null;
  exam_dates?: Array<{ subject: string; date: string }> | null;
  student_email?: string | null;
  guardian_email?: string | null;
  goals?: string | null;
}

interface LearnerLibraryTabProps {
  academicProfile: AcademicProfile | null;
  onShowAcademicSetup: () => void;
  onBookTutor: (tutorId: string, tutorName: string) => Promise<void>;
  onNeedHelp: () => void;
}

export const LearnerLibraryTab = ({
  academicProfile,
  onShowAcademicSetup,
  onBookTutor,
  onNeedHelp,
}: LearnerLibraryTabProps) => {
  // Signature changes → StudySyncLibrary remounts and tabs (Clips/Books/Past Papers)
  // refetch + re-personalise instantly after the learner edits their profile.
  const profileKey = academicProfile
    ? `${academicProfile.curriculum ?? ""}|${academicProfile.grade ?? ""}|${(academicProfile.subjects ?? []).slice().sort().join(",")}`
    : "no-profile";

  return (
    <div className="space-y-4 p-4 mt-0">
      <StruggleRecRail />
      {/* Header — spec p.4 mockup: bold "Library" + one context line */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Library</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {academicProfile
              ? `${academicProfile.curriculum ?? ""}${academicProfile.grade ? ` · ${academicProfile.grade}` : ""}${academicProfile.subjects?.length ? ` · ${academicProfile.subjects.length} subjects` : ""}`
              : "Browsing and reference material for your curriculum"}
          </p>
        </div>
        {!academicProfile && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0"
            onClick={onShowAcademicSetup}
          >
            <GraduationCap className="h-3.5 w-3.5 mr-1" />
            Set Profile
          </Button>
        )}
      </div>
      <StudySyncLibrary
        key={profileKey}
        academicProfile={academicProfile as any}
        onBookTutor={onBookTutor}
        onNeedHelp={onNeedHelp}
        onEditProfile={onShowAcademicSetup}
      />
    </div>
  );
};
