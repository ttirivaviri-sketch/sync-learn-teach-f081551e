/**
 * Public invitation landing page. Anyone with a valid token can preview;
 * accepting requires the invitee to be signed in with the matching email.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, GraduationCap, ShieldCheck, Users, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchInvitationSummary, useAcceptInvitation, type SchoolRole } from "@/hooks/useSchools";

const roleLabel: Record<SchoolRole, string> = {
  school_admin: "School Admin",
  school_teacher: "Teacher",
  school_student: "Student",
};
const roleIcon: Record<SchoolRole, any> = {
  school_admin: ShieldCheck,
  school_teacher: Users,
  school_student: GraduationCap,
};

export default function AcceptInvitation() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const accept = useAcceptInvitation();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchInvitationSummary>>>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => { document.title = "Join your school | StudySync"; }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchInvitationSummary(token);
        setSummary(s);
        const { data: { session } } = await supabase.auth.getSession();
        setSessionEmail(session?.user?.email?.toLowerCase() ?? null);
      } catch (e: any) {
        toast({ title: "Could not load invitation", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, toast]);

  const onAccept = async () => {
    try {
      const r = await accept.mutateAsync(token);
      toast({ title: "Welcome!", description: `You've joined ${summary?.school_name}.` });
      if (r.role === "school_admin") navigate(`/school/${r.school_id}`, { replace: true });
      else if (r.role === "school_teacher") navigate(`/tutor`, { replace: true });
      else navigate(`/learner`, { replace: true });
    } catch (e: any) {
      toast({ title: "Could not accept", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <main className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invitation…</main>;
  }

  if (!summary) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-amber-500" />
          <h1 className="text-lg font-semibold">Invitation not found</h1>
          <p className="text-sm text-muted-foreground mt-1">The link may be incorrect or has been revoked.</p>
          <Link to="/" className="inline-block mt-4 text-sm underline">Back to StudySync</Link>
        </Card>
      </main>
    );
  }

  const Icon = roleIcon[summary.role];
  const expired = summary.expired || summary.status === "expired";
  const finalised = summary.status === "accepted" || summary.status === "revoked";
  const emailMismatch = sessionEmail && sessionEmail !== summary.email.toLowerCase();

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="p-8 max-w-md w-full text-center space-y-4">
        <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-12 mx-auto object-contain" />
        <div className="flex justify-center"><Icon className="h-10 w-10 text-primary" /></div>
        <div>
          <h1 className="text-xl font-semibold">{summary.school_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You've been invited to join as a <Badge variant="secondary" className="ml-1">{roleLabel[summary.role]}</Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-2">Invitation sent to <strong>{summary.email}</strong></p>
        </div>

        {finalised ? (
          <p className="text-sm text-muted-foreground">This invitation has already been {summary.status}.</p>
        ) : expired ? (
          <p className="text-sm text-rose-600">This invitation has expired. Ask the school admin to send a new one.</p>
        ) : !sessionEmail ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sign in or create an account using <strong>{summary.email}</strong> to accept.</p>
            <Button className="w-full" onClick={() => navigate(`/learner/auth?next=/invite/${token}&email=${encodeURIComponent(summary.email)}`)}>
              Sign in to continue
            </Button>
          </div>
        ) : emailMismatch ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-600">You're signed in as <strong>{sessionEmail}</strong>, but this invitation is for <strong>{summary.email}</strong>.</p>
            <Button variant="secondary" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate(`/learner/auth?next=/invite/${token}&email=${encodeURIComponent(summary.email)}`); }}>
              Sign in with a different account
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={onAccept} disabled={accept.isPending}>
            {accept.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Accept and join {summary.school_name}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Expires {new Date(summary.expires_at).toLocaleDateString()}.
        </p>
      </Card>
    </main>
  );
}
