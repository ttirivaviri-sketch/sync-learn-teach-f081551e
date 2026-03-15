import { useEffect, useState } from "react";
import {
  Video, Upload, Plus, Trash2, Eye, Edit, CheckCircle2,
  Clock, TrendingUp, Star, Users, BookOpen, AlertCircle, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRICULUM_SUBJECTS,
  GRADE_LEVELS_BY_CURRICULUM,
  Curriculum,
  GradeLevel,
} from "@/types/academicProfile";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Tutorial {
  id: string;
  title: string;
  subject: string;
  topic: string;
  grade: string;
  curriculum: string;
  status: "draft" | "published" | "archived";
  watchCount: number;
  rating: number;
  reviewCount: number;
  completionRate: number;
  createdAt: string;
}

const EMPTY_FORM: TutorialForm = {
  title: "",
  description: "",
  subject: "",
  topic: "",
  subtopic: "",
  grade: "",
  curriculum: "ZIMSEC",
  videoUrl: "",
  durationLabel: "",
};

const CURRICULUM_OPTIONS: Curriculum[] = ["ZIMSEC", "CAMB", "IEB", "NSC", "IGCSE", "OTHER"];

interface TutorCreatorDashboardProps {
  tutorId: string;
  tutorName: string;
}

export function TutorCreatorDashboard({
  tutorId,
  tutorName,
}: TutorCreatorDashboardProps) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TutorialForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Derived
  const availableSubjects = CURRICULUM_SUBJECTS[form.curriculum];
  const availableGrades = GRADE_LEVELS_BY_CURRICULUM[form.curriculum];

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalViews = tutorials.reduce((sum, t) => sum + t.watchCount, 0);
  const avgRating =
    tutorials.length > 0
      ? (tutorials.reduce((sum, t) => sum + t.rating, 0) / tutorials.length).toFixed(1)
      : "–";
  const published = tutorials.filter((t) => t.status === "published").length;

  useEffect(() => {
    const fetchTutorials = async () => {
      try {
        const { data, error } = await supabase
          .from("tutor_tutorials")
          .select("*")
          .eq("tutor_id", tutorId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped: Tutorial[] = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          subject: row.subject,
          topic: row.topic,
          grade: row.grade || "",
          curriculum: row.curriculum || "ZIMSEC",
          status: row.status as "draft" | "published" | "archived",
          watchCount: row.watch_count || 0,
          rating: row.rating || 0,
          reviewCount: row.review_count || 0,
          completionRate: row.completion_rate || 0,
          createdAt: row.created_at,
        }));

        setTutorials(mapped);
      } catch (error) {
        console.warn("Failed to load tutor tutorials:", error);
      }
    };

    if (tutorId) {
      fetchTutorials();
    }
  }, [tutorId]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const updateForm = (field: keyof TutorialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
  };

  const openEdit = (tutorial: Tutorial) => {
    setForm({
      title: tutorial.title,
      description: "",
      subject: tutorial.subject,
      topic: tutorial.topic,
      subtopic: "",
      grade: tutorial.grade,
      curriculum: tutorial.curriculum as Curriculum,
      videoUrl: "",
      durationLabel: "",
    });
    setEditingId(tutorial.id);
    setShowForm(true);
  };

  // ── Save / Submit ──────────────────────────────────────────────────────────

  const handleSubmit = async (publishNow: boolean) => {
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    if (!form.subject) { setFormError("Please select a subject"); return; }
    if (!form.topic.trim()) { setFormError("Topic is required"); return; }

    setSaving(true);
    try {
      const payload = {
        tutor_id: tutorId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject: form.subject,
        topic: form.topic.trim(),
        subtopic: form.subtopic.trim() || null,
        grade: form.grade || null,
        curriculum: form.curriculum,
        video_url: form.videoUrl.trim() || null,
        duration_label: form.durationLabel.trim() || null,
        status: publishNow ? "published" : "draft",
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("tutor_tutorials")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        setTutorials((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  title: form.title,
                  subject: form.subject,
                  topic: form.topic,
                  grade: form.grade,
                  curriculum: form.curriculum,
                  status: publishNow ? "published" : t.status,
                }
              : t
          )
        );
      } else {
        const { data, error } = await supabase
          .from("tutor_tutorials")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const newTutorial: Tutorial = {
            id: data.id,
            title: data.title,
            subject: data.subject,
            topic: data.topic,
            grade: data.grade || "",
            curriculum: data.curriculum || "ZIMSEC",
            status: data.status as "draft" | "published" | "archived",
            watchCount: 0,
            rating: 0,
            reviewCount: 0,
            completionRate: 0,
            createdAt: data.created_at,
          };
          setTutorials((prev) => [newTutorial, ...prev]);
        }
      }

      // Success
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: {
            title: publishNow ? "Tutorial Published!" : "Draft Saved",
            description: publishNow
              ? "Your tutorial is now live in the StudySync Library."
              : "Draft saved. You can publish it later.",
          },
        })
      );
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save tutorial. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("tutor_tutorials").delete().eq("id", id);
      setTutorials((prev) => prev.filter((t) => t.id !== id));
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { title: "Tutorial deleted", description: "The tutorial has been removed." },
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleTogglePublish = async (tutorial: Tutorial) => {
    const newStatus = tutorial.status === "published" ? "draft" : "published";
    try {
      await supabase
        .from("tutor_tutorials")
        .update({ status: newStatus })
        .eq("id", tutorial.id);
      setTutorials((prev) =>
        prev.map((t) => (t.id === tutorial.id ? { ...t, status: newStatus } : t))
      );
    } catch {
      /* ignore */
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            My Tutorials
          </h2>
          <p className="text-xs text-muted-foreground">
            Create tutorials · reach thousands of students
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Upload Tutorial
        </Button>
      </div>

      {/* Stats */}
      {tutorials.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Published", value: published, icon: CheckCircle2, color: "text-green-600" },
            { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-blue-600" },
            { label: "Avg Rating", value: avgRating, icon: Star, color: "text-yellow-500" },
            { label: "Tutorials", value: tutorials.length, icon: BookOpen, color: "text-primary" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                <p className="text-base font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tutorial list */}
      {tutorials.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Video className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Become an Educational Creator</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Upload your first tutorial and get discovered by thousands of students across ZIMSEC, Cambridge &amp; more.
              </p>
            </div>
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Tutorial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tutorials.map((tutorial) => (
            <Card key={tutorial.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm truncate">{tutorial.title}</h4>
                      <Badge
                        variant={
                          tutorial.status === "published"
                            ? "default"
                            : tutorial.status === "draft"
                            ? "secondary"
                            : "outline"
                        }
                        className={`text-[10px] ${tutorial.status === "published" ? "bg-green-600" : ""}`}
                      >
                        {tutorial.status === "published" ? (
                          <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Live</>
                        ) : (
                          <><Clock className="h-2.5 w-2.5 mr-0.5" />Draft</>
                        )}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-[10px]">{tutorial.subject}</Badge>
                      <Badge variant="outline" className="text-[10px]">{tutorial.topic}</Badge>
                      {tutorial.grade && (
                        <Badge variant="outline" className="text-[10px]">{tutorial.grade}</Badge>
                      )}
                    </div>

                    {tutorial.watchCount > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {tutorial.watchCount} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {tutorial.rating > 0 ? tutorial.rating : "No ratings"}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {tutorial.completionRate}% completion
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(tutorial)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tutorial.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleTogglePublish(tutorial)}
                  >
                    {tutorial.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Upload / Edit Form Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); setShowForm(false); } }}>
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
                onChange={(e) => updateForm("title", e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="What will students learn? What topics are covered?"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={3}
              />
            </div>

            {/* Curriculum + Grade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Curriculum *</Label>
                <Select
                  value={form.curriculum}
                  onValueChange={(v) => {
                    updateForm("curriculum", v);
                    updateForm("subject", "");
                    updateForm("grade", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRICULUM_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Grade</Label>
                <Select
                  value={form.grade}
                  onValueChange={(v) => updateForm("grade", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGrades.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject + Topic */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Select
                  value={form.subject}
                  onValueChange={(v) => updateForm("subject", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
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
                  onChange={(e) => updateForm("topic", e.target.value)}
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
                onChange={(e) => updateForm("subtopic", e.target.value)}
              />
            </div>

            {/* Video URL */}
            <div className="space-y-1.5">
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                placeholder="YouTube, Loom, or direct link"
                value={form.videoUrl}
                onChange={(e) => updateForm("videoUrl", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste a YouTube, Loom or Vimeo link. Direct upload coming soon.
              </p>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g. 22 min"
                value={form.durationLabel}
                onChange={(e) => updateForm("durationLabel", e.target.value)}
              />
            </div>

            {/* Info card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>After publishing</strong>, your tutorial will automatically appear in the StudySync Library under the matching subject rack, search results, and topic learning hubs.
                </p>
              </CardContent>
            </Card>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                disabled={saving}
                onClick={() => handleSubmit(false)}
              >
                Save as Draft
              </Button>
              <Button
                className="flex-1"
                disabled={saving}
                onClick={() => handleSubmit(true)}
              >
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
    </div>
  );
}
