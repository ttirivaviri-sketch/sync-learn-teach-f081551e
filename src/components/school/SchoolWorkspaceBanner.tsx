/**
 * SchoolWorkspaceBanner — visible only to learners who belong to a school.
 *
 * - Links to /school/{schoolId}/learn (StudentWorkspace).
 * - Shows live status of browser Notification permission with clear help text
 *   for the Denied state (where the OS won't allow re-prompting).
 * - Links to /settings/notifications for fine-grained toggles.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, ChevronRight, BellRing, BellOff, CheckCircle2, Settings2, Info,
} from "lucide-react";
import { useStudyContext } from "@/hooks/useStudyContext";
import { toast } from "sonner";

type PermState = NotificationPermission | "unsupported";

function readPerm(): PermState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function SchoolWorkspaceBanner() {
  const navigate = useNavigate();
  const { data: ctx } = useStudyContext();
  const school = ctx?.school;
  const [perm, setPerm] = useState<PermState>(readPerm());
  const [showHelp, setShowHelp] = useState(false);

  // Re-check permission when the tab regains focus (user may have changed it in settings).
  useEffect(() => {
    const onFocus = () => setPerm(readPerm());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!school?.schoolId) return null;

  const requestPerm = async () => {
    if (perm === "unsupported") return toast.error("Notifications not supported on this device");
    if (perm === "denied") { setShowHelp(true); return; }
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res === "granted") {
        toast.success("Alerts enabled — you'll get pop-ups for new homework");
        try { new Notification("Alerts enabled", { body: "We'll ping you here when new homework drops.", icon: "/favicon.ico" }); } catch { /* ignore */ }
      } else if (res === "denied") {
        setShowHelp(true);
        toast.error("Alerts blocked. See instructions below.");
      }
    } catch {
      toast.error("Could not enable alerts");
    }
  };

  const statusLabel =
    perm === "granted" ? "Alerts on" :
    perm === "denied" ? "Alerts blocked" :
    perm === "unsupported" ? "Alerts unavailable" :
    "Alerts off";

  const statusTone =
    perm === "granted" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
    perm === "denied" ? "bg-destructive/15 text-destructive" :
    "bg-muted text-muted-foreground";

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
      <button
        onClick={() => navigate(`/school/${school.schoolId}/learn`)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition"
      >
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">My School Workspace</div>
          <div className="text-xs text-muted-foreground truncate">
            {school.schoolName ?? "Your school"} · homework, quizzes & materials
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="px-4 pb-3 -mt-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone}`}>
            {perm === "granted" ? <CheckCircle2 className="h-3 w-3" /> :
             perm === "denied" ? <BellOff className="h-3 w-3" /> :
             <BellRing className="h-3 w-3" />}
            {statusLabel}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/settings/notifications"); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3 w-3" /> Manage
          </button>
        </div>

        {perm !== "granted" && perm !== "unsupported" && (
          <Button
            variant="outline"
            size="sm"
            onClick={requestPerm}
            className="w-full h-8 text-xs"
          >
            {perm === "denied" ? <BellOff className="h-3 w-3 mr-1" /> : <BellRing className="h-3 w-3 mr-1" />}
            {perm === "denied" ? "Show me how to unblock" : "Enable homework alerts"}
          </Button>
        )}

        {showHelp && perm === "denied" && (
          <div className="rounded-md bg-muted/50 border border-border p-2 text-[11px] text-muted-foreground leading-relaxed">
            <div className="flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-foreground mb-1">Unblock alerts</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Tap the lock or site-settings icon in your browser's address bar.</li>
                  <li>Find <em>Notifications</em> and change it to <em>Allow</em>.</li>
                  <li>Reload this page — the status above will flip to <em>Alerts on</em>.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
