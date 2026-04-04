import { useState } from 'react';
import { ArrowLeft, Target, TrendingUp, MessageCircle, Sparkles, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import { Subject, DailyTask } from '../types/study';
import { Button } from './ui/button';
import { TaskList } from './TaskList';
import { ExamQuestionPanel } from './ExamQuestionPanel';
import { TaskContentPanel } from './TaskContentPanel';
import { FlashcardPanel } from './FlashcardPanel';
import { PrerequisiteRemediationFlow } from './PrerequisiteRemediationFlow';
import { ConceptMasteryBreakdown } from './ConceptMasteryBreakdown';
import { useTopicProgression } from '../hooks/useTopicProgression';
import { useUserProgress } from '../hooks/useUserProgress';
import { cn } from '../lib/utils';

interface SubjectDetailProps {
  subject: Subject;
  tasks: DailyTask[];
  onBack: () => void;
  onOpenChat?: (subject: string, topic: string) => void;
}

export function SubjectDetail({ subject, tasks, onBack, onOpenChat }: SubjectDetailProps) {
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [currentTasks, setCurrentTasks] = useState(tasks);
  const [showPrerequisiteCheck, setShowPrerequisiteCheck] = useState(false);
  const [showConceptBreakdown, setShowConceptBreakdown] = useState(false);
  const { advanceToNextTopic, canAdvance, getCurrentTopicIndex } = useTopicProgression();
  const { addXp, updateStreak } = useUserProgress();

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 95) return 'text-success';
    if (mastery >= 70) return 'text-accent';
    if (mastery >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const handleTaskComplete = () => {
    if (!selectedTask) return;
    
    setCurrentTasks(prev => {
      const updatedTasks = prev.map(t => 
        t.id === selectedTask.id ? { ...t, isCompleted: true } : t
      );
      
      const currentIndex = updatedTasks.findIndex(t => t.id === selectedTask.id);
      if (currentIndex < updatedTasks.length - 1) {
        updatedTasks[currentIndex + 1].isLocked = false;
      }
      
      return updatedTasks;
    });
    
    // Award XP and update streak
    addXp.mutate(10);
    updateStreak.mutate();
    
    setSelectedTask(null);
  };

  const handleAdvanceTopic = () => {
    const topicIndex = getCurrentTopicIndex(subject);
    advanceToNextTopic.mutate({ subject, currentTopicIndex: topicIndex });
  };

  // Show prerequisite remediation flow
  if (showPrerequisiteCheck) {
    return (
      <PrerequisiteRemediationFlow
        subject={subject.name}
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
        onComplete={handleTaskComplete}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-md",
            `bg-gradient-to-br ${subject.color}`
          )}>
            {subject.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{subject.name}</h2>
            <p className="text-sm text-muted-foreground">Today's Study Pack</p>
          </div>
        </div>
      </div>

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

      {/* Task List */}
      <div>
         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-bold text-foreground">Today's Tasks</h3>
           <span className="text-xs text-muted-foreground flex items-center gap-1">
             <Sparkles className="h-3 w-3" />
             AI-powered content
           </span>
         </div>
        <TaskList tasks={currentTasks} onTaskClick={setSelectedTask} />
      </div>
    </div>
  );
}
