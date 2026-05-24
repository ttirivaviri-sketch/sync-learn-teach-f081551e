import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pause,
  Play,
  X,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react";
import { format, isAfter } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";
import { AllocationDialog } from "@/components/admin/AllocationDialog";

interface AllocationBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

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
  bookings?: AllocationBooking[];
  generated_count?: number;
  accepted_count?: number;
}

const Allocations = () => {
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Tutor Allocations | StudySync Admin";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rawList, error } = await supabase
        .from("tutor_allocations" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      let list = (rawList || []) as any[];

      // Enrich profiles + subjects
      const learnerIds = [...new Set(list.map((r) => r.learner_id))];
      const tutorIds = [...new Set(list.map((r) => r.tutor_id))];
      const subjectIds = [...new Set(list.map((r) => r.tutor_subject_id))];
      const [profiles, subjects] = await Promise.all([
        learnerIds.length || tutorIds.length
          ? supabase
              .from("profiles")
              .select("id,full_name,email")
              .in("id", [...learnerIds, ...tutorIds])
          : Promise.resolve({ data: [] as any[] }),
        subjectIds.length
          ? supabase
              .from("tutor_subjects")
              .select("id,subject,level")
              .in("id", subjectIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profiles.data || []).map((p: any) => [p.id, p]));
      const sMap = new Map((subjects.data || []).map((s: any) => [s.id, s]));

      // Bookings per allocation
      const allocIds = list.map((r) => r.id);
      let bookingsByAlloc: Record<string, AllocationBooking[]> = {};
      if (allocIds.length) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, allocation_id, scheduled_at, duration_minutes, status")
          .in("allocation_id", allocIds)
          .order("scheduled_at", { ascending: true });
        for (const b of bookings || []) {
          const k = (b as any).allocation_id as string;
          if (!k) continue;
          (bookingsByAlloc[k] ||= []).push(b as any);
        }
      }

      list = list.map((r) => {
        const bks = bookingsByAlloc[r.id] || [];
        return {
          ...r,
          learner: pMap.get(r.learner_id),
          tutor: pMap.get(r.tutor_id),
          tutor_subjects: sMap.get(r.tutor_subject_id),
          bookings: bks,
          generated_count: bks.length,
          accepted_count: bks.filter(
            (b) => b.status === "confirmed" || b.status === "completed",
          ).length,
        };
      });

      setRows(list);
    } catch (e) {
      logger.error("Failed to load allocations", e);
      toast({ title: "Error", description: "Failed to load allocations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /** Cancel future bookings for an allocation. Past sessions are left untouched. */
  const cancelFutureBookings = async (allocationId: string, includeConfirmed: boolean) => {
    const statuses: Array<"requested" | "confirmed"> = includeConfirmed
      ? ["requested", "confirmed"]
      : ["requested"];
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "canceled" })
      .eq("allocation_id", allocationId)
      .gt("scheduled_at", new Date().toISOString())
      .in("status", statuses)
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  };

  const setStatus = async (id: string, status: "active" | "paused" | "ended") => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("tutor_allocations" as any)
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      let canceled = 0;
      if (status === "paused") {
        canceled = await cancelFutureBookings(id, false);
      } else if (status === "ended") {
        canceled = await cancelFutureBookings(id, true);
      }

      toast({
        title: "Updated",
        description:
          status === "paused"
            ? `Paused. Canceled ${canceled} pending future session${canceled === 1 ? "" : "s"}.`
            : status === "ended"
              ? `Ended. Canceled ${canceled} future session${canceled === 1 ? "" : "s"}.`
              : "Resumed. Use Regenerate to recreate canceled sessions.",
      });
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
      toast({
        title: "Generated",
        description: `Created ${data ?? 0} new session${data === 1 ? "" : "s"}.`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const scheduleSummary = (s: Allocation["weekly_schedule"]) =>
    (s || []).map((x) => `${x.day.toUpperCase()} ${x.time}`).join(" · ");

  const bookingStatusVariant = (s: string) =>
    s === "confirmed"
      ? "default"
      : s === "completed"
        ? "outline"
        : s === "canceled"
          ? "destructive"
          : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tutor Allocations</h1>
          <p className="text-sm text-muted-foreground">
            Assign tutors to learners on a recurring schedule. Payments are handled outside the app.
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
          {rows.map((r) => {
            const isOpen = !!expanded[r.id];
            const upcoming = (r.bookings || []).filter((b) =>
              isAfter(new Date(b.scheduled_at), new Date()),
            );
            const preview = isOpen ? r.bookings || [] : (r.bookings || []).slice(0, 3);
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold truncate">
                          {r.learner?.full_name || r.learner?.email || "Learner"}
                        </span>
                        <span className="text-muted-foreground">←</span>
                        <span className="font-semibold truncate">
                          {r.tutor?.full_name || r.tutor?.email || "Tutor"}
                        </span>
                        {r.tutor_subjects?.subject && (
                          <Badge variant="outline">{r.tutor_subjects.subject}</Badge>
                        )}
                        <Badge
                          variant={
                            r.status === "active"
                              ? "default"
                              : r.status === "paused"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(r.start_date), "MMM d")} –{" "}
                        {format(new Date(r.end_date), "MMM d, yyyy")} · {r.duration_minutes}min · R
                        {Number(r.price_per_session).toFixed(2)}/session
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {scheduleSummary(r.weekly_schedule)}
                      </div>
                      <div className="text-xs mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {r.generated_count ?? 0} generated
                        </span>
                        <span>·</span>
                        <span>{r.accepted_count ?? 0} accepted by tutor</span>
                        <span>·</span>
                        <span>{upcoming.length} upcoming</span>
                        {r.external_payment_reference && (
                          <>
                            <span>·</span>
                            <span>Ref {r.external_payment_reference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id || r.status === "ended"}
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
                  </div>

                  {(r.bookings?.length ?? 0) > 0 && (
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Generated sessions
                        </span>
                        {(r.bookings?.length ?? 0) > 3 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() =>
                              setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))
                            }
                          >
                            {isOpen ? (
                              <>
                                Hide <ChevronUp className="h-3 w-3 ml-1" />
                              </>
                            ) : (
                              <>
                                Show all {r.bookings?.length}{" "}
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {preview.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-2.5 py-1.5"
                          >
                            <span className="truncate">
                              {format(new Date(b.scheduled_at), "EEE, MMM d · HH:mm")}
                            </span>
                            <Badge
                              variant={bookingStatusVariant(b.status) as any}
                              className="text-[10px]"
                            >
                              {b.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
