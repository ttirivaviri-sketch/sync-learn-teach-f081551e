/**
 * SyllabusSetupGate
 *
 * A gate component that requires students to configure their syllabus details
 * (syllabus names, paper codes) and optionally upload documents before they
 * can access daily tasks in Study Mode.
 */

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Upload, ChevronDown, ChevronUp, AlertCircle, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AcademicProfile } from "@/types/academicProfile";
import { logger } from "@/utils/logger";

// Sub-components
import { SyllabusEntryCard } from "@/components/syllabus/SyllabusEntryCard";
import { AddSubjectForm } from "@/components/syllabus/AddSubjectForm";
import { ProfileImportBanner } from "@/components/syllabus/ProfileImportBanner";

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
  onSetupComplete?: () => void;
  advisory?: boolean;
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
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // New entry form state
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSyllabusCode, setNewSyllabusCode] = useState("");
  const [newPaperCode, setNewPaperCode] = useState("");
  const [newPaperCodes, setNewPaperCodes] = useState<string[]>([]);

  // Edit form state
  const [editSyllabusCode, setEditSyllabusCode] = useState("");
  const [editPaperCode, setEditPaperCode] = useState("");
  const [editPaperCodes, setEditPaperCodes] = useState<string[]>([]);

  // ── Load entries ──────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, syllabus_code, topics")
        .eq("user_id", userId);
      if (error) throw error;

      const loaded: SyllabusEntry[] = (data || []).map((row: any) => {
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

      const { data: metaData } = await supabase
        .from("academic_profiles")
        .select("id, subjects")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metaData?.subjects && Array.isArray(metaData.subjects)) {
        const existingNames = new Set(loaded.map((e) => e.subject_name.toLowerCase()));
        const missingSubjects = metaData.subjects.filter(
          (s: string) => !existingNames.has(s.toLowerCase())
        );
        if (missingSubjects.length > 0 && loaded.length === 0) {
          setShowAddForm(true);
        }
      }
    } catch (err) {
      logger.error("Error loading syllabus entries:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Setup completeness ────────────────────────────────────────────────────
  const isSetupComplete = entries.length > 0 && entries.every((e) => e.subject_name.trim() !== "");

  useEffect(() => {
    if (isSetupComplete) onSetupComplete?.();
  }, [isSetupComplete, onSetupComplete]);

  // ── Paper code helpers ────────────────────────────────────────────────────
  const addNewPaperCode = () => {
    const code = newPaperCode.trim().toUpperCase();
    if (code && !newPaperCodes.includes(code)) {
      setNewPaperCodes((prev) => [...prev, code]);
      setNewPaperCode("");
    }
  };

  const addEditPaperCode = () => {
    const code = editPaperCode.trim().toUpperCase();
    if (code && !editPaperCodes.includes(code)) {
      setEditPaperCodes((prev) => [...prev, code]);
      setEditPaperCode("");
    }
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleAddEntry = async () => {
    const subject = newSubjectName.trim();
    const syllabusCode = newSyllabusCode.trim().toUpperCase();
    if (!subject) {
      toast({ title: "Subject name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Match by canonical name (strips "(IGCSE)" etc.) so we update instead of duplicating
      const { findExistingSubjectId } = await import("@/lib/subjectName");
      const existingId = await findExistingSubjectId(supabase, userId, subject);

      if (existingId) {
        await supabase.from("subjects").update({
          syllabus_code: syllabusCode || null,
          updated_at: new Date().toISOString(),
        }).eq("id", existingId);
      } else {
        const topicsWithCodes = newPaperCodes.map((code, idx) => ({
          id: `paper-${idx + 1}`, name: `Paper ${code}`, paper_code: code,
          subtopics: [], learningObjectives: [], concepts: [], examWeight: 0, prerequisites: [],
        }));
        await supabase.from("subjects").insert({
          user_id: userId, name: subject,
          syllabus_code: syllabusCode || null,
          topics: topicsWithCodes.length > 0 ? topicsWithCodes : ([] as any),
        });
      }

      const { error: lsError } = await supabase
        .from("learner_subjects")
        .upsert({ user_id: userId, subject }, { onConflict: "user_id,subject" });
      if (lsError && lsError.code !== "23505") {
        logger.warn("learner_subjects sync warning:", lsError);
      }

      toast({ title: "Subject added", description: `${subject} has been saved.` });
      setNewSubjectName(""); setNewSyllabusCode(""); setNewPaperCode(""); setNewPaperCodes([]);
      setShowAddForm(false);
      await loadEntries();
    } catch (err) {
      logger.error("Error saving syllabus entry:", err);
      toast({ title: "Error", description: "Failed to save subject.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: SyllabusEntry) => {
    setEditingId(entry.id);
    setEditSyllabusCode(entry.syllabus_code);
    setEditPaperCodes([...entry.paper_codes]);
    setEditPaperCode("");
  };

  const handleSaveEdit = async (entry: SyllabusEntry) => {
    setSaving(true);
    try {
      const syllabusCode = editSyllabusCode.trim().toUpperCase();
      const { data: subjectData } = await supabase
        .from("subjects").select("topics").eq("id", entry.id).single();

      let topics = Array.isArray(subjectData?.topics) ? [...(subjectData.topics as any[])] : [];
      const existingPaperCodes = new Set(topics.filter((t: any) => t.paper_code).map((t: any) => t.paper_code));
      for (const code of editPaperCodes) {
        if (!existingPaperCodes.has(code)) {
          topics.push({
            id: `paper-${Date.now()}-${code}`, name: `Paper ${code}`, paper_code: code,
            subtopics: [], learningObjectives: [], concepts: [], examWeight: 0, prerequisites: [],
          });
        }
      }
      topics = topics.filter((t: any) => !t.paper_code || editPaperCodes.includes(t.paper_code));

      await supabase.from("subjects").update({
        syllabus_code: syllabusCode || null,
        topics: topics as any,
        updated_at: new Date().toISOString(),
      }).eq("id", entry.id);

      toast({ title: "Updated", description: `${entry.subject_name} has been updated.` });
      setEditingId(null);
      await loadEntries();
    } catch (err) {
      logger.error("Error updating syllabus entry:", err);
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: SyllabusEntry) => {
    setSaving(true);
    try {
      await supabase.from("subjects").delete().eq("id", entry.id);
      toast({ title: "Removed", description: `${entry.subject_name} has been removed.` });
      await loadEntries();
    } catch (err) {
      logger.error("Error deleting entry:", err);
      toast({ title: "Error", description: "Failed to remove.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Re-parse the most recent uploaded syllabus PDF for this subject using the
  // improved extraction pipeline (real PDF text + exam-board metadata).
  const handleReparse = async (entry: SyllabusEntry) => {
    setReparsingId(entry.id);
    try {
      // Find the most recent syllabus document for this subject
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("id, file_path, name")
        .eq("user_id", userId)
        .eq("type", "syllabus")
        .ilike("subject", entry.subject_name)
        .order("created_at", { ascending: false })
        .limit(1);

      if (docsErr) throw docsErr;
      if (!docs || docs.length === 0) {
        toast({
          title: "No syllabus PDF found",
          description: `Upload a syllabus PDF for ${entry.subject_name} first.`,
          variant: "destructive",
        });
        return;
      }

      const doc = docs[0];

      // Download the original file
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (dlErr || !fileBlob) throw dlErr || new Error("Could not download PDF");

      // Re-extract text using the improved PDF extractor
      const { extractTextFromFile, chunkText } = await import("@/studymode/lib/pdfExtractor");
      const file = new File([fileBlob], doc.name, { type: "application/pdf" });
      const fullText = await extractTextFromFile(file);
      const chunks = chunkText(fullText, 80_000);

      toast({ title: "Re-parsing…", description: `Reading ${chunks.length} section(s) of ${doc.name}.` });

      const result = await supabase.functions.invoke("parse-document", {
        body: {
          documentId: doc.id,
          content: fullText,
          chunks,
          totalChunks: chunks.length,
          documentType: "syllabus",
          subject: entry.subject_name,
        },
      });

      if (result.error) throw result.error;

      const topicCount = result.data?.parsed?.topics?.length || 0;
      toast({
        title: "Syllabus re-parsed",
        description: `${topicCount} topics extracted with full exam-board metadata.`,
      });
      await loadEntries();
    } catch (err) {
      logger.error("Re-parse error:", err);
      toast({
        title: "Re-parse failed",
        description: err instanceof Error ? err.message : "Could not re-parse the syllabus.",
        variant: "destructive",
      });
    } finally {
      setReparsingId(null);
    }
  };


  const autoPopulateFromProfile = async () => {
    if (!academicProfile?.subjects || academicProfile.subjects.length === 0) {
      toast({ title: "No subjects in profile", description: "Set your academic profile first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { findExistingSubjectId } = await import("@/lib/subjectName");
      for (const subjectName of academicProfile.subjects) {
        const existingId = await findExistingSubjectId(supabase, userId, subjectName);
        if (!existingId) {
          await supabase.from("subjects").insert({ user_id: userId, name: subjectName, syllabus_code: null, topics: [] });
        }
        await supabase.from("learner_subjects")
          .upsert({ user_id: userId, subject: subjectName }, { onConflict: "user_id,subject" })
          .then(() => {});
      }
      toast({ title: "Subjects imported", description: `${academicProfile.subjects.length} subjects from your academic profile.` });
      await loadEntries();
    } catch (err) {
      logger.error("Auto-populate error:", err);
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
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
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
            <SyllabusEntryCard
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              saving={saving}
              reparsing={reparsingId === entry.id}
              editSyllabusCode={editSyllabusCode}
              editPaperCode={editPaperCode}
              editPaperCodes={editPaperCodes}
              onStartEdit={startEdit}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
              onReparse={handleReparse}
              onEditSyllabusCodeChange={setEditSyllabusCode}
              onEditPaperCodeChange={setEditPaperCode}
              onAddEditPaperCode={addEditPaperCode}
              onRemoveEditPaperCode={(code) => setEditPaperCodes((prev) => prev.filter((c) => c !== code))}
            />
          ))}

          {/* Quick import from profile */}
          <ProfileImportBanner
            subjects={unaddedProfileSubjects}
            saving={saving}
            onImport={autoPopulateFromProfile}
          />

          {/* Add new entry form */}
          {showAddForm ? (
            <AddSubjectForm
              newSubjectName={newSubjectName}
              newSyllabusCode={newSyllabusCode}
              newPaperCode={newPaperCode}
              newPaperCodes={newPaperCodes}
              saving={saving}
              onSubjectNameChange={setNewSubjectName}
              onSyllabusCodeChange={setNewSyllabusCode}
              onPaperCodeChange={setNewPaperCode}
              onAddPaperCode={addNewPaperCode}
              onRemovePaperCode={(code) => setNewPaperCodes((prev) => prev.filter((c) => c !== code))}
              onSubmit={handleAddEntry}
              onCancel={() => {
                setShowAddForm(false);
                setNewSubjectName(""); setNewSyllabusCode(""); setNewPaperCodes([]);
              }}
            />
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowAddForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Subject Manually
              </Button>
              {onUploadDocuments && (
                <Button size="sm" variant="outline" className="flex-1" onClick={onUploadDocuments}>
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
