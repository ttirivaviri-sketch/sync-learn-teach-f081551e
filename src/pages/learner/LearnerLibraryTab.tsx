/**
 * LearnerLibraryTab — StudySyncLibrary with academic-profile gating.
 */
import { ShoppingBag, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudySyncLibrary from "@/components/StudySyncLibrary";

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
}: LearnerLibraryTabProps) => (
  <div className="space-y-4 p-4 mt-0">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">StudySync Library</h3>
      </div>
      {!academicProfile && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={onShowAcademicSetup}
        >
          <GraduationCap className="h-3.5 w-3.5 mr-1" />
          Set Profile
        </Button>
      )}
    </div>
    <StudySyncLibrary
      academicProfile={academicProfile}
      onBookTutor={onBookTutor}
      onNeedHelp={onNeedHelp}
    />
  </div>
);
