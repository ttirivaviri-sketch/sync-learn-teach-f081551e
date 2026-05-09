import { useState, useRef } from "react";
import {
  Video, CheckCircle2, AlertCircle, Upload, Link, X, FileVideo, FileText, BadgeCheck,
} from "lucide-react";
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

export type ContentType = "video" | "pdf";
export type ResourceCategory = "textbook" | "past_paper" | "notes";

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
  contentType: ContentType;
  pdfUrl: string;
  resourceCategory: ResourceCategory;
}

const CURRICULUM_OPTIONS: Curriculum[] = ["ZIMSEC", "CAMB", "IEB", "NSC", "OTHER"];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB videos
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB pdfs
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface TutorialFormDialogProps {
  open: boolean;
  editingId: string | null;
  form: TutorialForm;
  saving: boolean;
  formError: string | null;
  tutorId: string;
  /** When true, expose PDF (study material) upload path */
  isOfficial?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateForm: (field: keyof TutorialForm, value: string) => void;
  onSubmit: (publishNow: boolean) => void;
  onReset: () => void;
}

export function TutorialFormDialog({
  open, editingId, form, saving, formError, tutorId, isOfficial = false,
  onOpenChange, onUpdateForm, onSubmit, onReset,
}: TutorialFormDialogProps) {
  const [videoMode, setVideoMode] = useState<"upload" | "link">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

    const { data: { session } } = await supabase.auth.getSession();
    const effectiveTutorId = tutorId || session?.user?.id;

    if (!effectiveTutorId) {
      setUploadError("Not signed in. Please refresh and try again.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const path = `${effectiveTutorId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

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

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.type !== "application/pdf") {
      setUploadError("Please select a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setUploadError("PDF too large. Maximum size is 50MB.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const effectiveTutorId = tutorId || session?.user?.id;
    if (!effectiveTutorId) {
      setUploadError("Not signed in. Please refresh and try again.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    try {
      const path = `${effectiveTutorId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const interval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 85));
      }, 400);
      const { error } = await supabase.storage
        .from("library-pdfs")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      clearInterval(interval);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("library-pdfs").getPublicUrl(path);
      setUploadProgress(100);
      setUploadedFileName(file.name);
      onUpdateForm("pdfUrl", urlData.publicUrl);
    } catch (err: any) {
      logger.warn("PDF upload failed:", err);
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
    onUpdateForm("pdfUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const isPdf = form.contentType === "pdf";

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
            {isPdf ? <FileText className="h-5 w-5 text-primary" /> : <Video className="h-5 w-5 text-primary" />}
            {editingId ? "Edit" : "Upload"} {isPdf ? "Study Material" : "Tutorial"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Official badge */}
          {isOfficial && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5 text-xs">
              <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-foreground">
                Signed in as <strong>studysyncofficial</strong> — you can publish books &amp; past papers.
              </span>
            </div>
          )}

          {/* Content type selector — only visible to official accounts */}
          {isOfficial && (
            <div className="space-y-1.5">
              <Label>Content Type *</Label>
              <Select
                value={form.contentType}
                onValueChange={(v) => {
                  onUpdateForm("contentType", v);
                  clearUpload();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Tutorial Video</SelectItem>
                  <SelectItem value="pdf">Study Material (PDF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* PDF resource category */}
          {isPdf && (
            <div className="space-y-1.5">
              <Label>Material Type *</Label>
              <Select
                value={form.resourceCategory}
                onValueChange={(v) => onUpdateForm("resourceCategory", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="textbook">Textbook</SelectItem>
                  <SelectItem value="past_paper">Past Paper</SelectItem>
                  <SelectItem value="notes">Notes / Study Guide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder={isPdf ? "e.g. ZIMSEC Maths Past Paper 2023" : "e.g. Solving Quadratic Equations Step by Step"}
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

          {/* PDF upload */}
          {isPdf ? (
            <div className="space-y-2">
              <Label>PDF File *</Label>
              {form.pdfUrl ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{uploadedFileName || "PDF uploaded"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearUpload}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handlePdfSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-20 border-dashed flex flex-col gap-1"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {uploading ? "Uploading..." : "Tap to select PDF (max 50MB)"}
                    </span>
                  </Button>
                </>
              )}
              {uploading && <Progress value={uploadProgress} className="h-2" />}
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            </div>
          ) : (
            /* Video Section */
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
                  {uploadedFileName && form.videoUrl ? (
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
          )}

          {/* Duration */}
          {!isPdf && (
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g. 22 min"
                value={form.durationLabel}
                onChange={(e) => onUpdateForm("durationLabel", e.target.value)}
              />
            </div>
          )}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <strong>After publishing</strong>, your {isPdf ? "study material" : "tutorial"} will automatically appear in the StudySync Library under the matching subject rack.
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
