import { useState, useEffect } from 'react';
import { ArrowLeft, Target, TrendingUp, MessageCircle, Sparkles, Unlock, ChevronDown, ChevronUp, ChevronRight, Brain, Clock, BarChart3, Zap, Trophy, Play } from 'lucide-react';
import { Subject, DailyTask } from '../types/study';
import { Button } from '@/components/ui/button';
import { StructuredDailyTaskRunner } from './StructuredDailyTaskRunner';
import { ExamQuestionPanel } from './ExamQuestionPanel';
import { TaskContentPanel } from './TaskContentPanel';
import { FlashcardPanel } from './FlashcardPanel';
import { ActiveRecallSession } from './ActiveRecallSession';
import { ExamModeSession } from './ExamModeSession';
import { InsightsDashboardPanel } from './InsightsDashboardPanel';
import { MasteryTrackerPanel } from './MasteryTrackerPanel';
import { PrerequisiteRemediationFlow } from './PrerequisiteRemediationFlow';
import { ConceptMasteryBreakdown } from './ConceptMasteryBreakdown';
import { Leaderboard } from './Leaderboard';
import { useTopicProgression } from '../hooks/useTopicProgression';
import { useUserProgress } from '../hooks/useUserProgress';
import { useSubjectXP } from '../hooks/useSubjectXP';
import { supabase } from '../../integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SubjectDetailProps {
  subject: Subject;
  tasks: DailyTask[];
  onBack: () => void;
  onOpenChat?: (subject: string, topic: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onAddBonusTask?: () => void;
  curriculum?: string | null;
}

export function SubjectDetail({ subject, tasks, onBack, onOpenChat, onCompleteTask, onAddBonusTask, curriculum }: SubjectDetailProps) {
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [currentTasks, setCurrentTasks] = useState(tasks);
  const [showPrerequisiteCheck, setShowPrerequisiteCheck] = useState(false);
  const [showConceptBreakdown, setShowConceptBreakdown] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeView, setActiveView] = useState<'tasks' | 'recall' | 'exam' | 'insights' | 'mastery'>('tasks');
  const [recallTopic, setRecallTopic] = useState<string | null>(null);
  const { advanceToNextTopic, canAdvance, getCurrentTopicIndex } = useTopicProgression();
  const { addXp, updateStreak } = useUserProgress();
  const { awardXP } = useSubjectXP();

  // Keep local task state in sync with parent (also force-unlock all when set is complete)
  useEffect(() => {
    const allDone = tasks.length > 0 && tasks.every(t => t.isCompleted);
    setCurrentTasks(allDone ? tasks.map(t => ({ ...t, isLocked: false })) : tasks);
  }, [tasks]);

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 95) return 'text-success';
    if (mastery >= 70) return 'text-accent';
    if (mastery >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const [xpPopup, setXpPopup] = useState<{ amount: number; key: number } | null>(null);
  const [completionCard, setCompletionCard] = useState<{ task: DailyTask; nextTask: DailyTask | null } | null>(null);

  const handleTaskComplete = () => {
    if (!selectedTask) return;

    // Replay path: task already done today — don't re-award XP, don't show completion card,
    // and don't kick the learner out of the panel. They can keep practising freely.
    if (selectedTask.isCompleted) {
      onCompleteTask?.(selectedTask.id); // hook short-circuits the DB write
      return;
    }

    // Persist to DB
    onCompleteTask?.(selectedTask.id);

    let nextUnlocked: DailyTask | null = null;

    setCurrentTasks(prev => {
      const updatedTasks = prev.map(t =>
        t.id === selectedTask.id ? { ...t, isCompleted: true } : t
      );

      const currentIndex = updatedTasks.findIndex(t => t.id === selectedTask.id);
      if (currentIndex < updatedTasks.length - 1) {
        updatedTasks[currentIndex + 1].isLocked = false;
        nextUnlocked = updatedTasks[currentIndex + 1];
      }

      // If this completion finishes the day's set, unlock everything for free replay
      if (updatedTasks.every(t => t.isCompleted)) {
        return updatedTasks.map(t => ({ ...t, isLocked: false }));
      }

      return updatedTasks;
    });

    // Award XP and update streak (first completion only)
    const xpAmount = 10;
    addXp.mutate(xpAmount);
    updateStreak.mutate();
    awardXP.mutate({ subject: subject.name, curriculum, amount: xpAmount });

    // Show XP popup
    setXpPopup({ amount: xpAmount, key: Date.now() });
    setTimeout(() => setXpPopup(null), 1500);

    // Show completion card with auto-advance
    setCompletionCard({ task: selectedTask, nextTask: nextUnlocked });
    setSelectedTask(null);
  };

  const handleContinueToNext = (task: DailyTask) => {
    setCompletionCard(null);
    setSelectedTask(task);
  };

  const handleDismissCompletion = () => {
    setCompletionCard(null);
  };

  const handleAdvanceTopic = () => {
    const topicIndex = getCurrentTopicIndex(subject);
    advanceToNextTopic.mutate({ subject, currentTopicIndex: topicIndex });
  };

  // ── Active Recall Session ──────────────────────────────────────────────
  if (activeView === 'recall') {
    const targetTopic = recallTopic
      ? subject.topics.find(t => t.name === recallTopic)
      : subject.currentTopic;
    return (
      <div className="animate-fade-in">
        <ActiveRecallSession
          subject={subject}
          topic={targetTopic || subject.currentTopic}
          onComplete={() => { setActiveView('tasks'); setRecallTopic(null); }}
          onBack={() => { setActiveView('tasks'); setRecallTopic(null); }}
        />
      </div>
    );
  }

  // ── Exam Mode Session ────────────────────────────────────────────────
  if (activeView === 'exam') {
    const targetTopic = recallTopic
      ? subject.topics.find(t => t.name === recallTopic)
      : subject.currentTopic;
    return (
      <div className="animate-fade-in">
        <ExamModeSession
          subject={subject}
          topic={targetTopic || subject.currentTopic}
          onComplete={() => { setActiveView('tasks'); setRecallTopic(null); }}
          onBack={() => { setActiveView('tasks'); setRecallTopic(null); }}
        />
      </div>
    );
  }

  // ── Insights Dashboard ───────────────────────────────────────────────
  if (activeView === 'insights') {
    return (
      <InsightsDashboardPanel
        subjectId={subject.id}
        subjectName={subject.name}
        topicName={subject.currentTopic.name}
        onBack={() => setActiveView('tasks')}
      />
    );
  }

  // ── Mastery Tracker ──────────────────────────────────────────────────
  if (activeView === 'mastery') {
    return (
      <MasteryTrackerPanel
        subject={subject}
        onBack={() => setActiveView('tasks')}
        onStartRecall={(topicName) => { setRecallTopic(topicName); setActiveView('recall'); }}
        onStartExam={(topicName) => { setRecallTopic(topicName); setActiveView('exam'); }}
      />
    );
  }

  // Show prerequisite remediation flow
  if (showPrerequisiteCheck) {
    return (
      <PrerequisiteRemediationFlow
        subject={subject.name}
        subjectId={subject.id}
        currentTopic={subject.currentTopic.name}
        onComplete={() => setShowPrerequisiteCheck(false)}
        onBack={() => setShowPrerequisiteCheck(false)}
      />
    );
  }

  if (selectedTask?.type === 'exam-question') {
    return (
      <div className="animate-fade-in">
        <ExamQuestionPanel
           subject={subject}
           topic={subject.currentTopic}
          onComplete={() => handleTaskComplete()}
          onBack={() => setSelectedTask(null)}
        />
      </div>
    );
  }

  // Flashcard interactive panel
  if (selectedTask?.type === 'flashcards') {
    return (
      <FlashcardPanel
        task={selectedTask}
        subject={subject}
        onComplete={handleTaskComplete}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  // AI-powered content for streaming text tasks
  if (selectedTask && ['micro-revision', 'concept-learning', 'active-recall', 'summary', 'revision-checklist'].includes(selectedTask.type)) {
    return (
      <TaskContentPanel
        task={selectedTask}
        subject={subject}
        curriculum={curriculum}
        onComplete={handleTaskComplete}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* XP Popup Animation */}
      {xpPopup && (
        <div
          key={xpPopup.key}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fade-in"
          style={{ animation: 'xp-float 1.5s ease-out forwards' }}
        >
          <div className="bg-accent text-accent-foreground px-4 py-2 rounded-full font-bold text-lg shadow-lg flex items-center gap-1">
            <Zap className="h-5 w-5" />
            +{xpPopup.amount} XP
          </div>
        </div>
      )}

      {/* Task Completion Card with Auto-Advance */}
      {completionCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-card border border-success/30 shadow-lg text-center animate-scale-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-3xl mb-3">
              ✅
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Task Complete!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Great work on "{completionCard.task.title}"
            </p>
            {completionCard.nextTask ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleContinueToNext(completionCard.nextTask!)}
                  className="w-full gradient-primary gap-2"
                >
                  <ChevronRight className="h-4 w-4" />
                  Continue to Next Task
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissCompletion}
                  className="w-full text-muted-foreground"
                >
                  Back to Task List
                </Button>
              </div>
            ) : (
              <Button onClick={handleDismissCompletion} className="w-full gradient-primary">
                🎉 All Tasks Done!
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-md shrink-0",
            `bg-gradient-to-br ${subject.color}`
          )}>
            {subject.icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{subject.name}</h2>
            <p className="text-sm text-muted-foreground">Today's Study Pack</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLeaderboard(true)}
          className="shrink-0 gap-1.5 border-accent/40 hover:bg-accent/10"
        >
          <Trophy className="h-4 w-4 text-accent" />
          <span className="hidden sm:inline">Leaderboard</span>
        </Button>
      </div>

      <Leaderboard
        open={showLeaderboard}
        onOpenChange={setShowLeaderboard}
        curriculum={curriculum}
        subject={subject.name}
      />

      {/* Current Topic Card */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            <span className="font-medium text-foreground">Today's Focus</span>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">
            {subject.currentTopic.examWeight}% exam weight
          </span>
        </div>
        
        <h3 className="text-lg font-bold text-foreground mb-3">
          {subject.currentTopic.name}
        </h3>

        {/* Mastery Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Topic Mastery
            </span>
            <span className={cn("font-bold", getMasteryColor(subject.currentTopic.mastery))}>
              {subject.currentTopic.mastery}%
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                subject.currentTopic.mastery >= 95 ? "bg-success" :
                subject.currentTopic.mastery >= 70 ? "bg-accent" :
                subject.currentTopic.mastery >= 50 ? "bg-warning" : "bg-destructive"
              )}
              style={{ width: `${subject.currentTopic.mastery}%` }}
            />
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/30"
              style={{ left: '95%' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {subject.currentTopic.mastery >= 95 
              ? "🎉 Ready to advance to next topic!"
              : `${95 - subject.currentTopic.mastery}% more to unlock next topic`
            }
          </p>
        </div>

        {/* Concept Mastery Breakdown Toggle */}
        <button
          onClick={() => setShowConceptBreakdown(v => !v)}
          className="w-full mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <span className="font-medium">Concept Breakdown</span>
          {showConceptBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showConceptBreakdown && (
          <div className="mt-2">
            <ConceptMasteryBreakdown subjectId={subject.id} topicName={subject.currentTopic.name} />
          </div>
        )}

        {/* Advance Topic Button */}
        {canAdvance(subject) && (
          <Button
            onClick={handleAdvanceTopic}
            disabled={advanceToNextTopic.isPending}
            className="w-full mt-4 gradient-success gap-2"
          >
            <Unlock className="h-4 w-4" />
            {advanceToNextTopic.isPending ? 'Unlocking...' : 'Advance to Next Topic'}
          </Button>
        )}

        {/* Check Prerequisites Button */}
        <Button
          onClick={() => setShowPrerequisiteCheck(true)}
          variant="outline"
          className="w-full mt-3 gap-2 border-accent/30 hover:bg-accent/10"
        >
          <Target className="h-4 w-4 text-accent" />
          Check My Prerequisites
        </Button>

        {/* Ask AI Tutor Button */}
        {onOpenChat && (
          <Button
            onClick={() => onOpenChat(subject.name, subject.currentTopic.name)}
            variant="outline"
            className="w-full mt-3 gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Ask AI Tutor about this topic
          </Button>
        )}
      </div>

      {/* ── Quick Launch: Active Recall, Exam Mode, Insights, Mastery ─── */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setActiveView('recall')}
          className="h-auto py-4 flex-col gap-2 gradient-primary"
        >
          <Brain className="h-6 w-6" />
          <div className="text-center">
            <p className="text-sm font-bold">Active Recall</p>
            <p className="text-[10px] opacity-80">10+ AI questions</p>
          </div>
        </Button>
        <Button
          onClick={() => setActiveView('exam')}
          className="h-auto py-4 flex-col gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          <Clock className="h-6 w-6" />
          <div className="text-center">
            <p className="text-sm font-bold">Exam Mode</p>
            <p className="text-[10px] opacity-80">Timed, no hints</p>
          </div>
        </Button>
        <Button
          onClick={() => setActiveView('mastery')}
          variant="outline"
          className="h-auto py-4 flex-col gap-2 border-accent/30 hover:bg-accent/10"
        >
          <Target className="h-6 w-6 text-accent" />
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Mastery Tracker</p>
            <p className="text-[10px] text-muted-foreground">Per-topic progress</p>
          </div>
        </Button>
        <Button
          onClick={() => setActiveView('insights')}
          variant="outline"
          className="h-auto py-4 flex-col gap-2 border-accent/30 hover:bg-accent/10"
        >
          <BarChart3 className="h-6 w-6 text-accent" />
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Insights</p>
            <p className="text-[10px] text-muted-foreground">Analytics & trends</p>
          </div>
        </Button>
      </div>

      {/* Task List */}
      <div>
         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-bold text-foreground">Today's Tasks</h3>
           <span className="text-xs text-muted-foreground flex items-center gap-1">
             <Sparkles className="h-3 w-3" />
             AI-powered content
           </span>
         </div>
        <TaskList 
          tasks={currentTasks} 
          onTaskClick={setSelectedTask}
          onAddBonusTask={onAddBonusTask}
        />
      </div>
    </div>
  );
}
