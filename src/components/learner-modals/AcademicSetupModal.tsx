import { AcademicProfileSetup } from "@/components/AcademicProfileSetup";
import type { AcademicProfile } from "@/types/academicProfile";

interface AcademicSetupModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  academicProfile: AcademicProfile | null;
  saving: boolean;
  onSave: (data: Omit<AcademicProfile, "id" | "user_id" | "created_at" | "updated_at">) => Promise<boolean>;
  onSaved: () => void;
}

export function AcademicSetupModal({
  open,
  onClose,
  userId,
  academicProfile,
  saving,
  onSave,
  onSaved,
}: AcademicSetupModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <AcademicProfileSetup
          userId={userId}
          existingProfile={academicProfile}
          onSave={async (data) => {
            const ok = await onSave(data);
            if (ok) onSaved();
            return ok;
          }}
          saving={saving}
          onSkip={onClose}
          compact
        />
      </div>
    </div>
  );
}
