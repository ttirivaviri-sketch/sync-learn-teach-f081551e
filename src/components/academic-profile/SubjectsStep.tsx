import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SubjectsStepProps {
  subjects: string[];
  availableSubjects: readonly string[];
  onToggle: (subject: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function SubjectsStep({ subjects, availableSubjects, onToggle, onBack, onNext }: SubjectsStepProps) {
  return (
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
              onClick={() => onToggle(subject)}
            >
              {selected && <Check className="h-3 w-3 mr-1" />}
              {subject}
            </Badge>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={subjects.length === 0}>
          Next: Contact Info
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
