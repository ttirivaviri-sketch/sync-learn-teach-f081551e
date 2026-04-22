import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Sparkles, X, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTopicSessionRunner } from '../hooks/useTopicSessionRunner';
import { TopicSessionSummary } from './TopicSessionSummary';
import { MathMarkdown } from './MathMarkdown';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: { subject: string; topic: string; subtopic?: string; subjectId?: string; curriculum: string } | null;
}

export function TopicSessionRunner({ open, onOpenChange, start }: Props) {
  const runner = useTopicSessionRunner();
  const [answer, setAnswer] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDepth, setReviewDepth] = useState<'quick' | 'full'>('quick');
  const [showSummary, setShowSummary] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (open && start && !bootstrapped) {
      setBootstrapped(true);
      runner.startSession({
        subject: start.subject,
        topic: start.topic,
        subtopic: start.subtopic,
        subjectId: start.subjectId,
        curriculum: start.curriculum,
      }).catch(() => {});
    }
    if (!open) {
      setBootstrapped(false);
      setAnswer('');
      setShowSummary(false);
      setReviewOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start]);

  // Auto-advance on exam_ready
  useEffect(() => {
    if (runner.lastResult?.level === 'exam_ready') {
      const t = setTimeout(() => {
        setAnswer('');
        runner.nextQuestion();
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [runner.lastResult]);

  // When all questions done → summary
  useEffect(() => {
    if (runner.isFinished && !showSummary && runner.questions.length > 0) {
      setShowSummary(true);
    }
  }, [runner.isFinished, showSummary, runner.questions.length]);

  const handleEnd = async () => {
    await runner.endSession();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    await runner.submitAnswer(answer);
  };

  const handleReview = async (depth: 'quick' | 'full') => {
    setReviewDepth(depth);
    setReviewOpen(true);
    await runner.requestReview(depth);
  };

  const q = runner.currentQuestion;
  const result = runner.lastResult;

  return (
    <>
      <Dialog open={open && !showSummary} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[92vh] sm:h-[88vh] p-0 flex flex-col gap-0">
          {/* Header */}
          <div className="px-5 py-3 border-b flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">{runner.curriculum}</Badge>
                <span className="truncate">{runner.subject}</span>
              </div>
              <h2 className="text-sm font-semibold truncate">{runner.topic}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-accent/15 text-accent border-accent/30">
                +{runner.sessionXP} XP
              </Badge>
              <Badge variant="outline">
                {Math.min(runner.currentIndex + 1, runner.questions.length || 1)}/{runner.questions.length || '–'}
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleEnd}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-5 space-y-4">
              {runner.isStarting && (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                </div>
              )}

              {!runner.isStarting && q && (
                <>
                  {/* Testing chip */}
                  {q.concept_map?.concepts?.length > 0 && (
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5">
                      <span className="font-medium">Testing:</span>
                      {q.concept_map.concepts.slice(0, 4).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                      ))}
                      <Badge variant="secondary" className="text-[10px] capitalize">{q.concept_map.difficulty}</Badge>
                    </div>
                  )}

                  {/* Question */}
                  <Card className="border-primary/20">
                    <CardContent className="p-4">
                      <MathMarkdown content={q.question} />
                    </CardContent>
                  </Card>

                  {/* Review button */}
                  {!result && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReview('quick')}
                        disabled={runner.reviewBlocked || runner.isReviewing}
                        className="gap-1.5"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        {runner.reviewBlocked ? 'Try the question first' : 'Review concept first'}
                      </Button>
                    </div>
                  )}

                  {/* Answer input */}
                  {!result && (
                    <div className="space-y-2">
                      <Textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder="Type your answer…"
                        rows={5}
                        className="resize-none"
                        disabled={runner.isEvaluating}
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={!answer.trim() || runner.isEvaluating}
                        className="w-full"
                      >
                        {runner.isEvaluating ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Grading…</>
                        ) : (
                          <>Submit answer <ArrowRight className="h-4 w-4 ml-2" /></>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Result */}
                  {result && (
                    <Card className={cn(
                      'border-2',
                      result.level === 'exam_ready' && 'border-success/40 bg-success/5',
                      result.level === 'close' && 'border-accent/40 bg-accent/5',
                      result.level === 'developing' && 'border-warning/40 bg-warning/5',
                      result.level === 'weak' && 'border-destructive/40 bg-destructive/5',
                    )}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result.level === 'exam_ready' ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-warning" />
                            )}
                            <span className="font-semibold capitalize">
                              {result.level === 'exam_ready' ? 'Exam Ready ✨' : result.level.replace('_', ' ')}
                            </span>
                          </div>
                          <Badge className={result.xp_delta >= 0 ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive'}>
                            {result.xp_delta >= 0 ? '+' : ''}{result.xp_delta} XP
                          </Badge>
                        </div>

                        {result.level !== 'exam_ready' && (
                          <>
                            {result.feedback && (
                              <p className="text-sm text-foreground/90">{result.feedback}</p>
                            )}
                            {result.missing_points?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Missing points:</p>
                                <ul className="text-sm space-y-1 list-disc list-inside text-foreground/80">
                                  {result.missing_points.map((m, i) => <li key={i}>{m}</li>)}
                                </ul>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              <Button variant="outline" size="sm" onClick={() => { setAnswer(''); runner.nextQuestion(); }}>
                                Next question
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleReview('full')}>
                                Show full explanation
                              </Button>
                            </div>
                          </>
                        )}

                        {result.level === 'exam_ready' && (
                          <p className="text-xs text-muted-foreground">Auto-advancing…</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!runner.isStarting && !q && runner.questions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Couldn't load questions. Try a different topic.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Concept Review Side-Sheet */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="font-semibold">{reviewDepth === 'quick' ? 'Quick Review' : 'Full Explanation'}</h3>
            </div>

            {runner.isReviewing && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}

            {!runner.isReviewing && runner.lastReview && (
              <div className="space-y-4 text-sm">
                {runner.lastReview.testing_focus?.length > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium text-primary mb-1">This question is testing:</p>
                    <p className="text-foreground/90">{runner.lastReview.testing_focus.join(' · ')}</p>
                  </div>
                )}

                {runner.lastReview.quick_review?.bullets?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Key points</p>
                    <ul className="space-y-1 list-disc list-inside">
                      {runner.lastReview.quick_review.bullets.map((b, i) => (
                        <li key={i}><MathMarkdown content={b} inline /></li>
                      ))}
                    </ul>
                  </div>
                )}

                {runner.lastReview.quick_review?.formulas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Formulas</p>
                    <div className="space-y-1.5">
                      {runner.lastReview.quick_review.formulas.map((f, i) => (
                        <div key={i} className="p-2 rounded bg-muted/40"><MathMarkdown content={f} /></div>
                      ))}
                    </div>
                  </div>
                )}

                {runner.lastReview.quick_review?.definitions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Definitions</p>
                    <ul className="space-y-1">
                      {runner.lastReview.quick_review.definitions.map((d, i) => (
                        <li key={i} className="text-foreground/85"><MathMarkdown content={d} inline /></li>
                      ))}
                    </ul>
                  </div>
                )}

                {reviewDepth === 'full' && runner.lastReview.full_explanation && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Explanation</p>
                    <MathMarkdown content={runner.lastReview.full_explanation} />
                  </div>
                )}

                {reviewDepth === 'full' && runner.lastReview.examples?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Examples</p>
                    {runner.lastReview.examples.map((ex, i) => (
                      <div key={i} className="mb-2 p-3 rounded-lg bg-muted/40"><MathMarkdown content={ex} /></div>
                    ))}
                  </div>
                )}

                {reviewDepth === 'full' && runner.lastReview.common_mistakes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-destructive uppercase mb-1.5">Common mistakes</p>
                    <ul className="space-y-1 list-disc list-inside text-foreground/85">
                      {runner.lastReview.common_mistakes.map((m, i) => (<li key={i}>{m}</li>))}
                    </ul>
                  </div>
                )}

                {reviewDepth === 'quick' && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleReview('full')}>
                    Show full explanation
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Summary */}
      {showSummary && (
        <TopicSessionSummary
          open={showSummary}
          onOpenChange={(o) => { setShowSummary(o); if (!o) onOpenChange(false); }}
          subject={runner.subject}
          topic={runner.topic}
          sessionXP={runner.sessionXP}
          attempted={runner.questionsAttempted}
          correct={runner.questionsCorrect}
          onClose={handleEnd}
        />
      )}
    </>
  );
}
