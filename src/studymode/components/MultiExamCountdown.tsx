import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, GraduationCap, Plus, Trash2, ChevronDown, ChevronUp,
  Target, Brain, Flame, Shield, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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

function getUrgencyConfig(days: number) {
  if (days <= 3) return { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', icon: Flame, label: 'CRITICAL' };
  if (days <= 7) return { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', icon: AlertTriangle, label: 'Exam Mode' };
  if (days <= 14) return { color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30', icon: Target, label: 'Focused Study' };
  if (days <= 30) return { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', icon: Brain, label: 'Steady Progress' };
  return { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', icon: Shield, label: 'On Track' };
}

function getReadinessColor(readiness: number) {
  if (readiness >= 80) return 'text-success';
  if (readiness >= 60) return 'text-primary';
  if (readiness >= 40) return 'text-accent';
  return 'text-destructive';
}

function ExamCard({ exam, onDelete }: { exam: SubjectExamWithReadiness; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const urgency = getUrgencyConfig(exam.daysRemaining);
  const UrgencyIcon = urgency.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('rounded-2xl border p-4', urgency.bg, urgency.border)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl font-bold text-2xl shrink-0', urgency.bg)}>
            <span className={urgency.color}>{exam.daysRemaining}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">
              {exam.exam_name || exam.subject?.name || 'Exam'}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(exam.exam_date), 'EEE, dd MMM yyyy')}
              {exam.paper_number && ` • Paper ${exam.paper_number}`}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <UrgencyIcon className={cn('h-3 w-3', urgency.color)} />
              <span className={cn('text-xs font-semibold', urgency.color)}>
                {exam.daysRemaining === 0 ? 'TODAY' : `${exam.daysRemaining} days`}
              </span>
              <span className="text-xs text-muted-foreground">• {urgency.label}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Readiness bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall Readiness</span>
          <span className={cn('font-bold', getReadinessColor(exam.topicReadiness))}>{exam.topicReadiness}%</span>
        </div>
        <Progress value={exam.topicReadiness} className="h-2" />
      </div>

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-xs text-muted-foreground">Topics</p>
          <p className="text-sm font-bold text-foreground">{exam.topicBreakdown.length}</p>
        </div>
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-xs text-muted-foreground">Quizzes</p>
          <p className="text-sm font-bold text-foreground">{exam.quizAttempts}</p>
        </div>
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-xs text-muted-foreground">Accuracy</p>
          <p className={cn('text-sm font-bold', getReadinessColor(exam.avgAccuracy))}>{exam.avgAccuracy}%</p>
        </div>
      </div>

      {/* Expanded topic breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic Readiness</p>
              {exam.topicBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No topics found for this subject.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {exam.topicBreakdown.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-foreground truncate">{topic.name}</span>
                          <span className={cn('text-xs font-semibold ml-2', getReadinessColor(topic.mastery))}>
                            {topic.mastery}%
                          </span>
                        </div>
                        <Progress value={topic.mastery} className="h-1" />
                      </div>
                      {topic.mastery >= 80 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      ) : topic.mastery < 40 ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Exam Countdowns</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : <><Plus className="h-4 w-4 mr-1" /> Add Exam</>}
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
