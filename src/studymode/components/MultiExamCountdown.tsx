import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, GraduationCap, Plus, Trash2,
  AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MasteryRing } from '@/components/ui/mastery-ring';
import { cn } from '@/lib/utils';
import { SubjectExamWithReadiness } from '../hooks/useSubjectExams';
import { Subject } from '../types/study';

interface MultiExamCountdownProps {
  exams: SubjectExamWithReadiness[];
  subjects: Subject[];
  onAddExam: (exam: { subject_id: string; exam_name: string; exam_date: string; paper_number?: string }) => void;
  onDeleteExam: (id: string) => void;
  isAdding?: boolean;
}

// Days badge tint follows urgency; severity pill follows readiness (spec p.8 mockup).
function getDaysBadgeClass(days: number) {
  if (days < 0) return 'bg-muted text-muted-foreground';
  if (days <= 14) return 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400';
  if (days <= 60) return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400';
  return 'bg-primary/10 text-primary';
}

function getSeverityPill(readiness: number) {
  if (readiness > 70) return { label: 'On track · good readiness', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' };
  if (readiness >= 30) return { label: 'Building · keep going', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' };
  return { label: 'Critical · low readiness', cls: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' };
}

// Spec: readiness colour-coded red <30%, amber 30–70%, green >70%.
function getReadinessColor(readiness: number) {
  if (readiness > 70) return 'text-emerald-600 dark:text-emerald-400';
  if (readiness >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const TOPICS_PREVIEW_COUNT = 3;

function ExamCard({ exam, onDelete }: { exam: SubjectExamWithReadiness; onDelete: () => void }) {
  const [showAllTopics, setShowAllTopics] = useState(false);
  const isPast = exam.daysRemaining < 0;
  const severity = getSeverityPill(exam.topicReadiness);
  const visibleTopics = showAllTopics ? exam.topicBreakdown : exam.topicBreakdown.slice(0, TOPICS_PREVIEW_COUNT);
  const hiddenCount = exam.topicBreakdown.length - TOPICS_PREVIEW_COUNT;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      {/* Header row — days badge block, title + date + severity pill, delete */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-14 w-14 flex-col items-center justify-center rounded-xl shrink-0', getDaysBadgeClass(exam.daysRemaining))}>
          {isPast ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <>
              {/* Never show a signed negative countdown — "-80 days" reads as a bug. */}
              <span className="text-xl font-extrabold leading-none">{exam.daysRemaining}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">days</span>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm truncate">
            {exam.exam_name || exam.subject?.name || 'Exam'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(exam.exam_date), 'EEE, dd MMM yyyy')}
            {exam.paper_number && ` • Paper ${exam.paper_number}`}
            {isPast && ` • ${Math.abs(exam.daysRemaining)} day${Math.abs(exam.daysRemaining) === 1 ? '' : 's'} ago`}
            {exam.daysRemaining === 0 && ' • TODAY'}
          </p>
          <span className={cn('inline-block mt-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold', severity.cls)}>
            {severity.label}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Overall readiness ring + quick stats — rings, never thin horizontal bars */}
      <div className="mt-3 flex items-center gap-4">
        <MasteryRing value={exam.topicReadiness} size={56} strokeWidth={5} />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Overall readiness</p>
          <div className="flex items-baseline gap-5">
            <div>
              <span className="text-sm font-bold text-foreground">{exam.topicBreakdown.length}</span>
              <span className="block text-[10px] text-muted-foreground">topics</span>
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">{exam.quizAttempts}</span>
              <span className="block text-[10px] text-muted-foreground">quizzes</span>
            </div>
            <div>
              <span className={cn('text-sm font-bold', getReadinessColor(exam.avgAccuracy))}>{exam.avgAccuracy}%</span>
              <span className="block text-[10px] text-muted-foreground">accuracy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Topic readiness — always visible list rows with warnings, per mockup */}
      <div className="mt-3 pt-3 border-t border-border/60">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Topic Readiness</p>
        {exam.topicBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No topics found for this subject.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {visibleTopics.map((topic, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-xs text-foreground truncate">{topic.name}</span>
                <span className={cn('flex items-center gap-1 text-xs font-semibold shrink-0', getReadinessColor(topic.mastery))}>
                  {topic.mastery >= 80 ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : topic.mastery < 40 ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {topic.mastery}%
                </span>
              </div>
            ))}
          </div>
        )}
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAllTopics(!showAllTopics)}
            className="mt-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {showAllTopics ? 'Show fewer topics' : `+${hiddenCount} more topics`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function MultiExamCountdown({ exams, subjects, onAddExam, onDeleteExam, isAdding }: MultiExamCountdownProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newExam, setNewExam] = useState({ subject_id: '', exam_name: '', exam_date: undefined as Date | undefined, paper_number: '' });

  // Deduplicate exams by subject_id + exam_date (keep the first occurrence)
  const dedupedExams = useMemo(() => {
    const seen = new Set<string>();
    return exams.filter((e) => {
      const key = `${e.subject_id}_${e.exam_date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [exams]);

  const handleAdd = () => {
    if (!newExam.subject_id || !newExam.exam_date) return;
    const subject = subjects.find(s => s.id === newExam.subject_id);
    onAddExam({
      subject_id: newExam.subject_id,
      exam_name: newExam.exam_name || subject?.name || 'Exam',
      exam_date: format(newExam.exam_date, 'yyyy-MM-dd'),
      paper_number: newExam.paper_number || undefined,
    });
    setNewExam({ subject_id: '', exam_name: '', exam_date: undefined, paper_number: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Exam countdowns</h2>
        <Button variant="outline" size="sm" className="rounded-full text-primary border-primary/30 hover:bg-primary/5" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Add exam</>}
        </Button>
      </div>

      {/* Add Exam Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Select value={newExam.subject_id} onValueChange={(v) => setNewExam(p => ({ ...p, subject_id: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paper (optional)</Label>
                  <Input
                    value={newExam.paper_number}
                    onChange={(e) => setNewExam(p => ({ ...p, paper_number: e.target.value }))}
                    placeholder="e.g. 1, 2"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exam Name</Label>
                <Input
                  value={newExam.exam_name}
                  onChange={(e) => setNewExam(p => ({ ...p, exam_name: e.target.value }))}
                  placeholder="e.g. Mathematics Paper 2, Biology Paper 1"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exam Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left h-9 text-sm', !newExam.exam_date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newExam.exam_date ? format(newExam.exam_date, 'PPP') : 'Pick exam date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newExam.exam_date}
                      onSelect={(d) => setNewExam(p => ({ ...p, exam_date: d }))}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleAdd} disabled={!newExam.subject_id || !newExam.exam_date || isAdding} size="sm" className="w-full">
                {isAdding ? 'Adding...' : 'Add Exam'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exam Cards */}
      {dedupedExams.length === 0 && !showAdd ? (
        <div className="p-6 rounded-2xl border border-dashed border-border text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">No exam dates set yet</p>
          <p className="text-xs text-muted-foreground">Add your exam dates to get countdowns, readiness tracking, and smarter study scheduling.</p>
        </div>
      ) : (
        <AnimatePresence>
          {dedupedExams.map(exam => (
            <ExamCard key={exam.id} exam={exam} onDelete={() => onDeleteExam(exam.id)} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
