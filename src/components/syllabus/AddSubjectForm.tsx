import { Plus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface AddSubjectFormProps {
  newSubjectName: string;
  newSyllabusCode: string;
  newPaperCode: string;
  newPaperCodes: string[];
  saving: boolean;
  onSubjectNameChange: (value: string) => void;
  onSyllabusCodeChange: (value: string) => void;
  onPaperCodeChange: (value: string) => void;
  onAddPaperCode: () => void;
  onRemovePaperCode: (code: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddSubjectForm({
  newSubjectName,
  newSyllabusCode,
  newPaperCode,
  newPaperCodes,
  saving,
  onSubjectNameChange,
  onSyllabusCodeChange,
  onPaperCodeChange,
  onAddPaperCode,
  onRemovePaperCode,
  onSubmit,
  onCancel,
}: AddSubjectFormProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-1">
          <Plus className="h-4 w-4 text-primary" />
          Add Subject
        </h4>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">Subject Name *</Label>
        <Input
          value={newSubjectName}
          onChange={(e) => onSubjectNameChange(e.target.value)}
          placeholder="e.g. Mathematics, Physics, Biology"
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Syllabus Code</Label>
        <Input
          value={newSyllabusCode}
          onChange={(e) => onSyllabusCodeChange(e.target.value)}
          placeholder="e.g. 4028, 0580, 9709"
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Paper Codes</Label>
        <div className="flex gap-2">
          <Input
            value={newPaperCode}
            onChange={(e) => onPaperCodeChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddPaperCode())}
            placeholder="e.g. P1, P2, P3"
            className="h-8 text-sm flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onAddPaperCode}
            disabled={!newPaperCode.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {newPaperCodes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {newPaperCodes.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1 pr-1 text-xs">
                {code}
                <button
                  onClick={() => onRemovePaperCode(code)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button
        size="sm"
        onClick={onSubmit}
        disabled={saving || !newSubjectName.trim()}
        className="w-full"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Check className="h-3.5 w-3.5 mr-1" />
        )}
        Add Subject
      </Button>
    </div>
  );
}
