/**
 * TutorWorkspaceLinkCard
 *
 * Compact deep link to the Teacher Command Center (and the School Admin
 * Console for owners/admins) when the signed-in user has a staff role in a
 * learning workspace. Hides itself when not applicable.
 */
import { Link } from 'react-router-dom';
import { Building2, ClipboardList, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';

export function TutorWorkspaceLinkCard() {
  const { workspace, isLoading } = useSchoolWorkspace();

  if (isLoading) return null;
  if (!workspace || workspace.id === 'personal-school-context') return null;

  const role = workspace.role;
  const isStaff = role === 'owner' || role === 'admin' || role === 'teacher' || role === 'tutor';
  if (!isStaff) return null;

  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Radar className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Workspace operations</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 uppercase">
              {role}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {workspace.name} · multi-actor view of students, cohorts, and interventions.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/teacher">
            <ClipboardList className="mr-2 h-4 w-4" />
            Teacher Command Center
          </Link>
        </Button>
        {isOwnerOrAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/school">
              <Building2 className="mr-2 h-4 w-4" />
              School Admin Console
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
