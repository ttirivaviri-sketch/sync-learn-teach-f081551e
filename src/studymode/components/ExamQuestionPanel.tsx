import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, Eye, Lightbulb, ThumbsUp, ThumbsDown, MessageCircle, Loader2 as LoaderIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useQuizGenerator, QuizQuestion } from '../hooks/useQuizGenerator';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useUserProgress } from '../hooks/useUserProgress';
import { Subject, Topic } from '../types/study';
import { supabase } from '../../integrations/supabase/client';

interface ExamQuestionPanelProps {
  question?: {
    text: string;
    marks: number;
    topic: string;
  };
  subject?: Subject;
  topic?: Topic;
  onComplete: (score: number) => void;
  onBack: () => void;
}

 type Phase = 'read' | 'analyze' | 'answer' | 'self-assess' | 'feedback';

export function ExamQuestionPanel({ question: staticQuestion, subject, topic, onComplete, onBack }: ExamQuestionPanelProps) {
  const [phase, setPhase] = useState<Phase>('read');
  const [analysis, setAnalysis] = useState({
    givenInfo: '',
    requiredAnswer: '',
    keywords: '',
    strategy: '',
  });
  const [answer, setAnswer] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [generatedModelAnswer, setGeneratedModelAnswer] = useState<string | null>(null);
  const [generatedKeyPoints, setGeneratedKeyPoints] = useState<string[]>([]);
  const [selfAssessment, setSelfAssessment] = useState<'correct' | 'incorrect' | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID for spaced repetition
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  // Spaced repetition hook
  const { recordAttempt } = useSpacedRepetition(userId);
  
  // User progress hook for XP and streaks
  const { addXp, updateStreak } = useUserProgress();
 
   // Use AI quiz generator if subject is provided
   const quizGenerator = subject ? useQuizGenerator({ subject, topic }) : null;
 
   // Generate question on mount if using AI generator
   useEffect(() => {
     if (quizGenerator && !quizGenerator.question && !quizGenerator.isLoading) {
       quizGenerator.generateQuestion();
     }
   }, []);
 
   // Use either static question or generated question
   const activeQuestion = staticQuestion || (quizGenerator?.question ? {
     text: quizGenerator.question.question,
     marks: quizGenerator.question.marks,
     topic: quizGenerator.question.topic,
   } : null);
 
   // Store model answer from generated question
   useEffect(() => {
     if (quizGenerator?.question) {
       setGeneratedModelAnswer(quizGenerator.question.modelAnswer || null);
       setGeneratedKeyPoints(quizGenerator.question.keyPoints || []);
     }
   }, [quizGenerator?.question]);
 
   // Stream AI explanation
   const requestExplanation = useCallback(async () => {
     if (!activeQuestion) return;
     
     setIsExplaining(true);
     setExplanationError(null);
     setAiExplanation('');
 
     try {
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-answer`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
           },
           body: JSON.stringify({
             question: activeQuestion.text,
             studentAnswer: answer,
             modelAnswer: generatedModelAnswer,
             topic: activeQuestion.topic,
             subject: subject?.name || 'Unknown',
           }),
         }
       );
 
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         throw new Error(errorData.error || 'Failed to get explanation');
       }
 
       if (!response.body) throw new Error('No response body');
 
       const reader = response.body.getReader();
       const decoder = new TextDecoder();
       let textBuffer = '';
       let explanationSoFar = '';
 
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         textBuffer += decoder.decode(value, { stream: true });
 
         let newlineIndex: number;
         while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
           let line = textBuffer.slice(0, newlineIndex);
           textBuffer = textBuffer.slice(newlineIndex + 1);
 
           if (line.endsWith('\r')) line = line.slice(0, -1);
           if (line.startsWith(':') || line.trim() === '') continue;
           if (!line.startsWith('data: ')) continue;
 
           const jsonStr = line.slice(6).trim();
           if (jsonStr === '[DONE]') break;
 
           try {
             const parsed = JSON.parse(jsonStr);
             const content = parsed.choices?.[0]?.delta?.content as string | undefined;
             if (content) {
               explanationSoFar += content;
               setAiExplanation(explanationSoFar);
             }
           } catch {
             textBuffer = line + '\n' + textBuffer;
             break;
           }
         }
       }
     } catch (err) {
       console.error('Explanation error:', err);
       setExplanationError(err instanceof Error ? err.message : 'Failed to get explanation');
     } finally {
       setIsExplaining(false);
     }
   }, [activeQuestion, answer, generatedModelAnswer, subject?.name]);
 
  // Handle self-assessment and record for spaced repetition
  const handleSelfAssess = async (assessment: 'correct' | 'incorrect') => {
    setSelfAssessment(assessment);
    
    // Record attempt for spaced repetition
    if (activeQuestion && userId) {
      await recordAttempt(
        activeQuestion.topic,
        activeQuestion.text,
        assessment === 'correct',
        subject?.id,
        activeQuestion.marks // Use marks as difficulty indicator
      );
    }
    
    // Update XP and streak
    const xpEarned = assessment === 'correct' ? 25 : 10;
    addXp.mutate(xpEarned);
    updateStreak.mutate();
    
    if (assessment === 'incorrect') {
      requestExplanation();
    }
    setPhase('feedback');
  };
 
   // Loading state for AI generation
   if (quizGenerator?.isLoading) {
     return (
       <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
         <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
         <p className="text-sm text-muted-foreground">Generating exam question from curriculum...</p>
         <p className="text-xs text-muted-foreground mt-1">Using your syllabus content</p>
       </div>
     );
   }
 
   // Error state
   if (quizGenerator?.error) {
     return (
       <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-center animate-fade-in">
         <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
         <p className="text-sm text-destructive mb-4">{quizGenerator.error}</p>
         <div className="flex gap-3 justify-center">
           <Button variant="outline" onClick={onBack}>Back</Button>
           <Button onClick={() => quizGenerator.generateQuestion()} className="gradient-primary">
             Try Again
           </Button>
         </div>
       </div>
     );
   }
 
   // No question available
   if (!activeQuestion) {
     return (
       <div className="p-6 rounded-xl bg-muted/50 border border-border text-center animate-fade-in">
         <p className="text-sm text-muted-foreground">No question available</p>
         <Button variant="outline" onClick={onBack} className="mt-4">Back</Button>
       </div>
     );
   }

  const isAnalysisComplete = 
    analysis.givenInfo.trim() && 
    analysis.requiredAnswer.trim() && 
    analysis.keywords.trim() && 
    analysis.strategy.trim();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Question Header */}
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <div className="flex items-center justify-between mb-3">
           <span className="text-sm font-medium text-destructive">
             {quizGenerator ? 'AI-Generated Exam Question' : 'Exam Question'}
           </span>
          <span className="px-3 py-1 rounded-full bg-destructive/20 text-destructive text-sm font-bold">
             {activeQuestion.marks} marks
          </span>
        </div>
         <p className="text-foreground font-medium leading-relaxed">{activeQuestion.text}</p>
         {quizGenerator && (
           <p className="text-xs text-muted-foreground mt-2">
             Topic: {activeQuestion.topic}
           </p>
         )}
      </div>

      {/* Phase: Read Question */}
      {phase === 'read' && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Question Analysis Required</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Before answering, you must analyze this question carefully. Read it at least twice and identify the key information.
              </p>
              <Button onClick={() => setPhase('analyze')} className="gradient-primary">
                I've Read the Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase: Analysis */}
      {phase === 'analyze' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-5 w-5 text-accent" />
              <h4 className="font-semibold text-foreground">Question Analysis Protocol</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete all fields before you can start answering.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="given">Given Information</Label>
              <Textarea
                id="given"
                placeholder="What information is provided in the question?"
                value={analysis.givenInfo}
                onChange={(e) => setAnalysis(a => ({ ...a, givenInfo: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="required">Required Answer</Label>
              <Textarea
                id="required"
                placeholder="What exactly is the question asking for?"
                value={analysis.requiredAnswer}
                onChange={(e) => setAnalysis(a => ({ ...a, requiredAnswer: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords & Units</Label>
              <Input
                id="keywords"
                placeholder="Key terms, command words, units required"
                value={analysis.keywords}
                onChange={(e) => setAnalysis(a => ({ ...a, keywords: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy/Approach</Label>
              <Textarea
                id="strategy"
                placeholder="How will you approach this question? What formula/method?"
                value={analysis.strategy}
                onChange={(e) => setAnalysis(a => ({ ...a, strategy: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <Button 
            onClick={() => setPhase('answer')} 
            disabled={!isAnalysisComplete}
            className={cn(
              "w-full",
              isAnalysisComplete ? "gradient-accent" : "bg-muted text-muted-foreground"
            )}
          >
            {isAnalysisComplete ? 'Start Answering' : 'Complete All Fields First'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Phase: Answer */}
      {phase === 'answer' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">Analysis complete! Now write your answer.</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="answer">Your Answer</Label>
            <Textarea
              id="answer"
              placeholder="Write your complete answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          <Button 
             onClick={() => setPhase('self-assess')} 
            disabled={!answer.trim()}
            className="w-full gradient-primary"
          >
            Submit Answer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

       {/* Phase: Self-Assessment */}
       {phase === 'self-assess' && (
         <div className="space-y-4">
           {/* Show Model Answer */}
           <div className="p-4 rounded-xl bg-success/10 border border-success/30">
             <h4 className="font-semibold text-success mb-2">Model Answer</h4>
             <p className="text-sm text-foreground whitespace-pre-wrap">
               {generatedModelAnswer || 'Compare your answer with the expected solution.'}
             </p>
           </div>
 
           {/* Your Answer Comparison */}
           <div className="p-4 rounded-xl bg-muted/50 border border-border">
             <h4 className="font-semibold text-foreground mb-2">Your Answer</h4>
             <p className="text-sm text-foreground whitespace-pre-wrap">{answer}</p>
           </div>
 
           {/* Self-Assessment Prompt */}
           <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
             <h4 className="font-semibold text-foreground mb-3 text-center">How did you do?</h4>
             <p className="text-sm text-muted-foreground text-center mb-4">
               Compare your answer with the model answer above. Be honest with yourself!
             </p>
             <div className="flex gap-3">
               <Button
                 onClick={() => handleSelfAssess('correct')}
                 className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
               >
                 <ThumbsUp className="mr-2 h-4 w-4" />
                 I got it right
               </Button>
               <Button
                 onClick={() => handleSelfAssess('incorrect')}
                 className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
               >
                 <ThumbsDown className="mr-2 h-4 w-4" />
                 I need help
               </Button>
             </div>
           </div>
         </div>
       )}
 
      {/* Phase: Feedback */}
      {phase === 'feedback' && (
        <div className="space-y-4">
          {/* Score */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center">
             <p className="text-sm text-muted-foreground mb-1">
               {selfAssessment === 'correct' ? 'Great job!' : 'Keep learning!'}
             </p>
             <p className={cn(
               "text-4xl font-bold",
               selfAssessment === 'correct' ? 'text-success' : 'text-warning'
             )}>
               {selfAssessment === 'correct' ? `${activeQuestion.marks}/${activeQuestion.marks}` : `0/${activeQuestion.marks}`}
             </p>
            <p className="text-sm text-muted-foreground mt-1">marks</p>
          </div>

           {/* AI Step-by-Step Explanation (when incorrect) */}
           {selfAssessment === 'incorrect' && (
             <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
               <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                 <MessageCircle className="h-4 w-4 text-accent" />
                 AI Tutor Explanation
               </h4>
               
               {isExplaining && !aiExplanation && (
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                   <LoaderIcon className="h-4 w-4 animate-spin" />
                   Analyzing your answer...
                 </div>
               )}
               
               {explanationError && (
                 <div className="text-sm text-destructive">
                   {explanationError}
                   <Button 
                     variant="link" 
                     className="text-accent p-0 h-auto ml-2"
                     onClick={requestExplanation}
                   >
                     Try again
                   </Button>
                 </div>
               )}
               
               {aiExplanation && (
                 <div className="prose prose-sm max-w-none text-foreground">
                   <ReactMarkdown>{aiExplanation}</ReactMarkdown>
                 </div>
               )}
               
               {isExplaining && aiExplanation && (
                 <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                   <LoaderIcon className="h-3 w-3 animate-spin" />
                   <span>Still typing...</span>
                 </div>
               )}
             </div>
           )}
 
           {/* Success message when correct */}
           {selfAssessment === 'correct' && (
             <div className="p-4 rounded-xl bg-success/10 border border-success/30">
               <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                 <CheckCircle className="h-4 w-4" />
                 Excellent Work!
               </h4>
               <p className="text-sm text-muted-foreground">
                 You demonstrated a strong understanding of {activeQuestion.topic}. Keep up the great work!
               </p>
             </div>
           )}
 
          {/* Feedback */}
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
            <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
               Key Points to Remember
            </h4>
             {generatedKeyPoints.length > 0 ? (
               <ul className="text-sm text-muted-foreground space-y-1">
                 {generatedKeyPoints.map((point, index) => (
                   <li key={index}>• {point}</li>
                 ))}
               </ul>
             ) : (
               <ul className="text-sm text-muted-foreground space-y-1">
                 <li>• Good understanding of the core concept</li>
                 <li>• Remember to include units in your final answer</li>
                 <li>• Show more working steps for method marks</li>
               </ul>
             )}
          </div>

          {/* Model Answer Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowModelAnswer(!showModelAnswer)}
            className="w-full"
          >
            {showModelAnswer ? 'Hide' : 'Show'} Model Answer
          </Button>

          {showModelAnswer && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/30">
              <h4 className="font-semibold text-success mb-2">Model Answer</h4>
               <p className="text-sm text-foreground whitespace-pre-wrap">
                 {generatedModelAnswer || '[Model answer would be displayed here based on mark scheme]'}
               </p>
            </div>
          )}

          {/* Complete Button */}
           <Button 
             onClick={() => onComplete(selfAssessment === 'correct' ? activeQuestion.marks : 0)} 
             className="w-full gradient-success"
             disabled={isExplaining}
           >
            Complete Task
            <CheckCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="w-full">
        Back to Tasks
      </Button>
    </div>
  );
}
