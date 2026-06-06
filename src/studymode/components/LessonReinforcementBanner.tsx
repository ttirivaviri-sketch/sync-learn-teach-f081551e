import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LessonReinforcementRunner } from "@/components/lesson/LessonReinforcementRunner";

/**
 * Dashboard banner that surfaces the most recent uncompleted lesson
 * reinforcement set for the current learner. Tapping it opens the runner.
 */
export function LessonReinforcementBanner() {
  const [reinforcementId, setReinforcementId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from("lesson_reinforcement_sets")
        .select("id")
        .eq("learner_id", uid)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setReinforcementId(data?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!reinforcementId) return null;

  return (
    <>
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-3 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-primary to-accent">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Reinforce your last lesson</div>
          <div className="text-xs text-muted-foreground">Short quiz + flashcards to lock in what you covered.</div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>Start</Button>
      </Card>
      <LessonReinforcementRunner
        reinforcementId={reinforcementId}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            // Re-check so the banner hides once finished.
            setReinforcementId(null);
          }
        }}
      />
    </>
  );
}
