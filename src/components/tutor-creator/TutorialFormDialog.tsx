import { Video, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRICULUM_SUBJECTS, GRADE_LEVELS_BY_CURRICULUM, Curriculum,
} from "@/types/academicProfile";

interface TutorialForm {
  title: string;
  description: string;
  subject: string;
  topic: string;
  subtopic: string;
  grade: string;
  curriculum: Curriculum;
  videoUrl: string;
  durationLabel: string;
}

const CURRICULUM_OPTIONS: Curriculum[] = ["ZIMSEC", "CAMB", "IEB", "NSC", "IGCSE", "OTHER"];

interface TutorialFormDialogProps {
  open: boolean;
  editingId: string | null;
  form: TutorialForm;
  saving: boolean;
  formError: string | null;
  onOpenChange: (open: boolean) => void;
  onUpdateForm: (field: keyof TutorialForm, value: string) => void;
  onSubmit: (publishNow: boolean) => void;
  onReset: () => void;
}

export function TutorialFormDialog({
  open,
  editingId,
  form,
  saving,
  formError,
  onOpenChange,
  onUpdateForm,
  onSubmit,
  onReset,
}: TutorialFormDialogProps) {
  const availableSubjects = CURRICULUM_SUBJECTS[form.curriculum];
  const availableGrades = GRADE_LEVELS_BY_CURRICULUM[form.curriculum];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { onReset(); }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            {editingId ? "Edit Tutorial" : "Upload Tutorial"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Tutorial Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Solving Quadratic Equations Step by Step"
              value={form.title}
              onChange={(e) => onUpdateForm("title", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="What will students learn? What topics are covered?"
              value={form.description}
              onChange={(e) => onUpdateForm("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Curriculum *</Label>
              <Select
                value={form.curriculum}
                onValueChange={(v) => {
                  onUpdateForm("curriculum", v);
                  onUpdateForm("subject", "");
                  onUpdateForm("grade", "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger>
                <SelectContent>
                  {CURRICULUM_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={form.grade} onValueChange={(v) => onUpdateForm("grade", v)}>
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {availableGrades.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Select value={form.subject} onValueChange={(v) => onUpdateForm("subject", v)}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                placeholder="e.g. Quadratic Equations"
                value={form.topic}
                onChange={(e) => onUpdateForm("topic", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subtopic">Subtopic (optional)</Label>
            <Input
              id="subtopic"
              placeholder="e.g. Completing the Square"
              value={form.subtopic}
              onChange={(e) => onUpdateForm("subtopic", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              placeholder="YouTube, Loom, or direct link"
              value={form.videoUrl}
              onChange={(e) => onUpdateForm("videoUrl", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Paste a YouTube, Loom or Vimeo link. Direct upload coming soon.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              placeholder="e.g. 22 min"
              value={form.durationLabel}
              onChange={(e) => onUpdateForm("durationLabel", e.target.value)}
            />
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <strong>After publishing</strong>, your tutorial will automatically appear in the StudySync Library under the matching subject rack, search results, and topic learning hubs.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => onSubmit(false)}>
              Save as Draft
            </Button>
            <Button className="flex-1" disabled={saving} onClick={() => onSubmit(true)}>
              {saving ? (
                <><span className="animate-spin mr-1">⏳</span>Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" />Publish Now</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { TutorialForm };
