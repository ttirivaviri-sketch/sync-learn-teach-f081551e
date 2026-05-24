import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pause, Play, X, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";
import { AllocationDialog } from "@/components/admin/AllocationDialog";

interface Allocation {
  id: string;
  learner_id: string;
  tutor_id: string;
  tutor_subject_id: string;
  weekly_schedule: Array<{ day: string; time: string }>;
  start_date: string;
  end_date: string;
  duration_minutes: number;
  price_per_session: number;
  external_payment_reference: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  learner?: { full_name: string | null; email: string | null };
  tutor?: { full_name: string | null; email: string | null };
  tutor_subjects?: { subject: string; level: string };
  generated_count?: number;
  accepted_count?: number;
}

const Allocations = () => {
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Tutor Allocations | StudySync Admin";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tutor_allocations" as any)
        .select(
          `*,
          learner:profiles!tutor_allocations_learner_id_fkey(full_name,email),
          tutor:profiles!tutor_allocations_tutor_id_fkey(full_name,email),
          tutor_subjects(subject,level)`
        )
        .order("created_at", { ascending: false });

      // If the FK aliases above aren't named, fall back to a simpler query
      let list = data as any[] | null;
      if (error) {
        const fallback = await supabase
          .from("tutor_allocations" as any)
          .select("*")
          .order("created_at", { ascending: false });
        if (fallback.error) throw fallback.error;
        list = fallback.data as any[];

        // Enrich
        const learnerIds = [...new Set(list.map((r) => r.learner_id))];
        const tutorIds = [...new Set(list.map((r) => r.tutor_id))];
        const subjectIds = [...new Set(list.map((r) => r.tutor_subject_id))];
        const [profiles, subjects] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,email")
            .in("id", [...learnerIds, ...tutorIds]),
          supabase
            .from("tutor_subjects")
            .select("id,subject,level")
            .in("id", subjectIds),
        ]);
        const pMap = new Map((profiles.data || []).map((p: any) => [p.id, p]));
        const sMap = new Map((subjects.data || []).map((s: any) => [s.id, s]));
        list = list.map((r) => ({
          ...r,
          learner: pMap.get(r.learner_id),
          tutor: pMap.get(r.tutor_id),
          tutor_subjects: sMap.get(r.tutor_subject_id),
        }));
      }

      // Count generated bookings per allocation
      const allocIds = (list || []).map((r) => r.id);
      if (allocIds.length) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("allocation_id,status")
          .in("allocation_id", allocIds);
        const counts: Record<string, { gen: number; acc: number }> = {};
        for (const b of bookings || []) {
          const k = (b as any).allocation_id as string;
          if (!counts[k]) counts[k] = { gen: 0, acc: 0 };
          counts[k].gen += 1;
          if ((b as any).status === "confirmed" || (b as any).status === "completed") {
            counts[k].acc += 1;
          }
        }
        list = (list || []).map((r) => ({
          ...r,
          generated_count: counts[r.id]?.gen ?? 0,
          accepted_count: counts[r.id]?.acc ?? 0,
        }));
      }

      setRows(list || []);
    } catch (e) {
      logger.error("Failed to load allocations", e);
      toast({ title: "Error", description: "Failed to load allocations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("tutor_allocations" as any)
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Updated", description: `Allocation ${status}.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("generate_allocation_bookings" as any, {
        p_allocation_id: id,
      });
      if (error) throw error;
      toast({ title: "Generated", description: `Created ${data ?? 0} new booking requests.` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const scheduleSummary = (s: Allocation["weekly_schedule"]) =>
    (s || []).map((x) => `${x.day.toUpperCase()} ${x.time}`).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tutor Allocations</h1>
          <p className="text-sm text-muted-foreground">
            Assign tutors to learners on a recurring monthly schedule. Payments are handled outside the app.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New allocation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No allocations yet. Click <strong>New allocation</strong> to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold truncate">
                      {r.learner?.full_name || r.learner?.email || "Learner"}
                    </span>
                    <span className="text-muted-foreground">←</span>
                    <span className="font-semibold truncate">
                      {r.tutor?.full_name || r.tutor?.email || "Tutor"}
                    </span>
                    <Badge variant="outline">{r.tutor_subjects?.subject}</Badge>
                    <Badge
                      variant={
                        r.status === "active" ? "default" : r.status === "paused" ? "secondary" : "outline"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d, yyyy")} ·{" "}
                    {r.duration_minutes}min · R{Number(r.price_per_session).toFixed(2)}/session
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {scheduleSummary(r.weekly_schedule)}
                  </div>
                  <div className="text-xs mt-1">
                    {r.generated_count ?? 0} generated · {r.accepted_count ?? 0} accepted
                    {r.external_payment_reference ? ` · Ref ${r.external_payment_reference}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => regenerate(r.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
                  </Button>
                  {r.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, "paused")}
                    >
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </Button>
                  ) : r.status === "paused" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, "active")}
                    >
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </Button>
                  ) : null}
                  {r.status !== "ended" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, "ended")}
                    >
                      <X className="h-4 w-4 mr-1" /> End
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </div>
  );
};

export default Allocations;
