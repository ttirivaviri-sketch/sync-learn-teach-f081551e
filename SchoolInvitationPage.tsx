/**
 * SchoolInvitationPage
 *
 * Accepts workspace invitation tokens and joins the signed-in user to the
 * invited workspace.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Link2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingScreen } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useSchoolWorkspace } from '@/studymode/hooks/useSchoolWorkspace';

export default function SchoolInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading } = useAuth({ redirectTo: '/learner/auth' });
  const { acceptInvitationToken } = useSchoolWorkspace();
  const { toast } = useToast();

  const initialToken = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const [token, setToken] = useState(initialToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (loading) {
    return <LoadingScreen message="Loading workspace invitation…" />;
  }

  if (!session) {
    return null;
  }

  const handleAccept = async () => {
    const cleaned = token.trim();
    if (!cleaned) {
      toast({ title: 'Invitation token required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvitationToken(cleaned);
      setAccepted(true);
      toast({ title: 'Workspace joined', description: 'Your invitation has been accepted.' });
    } catch (error) {
      toast({
        title: 'Invitation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-lg">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">Join school workspace</h1>
              <p className="text-xs text-muted-foreground">Accept an invitation link from your school or team</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-foreground">Workspace invitation</h2>
          </div>

          {accepted ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Invitation accepted</p>
                  <p className="text-sm text-muted-foreground">
                    Your membership is now active. If you were invited as staff, your workspace dashboards are ready.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate('/learner')}>Open learner app</Button>
                <Button variant="outline" onClick={() => navigate('/teacher')}>Open teacher command center</Button>
                <Button variant="outline" onClick={() => navigate('/school')}>Open school admin</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Paste the invitation token from your secure join link, or open this page using the full link your workspace owner shared.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="workspace-token">
                  Invitation token
                </label>
                <Input
                  id="workspace-token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste token"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAccept} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Accept invitation
                </Button>
                <Button variant="outline" onClick={() => navigate('/learner')}>Back to learner app</Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
