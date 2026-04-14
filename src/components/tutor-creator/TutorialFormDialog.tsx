import { useState, useRef } from "react";
import { Video, CheckCircle2, AlertCircle, Upload, Link, X, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRICULUM_SUBJECTS, GRADE_LEVELS_BY_CURRICULUM, Curriculum,
} from "@/types/academicProfile";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

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
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface TutorialFormDialogProps {
  open: boolean;
  editingId: string | null;
  form: TutorialForm;
  saving: boolean;
  formError: string | null;
  tutorId: string;
  onOpenChange: (open: boolean) => void;
  onUpdateForm: (field: keyof TutorialForm, value: string) => void;
  onSubmit: (publishNow: boolean) => void;
  onReset: () => void;
}

export function TutorialFormDialog({
  open, editingId, form, saving, formError, tutorId,
  onOpenChange, onUpdateForm, onSubmit, onReset,
}: TutorialFormDialogProps) {
  const [videoMode, setVideoMode] = useState<"upload" | "link">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableSubjects = CURRICULUM_SUBJECTS[form.curriculum];
  const availableGrades = GRADE_LEVELS_BY_CURRICULUM[form.curriculum];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setUploadError("Please select a valid video file (MP4, MOV, or WebM).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File too large. Maximum size is 100MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${tutorId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      // Simulate progress since supabase upload doesn't expose it
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 8, 85));
      }, 400);

      const { error } = await supabase.storage
        .from("tutor-videos")
        .upload(path, file, { contentType: file.type, upsert: false });

      clearInterval(progressInterval);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("tutor-videos")
        .getPublicUrl(path);

      setUploadProgress(100);
      setUploadedFileName(file.name);
      onUpdateForm("videoUrl", urlData.publicUrl);
    } catch (err: any) {
      logger.warn("Video upload failed:", err);
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const clearUpload = () => {
    setUploadedFileName(null);
    setUploadProgress(0);
    setUploadError(null);
    onUpdateForm("videoUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { onReset(); clearUpload(); }
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

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Tutorial Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Solving Quadratic Equations Step by Step"
              value={form.title}
              onChange={(e) => onUpdateForm("title", e.target.value)}
            />
          </div>

          {/* Description */}
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

          {/* Curriculum & Grade */}
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

          {/* Subject & Topic */}
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

          {/* Subtopic */}
          <div className="space-y-1.5">
            <Label htmlFor="subtopic">Subtopic (optional)</Label>
            <Input
              id="subtopic"
              placeholder="e.g. Completing the Square"
              value={form.subtopic}
              onChange={(e) => onUpdateForm("subtopic", e.target.value)}
            />
          </div>

          {/* Video Section */}
          <div className="space-y-2">
            <Label>Video *</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setVideoMode("upload")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  videoMode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-3.5 w-3.5" /> Upload from Gallery
              </button>
              <button
                type="button"
                onClick={() => setVideoMode("link")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  videoMode === "link" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link className="h-3.5 w-3.5" /> Paste a link
              </button>
            </div>

            {videoMode === "upload" ? (
              <div className="space-y-2">
                {uploadedFileName ? (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <FileVideo className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{uploadedFileName}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearUpload}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed flex flex-col gap-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {uploading ? "Uploading..." : "Tap to select video (max 100MB)"}
                      </span>
                    </Button>
                  </>
                )}

                {uploading && (
                  <Progress value={uploadProgress} className="h-2" />
                )}

                {uploadError && (
                  <p className="text-xs text-destructive">{uploadError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="YouTube, Loom, or direct link"
                  value={form.videoUrl}
                  onChange={(e) => onUpdateForm("videoUrl", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a YouTube, Loom or Vimeo link.
                </p>
              </div>
            )}
          </div>

          {/* Duration */}
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
