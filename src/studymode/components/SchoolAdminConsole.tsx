// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * SchoolAdminConsole
 *
 * Workspace-wide operations console for owners and admins:
 * - Workspace identity
 * - Cohort overview
 * - Membership roster with role & cohort assignment
 * - Pending invitations with actual join-link issuance
 */
import { useMemo, useState } from 'react';
import {
  Building2,
  Copy,
  Link2,
  Mail,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import type { WorkspaceRole } from '../lib/learningOps';
import { ConceptIngestionPanel } from './ConceptIngestionPanel';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function SchoolAdminConsole() {
  const {
    workspace,
    cohorts,
    members,
    invitations,
    isLoading,
    error,
    createCohort,
    inviteMember,
    issueInvitationLink,
    changeMemberRole,
    assignMembershipToCohort,
    changeInvitationStatus,
  } = useSchoolWorkspace();
  const { toast } = useToast();

  const [cohortForm, setCohortForm] = useState({
    name: '',
    gradeLevel: '',
    curriculum: '',
    subjectNames: '',
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'student' as WorkspaceRole,
    cohortId: 'none',
  });
  const [isSavingCohort, setIsSavingCohort] = useState(false);
  const [isSavingInvite, setIsSavingInvite] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});

  const canManage = workspace?.role === 'owner' || workspace?.role === 'admin';
  const activeInvitations = useMemo(
    () => invitations.filter((invite) => invite.status === 'invited'),
    [invitations],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!workspace || workspace.id === 'personal-school-context') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">School Admin Console</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No school workspace is connected yet. Create one from Learning Mission Control to activate
          full school-grade operations.
        </p>
      </div>
    );
  }

  const handleCreateCohort = async () => {
    const name = cohortForm.name.trim();
    if (!name) {
      toast({ title: 'Cohort name required', variant: 'destructive' });
      return;
    }
    setIsSavingCohort(true);
    try {
      await createCohort({
        name,
        gradeLevel: cohortForm.gradeLevel.trim() || null,
        curriculum: cohortForm.curriculum.trim() || null,
        subjectNames: cohortForm.subjectNames
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setCohortForm({ name: '', gradeLevel: '', curriculum: '', subjectNames: '' });
      toast({ title: 'Cohort created' });
    } catch (err) {
      toast({
        title: 'Cohort creation failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCohort(false);
    }
  };

  const handleInviteMember = async () => {
    const email = inviteForm.email.trim();
    if (!email) {
      toast({ title: 'Invite email required', variant: 'destructive' });
      return;
    }
    setIsSavingInvite(true);
    try {
      await inviteMember({
        email,
        role: inviteForm.role,
        cohortIds: inviteForm.cohortId !== 'none' ? [inviteForm.cohortId] : [],
      });
      setInviteForm({ email: '', role: 'student', cohortId: 'none' });
      toast({ title: 'Invitation recorded' });
    } catch (err) {
      toast({
        title: 'Invitation failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingInvite(false);
    }
  };

  const handleIssueLink = async (invitationId: string) => {
    setBusyInviteId(invitationId);
    try {
      const url = await issueInvitationLink(invitationId);
      setInviteLinks((current) => ({ ...current, [invitationId]: url }));
      await navigator.clipboard.writeText(url);
      toast({ title: 'Join link copied', description: 'Send this secure link to the invited member.' });
    } catch (err) {
      toast({
        title: 'Could not generate join link',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleCopyExistingLink = async (invitationId: string, token?: string | null) => {
    if (!token) {
      await handleIssueLink(invitationId);
      return;
    }
    const url = inviteLinks[invitationId]
      || `${window.location.origin}/school/join?token=${encodeURIComponent(token)}`;
    setInviteLinks((current) => ({ ...current, [invitationId]: url }));
    await navigator.clipboard.writeText(url);
    toast({ title: 'Join link copied' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{workspace.name}</h2>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent-foreground border border-accent/30 uppercase">
                {workspace.role ?? 'member'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {workspace.workspaceType.replace('_', ' ')}
              {workspace.schoolName ? ` · ${workspace.schoolName}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}</p>
            <p className="text-xs text-muted-foreground">{members.length} member{members.length === 1 ? '' : 's'}</p>
            <p className="text-xs text-muted-foreground">{activeInvitations.length} active invite{activeInvitations.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Create cohort
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-cohort-name">Cohort name</Label>
                <Input
                  id="admin-cohort-name"
                  value={cohortForm.name}
                  onChange={(event) => setCohortForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Year 11 Sciences"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-cohort-grade">Grade level</Label>
                  <Input
                    id="admin-cohort-grade"
                    value={cohortForm.gradeLevel}
                    onChange={(event) => setCohortForm((current) => ({ ...current, gradeLevel: event.target.value }))}
                    placeholder="Year 11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-cohort-curriculum">Curriculum</Label>
                  <Input
                    id="admin-cohort-curriculum"
                    value={cohortForm.curriculum}
                    onChange={(event) => setCohortForm((current) => ({ ...current, curriculum: event.target.value }))}
                    placeholder="IGCSE"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-cohort-subjects">Subjects</Label>
                <Input
                  id="admin-cohort-subjects"
                  value={cohortForm.subjectNames}
                  onChange={(event) => setCohortForm((current) => ({ ...current, subjectNames: event.target.value }))}
                  placeholder="Biology, Chemistry, Physics"
                />
              </div>
              <Button onClick={handleCreateCohort} disabled={isSavingCohort} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSavingCohort ? 'Creating cohort…' : 'Create cohort'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Mail className="h-4 w-4 text-primary" />
              Invite workspace member
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-invite-email">Email</Label>
                <Input
                  id="admin-invite-email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="teacher@school.org"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) => setInviteForm((current) => ({ ...current, role: value as WorkspaceRole }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="tutor">Tutor</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cohort</Label>
                  <Select
                    value={inviteForm.cohortId}
                    onValueChange={(value) => setInviteForm((current) => ({ ...current, cohortId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Cohort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No cohort yet</SelectItem>
                      {cohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleInviteMember} disabled={isSavingInvite} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSavingInvite ? 'Saving invitation…' : 'Save invitation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConceptIngestionPanel workspaceId={workspace.id} canManage={canManage} />

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Membership roster
          </div>
          <span className="text-[11px] text-muted-foreground">{members.length} member{members.length === 1 ? '' : 's'}</span>
        </div>

        {members.length > 0 ? (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.membershipId} className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {member.email || 'No email'} · {member.cohortNames.length > 0 ? member.cohortNames.join(', ') : 'No cohort assigned'}
                  </p>
                </div>
                {canManage && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Select value={member.role} onValueChange={(value) => changeMemberRole(member.membershipId, value as WorkspaceRole)}>
                      <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="tutor">Tutor</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={member.cohortIds[0] || 'none'}
                      onValueChange={(value) => {
                        if (value !== 'none') {
                          assignMembershipToCohort({ membershipId: member.membershipId, userId: member.userId, cohortId: value });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Cohort" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No cohort yet</SelectItem>
                        {cohorts.map((cohort) => (
                          <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No members yet. Invite teachers, students, or guardians to populate the workspace.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            Invitations
          </div>
          <span className="text-[11px] text-muted-foreground">{invitations.length} record{invitations.length === 1 ? '' : 's'}</span>
        </div>

        {invitations.length > 0 ? (
          <div className="space-y-2">
            {invitations.map((invite) => {
              const joinUrl = invite.token
                ? inviteLinks[invite.id] || `${window.location.origin}/school/join?token=${encodeURIComponent(invite.token)}`
                : inviteLinks[invite.id];
              const isBusy = busyInviteId === invite.id;
              return (
                <div key={invite.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground break-all">{invite.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {invite.role} · {invite.status}
                        {invite.cohortNames.length > 0 ? ` · ${invite.cohortNames.join(', ')}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <p>Created {formatDate(invite.createdAt)}</p>
                      <p>Expires {formatDate(invite.expiresAt)}</p>
                    </div>
                  </div>

                  {joinUrl && invite.status === 'invited' && (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground break-all">
                      {joinUrl}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {canManage && invite.status === 'invited' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleIssueLink(invite.id)}
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          {invite.token ? 'Refresh join link' : 'Generate join link'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleCopyExistingLink(invite.id, invite.token)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy link
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => changeInvitationStatus(invite.id, 'revoked')}>
                          Revoke
                        </Button>
                      </>
                    )}
                    {invite.status === 'accepted' && (
                      <span className="text-xs text-success">Accepted {formatDate(invite.acceptedAt)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No invitations recorded yet.</p>
        )}
      </div>
    </div>
  );
}