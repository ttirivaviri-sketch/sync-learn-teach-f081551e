/**
 * SchoolAdminPage
 *
 * Dedicated workspace administration surface for owners and admins.
 * Mounted at `/school`.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/LoadingSpinner';
import { SchoolAdminConsole } from '@/studymode/components/SchoolAdminConsole';

export default function SchoolAdminPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth({ redirectTo: '/learner/auth' });

  if (loading) {
    return <LoadingScreen message="Loading School Admin Console…" />;
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
              <h1 className="text-base font-bold text-foreground">School Admin Console</h1>
              <p className="text-xs text-muted-foreground">Cohorts, members, invitations, and roles</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/teacher')}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Teacher view
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SchoolAdminConsole />
      </main>
    </div>
  );
}
