/**
 * GenerateFromDocPanel — P10/P11 teacher UX.
 * Pops over a school_ai_documents card and lets the teacher kick off
 * Homework / Quiz / Flashcards generation against the doc.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useGenerateHomework,
  useGenerateSchoolQuiz,
  useGenerateSchoolFlashcards,
} from "@/hooks/useSchoolStudyMode";

interface Props {
  schoolId: string;
  classId: string;
  subjectId?: string;
  documentId: string;
  documentTitle: string;
}

type Mode = "homework" | "quiz" | "flashcards";

export function GenerateFromDocPanel({ schoolId, classId, subjectId, documentId, documentTitle }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("homework");
  const [title, setTitle] = useState(documentTitle);
  const [topic, setTopic] = useState(documentTitle);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");

  const hwM = useGenerateHomework();
  const quizM = useGenerateSchoolQuiz();
  const cardsM = useGenerateSchoolFlashcards();
  const busy = hwM.isPending || quizM.isPending || cardsM.isPending;

  const run = async () => {
    try {
      if (mode === "homework") {
        const r = await hwM.mutateAsync({ schoolId, documentId, classId, subjectId, title, topic, difficulty, count });
        toast({ title: "Homework published", description: `${r.count} questions, ${r.total_marks} marks.` });
      } else if (mode === "quiz") {
        const r = await quizM.mutateAsync({ schoolId, documentId, classId, subjectId, title, topic, difficulty, count });
        toast({ title: "Quiz published", description: `${r.count} questions.` });
      } else {
        const r = await cardsM.mutateAsync({ schoolId, documentId, classId, topic, count });
        toast({ title: "Flashcards published", description: `${r.count} cards available to the class.` });
      }
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" /> Generate from this resource
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["homework", "quiz", "flashcards"] as Mode[]).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} className="capitalize">
            {m}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Topic</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Count</Label>
          <Input type="number" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={run} disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate {mode}
      </Button>
    </Card>
  );
}
