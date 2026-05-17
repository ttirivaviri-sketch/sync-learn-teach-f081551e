import {
  X, Edit2, Save, BookOpen, Plus, Loader2, Trash2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { SyllabusEntry } from "@/components/SyllabusSetupGate";

interface SyllabusEntryCardProps {
  entry: SyllabusEntry;
  isEditing: boolean;
  saving: boolean;
  reparsing?: boolean;
  editSyllabusCode: string;
  editPaperCode: string;
  editPaperCodes: string[];
  onStartEdit: (entry: SyllabusEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (entry: SyllabusEntry) => void;
  onDelete: (entry: SyllabusEntry) => void;
  onReparse?: (entry: SyllabusEntry) => void;
  onEditSyllabusCodeChange: (value: string) => void;
  onEditPaperCodeChange: (value: string) => void;
  onAddEditPaperCode: () => void;
  onRemoveEditPaperCode: (code: string) => void;
}

export function SyllabusEntryCard({
  entry,
  isEditing,
  saving,
  reparsing,
  editSyllabusCode,
  editPaperCode,
  editPaperCodes,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReparse,
  onEditSyllabusCodeChange,
  onEditPaperCodeChange,
  onAddEditPaperCode,
  onRemoveEditPaperCode,
}: SyllabusEntryCardProps) {
  if (isEditing) {
    return (
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{entry.subject_name}</h4>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={saving}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Syllabus Code</Label>
              <Input
                value={editSyllabusCode}
                onChange={(e) => onEditSyllabusCodeChange(e.target.value)}
                placeholder="e.g. 4028, 0580"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Paper Codes</Label>
              <div className="flex gap-2">
                <Input
                  value={editPaperCode}
                  onChange={(e) => onEditPaperCodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddEditPaperCode())}
                  placeholder="e.g. P1, P2, P3"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={onAddEditPaperCode}
                  disabled={!editPaperCode.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {editPaperCodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {editPaperCodes.map((code) => (
                    <Badge key={code} variant="secondary" className="gap-1 pr-1 text-xs">
                      {code}
                      <button
                        onClick={() => onRemoveEditPaperCode(code)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button size="sm" onClick={() => onSaveEdit(entry)} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-sm">{entry.subject_name}</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entry.syllabus_code && (
              <Badge variant="outline" className="text-xs">
                Syllabus: {entry.syllabus_code}
              </Badge>
            )}
            {entry.paper_codes.map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">{code}</Badge>
            ))}
            {!entry.syllabus_code && entry.paper_codes.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                No codes set — tap edit to add
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {onReparse && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => onReparse(entry)}
              disabled={reparsing}
              title="Re-parse uploaded syllabus PDF"
            >
              {reparsing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onStartEdit(entry)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(entry)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
