import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GradeLevel } from "@/types/academicProfile";

interface GradeStepProps {
  grade: GradeLevel | "";
  availableGrades: readonly GradeLevel[];
  onSelect: (g: GradeLevel) => void;
  onBack: () => void;
  onNext: () => void;
}

export function GradeStep({ grade, availableGrades, onSelect, onBack, onNext }: GradeStepProps) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-lg">What grade / year are you in?</h2>
      <Select value={grade} onValueChange={(v) => onSelect(v as GradeLevel)}>
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
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={!grade}>
          Next: Subjects
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
