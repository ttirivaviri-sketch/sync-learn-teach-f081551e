// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * TeacherClassDetailPage
 *
 * Phase 3.2 route. Mounted at `/teacher/class/:cohortId`.
 * Restricts to workspace staff and renders the class-scoped LOS surface.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/LoadingSpinner';
import { losFrom } from '@/integrations/supabase/learning-os-types';
import { TeacherClassDetail } from '@/studymode/components/TeacherClassDetail';
import { useSchoolWorkspace } from '@/studymode/hooks/useSchoolWorkspace';

export default function TeacherClassDetailPage() {
  const navigate = useNavigate();
  const { cohortId } = useParams<{ cohortId: string }>();
  const { session, loading } = useAuth({ redirectTo: '/learner/auth' });
  const { workspace, cohorts, isLoading: workspaceLoading } = useSchoolWorkspace();
  const [cohortName, setCohortName] = useState<string>('');

  const matchedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === cohortId),
    [cohorts, cohortId],
  );

  useEffect(() => {
    if (!cohortId) return;
    if (matchedCohort) {
      setCohortName(matchedCohort.name);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await losFrom('learning_workspace_cohorts')
        .select('name')
        .eq('id', cohortId)
        .maybeSingle();
      if (!cancelled && data?.name) setCohortName(data.name);
    })();
    return () => { cancelled = true; };
  }, [cohortId, matchedCohort]);

  if (loading || workspaceLoading) {
    return <LoadingScreen message="Loading class detail…" />;
  }

  if (!session) return null;

  if (!workspace || workspace.id === 'personal-school-context') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h2 className="text-lg font-bold">No workspace</h2>
          <p className="text-sm text-muted-foreground">
            You need to belong to a school workspace to view class detail.
          </p>
          <Button onClick={() => navigate('/school')}>Open school admin</Button>
        </div>
      </div>
    );
  }

  const canManage = workspace.role === 'owner' || workspace.role === 'admin' || workspace.role === 'teacher';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">Class detail</h1>
              <p className="text-xs text-muted-foreground">{cohortName || 'Loading…'}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/teacher')}>
            <Home className="mr-2 h-4 w-4" />
            Command center
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {cohortId && cohortName && (
          <TeacherClassDetail
            workspaceId={workspace.id}
            cohortId={cohortId}
            cohortName={cohortName}
            canManage={canManage}
          />
        )}
      </main>
    </div>
  );
}