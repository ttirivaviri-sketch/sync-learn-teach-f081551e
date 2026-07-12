// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * ConceptIngestionPanel
 *
 * Phase 3.1 UI. Sits in the School Admin Console. Lets owners/admins/teachers:
 *   - kick off document-to-concept ingestion for a specific processed document
 *   - review pending staged concepts (approve / reject / promote to catalog)
 *   - see recent ingestion outcomes with provenance
 */
import { useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, PlusCircle, RefreshCw, XCircle } from 'lucide-react';
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
import { useConceptIngestion } from '../hooks/useConceptIngestion';

interface DocumentOption {
  id: string;
  title: string;
  type: string;
  subject: string | null;
}

interface Props {
  workspaceId: string | null;
  canManage: boolean;
  defaultCurriculum?: string | null;
}

export function ConceptIngestionPanel({ workspaceId, canManage, defaultCurriculum }: Props) {
  const { pending, recent, isLoading, busyId, lastRun, refresh, ingestDocument, approve, reject, promote } = useConceptIngestion({ workspaceId });
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [form, setForm] = useState({
    documentId: '',
    subjectName: '',
    topicName: '',
    curriculum: defaultCurriculum ?? 'GENERAL',
    sourceKind: 'syllabus' as 'syllabus' | 'past_paper' | 'notes' | 'manual',
  });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('documents')
        .select('id, title, type, subject')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setDocuments((data ?? []) as DocumentOption[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedDoc = useMemo(() => documents.find((doc) => doc.id === form.documentId), [documents, form.documentId]);

  const handleRun = async () => {
    if (!form.documentId || !form.subjectName.trim()) {
      toast({ title: 'Document and subject required', variant: 'destructive' });
      return;
    }
    setIsRunning(true);
    try {
      const result = await ingestDocument({
        documentId: form.documentId,
        subjectName: form.subjectName.trim(),
        topicName: form.topicName.trim() || undefined,
        curriculum: form.curriculum.trim() || 'GENERAL',
        sourceKind: form.sourceKind,
      });
      toast({
        title: 'Ingestion complete',
        description: `${result.staged} candidate${result.staged === 1 ? '' : 's'} staged for review.`,
      });
    } catch (err) {
      toast({
        title: 'Ingestion failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Concept ingestion</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Extract concepts from parsed documents into the concept graph. Ingestion is staged for review before promotion.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {canManage && (
        <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Parsed document</Label>
              <Select value={form.documentId} onValueChange={(value) => setForm((current) => ({ ...current, documentId: value }))}>
                <SelectTrigger><SelectValue placeholder="Choose a processed document" /></SelectTrigger>
                <SelectContent>
                  {documents.length === 0 && <SelectItem value="none" disabled>No processed documents</SelectItem>}
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>{doc.title ?? doc.id} · {doc.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source kind</Label>
              <Select value={form.sourceKind} onValueChange={(value) => setForm((current) => ({ ...current, sourceKind: value as typeof form.sourceKind }))}>
                <SelectTrigger><SelectValue placeholder="Source kind" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="syllabus">Syllabus</SelectItem>
                  <SelectItem value="past_paper">Past paper</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Subject name</Label>
              <Input
                value={form.subjectName}
                onChange={(event) => setForm((current) => ({ ...current, subjectName: event.target.value }))}
                placeholder={selectedDoc?.subject ?? 'Mathematics'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default topic (optional)</Label>
              <Input
                value={form.topicName}
                onChange={(event) => setForm((current) => ({ ...current, topicName: event.target.value }))}
                placeholder="Algebra"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Curriculum</Label>
              <Input
                value={form.curriculum}
                onChange={(event) => setForm((current) => ({ ...current, curriculum: event.target.value }))}
                placeholder="IGCSE"
              />
            </div>
          </div>
          <Button onClick={handleRun} disabled={isRunning || !form.documentId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {isRunning ? 'Extracting…' : 'Extract concepts'}
          </Button>
        </div>
      )}

      {lastRun && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 text-accent-foreground text-xs p-2">
          Last run · {lastRun.staged} staged · {lastRun.rejected} skipped
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Pending review ({pending.length})</p>
        {pending.length === 0 && (
          <p className="text-xs text-muted-foreground">No staged concepts pending review.</p>
        )}
        {pending.slice(0, 12).map((row) => {
          const isBusy = busyId === row.id;
          return (
            <div key={row.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{row.conceptName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.subjectName} · {row.topicName} · {row.sourceKind}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">Confidence {Math.round(row.confidence * 100)}%</span>
              </div>
              {row.prerequisites.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Prereqs: {row.prerequisites.join(', ')}</p>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={isBusy} onClick={() => promote(row.id).then(() => undefined)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Promote to catalog
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => approve(row.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => reject(row.id, 'Rejected during review')}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Recent outcomes</p>
        {recent.length === 0 && <p className="text-xs text-muted-foreground">No ingestion history yet.</p>}
        {recent.slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{row.conceptName}</span>
              <span className="text-muted-foreground uppercase">{row.status}</span>
            </div>
            <p className="text-muted-foreground">{row.subjectName} · {row.topicName} · {row.sourceKind}</p>
          </div>
        ))}
      </div>
    </div>
  );
}