import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const COMPLIANCE_KEY = "tutor_content_compliance_accepted";

export function hasAcceptedCompliance(): boolean {
  return sessionStorage.getItem(COMPLIANCE_KEY) === "true";
}

export function markComplianceAccepted(): void {
  sessionStorage.setItem(COMPLIANCE_KEY, "true");
}

interface ContentComplianceModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function ContentComplianceModal({ open, onAccept, onCancel }: ContentComplianceModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    markComplianceAccepted();
    setAgreed(false);
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setAgreed(false); onCancel(); } }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Content Guidelines
          </DialogTitle>
          <DialogDescription>
            Please review and accept before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="font-medium">By uploading content, you confirm that:</p>

          <ul className="space-y-2 list-disc pl-5 text-muted-foreground">
            <li>Your content is <strong className="text-foreground">educational and appropriate</strong> for students</li>
            <li>
              It does <strong className="text-foreground">not</strong> contain:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Foul or offensive language</li>
                <li>Nudity or sexually explicit material</li>
                <li>Hate speech or discrimination</li>
                <li>Violence or harmful behaviour</li>
              </ul>
            </li>
            <li>You respect community guidelines and platform standards</li>
            <li>Your content is your own or you have permission to use it</li>
          </ul>

          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-xs">
            <strong>Violating these rules may result in:</strong> content removal, account suspension, or permanent ban.
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              I have read and agree that my content complies with the above guidelines
            </span>
          </label>

          <Button className="w-full" disabled={!agreed} onClick={handleAccept}>
            Continue to Upload
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            This step helps keep StudySync safe and valuable for all students.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
