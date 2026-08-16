/**
 * NotificationSettings — learner-facing controls for homework alerts.
 *
 * Persists per-user toggles in `notification_preferences` (RLS-scoped to the
 * caller). Also surfaces the current browser Notification permission state so
 * users know whether system pop-ups will actually fire.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, BellOff, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PermState = NotificationPermission | "unsupported";

function currentPermission(): PermState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [homeworkRelease, setHomeworkRelease] = useState(true);
  const [dueSoon, setDueSoon] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [perm, setPerm] = useState<PermState>(currentPermission());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/learner/auth");
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !cancelled) {
        setHomeworkRelease(!!data.homework_release_alerts);
        setDueSoon(!!data.due_soon_alerts);
        setSessionReminders(data.session_reminder_alerts ?? true);
        setPushEnabled(!!data.push_enabled);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const save = async (patch: Partial<{ homework_release_alerts: boolean; due_soon_alerts: boolean; session_reminder_alerts: boolean; push_enabled: boolean }>) => {
    if (!userId) return;
    setSaving(true);
    const next = {
      user_id: userId,
      homework_release_alerts: homeworkRelease,
      due_soon_alerts: dueSoon,
      session_reminder_alerts: sessionReminders,
      push_enabled: pushEnabled,
      ...patch,
    };
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(next, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save — try again");
    } else {
      toast.success("Saved");
    }
  };

  const requestPerm = async () => {
    if (perm === "unsupported") {
      toast.error("This device doesn't support browser notifications");
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res === "granted") toast.success("Browser alerts enabled");
      else if (res === "denied") toast.error("Blocked — update browser settings to allow");
    } catch {
      toast.error("Could not request permission");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Notifications</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card className="p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">School homework</h2>
                <p className="text-xs text-muted-foreground">Control what triggers an alert in this app.</p>
              </div>

              <div className="flex items-start justify-between gap-4 py-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">New AI homework released</Label>
                  <p className="text-xs text-muted-foreground">When a teacher publishes new homework in your class.</p>
                </div>
                <Switch
                  checked={homeworkRelease}
                  disabled={saving}
                  onCheckedChange={(v) => { setHomeworkRelease(v); save({ homework_release_alerts: v }); }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Due soon reminders</Label>
                  <p className="text-xs text-muted-foreground">One alert about 24h before each homework is due.</p>
                </div>
                <Switch
                  checked={dueSoon}
                  disabled={saving}
                  onCheckedChange={(v) => { setDueSoon(v); save({ due_soon_alerts: v }); }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Session reminders</Label>
                  <p className="text-xs text-muted-foreground">Alerts 24 hours and 1 hour before each booked tutoring session.</p>
                </div>
                <Switch
                  checked={sessionReminders}
                  disabled={saving}
                  onCheckedChange={(v) => { setSessionReminders(v); save({ session_reminder_alerts: v }); }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Send to my devices</Label>
                  <p className="text-xs text-muted-foreground">Also deliver via push when the app isn't open (requires browser/device permission).</p>
                </div>
                <Switch
                  checked={pushEnabled}
                  disabled={saving}
                  onCheckedChange={(v) => { setPushEnabled(v); save({ push_enabled: v }); }}
                />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {perm === "granted" ? (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                )}
                <h2 className="text-sm font-semibold">Browser permission</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {perm === "granted" && "Granted — system pop-ups will appear when this tab is open or the app is installed."}
                {perm === "default" && "Not requested yet. Tap below to allow system pop-ups."}
                {perm === "denied" && "Blocked. Open your browser site settings, set Notifications to Allow for this site, then reload."}
                {perm === "unsupported" && "This browser doesn't support web notifications. In-app alerts will still work."}
              </p>
              {perm !== "granted" && (
                <Button variant="outline" size="sm" onClick={requestPerm} className="w-full">
                  {perm === "denied" ? <BellOff className="h-4 w-4 mr-2" /> : <BellRing className="h-4 w-4 mr-2" />}
                  {perm === "denied" ? "How to unblock" : "Enable browser alerts"}
                </Button>
              )}
            </Card>

            <p className="text-[11px] text-muted-foreground px-1">
              Changes save automatically. Native mobile push (Android/iOS) coming when you install the app from the store.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
