import { ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailsStepProps {
  studentEmail: string;
  guardianEmail: string;
  onStudentEmailChange: (v: string) => void;
  onGuardianEmailChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const isValidEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function EmailsStep({
  studentEmail,
  guardianEmail,
  onStudentEmailChange,
  onGuardianEmailChange,
  onBack,
  onNext,
}: EmailsStepProps) {
  return (
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
            onChange={(e) => onStudentEmailChange(e.target.value)}
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
            onChange={(e) => onGuardianEmailChange(e.target.value)}
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
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={onNext}
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
  );
}
