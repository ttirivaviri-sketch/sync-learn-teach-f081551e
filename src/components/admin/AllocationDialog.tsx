import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function monthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export const AllocationDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [learners, setLearners] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [tutors, setTutors] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; subject: string; level: string; hourly_rate: number | null }>>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  const [learnerId, setLearnerId] = useState<string>("");
  const [tutorId, setTutorId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [schedule, setSchedule] = useState<Record<string, { enabled: boolean; time: string }>>(
    Object.fromEntries(DAYS.map((d) => [d.key, { enabled: false, time: "16:00" }]))
  );
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(monthEnd());
  const [duration, setDuration] = useState<number>(60);
  const [price, setPrice] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: ls }, { data: ts }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").eq("user_type", "learner").order("full_name"),
        supabase.from("profiles").select("id,full_name,email").eq("user_type", "tutor").order("full_name"),
      ]);
      setLearners(ls || []);
      setTutors(ts || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!tutorId) {
      setSubjects([]);
      setSubjectId("");
      return;
    }
    setSubjectsLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("tutor_subjects")
        .select("id,subject,level,hourly_rate")
        .eq("user_id", tutorId);
      if (error) logger.error("Load tutor subjects failed", error);
      setSubjects((data as any) || []);
      setSubjectId("");
      setSubjectsLoading(false);
    })();
  }, [tutorId]);

  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [] as string[];
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const out: string[] = [];
    const enabled = Object.entries(schedule).filter(([, v]) => v.enabled);
    if (!enabled.length) return out;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      for (const [day, v] of enabled) {
        if (cur.getDay() === dayMap[day]) {
          out.push(`${cur.toISOString().slice(0, 10)} ${v.time}`);
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [schedule, startDate, endDate]);

  const submit = async () => {
    if (!learnerId || !tutorId || !subjectId) {
      toast({ title: "Missing info", description: "Pick learner, tutor and subject.", variant: "destructive" });
      return;
    }
    const enabled = Object.entries(schedule)
      .filter(([, v]) => v.enabled)
      .map(([day, v]) => ({ day, time: v.time }));
    if (!enabled.length) {
      toast({ title: "Pick a schedule", description: "Select at least one weekly slot.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id;
      if (!adminId) throw new Error("Not authenticated");

      const { error } = await supabase.from("tutor_allocations" as any).insert({
        learner_id: learnerId,
        tutor_id: tutorId,
        tutor_subject_id: subjectId,
        weekly_schedule: enabled,
        start_date: startDate,
        end_date: endDate,
        duration_minutes: duration,
        price_per_session: Number(price) || 0,
        external_payment_reference: reference || null,
        notes: notes || null,
        created_by: adminId,
      });
      if (error) throw error;
      toast({ title: "Allocation created", description: "Booking requests sent to the tutor." });
      onCreated();
    } catch (e: any) {
      logger.error("Create allocation failed", e);
      toast({ title: "Error", description: e.message || "Failed to create", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New tutor allocation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Learner</Label>
              <Select value={learnerId} onValueChange={setLearnerId}>
                <SelectTrigger><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>
                  {learners.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.full_name || l.email || l.id.slice(0, 6)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tutor</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger><SelectValue placeholder="Select tutor" /></SelectTrigger>
                <SelectContent>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name || t.email || t.id.slice(0, 6)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!tutorId || subjectsLoading}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !tutorId
                      ? "Pick a tutor first"
                      : subjectsLoading
                        ? "Loading subjects…"
                        : subjects.length === 0
                          ? "This tutor has no subjects set up"
                          : "Select subject"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.subject} ({s.level}){s.hourly_rate ? ` · R${s.hourly_rate}/hr` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tutorId && !subjectsLoading && subjects.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Ask this tutor to add subjects in their profile before allocating.
              </p>
            )}
          </div>

          <div>
            <Label>Weekly schedule</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {DAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-2 border rounded-md px-2 py-1.5">
                  <Checkbox
                    checked={schedule[d.key].enabled}
                    onCheckedChange={(v) =>
                      setSchedule((s) => ({ ...s, [d.key]: { ...s[d.key], enabled: !!v } }))
                    }
                  />
                  <span className="text-sm font-medium w-8">{d.label}</span>
                  <Input
                    type="time"
                    value={schedule[d.key].time}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, [d.key]: { ...s[d.key], time: e.target.value } }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 60)}
              />
            </div>
            <div>
              <Label>Price / session (R)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>External payment reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="EFT ref, invoice #, etc." />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="bg-muted/40 rounded-md p-3 text-xs">
            <div className="font-semibold mb-1">
              Preview: {previewDates.length} session{previewDates.length === 1 ? "" : "s"} will be generated
            </div>
            <div className="text-muted-foreground line-clamp-3">
              {previewDates.slice(0, 12).join(" · ")}
              {previewDates.length > 12 ? ` … +${previewDates.length - 12} more` : ""}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
