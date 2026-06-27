/**
 * TeacherCommandCenterPage
 *
 * Dedicated multi-actor surface for teachers, admins, and owners of a school
 * workspace. Mounted at `/teacher` so it lives outside of the learner/tutor
 * shells while still using the shared LOS layer.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/LoadingSpinner';
import { TeacherCommandCenter } from '@/studymode/components/TeacherCommandCenter';

export default function TeacherCommandCenterPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth({ redirectTo: '/learner/auth' });

  if (loading) {
    return <LoadingScreen message="Loading Teacher Command Center…" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">Teacher Command Center</h1>
              <p className="text-xs text-muted-foreground">School workspace operational dashboard</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/learner')}>
            <Home className="mr-2 h-4 w-4" />
            Learner app
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <TeacherCommandCenter />
      </main>
    </div>
  );
}
