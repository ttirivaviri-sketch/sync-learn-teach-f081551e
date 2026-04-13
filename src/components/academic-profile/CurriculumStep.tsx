import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Curriculum } from "@/types/academicProfile";

interface CurriculumStepProps {
  curriculum: Curriculum;
  onSelect: (c: Curriculum) => void;
  onNext: () => void;
}

const CURRICULUMS: { key: Curriculum; label: string; flag: string }[] = [
  { key: "ZIMSEC", label: "ZIMSEC (Zimbabwe)", flag: "ZW" },
  { key: "CAMB", label: "Cambridge (CIE)", flag: "GB" },
  { key: "IEB", label: "IEB (South Africa)", flag: "ZA" },
  { key: "NSC", label: "NSC / Matric (SA)", flag: "ZA" },
  { key: "IGCSE", label: "IGCSE", flag: "INT" },
  { key: "OTHER", label: "Other / General", flag: "OTH" },
];

export { CURRICULUMS };

export function CurriculumStep({ curriculum, onSelect, onNext }: CurriculumStepProps) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Choose your curriculum</h2>
      <div className="grid grid-cols-1 gap-2">
        {CURRICULUMS.map((c) => (
          <Card
            key={c.key}
            className={`cursor-pointer transition-all ${
              curriculum === c.key ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
            onClick={() => onSelect(c.key)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{c.flag}</span>
                <span className="font-medium text-sm">{c.label}</span>
              </div>
              {curriculum === c.key && <Check className="h-4 w-4 text-primary" />}
            </CardContent>
          </Card>
        ))}
      </div>
      <Button className="w-full mt-2" onClick={onNext}>
        Next: Choose Grade
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
