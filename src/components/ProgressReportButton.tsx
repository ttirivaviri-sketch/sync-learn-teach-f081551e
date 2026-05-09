/**
 * ProgressReportButton — Lets a learner download their full progress report
 * as a PDF, and optionally email it to their tutor and/or guardian.
 */
import { useState } from "react";
import { Download, FileBarChart2, Loader2, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useProgressReport } from "@/hooks/useProgressReport";

interface Props {
  learnerId: string | null | undefined;
  /** Optional: tutors associated with the learner's upcoming bookings. */
  tutors?: Array<{ id: string; name: string; email?: string | null }>;
  /** Optional default guardian email pulled from academic profile */
  defaultGuardianEmail?: string | null;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

export function ProgressReportButton({
  learnerId,
  tutors = [],
  defaultGuardianEmail,
  variant = "outline",
  size = "sm",
  className,
  label = "Progress Report",
}: Props) {
  const { generate, generating } = useProgressReport(learnerId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [tutorEmail, setTutorEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState(defaultGuardianEmail || "");
  const [sendToTutor, setSendToTutor] = useState(true);
  const [sendToGuardian, setSendToGuardian] = useState(true);
  const [message, setMessage] = useState("");

  const openEmailDialog = (tutorId?: string, presetEmail?: string) => {
    setSelectedTutorId(tutorId || null);
    setTutorEmail(presetEmail || "");
    setGuardianEmail(defaultGuardianEmail || "");
    setSendToTutor(!!presetEmail || !!tutorId);
    setSendToGuardian(!!defaultGuardianEmail);
    setMessage("");
    setEmailOpen(true);
    setMenuOpen(false);
  };

  const handleSend = async () => {
    setEmailOpen(false);
    await generate({
      audience: selectedTutorId ? "tutor" : "self",
      tutorId: selectedTutorId,
      email: true,
      tutorEmail: sendToTutor ? tutorEmail : null,
      guardianEmail: sendToGuardian ? guardianEmail : null,
      message: message || undefined,
    });
  };

  const Icon = generating ? Loader2 : FileBarChart2;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={generating}
          >
            <Icon className={`h-4 w-4 mr-1.5 ${generating ? "animate-spin" : ""}`} />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Download as PDF</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              generate({ audience: "self" });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download for me
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Email on my behalf</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openEmailDialog()}>
            <Mail className="h-4 w-4 mr-2" />
            Email to tutor &amp; parent…
          </DropdownMenuItem>

          {tutors.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Share with a tutor</DropdownMenuLabel>
              {tutors.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => openEmailDialog(t.id, t.email || "")}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email progress report</DialogTitle>
            <DialogDescription>
              We'll send the PDF on your behalf. Replies go to your email address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="send-tutor"
                checked={sendToTutor}
                onCheckedChange={(v) => setSendToTutor(!!v)}
                className="mt-2"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="tutor-email">Tutor email</Label>
                <Input
                  id="tutor-email"
                  type="email"
                  placeholder="tutor@example.com"
                  value={tutorEmail}
                  onChange={(e) => setTutorEmail(e.target.value)}
                  disabled={!sendToTutor}
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="send-guardian"
                checked={sendToGuardian}
                onCheckedChange={(v) => setSendToGuardian(!!v)}
                className="mt-2"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="guardian-email">Parent / guardian email</Label>
                <Input
                  id="guardian-email"
                  type="email"
                  placeholder="parent@example.com"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  disabled={!sendToGuardian}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="msg">Message (optional)</Label>
              <Textarea
                id="msg"
                placeholder="Add a short note…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                (!sendToTutor || !tutorEmail.trim()) &&
                (!sendToGuardian || !guardianEmail.trim())
              }
            >
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
