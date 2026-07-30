/**
 * ClassMisconceptionDigest — "what should I re-teach?" card for teachers.
 *
 * Backed by the SECURITY DEFINER RPC get_class_misconception_digest, which
 * aggregates the class's marked homework responses (last 60 days) into the
 * questions with the lowest average score (min 3 marked responses, <60% avg)
 * along with their tagged concepts and known common mistakes.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DigestItem {
  homework_title: string;
  homework_topic: string | null;
  prompt: string;
  concepts: string[];
  common_mistakes: string | null;
  responses: number;
  avg_pct: number;
}

export function ClassMisconceptionDigest({ classId }: { classId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["class-misconceptions", classId],
    enabled: !!classId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_class_misconception_digest",
        { p_class_id: classId },
      );
      if (error) throw error;
      const payload = data as unknown as { items?: DigestItem[] } | null;
      return payload?.items ?? [];
    },
  });

  if (isLoading) {
    return (
      <Card className="p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Analysing homework results…
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card className="p-5 space-y-4 border-amber-500/30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="font-medium text-sm">Re-teach radar</h3>
        <Badge variant="secondary" className="text-[10px]">
          last 60 days
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Homework questions your class scored lowest on (3+ marked answers, under 60%
        average). Consider revisiting these concepts in your next lesson.
      </p>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm leading-snug flex-1">{item.prompt}</p>
              <Badge
                variant="destructive"
                className="shrink-0 text-[11px]"
                title={`${item.responses} marked responses`}
              >
                {item.avg_pct}% avg
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {item.homework_title}
              {item.homework_topic ? ` · ${item.homework_topic}` : ""} ·{" "}
              {item.responses} responses
            </p>
            {item.concepts?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.concepts.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            {item.common_mistakes && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Known pitfall: {item.common_mistakes}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
