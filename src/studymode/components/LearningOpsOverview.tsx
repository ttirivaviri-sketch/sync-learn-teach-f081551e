// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  Building2,
  CheckCircle2,
  GraduationCap,
  PlusCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Subject } from '../types/study';
import { WorkspaceRole, upsertConceptCatalogEntries } from '../lib/learningOps';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { useLearningInterventions } from '../hooks/useLearningInterventions';
import { useExamReadiness } from '../hooks/useExamReadiness';
import { cn } from '@/lib/utils';
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
import { supabase } from '@/integrations/supabase/client';
import { MasteryIntelligenceCard } from './MasteryIntelligenceCard';

interface LearningOpsOverviewProps {
  subject: Subject;
}

function severityClass(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (severity === 'medium') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-accent/30 bg-accent/10 text-accent';
}

function splitSubjectNames(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function LearningOpsOverview({ subject }: LearningOpsOverviewProps) {
  const {
    workspace,
    cohorts,
    members,
    invitations,
    error: workspaceError,
    isLoading: workspaceLoading,
    createWorkspace,
    createCohort,
    inviteMember,
    changeMemberRole,
    assignMembershipToCohort,
    changeInvitationStatus,
  } = useSchoolWorkspace();
  const { interventions, queue, headline, isLoading: interventionLoading, updateQueueItem } = useLearningInterventions({
    subjectId: subject.id,
    subjectName: subject.name,
    topicName: subject.currentTopic.name,
  });
  const { papers, isLoading: readinessLoading } = useExamReadiness();
  const { toast } = useToast();

  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false);
  const [showCohortSetup, setShowCohortSetup] = useState(false);
  const [showInviteSetup, setShowInviteSetup] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [isSavingCohort, setIsSavingCohort] = useState(false);
  const [isSavingInvite, setIsSavingInvite] = useState(false);
  const [isSeedingConcepts, setIsSeedingConcepts] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    schoolName: '',
    workspaceType: 'school' as 'school' | 'tutoring_org' | 'family' | 'personal',
  });
  const [cohortForm, setCohortForm] = useState({
    name: '',
    gradeLevel: '',
    curriculum: '',
    subjectNames: subject.name,
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'student' as WorkspaceRole,
    cohortId: 'none',
  });

  const subjectPaper = papers.find(
    (paper) => paper.subjectId === subject.id || paper.subjectName.toLowerCase() === subject.name.toLowerCase(),
  );

  const canCreateRealWorkspace = !workspace || workspace.id === 'personal-school-context';
  const canManageWorkspace = workspace?.role === 'owner' || workspace?.role === 'admin' || workspace?.role === 'teacher';
  const connectedSubjects = useMemo(() => {
    const names = new Set<string>();
    cohorts.forEach((cohort) => {
      cohort.subjectNames.forEach((name) => names.add(name));
    });
    return Array.from(names);
  }, [cohorts]);

  const openQueue = queue.filter((item) => item.status === 'open' || item.status === 'acknowledged');

  const handleCreateWorkspace = async () => {
    const name = workspaceForm.name.trim();
    if (!name) {
      toast({ title: 'Workspace name required', description: 'Add a workspace name before creating it.', variant: 'destructive' });
      return;
    }

    try {
      setIsSavingWorkspace(true);
      await createWorkspace({
        name,
        schoolName: workspaceForm.schoolName.trim() || null,
        workspaceType: workspaceForm.workspaceType,
      });
      setWorkspaceForm({ name: '', schoolName: '', workspaceType: 'school' });
      setShowWorkspaceSetup(false);
      toast({ title: 'Workspace created', description: 'School workspace is now connected to Learning Mission Control.' });
    } catch (error) {
      toast({
        title: 'Workspace creation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  const handleCreateCohort = async () => {
    const name = cohortForm.name.trim();
    const subjectNames = splitSubjectNames(cohortForm.subjectNames);

    if (!name) {
      toast({ title: 'Cohort name required', description: 'Add a cohort name before saving it.', variant: 'destructive' });
      return;
    }

    try {
      setIsSavingCohort(true);
      await createCohort({
        name,
        gradeLevel: cohortForm.gradeLevel.trim() || null,
        curriculum: cohortForm.curriculum.trim() || null,
        subjectNames: subjectNames.length > 0 ? subjectNames : [subject.name],
      });
      setCohortForm({ name: '', gradeLevel: '', curriculum: '', subjectNames: subject.name });
      setShowCohortSetup(false);
      toast({ title: 'Cohort created', description: 'The workspace can now coordinate this learner group.' });
    } catch (error) {
      toast({
        title: 'Cohort creation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCohort(false);
    }
  };

  const handleInviteMember = async () => {
    const email = inviteForm.email.trim().toLowerCase();
    if (!email) {
      toast({ title: 'Invite email required', description: 'Add an email address before sending an invite.', variant: 'destructive' });
      return;
    }

    try {
      setIsSavingInvite(true);
      await inviteMember({
        email,
        role: inviteForm.role,
        cohortIds: inviteForm.cohortId !== 'none' ? [inviteForm.cohortId] : [],
      });
      setInviteForm({ email: '', role: 'student', cohortId: 'none' });
      setShowInviteSetup(false);
      toast({ title: 'Invitation recorded', description: 'The workspace now tracks this invite and intended role.' });
    } catch (error) {
      toast({
        title: 'Invitation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingInvite(false);
    }
  };

  const handleSeedConcepts = async () => {
    try {
      setIsSeedingConcepts(true);
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Not authenticated');
      const curriculum = cohorts.find((cohort) => cohort.curriculum)?.curriculum || 'GENERAL';
      const count = await upsertConceptCatalogEntries({
        subjectId: subject.id,
        subjectName: subject.name,
        topicName: subject.currentTopic.name,
        curriculum,
        concepts: subject.currentTopic.subtopics?.length ? subject.currentTopic.subtopics : [subject.currentTopic.name],
      });
      toast({ title: 'Concept graph updated', description: `${count} concept node${count === 1 ? '' : 's'} seeded for ${subject.currentTopic.name}.` });
    } catch (error) {
      toast({
        title: 'Concept seeding failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSeedingConcepts(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radar className="h-5 w-5 text-accent" />
              <h3 className="font-bold text-foreground">Learning Mission Control</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Operational guidance across mastery, readiness, interventions, school coordination, and concept governance.
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30">
            LOS BETA
          </span>
        </div>

        {workspaceError && (
          <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            Workspace sync warning: {workspaceError}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Workspace
            </div>
            {workspaceLoading ? (
              <p className="text-xs text-muted-foreground">Loading workspace context…</p>
            ) : workspace ? (
              <>
                <p className="text-sm font-medium text-foreground">{workspace.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {workspace.workspaceType.replace('_', ' ')}{workspace.role ? ` · ${workspace.role}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'} · {members.length} member{members.length === 1 ? '' : 's'}
                </p>
                {connectedSubjects.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Subjects: {connectedSubjects.slice(0, 4).join(', ')}{connectedSubjects.length > 4 ? '…' : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No school workspace linked yet. The system will still use your personal study data.
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4 text-accent" />
              Exam readiness
            </div>
            {readinessLoading ? (
              <p className="text-xs text-muted-foreground">Calculating readiness…</p>
            ) : subjectPaper ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-foreground">{subjectPaper.readinessPercent}%</span>
                  <span className="text-xs text-muted-foreground mb-1 uppercase">{subjectPaper.confidenceBand}</span>
                </div>
                <p className="text-xs text-muted-foreground">Paper {subjectPaper.paperCode} readiness for {subject.name}.</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No paper-readiness snapshot yet. Complete quizzes or mock papers to unlock it.</p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-success" />
              Highest-impact action
            </div>
            <p className="text-sm text-foreground">{headline}</p>
          </div>
        </div>
      </div>

      <MasteryIntelligenceCard subjectId={subject.id} subjectName={subject.name} />

      {(canCreateRealWorkspace || canManageWorkspace) && (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Workspace Operations</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Membership invites, role management, cohort assignment, and concept graph seeding.
              </p>
            </div>
            {canManageWorkspace && (
              <Button variant="outline" size="sm" onClick={handleSeedConcepts} disabled={isSeedingConcepts}>
                <BookMarked className="mr-2 h-4 w-4" />
                {isSeedingConcepts ? 'Seeding…' : 'Seed current topic concepts'}
              </Button>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {canCreateRealWorkspace && (
              <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">Create school workspace</p>
                    <p className="text-xs text-muted-foreground">Turn personal study activity into a shared school operating layer.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowWorkspaceSetup((value) => !value)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {showWorkspaceSetup ? 'Hide' : 'Setup'}
                  </Button>
                </div>

                {showWorkspaceSetup && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="workspace-name">Workspace name</Label>
                      <Input
                        id="workspace-name"
                        value={workspaceForm.name}
                        onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="StudySync School Workspace"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="workspace-school">School name</Label>
                      <Input
                        id="workspace-school"
                        value={workspaceForm.schoolName}
                        onChange={(event) => setWorkspaceForm((current) => ({ ...current, schoolName: event.target.value }))}
                        placeholder="Springfield High"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Workspace type</Label>
                      <Select
                        value={workspaceForm.workspaceType}
                        onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, workspaceType: value as typeof current.workspaceType }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select workspace type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="school">School</SelectItem>
                          <SelectItem value="tutoring_org">Tutoring organisation</SelectItem>
                          <SelectItem value="family">Family</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateWorkspace} disabled={isSavingWorkspace} className="w-full">
                      {isSavingWorkspace ? 'Creating workspace…' : 'Create workspace'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {canManageWorkspace && (
              <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">Create cohort</p>
                    <p className="text-xs text-muted-foreground">Add learner groups so interventions and reporting can roll up beyond one student.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowCohortSetup((value) => !value)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {showCohortSetup ? 'Hide' : 'Add'}
                  </Button>
                </div>

                {showCohortSetup && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cohort-name">Cohort name</Label>
                      <Input
                        id="cohort-name"
                        value={cohortForm.name}
                        onChange={(event) => setCohortForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Year 11 Science"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="cohort-grade">Grade level</Label>
                        <Input
                          id="cohort-grade"
                          value={cohortForm.gradeLevel}
                          onChange={(event) => setCohortForm((current) => ({ ...current, gradeLevel: event.target.value }))}
                          placeholder="Year 11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cohort-curriculum">Curriculum</Label>
                        <Input
                          id="cohort-curriculum"
                          value={cohortForm.curriculum}
                          onChange={(event) => setCohortForm((current) => ({ ...current, curriculum: event.target.value }))}
                          placeholder="IGCSE"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cohort-subjects">Subjects</Label>
                      <Input
                        id="cohort-subjects"
                        value={cohortForm.subjectNames}
                        onChange={(event) => setCohortForm((current) => ({ ...current, subjectNames: event.target.value }))}
                        placeholder="Biology, Chemistry, Physics"
                      />
                    </div>
                    <Button onClick={handleCreateCohort} disabled={isSavingCohort} className="w-full">
                      {isSavingCohort ? 'Creating cohort…' : 'Create cohort'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {canManageWorkspace && workspace && workspace.id !== 'personal-school-context' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">Invite workspace member</p>
                    <p className="text-xs text-muted-foreground">Record intended role and cohort assignment before activation.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowInviteSetup((value) => !value)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {showInviteSetup ? 'Hide' : 'Invite'}
                  </Button>
                </div>

                {showInviteSetup && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
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
                      {isSavingInvite ? 'Saving invite…' : 'Save invitation'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
                <div>
                  <p className="font-medium text-foreground">Pending invitations</p>
                  <p className="text-xs text-muted-foreground">Use this as a lightweight membership pipeline before richer onboarding flows land.</p>
                </div>
                {invitations.length > 0 ? (
                  <div className="space-y-2">
                    {invitations.slice(0, 5).map((invite) => (
                      <div key={invite.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground break-all">{invite.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {invite.role} · {invite.status}{invite.cohortNames.length > 0 ? ` · ${invite.cohortNames.join(', ')}` : ''}
                            </p>
                          </div>
                          {invite.status === 'invited' && (
                            <Button variant="ghost" size="sm" onClick={() => changeInvitationStatus(invite.id, 'revoked')}>
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No invitations recorded yet.</p>
                )}
              </div>
            </div>
          )}

          {canManageWorkspace && members.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-background/60 space-y-3">
              <div>
                <p className="font-medium text-foreground">Role and cohort management</p>
                <p className="text-xs text-muted-foreground">Closed-loop school operations start with clear ownership and cohort placement.</p>
              </div>
              <div className="space-y-3">
                {members.slice(0, 8).map((member) => (
                  <div key={member.membershipId} className="rounded-lg border border-border p-3 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground break-all">
                        {member.email || 'No email'} · {member.cohortNames.length > 0 ? member.cohortNames.join(', ') : 'No cohort assigned'}
                      </p>
                    </div>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-warning" />
            Closed-loop intervention queue
          </div>
          <span className="text-[11px] text-muted-foreground">{openQueue.length} active</span>
        </div>

        {interventionLoading ? (
          <p className="text-xs text-muted-foreground">Scanning learning signals…</p>
        ) : openQueue.length > 0 ? (
          <div className="space-y-2">
            {openQueue.slice(0, 5).map((intervention) => (
              <div key={intervention.id} className="p-3 rounded-xl border border-border bg-background/60 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground capitalize">{intervention.type.replace(/-/g, ' ')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{intervention.reason}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', severityClass(intervention.priority))}>
                    {intervention.priority}
                  </span>
                </div>
                <p className="text-sm text-foreground">{intervention.recommendedAction}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => updateQueueItem({ interventionId: intervention.id, status: 'acknowledged', note: 'Acknowledged in mission control.' })}>
                    Acknowledge
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateQueueItem({ interventionId: intervention.id, status: 'resolved', note: 'Resolved after learner action.' })}>
                    Resolve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => updateQueueItem({ interventionId: intervention.id, status: 'dismissed', note: 'Dismissed after review.' })}>
                    Dismiss
                  </Button>
                  {canManageWorkspace && (
                    <Select
                      value={intervention.assignedRole || 'student'}
                      onValueChange={(value) => updateQueueItem({ interventionId: intervention.id, assignedRole: value as WorkspaceRole, note: `Assigned to ${value}.` })}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Assign role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Assign to student</SelectItem>
                        <SelectItem value="teacher">Assign to teacher</SelectItem>
                        <SelectItem value="tutor">Assign to tutor</SelectItem>
                        <SelectItem value="guardian">Assign to guardian</SelectItem>
                        <SelectItem value="admin">Assign to admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : interventions.length > 0 ? (
          <div className="space-y-2">
            {interventions.slice(0, 3).map((intervention) => (
              <div key={intervention.id} className="p-3 rounded-xl border border-border bg-background/60 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{intervention.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{intervention.reason}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border uppercase', severityClass(intervention.severity))}>
                    {intervention.severity}
                  </span>
                </div>
                <p className="text-sm text-foreground">{intervention.recommendation}</p>
                {intervention.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {intervention.evidence.map((item, index) => (
                      <span key={`${intervention.id}-${index}`} className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-success/30 bg-success/10 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <div>
              <p className="font-medium text-foreground">No urgent interventions</p>
              <p className="text-sm text-muted-foreground">
                Current signals look stable. Keep following your structured study flow and timed practice.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}