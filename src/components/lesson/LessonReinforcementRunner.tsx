import { useEffect, useState } from "react";
import { Check, X, Sparkles, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";

interface QuizQ { question: string; options: string[]; correct_index: number; explanation: string; concept: string }
interface Flashcard { front: string; back: string; concept: string }

interface ReinforcementSet {
  id: string;
  booking_id: string;
  learner_id: string;
  quiz: QuizQ[];
  flashcards: Flashcard[];
  concepts: string[];
  mastery_baseline: Record<string, number>;
  mastery_after: Record<string, number> | null;
}

interface Props {
  reinforcementId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Phase = "quiz" | "flashcards" | "results";

export function LessonReinforcementRunner({ reinforcementId, open, onOpenChange }: Props) {
  const [set, setSet] = useState<ReinforcementSet | null>(null);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [perConcept, setPerConcept] = useState<Record<string, { correct: number; total: number }>>({});
  const [fIdx, setFIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb.from("lesson_reinforcement_sets").select("*").eq("id", reinforcementId).maybeSingle();
      setSet(data);
      setPhase("quiz"); setQIdx(0); setSelected(null); setPerConcept({}); setFIdx(0); setFlipped(false);
    })();
  }, [reinforcementId, open]);

  if (!set) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><DialogTitle>Loading…</DialogTitle></DialogContent>
      </Dialog>
    );
  }

  const totalQ = set.quiz.length;
  const totalF = set.flashcards.length;
  const q = set.quiz[qIdx];

  const submitAnswer = (idx: number) => {
    if (selected != null) return;
    setSelected(idx);
    const correct = idx === q.correct_index;
    setPerConcept((prev) => {
      const cur = prev[q.concept] ?? { correct: 0, total: 0 };
      return { ...prev, [q.concept]: { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 } };
    });
  };

  const nextQ = async () => {
    setSelected(null);
    if (qIdx + 1 < totalQ) { setQIdx(qIdx + 1); return; }
    // Quiz finished — persist concept_attempts and move to flashcards.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const rows = Object.entries(perConcept).map(([concept, s]) => ({
      user_id: set.learner_id,
      concept_label: concept,
      surface: "lesson_reinforcement",
      was_correct: s.correct >= Math.ceil(s.total / 2),
      marks_awarded: s.correct,
      marks_possible: s.total,
      source_id: set.id,
      source_table: "lesson_reinforcement_sets",
    }));
    if (rows.length) await sb.from("concept_attempts").insert(rows);
    setPhase(totalF > 0 ? "flashcards" : "results");
  };

  const finishFlashcards = async () => {
    const masteryAfter: Record<string, number> = {};
    for (const c of set.concepts) {
      const s = perConcept[c];
      const baseline = set.mastery_baseline[c] ?? 0;
      masteryAfter[c] = s ? Math.round((s.correct / s.total) * 100) : baseline;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("lesson_reinforcement_sets").update({
      mastery_after: masteryAfter, completed_at: new Date().toISOString(),
    }).eq("id", set.id);
    setSet({ ...set, mastery_after: masteryAfter });
    setPhase("results");
    // Unified learning timeline (best-effort).
    try {
      const { logLearningEvent } = await import("@/lib/learningEvents");
      const totals = Object.values(perConcept).reduce(
        (acc, s) => ({ correct: acc.correct + s.correct, total: acc.total + s.total }),
        { correct: 0, total: 0 },
      );
      const scorePct = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : null;
      const deltas = set.concepts.map((c) => (masteryAfter[c] ?? 0) - (set.mastery_baseline[c] ?? 0));
      const masteryDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
      await logLearningEvent({
        source: "lesson_reinforcement",
        userId: set.learner_id,
        scorePct,
        masteryDelta,
        payload: {
          reinforcement_id: set.id,
          concepts: set.concepts,
          mastery_before: set.mastery_baseline,
          mastery_after: masteryAfter,
        },
      });
    } catch { /* best-effort */ }
  };

  const renderResults = () => {
    const after = set.mastery_after ?? {};
    const concepts = set.concepts;
    const deltas = concepts.map((c) => ({ c, before: set.mastery_baseline[c] ?? 0, after: after[c] ?? 0 }));
    const overall = deltas.length ? Math.round(deltas.reduce((s, d) => s + (d.after - d.before), 0) / deltas.length) : 0;
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 p-4 flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <div className="text-sm font-semibold">Mastery progression</div>
            <div className="text-xs text-muted-foreground">Average delta: <span className={overall >= 0 ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>{overall >= 0 ? "+" : ""}{overall}%</span></div>
          </div>
        </div>
        <div className="space-y-3">
          {deltas.map((d) => (
            <div key={d.c} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium truncate">{d.c}</span>
                <span className="text-muted-foreground">{d.before}% → <span className="font-semibold text-foreground">{d.after}%</span></span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-muted-foreground/40" style={{ width: `${d.before}%` }} />
                <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${d.after}%` }} />
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {phase === "quiz" && `Quiz · ${qIdx + 1}/${totalQ}`}
            {phase === "flashcards" && `Flashcards · ${fIdx + 1}/${totalF}`}
            {phase === "results" && "Reinforcement complete"}
          </DialogTitle>
        </DialogHeader>

        {phase === "quiz" && q && (
          <div className="space-y-4">
            <Progress value={((qIdx + (selected != null ? 1 : 0)) / totalQ) * 100} />
            <Badge variant="outline" className="text-[10px]">{q.concept}</Badge>
            <div className="text-sm font-medium"><MathMarkdown>{q.question}</MathMarkdown></div>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correct_index;
                const isPicked = selected === i;
                const reveal = selected != null;
                return (
                  <button
                    key={i}
                    disabled={selected != null}
                    onClick={() => submitAnswer(i)}
                    className={`w-full text-left text-sm rounded-lg border p-3 flex items-start gap-2 transition-colors ${
                      reveal && isCorrect ? "border-emerald-500 bg-emerald-500/10" :
                      reveal && isPicked ? "border-destructive bg-destructive/10" :
                      "border-border hover:bg-muted"
                    }`}
                  >
                    {reveal && isCorrect && <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
                    {reveal && isPicked && !isCorrect && <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    <span className="flex-1"><MathMarkdown>{opt}</MathMarkdown></span>
                  </button>
                );
              })}
            </div>
            {selected != null && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <MathMarkdown>{q.explanation}</MathMarkdown>
              </div>
            )}
            {selected != null && (
              <Button className="w-full" onClick={nextQ}>{qIdx + 1 < totalQ ? "Next question" : (totalF > 0 ? "Continue to flashcards" : "See results")}</Button>
            )}
          </div>
        )}

        {phase === "flashcards" && (
          <div className="space-y-4">
            <Progress value={((fIdx) / totalF) * 100} />
            <Badge variant="outline" className="text-[10px]">{set.flashcards[fIdx].concept}</Badge>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full min-h-[12rem] rounded-xl border bg-card p-5 text-left flex flex-col justify-center transition-colors hover:bg-muted/40"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">{flipped ? "Answer" : "Question"} · tap to flip</div>
              <div className="text-sm font-medium"><MathMarkdown>{flipped ? set.flashcards[fIdx].back : set.flashcards[fIdx].front}</MathMarkdown></div>
            </button>
            <Button className="w-full" onClick={() => {
              if (fIdx + 1 < totalF) { setFIdx(fIdx + 1); setFlipped(false); }
              else finishFlashcards();
            }}>{fIdx + 1 < totalF ? "Next card" : "Finish"}</Button>
          </div>
        )}

        {phase === "results" && renderResults()}
      </DialogContent>
    </Dialog>
  );
}
