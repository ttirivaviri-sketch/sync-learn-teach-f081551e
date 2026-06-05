import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MathMarkdown } from "@/studymode/components/MathMarkdown";

interface Segment { idx: number; speaker: "Tutor" | "Learner" | "Unknown"; text: string }
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  segments: Segment[];
  fullText?: string | null;
}

const STYLES: Record<string, string> = {
  Tutor: "bg-primary/15 text-primary border-primary/30",
  Learner: "bg-accent/15 text-accent-foreground border-accent/30",
  Unknown: "bg-muted text-muted-foreground border-border",
};

export function LessonTranscriptDialog({ open, onOpenChange, segments, fullText }: Props) {
  const list = segments?.length ? segments : (fullText ?? "").split(/\n+/).filter(Boolean).map((line, idx) => {
    const m = line.match(/^(Tutor|Learner|Unknown)\s*:\s*(.*)$/i);
    return { idx, speaker: (m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : "Unknown") as Segment["speaker"], text: m ? m[2] : line };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lesson transcript</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">No transcript available.</p>}
          {list.map((s) => (
            <div key={s.idx} className="flex gap-3">
              <Badge variant="outline" className={`shrink-0 h-fit ${STYLES[s.speaker]}`}>{s.speaker}</Badge>
              <div className="text-sm leading-relaxed flex-1"><MathMarkdown>{s.text}</MathMarkdown></div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
