/**
 * ProgressReportButton — Lets a learner download their full progress report
 * as a PDF, optionally addressed to a specific tutor (auto-attaches to
 * their next booking with that tutor).
 */
import { useState } from "react";
import { Download, FileBarChart2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProgressReport } from "@/hooks/useProgressReport";

interface Props {
  learnerId: string | null | undefined;
  /** Optional: tutors associated with the learner's upcoming bookings. */
  tutors?: Array<{ id: string; name: string }>;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

export function ProgressReportButton({
  learnerId,
  tutors = [],
  variant = "outline",
  size = "sm",
  className,
  label = "Progress Report",
}: Props) {
  const { generate, generating } = useProgressReport(learnerId);
  const [open, setOpen] = useState(false);

  // No tutors → just a button that downloads for self
  if (!tutors.length) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={generating}
        onClick={() => generate({ audience: "self" })}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <FileBarChart2 className="h-4 w-4 mr-1.5" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <FileBarChart2 className="h-4 w-4 mr-1.5" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Download as PDF</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            generate({ audience: "self" });
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download for me
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Share with a tutor</DropdownMenuLabel>
        {tutors.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => {
              setOpen(false);
              generate({ audience: "tutor", tutorId: t.id });
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
