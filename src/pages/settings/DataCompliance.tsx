/**
 * Data & Compliance settings — user-facing controls for lesson recordings:
 *   • per-booking consent toggles
 *   • retention window + keep-notes-only preference
 *   • export all lesson data
 *   • delete a single recording or all lesson data
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Trash2, Shield, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Recording { id: string; storage_path: string; status: string; created_at: string; booking_id: string }
interface Retention { auto_delete_after_days: number; keep_notes_only: boolean }
interface Consent { id?: string; booking_id: string; recording_consent: boolean; transcription_consent: boolean; notes_consent: boolean }

export default function DataCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [retention, setRetention] = useState<Retention>({ auto_delete_after_days: 90, keep_notes_only: true });
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setLoading(false); return; }
    setUserId(uid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [ret, recs, cons] = await Promise.all([
      sb.from("lesson_retention_settings").select("auto_delete_after_days,keep_notes_only").eq("user_id", uid).maybeSingle(),
      sb.from("lesson_recordings").select("id,storage_path,status,created_at,booking_id").or(`learner_id.eq.${uid},tutor_id.eq.${uid}`).order("created_at", { ascending: false }),
      sb.from("lesson_consents").select("id,booking_id,recording_consent,transcription_consent,notes_consent").eq("user_id", uid),
    ]);
    if (ret.data) setRetention(ret.data);
    setRecordings(recs.data ?? []);
    setConsents(cons.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveRetention = async (next: Retention) => {
    setRetention(next);
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("lesson_retention_settings").upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    toast({ title: "Saved", description: "Retention preferences updated." });
  };

  const updateConsent = async (bookingId: string, patch: Partial<Consent>) => {
    if (!userId) return;
    const existing = consents.find((c) => c.booking_id === bookingId);
    const next = {
      user_id: userId,
      booking_id: bookingId,
      recording_consent: existing?.recording_consent ?? false,
      transcription_consent: existing?.transcription_consent ?? false,
      notes_consent: existing?.notes_consent ?? false,
      ...patch,
      consented_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("lesson_consents").upsert(next, { onConflict: "user_id,booking_id" });
    setConsents((prev) => {
      const others = prev.filter((c) => c.booking_id !== bookingId);
      return [...others, { ...next }];
    });
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-lesson-data`,
        { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `studysync-lesson-data-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Your lesson data has been downloaded." });
    } catch (e) {
      toast({ title: "Export failed", description: String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const deleteRecording = async (id: string, storagePath: string, bookingId: string) => {
    if (!confirm("Delete this recording, transcript, and notes? This cannot be undone.")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    if (storagePath) await supabase.storage.from("lesson-audio").remove([storagePath]);
    await sb.from("lesson_transcripts").delete().eq("recording_id", id);
    await sb.from("lesson_notes").delete().eq("booking_id", bookingId);
    await sb.from("lesson_topic_mapping").delete().eq("booking_id", bookingId);
    await sb.from("lesson_recordings").delete().eq("id", id);
    toast({ title: "Deleted" });
    load();
  };

  const deleteAll = async () => {
    if (!confirm("Permanently delete ALL your lesson recordings, transcripts, and AI notes? This cannot be undone.")) return;
    for (const r of recordings) await deleteRecording(r.id, r.storage_path, r.booking_id);
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE" }),
        },
      );
      const result = await res.json();
      if (!res.ok || !result.deleted) throw new Error(result.error || "Deletion failed");
      await supabase.auth.signOut();
      toast({ title: "Account deleted", description: "Your account and personal data have been permanently removed." });
      navigate("/");
    } catch (e) {
      toast({
        title: "Account deletion failed",
        description: e instanceof Error ? e.message : "Please try again or contact support.",
        variant: "destructive",
      });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Data &amp; Compliance</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Control how StudySync records, transcribes, and stores your tutoring lessons. See our <a href="/legal/data-compliance" className="underline">Data &amp; Compliance policy</a> for the full legal terms.
        </p>

        <Card>
          <CardHeader><CardTitle className="text-base">Retention</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Auto-delete after <strong>{retention.auto_delete_after_days} days</strong></Label>
              <Slider
                value={[retention.auto_delete_after_days]}
                min={7} max={365} step={1}
                onValueChange={(v) => setRetention((r) => ({ ...r, auto_delete_after_days: v[0] }))}
                onValueCommit={(v) => saveRetention({ ...retention, auto_delete_after_days: v[0] })}
                className="mt-3"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>7 days</span><span>90 days</span><span>1 year</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Keep AI notes after audio expires</Label>
                <p className="text-xs text-muted-foreground">Recommended — lets StudyMode keep reinforcing concepts.</p>
              </div>
              <Switch
                checked={retention.keep_notes_only}
                onCheckedChange={(v) => saveRetention({ ...retention, keep_notes_only: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Your data</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={exportAll} disabled={exporting} variant="outline" className="w-full justify-start gap-2">
              <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export my lesson data (JSON)"}
            </Button>
            <Button onClick={deleteAll} variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Delete all my lesson data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Per-lesson consent &amp; recordings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && recordings.length === 0 && consents.length === 0 && (
              <p className="text-sm text-muted-foreground">No lessons recorded yet.</p>
            )}
            {recordings.map((r) => {
              const c = consents.find((x) => x.booking_id === r.booking_id) || { booking_id: r.booking_id, recording_consent: false, transcription_consent: false, notes_consent: false };
              return (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{r.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2"><Switch checked={c.recording_consent} onCheckedChange={(v) => updateConsent(r.booking_id, { recording_consent: v })} /> Recording</label>
                    <label className="flex items-center gap-2"><Switch checked={c.transcription_consent} onCheckedChange={(v) => updateConsent(r.booking_id, { transcription_consent: v })} /> Transcription</label>
                    <label className="flex items-center gap-2"><Switch checked={c.notes_consent} onCheckedChange={(v) => updateConsent(r.booking_id, { notes_consent: v })} /> AI notes</label>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => deleteRecording(r.id, r.storage_path, r.booking_id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete recording
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete your StudySync account and all personal data — profile, bookings,
              messages, study progress, recordings and notes. De-identified financial records are
              retained for 5 years as required by South African tax law. This cannot be undone.
            </p>
            <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start gap-2">
                  <Trash2 className="h-4 w-4" /> Delete my account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account permanently?</DialogTitle>
                  <DialogDescription>
                    This removes your profile, bookings, messages, study history, recordings and
                    every other personal record. It cannot be undone. Type <strong>DELETE</strong>{" "}
                    below to confirm.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  autoComplete="off"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletingAccount}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={deleteAccount}
                    disabled={deleteConfirmText !== "DELETE" || deletingAccount}
                  >
                    {deletingAccount ? "Deleting…" : "Permanently delete account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <a href="/legal/data-compliance" className="inline-flex items-center gap-1 underline"><ExternalLink className="h-3 w-3" /> Data &amp; Compliance policy</a>
          <a href="/legal/privacy" className="inline-flex items-center gap-1 underline"><ExternalLink className="h-3 w-3" /> Privacy policy</a>
          <a href="/legal/terms" className="inline-flex items-center gap-1 underline"><ExternalLink className="h-3 w-3" /> Terms of use</a>
        </div>
      </main>
    </div>
  );
}
