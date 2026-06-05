import { useEffect, useState } from "react";
import { Bot, ChevronDown, ChevronUp, FileText, ListChecks, BookMarked, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";
import { LessonTranscriptDialog } from "./LessonTranscriptDialog";
import { LessonReinforcementRunner } from "./LessonReinforcementRunner";

interface Props {
  bookingId: string;
  audience: "learner" | "tutor";
}

interface NotesRow {
  summary: string | null;
  key_points: string[];
  action_items: string[];
  vocabulary: { term: string; definition: string }[];
}

interface TranscriptRow {
  full_text: string;
  segments?: Array<{ idx: number; speaker: "Tutor" | "Learner" | "Unknown"; text: string }>;
}

export function LessonNotesCard({ bookingId, audience }: Props) {
  const [notes, setNotes] = useState<NotesRow | null>(null);
  const [transcript, setTranscript] = useState<TranscriptRow | null>(null);
  const [reinforcementId, setReinforcementId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [showReinf, setShowReinf] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [n, t, r] = await Promise.all([
        sb.from("lesson_notes").select("summary,key_points,action_items,vocabulary").eq("booking_id", bookingId).eq("audience", audience).maybeSingle(),
        sb.from("lesson_transcripts").select("full_text,segments").eq("booking_id", bookingId).maybeSingle(),
        sb.from("lesson_reinforcement_sets").select("id").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!cancelled) {
        setNotes(n.data ?? null);
        setTranscript(t.data ?? null);
        setReinforcementId(r.data?.id ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, audience]);

  if (loading) return null;
  if (!notes && !transcript) return null;

  return (
    <Card className="mt-2 border-primary/20">
      <CardContent className="p-3 space-y-2">
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gradient-to-r from-accent to-primary">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">Lesson notes</span>
            <Badge variant="secondary" className="text-[10px]">AI</Badge>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {open && notes && (
          <div className="space-y-3 pt-1">
            {notes.summary && (<div className="text-sm"><MathMarkdown>{notes.summary}</MathMarkdown></div>)}

            {!!notes.key_points?.length && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                  <FileText className="h-3 w-3" /> Key points
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {notes.key_points.map((p, i) => (<li key={i}><MathMarkdown>{p}</MathMarkdown></li>))}
                </ul>
              </div>
            )}

            {!!notes.action_items?.length && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                  <ListChecks className="h-3 w-3" /> Action items
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {notes.action_items.map((p, i) => (<li key={i}><MathMarkdown>{p}</MathMarkdown></li>))}
                </ul>
              </div>
            )}

            {!!notes.vocabulary?.length && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                  <BookMarked className="h-3 w-3" /> Vocabulary
                </div>
                <div className="space-y-1">
                  {notes.vocabulary.map((v, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{v.term}:</span>{" "}
                      <span className="text-muted-foreground"><MathMarkdown>{v.definition}</MathMarkdown></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {transcript && (
                <Button size="sm" variant="outline" onClick={() => setShowTx(true)}>View transcript</Button>
              )}
              {audience === "learner" && reinforcementId && (
                <Button size="sm" onClick={() => setShowReinf(true)} className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Reinforce this lesson
                </Button>
              )}
            </div>
          </div>
        )}

        {transcript && (
          <LessonTranscriptDialog
            open={showTx}
            onOpenChange={setShowTx}
            segments={transcript.segments ?? []}
            fullText={transcript.full_text}
          />
        )}

        {reinforcementId && (
          <LessonReinforcementRunner
            reinforcementId={reinforcementId}
            open={showReinf}
            onOpenChange={setShowReinf}
          />
        )}
      </CardContent>
    </Card>
  );
}
