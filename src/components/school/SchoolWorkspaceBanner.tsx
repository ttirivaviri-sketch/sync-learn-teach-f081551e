/**
 * SchoolWorkspaceBanner — visible only to learners who belong to a school.
 * Links to /school/{schoolId}/learn (StudentWorkspace) and offers a one-tap
 * "Enable alerts" CTA that requests browser Notification permission so future
 * homework releases / due-soon reminders surface as system notifications.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ChevronRight, BellRing, BellOff } from "lucide-react";
import { useStudyContext } from "@/hooks/useStudyContext";
import { toast } from "sonner";

export function SchoolWorkspaceBanner() {
  const navigate = useNavigate();
  const { data: ctx } = useStudyContext();
  const school = ctx?.school;
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  if (!school?.schoolId) return null;

  const requestPerm = async () => {
    if (perm === "unsupported") return toast.error("Notifications not supported on this device");
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res === "granted") toast.success("Alerts enabled");
      else if (res === "denied") toast.error("Alerts blocked in browser settings");
    } catch {
      toast.error("Could not enable alerts");
    }
  };

  return (
    <Card
      className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background"
    >
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
      {perm !== "granted" && perm !== "unsupported" && (
        <div className="px-4 pb-3 -mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={requestPerm}
            className="w-full h-8 text-xs"
          >
            {perm === "denied" ? <BellOff className="h-3 w-3 mr-1" /> : <BellRing className="h-3 w-3 mr-1" />}
            {perm === "denied" ? "Alerts blocked — update browser settings" : "Enable homework alerts"}
          </Button>
        </div>
      )}
    </Card>
  );
}
