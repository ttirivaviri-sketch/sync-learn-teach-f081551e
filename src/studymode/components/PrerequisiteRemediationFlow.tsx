import { useState, useEffect } from 'react';
import { ArrowLeft, Brain, BookOpen, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MathMarkdown } from './MathMarkdown';
import { aiRequestJSON } from '../lib/aiClient';
import { useAuth } from '@/hooks/useAuth';
import { useAcademicProfile } from '@/hooks/useAcademicProfile';
import { logger } from "@/utils/logger";

interface PrerequisiteGap {
  topic: string;
  description: string;
  exampleQuestions: string[];
  missingConcepts: string[];
  tiedToQuestionType?: string;
}

interface PrerequisiteRemediationFlowProps {
  subject: string;
  subjectId?: string;
  currentTopic: string;
  onComplete: () => void;
  onBack: () => void;
}

export function PrerequisiteRemediationFlow({
  subject,
  subjectId,
  currentTopic,
  onComplete,
  onBack,
}: PrerequisiteRemediationFlowProps) {
  const [phase, setPhase] = useState<'analysis' | 'theory' | 'quiz' | 'complete' | 'error'>('analysis');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [gaps, setGaps] = useState<PrerequisiteGap[]>([]);
  const [currentGapIndex, setCurrentGapIndex] = useState(0);
  const [theoryContent, setTheoryContent] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useAcademicProfile(user?.id);
  const curriculum = profile?.curriculum || 'ZIMSEC';
  const grade = profile?.grade || undefined;

  // Phase 1: Analyze prerequisites
  useEffect(() => {
    if (phase === 'analysis') {
      analyzePrerequisites();
    }
  }, [phase]);

  const analyzePrerequisites = async () => {
    setIsLoading(true);
    try {
      const data = await aiRequestJSON<{ gaps?: PrerequisiteGap[] }>('analyze-prerequisites', { subject, topic: currentTopic });

      if (data.gaps && data.gaps.length > 0) {
        setGaps(data.gaps);
        setPhase('theory');
        loadTheory(data.gaps[0]);
      } else {
        // No gaps found, proceed with original topic
        toast({
          title: '✅ Ready to go!',
          description: 'No prerequisite gaps detected.',
        });
        onComplete();
      }
    } catch (error) {
      logger.error('Prerequisite analysis error:', error);
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze prerequisites. Continuing anyway.',
        variant: 'destructive',
      });
      onComplete();
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 2: Load theory for current gap
  const loadTheory = async (gap: PrerequisiteGap) => {
    setIsLoading(true);
    try {
      const data = await aiRequestJSON<{ theory?: string }>('generate-prerequisite-theory', {
        subject,
        prerequisiteTopic: gap.topic,
        missingConcepts: gap.missingConcepts,
      });
      setTheoryContent(data.theory ?? '');
    } catch (error) {
      logger.error('Theory loading error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load theory content.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 3: Load quiz for current gap
  const loadQuiz = async () => {
    setIsLoading(true);
    setPhase('quiz');
    try {
      const currentGap = gaps[currentGapIndex];
      const data = await aiRequestJSON<{ questions?: any[] }>('generate-prerequisite-quiz', {
        subject,
        topic: currentGap.topic,
        difficulty: 'basic',
        questionCount: 3,
      });
      setQuizQuestions(data.questions ?? []);
      setCurrentQuestionIndex(0);
    } catch (error) {
      logger.error('Quiz loading error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load quiz.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null) return;

    const currentQuestion = quizQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    setAnswers(prev => [...prev, isCorrect]);
    setSelectedAnswer(null);

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Quiz complete for this gap
      const score = answers.filter(a => a).length + (isCorrect ? 1 : 0);
      const passed = score >= quizQuestions.length * 0.7; // 70% pass rate

      if (passed) {
        if (currentGapIndex < gaps.length - 1) {
          // Move to next gap
          setCurrentGapIndex(prev => prev + 1);
          loadTheory(gaps[currentGapIndex + 1]);
          setPhase('theory');
          setAnswers([]);
        } else {
          // All gaps covered
          setPhase('complete');
        }
      } else {
        toast({
          title: '📚 Keep Learning',
          description: 'Review the theory again before retrying the quiz.',
          variant: 'destructive',
        });
        setPhase('theory');
        setAnswers([]);
      }
    }
  };

  const currentGap = gaps[currentGapIndex];

  // Analysis Phase
  if (phase === 'analysis') {
    return (
      <Card className="p-8 max-w-2xl mx-auto animate-fade-in">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
              <Brain className="h-8 w-8 text-accent" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Prerequisites</h2>
            <p className="text-muted-foreground">
              AI is checking if you have the foundational knowledge for {currentTopic}...
            </p>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-2/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </div>
        </div>
      </Card>
    );
  }

  // Theory Phase
  if (phase === 'theory') {
    return (
      <Card className="p-6 max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <h3 className="font-semibold text-foreground">
              Gap {currentGapIndex + 1} of {gaps.length}
            </h3>
            <Progress value={((currentGapIndex + 1) / gaps.length) * 100} className="mt-2" />
          </div>
        </div>

        <Alert className="mb-6 border-warning bg-warning/10">
          <AlertCircle className="h-5 w-5 text-warning" />
          <AlertDescription>
            <span className="font-semibold text-warning">Prerequisite Gap Detected:</span>
            <br />
            You need to understand <span className="font-bold">{currentGap?.topic}</span> before
            mastering {currentTopic}.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              {currentGap?.topic} - Quick Review
            </h2>
            <div className="text-foreground">
              <MathMarkdown>{theoryContent}</MathMarkdown>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => {
              setPhase('analysis');
              onBack();
            }}
            variant="outline"
            className="flex-1"
          >
            Skip Prerequisites
          </Button>
          <Button onClick={loadQuiz} className="flex-1 gradient-primary" disabled={isLoading}>
            Take Quick Quiz
          </Button>
        </div>
      </Card>
    );
  }

  // Quiz Phase
  if (phase === 'quiz' && quizQuestions.length > 0) {
    const currentQuestion = quizQuestions[currentQuestionIndex];

    return (
      <Card className="p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </span>
            <span className="text-sm font-medium text-foreground">
              {currentGap?.topic}
            </span>
          </div>
          <Progress value={((currentQuestionIndex + 1) / quizQuestions.length) * 100} />
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {currentQuestion.question}
          </h3>

          <div className="space-y-3">
            {currentQuestion.options.map((option: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(index)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 text-left transition-all hover:scale-105',
                  selectedAnswer === index
                    ? 'border-primary bg-primary/10 shadow-lg'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="font-medium text-foreground">{option}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleAnswerSubmit}
          disabled={selectedAnswer === null}
          className="w-full gradient-primary"
        >
          {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
        </Button>
      </Card>
    );
  }

  // Complete Phase
  if (phase === 'complete') {
    return (
      <Card className="p-8 max-w-2xl mx-auto text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Prerequisites Covered! 🎉</h2>
        <p className="text-muted-foreground mb-6">
          You're now ready to tackle {currentTopic} with confidence.
        </p>
        <Button onClick={onComplete} className="gradient-success" size="lg">
          Continue to {currentTopic}
        </Button>
      </Card>
    );
  }

  return null;
}
