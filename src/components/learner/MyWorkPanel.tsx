/**
 * MyWorkPanel — the Learning Filesystem surface.
 *
 * Renders the learner's personal artifacts (homework, notes, reinforcement
 * sets) in one chronological list with kind filters. Powered exclusively by
 * useLearnerArtifacts so every artifact has a single canonical view.
 */
import { useMemo, useState } from "react";
import { FolderOpen, FileText, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLearnerArtifacts, type ArtifactKind, type LearnerArtifact } from "@/hooks/useLearnerArtifacts";
import { haptic } from "@/lib/haptics";

const ICONS: Record<ArtifactKind, typeof FileText> = {
  homework_submission: FileText,
  lesson_notes: BookOpen,
  reinforcement_set: Sparkles,
};

const LABELS: Record<ArtifactKind, string> = {
  homework_submission: "Homework",
  lesson_notes: "Notes",
  reinforcement_set: "Reinforcement",
};

const FILTERS: Array<{ id: "all" | ArtifactKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "homework_submission", label: "Homework" },
  { id: "lesson_notes", label: "Notes" },
  { id: "reinforcement_set", label: "Reinforcement" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60_000);
  return m > 0 ? `${m}m ago` : "just now";
}

export function MyWorkPanel({ userId }: { userId: string | null }) {
  const [filter, setFilter] = useState<"all" | ArtifactKind>("all");
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const { data = [], isLoading } = useLearnerArtifacts({ userId, limit: 50 });

  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((a) => a.kind === filter)),
    [data, filter],
  );
  const shown = expanded ? filtered : filtered.slice(0, 5);

  const open = (a: LearnerArtifact) => {
    haptic("light");
    if (a.route) navigate(a.route);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        My work
      </h3>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </CardContent>
          </Card>
        ) : (
          shown.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <button
                key={a.id}
                onClick={() => open(a)}
                className="w-full text-left active:scale-[0.99] transition-transform"
              >
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{a.title}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {LABELS[a.kind]}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.subtitle}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {typeof a.score_pct === "number" && (
                        <div className="text-xs font-semibold text-primary">
                          {Math.round(a.score_pct)}%
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground">{timeAgo(a.occurred_at)}</div>
                    </div>
                    {a.route && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </CardContent>
                </Card>
              </button>
            );
          })
        )}

        {filtered.length > 5 && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `Show all ${filtered.length}`}
          </Button>
        )}
      </div>
    </section>
  );
}
