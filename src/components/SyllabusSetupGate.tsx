/**
 * SyllabusSetupGate
 *
 * A gate component that requires students to configure their syllabus details
 * (syllabus names, paper codes) and optionally upload documents before they
 * can access daily tasks in Study Mode.
 *
 * Students can:
 * 1. Manually add syllabus names and paper codes per subject
 * 2. Upload PDF documents (syllabi, past papers) for parsing
 * 3. Edit their setup at any time
 *
 * All data is persisted to Supabase storage.
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, X, Edit2, Save, Upload, BookOpen, GraduationCap,
  Check, Loader2, ChevronDown, ChevronUp, AlertCircle, Sparkles, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AcademicProfile } from "@/types/academicProfile";

// ── Types ──────────────────────────────────────────────────────────────────
export interface SyllabusEntry {
  id: string;
  subject_name: string;
  syllabus_code: string;
  paper_codes: string[];
  exam_board?: string;
}

interface SyllabusSetupGateProps {
  userId: string;
  academicProfile?: AcademicProfile | null;
  /** Called when setup is complete (all subjects have at least syllabus name) */
  onSetupComplete?: () => void;
  /** If true, the gate is only advisory — daily tasks are still shown */
  advisory?: boolean;
  /** Called when user wants to upload documents */
  onUploadDocuments?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function SyllabusSetupGate({
  userId,
  academicProfile,
  onSetupComplete,
  advisory = false,
  onUploadDocuments,
}: SyllabusSetupGateProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<SyllabusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // New entry form state
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSyllabusCode, setNewSyllabusCode] = useState("");
  const [newPaperCode, setNewPaperCode] = useState("");
  const [newPaperCodes, setNewPaperCodes] = useState<string[]>([]);

  // Edit form state
  const [editSyllabusCode, setEditSyllabusCode] = useState("");
  const [editPaperCode, setEditPaperCode] = useState("");
  const [editPaperCodes, setEditPaperCodes] = useState<string[]>([]);

  // ── Load entries from subjects table ──────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, syllabus_code, topics")
        .eq("user_id", userId);

      if (error) throw error;

      const loaded: SyllabusEntry[] = (data || []).map((row: any) => {
        // Extract paper codes from topics JSON if available
        const topics = Array.isArray(row.topics) ? row.topics : [];
        const paperCodes: string[] = [];
        for (const t of topics) {
          if (t.paper_code && !paperCodes.includes(t.paper_code)) {
            paperCodes.push(t.paper_code);
          }
        }

        return {
          id: row.id,
          subject_name: row.name,
          syllabus_code: row.syllabus_code || "",
          paper_codes: paperCodes,
        };
      });

      setEntries(loaded);

      // Also check for entries stored in academic_profile metadata
      const { data: metaData } = await supabase
        .from("academic_profiles")
        .select("id, subjects")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If academic profile has subjects not in the subjects table, show them as available
      if (metaData?.subjects && Array.isArray(metaData.subjects)) {
        const existingNames = new Set(loaded.map((e) => e.subject_name.toLowerCase()));
        const missingSubjects = metaData.subjects.filter(
          (s: string) => !existingNames.has(s.toLowerCase())
        );
        if (missingSubjects.length > 0 && loaded.length === 0) {
          // Pre-populate form suggestions from academic profile
          setShowAddForm(true);
        }
      }
    } catch (err) {
      console.error("Error loading syllabus entries:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Check if setup is complete ────────────────────────────────────────────
  const isSetupComplete = entries.length > 0 && entries.every((e) => e.subject_name.trim() !== "");

  useEffect(() => {
    if (isSetupComplete) {
      onSetupComplete?.();
    }
  }, [isSetupComplete, onSetupComplete]);

  // ── Add new paper code to pending list ────────────────────────────────────
  const addNewPaperCode = () => {
    const code = newPaperCode.trim().toUpperCase();
    if (code && !newPaperCodes.includes(code)) {
      setNewPaperCodes((prev) => [...prev, code]);
      setNewPaperCode("");
    }
  };

  const removeNewPaperCode = (code: string) => {
    setNewPaperCodes((prev) => prev.filter((c) => c !== code));
  };

  const addEditPaperCode = () => {
    const code = editPaperCode.trim().toUpperCase();
    if (code && !editPaperCodes.includes(code)) {
      setEditPaperCodes((prev) => [...prev, code]);
      setEditPaperCode("");
    }
  };

  const removeEditPaperCode = (code: string) => {
    setEditPaperCodes((prev) => prev.filter((c) => c !== code));
  };

  // ── Save a new syllabus entry ─────────────────────────────────────────────
  const handleAddEntry = async () => {
    const subject = newSubjectName.trim();
    const syllabusCode = newSyllabusCode.trim().toUpperCase();

    if (!subject) {
      toast({ title: "Subject name required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Check if subject already exists
      const { data: existing } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", subject)
        .maybeSingle();

      if (existing?.id) {
        // Update existing
        await supabase
          .from("subjects")
          .update({
            syllabus_code: syllabusCode || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Create new subject with paper codes stored in topics metadata
        const topicsWithCodes = newPaperCodes.map((code, idx) => ({
          id: `paper-${idx + 1}`,
          name: `Paper ${code}`,
          paper_code: code,
          subtopics: [],
          learningObjectives: [],
          concepts: [],
          examWeight: 0,
          prerequisites: [],
        }));

        await supabase.from("subjects").insert({
          user_id: userId,
          name: subject,
          syllabus_code: syllabusCode || null,
          topics: topicsWithCodes.length > 0 ? topicsWithCodes : ([] as any),
        });
      }

      // Also sync to learner_subjects for tutor visibility
      const { error: lsError } = await supabase
        .from("learner_subjects")
        .upsert(
          { user_id: userId, subject: subject },
          { onConflict: "user_id,subject" }
        );
      if (lsError && lsError.code !== "23505") {
        console.warn("learner_subjects sync warning:", lsError);
      }

      toast({ title: "Subject added", description: `${subject} has been saved.` });
      setNewSubjectName("");
      setNewSyllabusCode("");
      setNewPaperCode("");
      setNewPaperCodes([]);
      setShowAddForm(false);
      await loadEntries();
    } catch (err) {
      console.error("Error saving syllabus entry:", err);
      toast({ title: "Error", description: "Failed to save subject.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Start editing an entry ────────────────────────────────────────────────
  const startEdit = (entry: SyllabusEntry) => {
    setEditingId(entry.id);
    setEditSyllabusCode(entry.syllabus_code);
    setEditPaperCodes([...entry.paper_codes]);
    setEditPaperCode("");
  };

  // ── Save edited entry ─────────────────────────────────────────────────────
  const handleSaveEdit = async (entry: SyllabusEntry) => {
    setSaving(true);
    try {
      const syllabusCode = editSyllabusCode.trim().toUpperCase();

      // Fetch existing topics to preserve them
      const { data: subjectData } = await supabase
        .from("subjects")
        .select("topics")
        .eq("id", entry.id)
        .single();

      let topics = Array.isArray(subjectData?.topics) ? [...(subjectData.topics as any[])] : [];

      // Update paper codes — merge with existing topics
      const existingPaperCodes = new Set(topics.filter((t: any) => t.paper_code).map((t: any) => t.paper_code));
      for (const code of editPaperCodes) {
        if (!existingPaperCodes.has(code)) {
          topics.push({
            id: `paper-${Date.now()}-${code}`,
            name: `Paper ${code}`,
            paper_code: code,
            subtopics: [],
            learningObjectives: [],
            concepts: [],
            examWeight: 0,
            prerequisites: [],
          });
        }
      }
      // Remove paper codes that were deleted
      topics = topics.filter(
        (t: any) => !t.paper_code || editPaperCodes.includes(t.paper_code)
      );

      await supabase
        .from("subjects")
        .update({
          syllabus_code: syllabusCode || null,
          topics: topics as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      toast({ title: "Updated", description: `${entry.subject_name} has been updated.` });
      setEditingId(null);
      await loadEntries();
    } catch (err) {
      console.error("Error updating syllabus entry:", err);
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete an entry ───────────────────────────────────────────────────────
  const handleDelete = async (entry: SyllabusEntry) => {
    setSaving(true);
    try {
      await supabase.from("subjects").delete().eq("id", entry.id);
      toast({ title: "Removed", description: `${entry.subject_name} has been removed.` });
      await loadEntries();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast({ title: "Error", description: "Failed to remove.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-populate subjects from academic profile ──────────────────────────
  const autoPopulateFromProfile = async () => {
    if (!academicProfile?.subjects || academicProfile.subjects.length === 0) {
      toast({ title: "No subjects in profile", description: "Set your academic profile first.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const existingNames = new Set(entries.map((e) => e.subject_name.toLowerCase()));

      for (const subjectName of academicProfile.subjects) {
        if (existingNames.has(subjectName.toLowerCase())) continue;

        await supabase.from("subjects").insert({
          user_id: userId,
          name: subjectName,
          syllabus_code: null,
          topics: [],
        });

        // Sync to learner_subjects
        await supabase
          .from("learner_subjects")
          .upsert(
            { user_id: userId, subject: subjectName },
            { onConflict: "user_id,subject" }
          )
          .then(() => {});
      }

      toast({ title: "Subjects imported", description: `${academicProfile.subjects.length} subjects from your academic profile.` });
      await loadEntries();
    } catch (err) {
      console.error("Auto-populate error:", err);
      toast({ title: "Error", description: "Failed to import subjects.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading syllabus setup...</p>
        </CardContent>
      </Card>
    );
  }

  // Subjects from academic profile that haven't been added yet
  const unaddedProfileSubjects = (academicProfile?.subjects || []).filter(
    (s) => !entries.find((e) => e.subject_name.toLowerCase() === s.toLowerCase())
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Syllabus & Paper Codes
          </CardTitle>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Badge variant={isSetupComplete ? "default" : "secondary"} className="text-xs">
                {entries.length} subject{entries.length !== 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {!isSetupComplete && !advisory && (
          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
            <AlertCircle className="h-3 w-3" />
            Add your syllabus details to unlock daily study tasks
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Existing entries */}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              {editingId === entry.id ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{entry.subject_name}</h4>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Syllabus Code</Label>
                      <Input
                        value={editSyllabusCode}
                        onChange={(e) => setEditSyllabusCode(e.target.value)}
                        placeholder="e.g. 4028, 0580"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Paper Codes</Label>
                      <div className="flex gap-2">
                        <Input
                          value={editPaperCode}
                          onChange={(e) => setEditPaperCode(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEditPaperCode())}
                          placeholder="e.g. P1, P2, P3"
                          className="h-8 text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={addEditPaperCode}
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
                                onClick={() => removeEditPaperCode(code)}
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

                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(entry)}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              ) : (
                /* ── View mode ── */
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
                        <Badge key={code} variant="secondary" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                      {!entry.syllabus_code && entry.paper_codes.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">
                          No codes set — tap edit to add
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => startEdit(entry)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Quick import from profile */}
          {unaddedProfileSubjects.length > 0 && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Import from Academic Profile
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={autoPopulateFromProfile}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import All"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {unaddedProfileSubjects.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add new entry form */}
          {showAddForm ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Plus className="h-4 w-4 text-primary" />
                  Add Subject
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSubjectName("");
                    setNewSyllabusCode("");
                    setNewPaperCodes([]);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div>
                <Label className="text-xs">Subject Name *</Label>
                <Input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Mathematics, Physics, Biology"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Syllabus Code</Label>
                <Input
                  value={newSyllabusCode}
                  onChange={(e) => setNewSyllabusCode(e.target.value)}
                  placeholder="e.g. 4028, 0580, 9709"
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Paper Codes</Label>
                <div className="flex gap-2">
                  <Input
                    value={newPaperCode}
                    onChange={(e) => setNewPaperCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewPaperCode())}
                    placeholder="e.g. P1, P2, P3"
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={addNewPaperCode}
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
                          onClick={() => removeNewPaperCode(code)}
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
                onClick={handleAddEntry}
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
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Subject Manually
              </Button>
              {onUploadDocuments && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={onUploadDocuments}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Upload Syllabus PDF
                </Button>
              )}
            </div>
          )}

          {/* Completion status */}
          {entries.length > 0 && (
            <div className={`flex items-center gap-2 text-xs ${isSetupComplete ? "text-green-600" : "text-amber-600"}`}>
              {isSetupComplete ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Setup complete — daily tasks are unlocked</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Add syllabus details for all your subjects to unlock daily tasks</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
