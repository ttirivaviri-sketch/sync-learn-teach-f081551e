import { useState, useEffect } from "react";
import { Plus, X, BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLearnerSubjects } from "@/hooks/useLearnerSubjects";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

const STUDY_LEVELS = [
  { key: "junior_primary", label: "Junior Primary (Grades 1–4)" },
  { key: "senior_primary", label: "Senior Primary (Grades 5–7)" },
  { key: "junior_high", label: "Junior High (Grades 8–9)" },
  { key: "senior_high", label: "Senior High (Grades 10–12)" },
  { key: "tertiary", label: "College & University" },
] as const;

interface LearnerSyllabusManagerProps {
  userId: string;
  currentStudyLevel?: string | null;
  onProfileUpdated?: () => void;
}

const LearnerSyllabusManager = ({ userId, currentStudyLevel, onProfileUpdated }: LearnerSyllabusManagerProps) => {
  const [newSubject, setNewSubject] = useState("");
  const [studyLevel, setStudyLevel] = useState(currentStudyLevel || "");
  const [savingLevel, setSavingLevel] = useState(false);
  const { subjects, loading, addSubject, removeSubject } = useLearnerSubjects(userId);
  const { toast } = useToast();

  useEffect(() => {
    if (currentStudyLevel) setStudyLevel(currentStudyLevel);
  }, [currentStudyLevel]);

  const handleAddSubject = async () => {
    if (!newSubject.trim()) return;
    const success = await addSubject(newSubject);
    if (success) setNewSubject("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubject();
    }
  };

  const handleUpdateLevel = async (level: string) => {
    setStudyLevel(level);
    setSavingLevel(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ study_level: level as any })
        .eq("id", userId);

      if (error) throw error;
      toast({ title: "Grade updated", description: "Your study level has been saved." });
      onProfileUpdated?.();
    } catch (error) {
      logger.error("Error updating study level:", error);
      toast({ title: "Error", description: "Failed to update grade.", variant: "destructive" });
    } finally {
      setSavingLevel(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-5 w-5 text-primary" />
          My Syllabus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grade / Study Level */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            Grade / Study Level
          </label>
          <Select value={studyLevel} onValueChange={handleUpdateLevel} disabled={savingLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Select your grade level" />
            </SelectTrigger>
            <SelectContent>
              {STUDY_LEVELS.map((lvl) => (
                <SelectItem key={lvl.key} value={lvl.key}>
                  {lvl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Add Subject */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Subjects I Need Help With</label>
          <div className="flex gap-2">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Chemistry, Mathematics..."
              className="flex-1"
            />
            <Button onClick={handleAddSubject} size="icon" disabled={!newSubject.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Subject List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subjects added yet. Add subjects you need tutoring for.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <Badge key={sub.id} variant="secondary" className="gap-1 pr-1">
                {sub.subject}
                <button
                  onClick={() => removeSubject(sub.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  aria-label={`Remove ${sub.subject}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LearnerSyllabusManager;
