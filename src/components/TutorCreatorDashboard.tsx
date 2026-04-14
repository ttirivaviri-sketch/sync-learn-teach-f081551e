import { useState, useEffect } from "react";
import { Video, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import type { Curriculum } from "@/types/academicProfile";

// Sub-components
import { TutorialStatsGrid } from "@/components/tutor-creator/TutorialStatsGrid";
import { TutorialCard, type Tutorial } from "@/components/tutor-creator/TutorialCard";
import { TutorialFormDialog, type TutorialForm } from "@/components/tutor-creator/TutorialFormDialog";
import { ContentComplianceModal, hasAcceptedCompliance } from "@/components/tutor-creator/ContentComplianceModal";

// ─── Constants ────────────────────────────────────────────────────────────────

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

interface TutorCreatorDashboardProps {
  tutorId: string;
  tutorName: string;
}

export function TutorCreatorDashboard({ tutorId, tutorName }: TutorCreatorDashboardProps) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [form, setForm] = useState<TutorialForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingTutorials, setLoadingTutorials] = useState(true);

  const handleUploadClick = () => {
    resetForm();
    if (hasAcceptedCompliance()) {
      setShowForm(true);
    } else {
      setShowCompliance(true);
    }
  };

  const handleComplianceAccepted = () => {
    setShowCompliance(false);
    setShowForm(true);
  };

  // ── Load tutorials from Supabase ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingTutorials(true);
      try {
        const { data, error } = await supabase
          .from("tutor_tutorials")
          .select("*")
          .eq("tutor_id", tutorId)
          .order("created_at", { ascending: false });
        if (error) {
          logger.warn("tutor_tutorials load error:", error.message);
        } else if (data) {
          setTutorials(
            (data as unknown as Array<{
              id: string; title: string; subject: string; topic: string;
              grade: string | null; curriculum: string | null; status: string;
              watch_count: number | null; rating: number | null;
              review_count: number | null; completion_rate: number | null;
              created_at: string;
            }>).map((row) => ({
              id: row.id,
              title: row.title,
              subject: row.subject,
              topic: row.topic,
              grade: row.grade || "",
              curriculum: row.curriculum || "ZIMSEC",
              status: (row.status as "draft" | "published" | "archived") || "draft",
              watchCount: row.watch_count ?? 0,
              rating: row.rating ?? 0,
              reviewCount: row.review_count ?? 0,
              completionRate: row.completion_rate ?? 0,
              createdAt: row.created_at,
            }))
          );
        }
      } catch (err) {
        logger.warn("Error loading tutorials:", err);
      } finally {
        setLoadingTutorials(false);
      }
    };
    if (tutorId) load();
  }, [tutorId]);

  // ── Derived stats ──────────────────────────────────────────────────────
  const totalViews = tutorials.reduce((sum, t) => sum + t.watchCount, 0);
  const avgRating =
    tutorials.length > 0
      ? (tutorials.reduce((sum, t) => sum + t.rating, 0) / tutorials.length).toFixed(1)
      : "–";
  const published = tutorials.filter((t) => t.status === "published").length;

  // ── Form helpers ──────────────────────────────────────────────────────
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

  // ── Save / Submit ─────────────────────────────────────────────────────
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
        const { error } = await supabase.from("tutor_tutorials").update(payload).eq("id", editingId);
        if (error) throw error;
        setTutorials((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? { ...t, title: form.title, subject: form.subject, topic: form.topic, grade: form.grade, curriculum: form.curriculum, status: publishNow ? "published" : t.status }
              : t
          )
        );
      } else {
        const { data, error } = await supabase.from("tutor_tutorials").insert(payload).select().single();
        if (error) throw error;
        if (data) {
          const newTutorial: Tutorial = {
            id: data.id, title: data.title, subject: data.subject, topic: data.topic,
            grade: data.grade || "", curriculum: data.curriculum || "ZIMSEC",
            status: data.status as "draft" | "published" | "archived",
            watchCount: 0, rating: 0, reviewCount: 0, completionRate: 0, createdAt: data.created_at,
          };
          setTutorials((prev) => [newTutorial, ...prev]);
        }
      }

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
      await supabase.from("tutor_tutorials").update({ status: newStatus }).eq("id", tutorial.id);
      setTutorials((prev) => prev.map((t) => (t.id === tutorial.id ? { ...t, status: newStatus } : t)));
    } catch {
      /* ignore */
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
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
        <Button size="sm" onClick={handleUploadClick}>
          <Plus className="h-4 w-4 mr-1" />
          Upload Tutorial
        </Button>
      </div>

      {/* Stats */}
      {tutorials.length > 0 && (
        <TutorialStatsGrid
          published={published}
          totalViews={totalViews}
          avgRating={avgRating}
          totalTutorials={tutorials.length}
        />
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
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <TutorialFormDialog
        open={showForm}
        editingId={editingId}
        form={form}
        saving={saving}
        formError={formError}
        onOpenChange={setShowForm}
        onUpdateForm={updateForm}
        onSubmit={handleSubmit}
        onReset={resetForm}
      />
    </div>
  );
}
