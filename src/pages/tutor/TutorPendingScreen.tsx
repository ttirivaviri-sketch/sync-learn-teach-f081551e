import { useEffect } from "react";
import { Clock, ShieldCheck, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  status: "pending" | "rejected";
  submittedAt?: string | null;
  rejectionReason?: string | null;
  onResubmit?: () => void;
}

export function TutorPendingScreen({ status, submittedAt, rejectionReason, onResubmit }: Props) {
  const navigate = useNavigate();
  const isRejected = status === "rejected";

  // Auto-poll: refetch verification status every 30s while pending so the
  // approval is reflected without a manual refresh.
  useEffect(() => {
    if (isRejected || !onResubmit) return;
    const id = setInterval(() => onResubmit(), 30_000);
    return () => clearInterval(id);
  }, [isRejected, onResubmit]);

  return (
    <div className="min-h-screen bg-background bg-mesh flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-5 bg-card/95 backdrop-blur-xl">
        <div className="flex justify-center">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center ${isRejected ? "bg-destructive/10" : "bg-primary/10"}`}>
            {isRejected
              ? <AlertTriangle className="h-8 w-8 text-destructive" />
              : <Clock className="h-8 w-8 text-primary animate-pulse" />}
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">
            {isRejected ? "Verification needs attention" : "We're reviewing your application"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? "One or more documents need to be re-uploaded."
              : "Our team reviews tutor documents within 24–48 hours. We'll update this screen automatically."}
          </p>
        </div>

        {!isRejected && submittedAt && (
          <div className="text-center text-xs text-muted-foreground">
            Submitted {new Date(submittedAt).toLocaleString()}
          </div>
        )}

        {isRejected && rejectionReason && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="font-medium text-destructive mb-1">Reason</div>
            <div className="text-foreground">{rejectionReason}</div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <Step Icon={FileText} label="Documents received" done />
          <Step Icon={ShieldCheck} label="Admin review" done={isRejected} active={!isRejected} />
          <Step Icon={ShieldCheck} label="Account activated" />
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {isRejected ? (
            <Button onClick={onResubmit} className="w-full">Re-upload documents</Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => onResubmit?.()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh status
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/tutor/auth");
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Step({ Icon, label, done, active }: { Icon: any; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${done ? "bg-emerald-500/15 text-emerald-600" : active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className={done || active ? "font-medium" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
