/**
 * InsightsDashboardPanel — Analytics & Insights UI
 *
 * Tracks:
 *   - Accuracy per topic
 *   - Weak areas and improvement trends
 *   - Common mistakes
 *   - AI-generated insights ("Student struggles with application questions")
 *   - Mastery classification per topic
 *   - Spaced repetition schedule
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, BarChart3, TrendingUp, TrendingDown, Target,
  AlertTriangle, CheckCircle, Brain, Lightbulb, Clock,
  RefreshCw, XCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';
import {
  classifyMastery,
  calculateImprovementTrend,
  calculateConsistencyScore,
  generateInsightsFromHistory,
  type MasteryClassification,
  type TopicMastery,
  type AnswerRecord,
  type StudentInsight,
} from '../engine/recallEngine';
import { logger } from '@/utils/logger';

interface InsightsDashboardPanelProps {
  subjectId?: string;
  subjectName?: string;
  topicName?: string;
  onBack: () => void;
}

interface TopicStats {
  topic: string;
  subject: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  classification: MasteryClassification;
  improvementTrend: number;
  consistencyScore: number;
  weakConcepts: string[];
  lastAttemptDate: string | null;
  nextReviewDate: string | null;
  recentScores: number[];
}

interface CommonMistake {
  concept: string;
  frequency: number;
  lastSeen: string;
}

export function InsightsDashboardPanel({ subjectId, subjectName, topicName, onBack }: InsightsDashboardPanelProps) {
  const [topicStatsData, setTopicStatsData] = useState<TopicStats[]>([]);
  const [insights, setInsights] = useState<StudentInsight[]>([]);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [overallAccuracy, setOverallAccuracy] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [subjectId, topicName]);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      // Fetch all quiz attempts
      let query = supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }

      const { data: attempts } = await query;
      if (!attempts || attempts.length === 0) {
        setIsLoading(false);
        return;
      }

      const allAttempts = attempts as any[];
      setTotalQuestions(allAttempts.length);

      // Overall accuracy
      const correct = allAttempts.filter(a => a.was_correct).length;
      setOverallAccuracy(allAttempts.length > 0 ? Math.round((correct / allAttempts.length) * 100) : 0);

      // Group by topic
      const topicMap = new Map<string, any[]>();
      for (const attempt of allAttempts) {
        const key = attempt.topic_name || 'Unknown';
        if (!topicMap.has(key)) topicMap.set(key, []);
        topicMap.get(key)!.push(attempt);
      }

      // Build topic stats
      const statsArr: TopicStats[] = [];
      for (const [topic, topicAttempts] of topicMap) {
        const total = topicAttempts.length;
        const correctCount = topicAttempts.filter(a => a.was_correct).length;
        const accuracy = total > 0 ? correctCount / total : 0;

        // Calculate scores for trend/consistency (use marks if available, else binary)
        const recentScores = topicAttempts
          .slice(0, 20)
          .map(a => {
            if (a.marks_awarded != null && a.marks_possible != null && a.marks_possible > 0) {
              return Math.round((a.marks_awarded / a.marks_possible) * 100);
            }
            return a.was_correct ? 100 : 0;
          });

        const improvementTrend = calculateImprovementTrend(recentScores);
        const consistencyScore = calculateConsistencyScore(recentScores);
        const classification = classifyMastery(accuracy, improvementTrend, consistencyScore, total);

        // Extract weak concepts from failed attempts
        const weakConceptSet = new Set<string>();
        topicAttempts
          .filter(a => !a.was_correct)
          .forEach(a => {
            const concepts: string[] = a.concepts_tested || [];
            concepts.forEach(c => weakConceptSet.add(c.toLowerCase().trim()));
          });

        // Next review date (latest one from spaced repetition)
        const sortedByReview = topicAttempts
          .filter(a => a.next_review_date)
          .sort((a: any, b: any) => new Date(b.next_review_date).getTime() - new Date(a.next_review_date).getTime());

        statsArr.push({
          topic,
          subject: subjectName || 'All Subjects',
          totalAttempts: total,
          correctAttempts: correctCount,
          accuracy,
          classification,
          improvementTrend,
          consistencyScore,
          weakConcepts: Array.from(weakConceptSet).slice(0, 5),
          lastAttemptDate: topicAttempts[0]?.created_at || null,
          nextReviewDate: sortedByReview[0]?.next_review_date || null,
          recentScores,
        });
      }

      // Sort: needs_reinforcement first, then developing, then mastered
      const classOrder: Record<MasteryClassification, number> = {
        needs_reinforcement: 0,
        developing: 1,
        mastered: 2,
      };
      statsArr.sort((a, b) => classOrder[a.classification] - classOrder[b.classification]);
      setTopicStatsData(statsArr);

      // Generate insights
      const mockAnswers: AnswerRecord[] = allAttempts.map(a => ({
        questionId: a.id,
        question: a.question || '',
        userAnswer: a.user_answer || '',
        topic: a.topic_name || '',
        subject: subjectName || '',
        difficulty: 'standard' as const,
        evaluation: {
          score: a.was_correct ? 80 : 30,
          totalMarks: a.marks_possible || 4,
          marksAwarded: a.marks_awarded || (a.was_correct ? 4 : 1),
          percentage: a.was_correct ? 80 : 30,
          correctConcepts: a.was_correct ? (a.concepts_tested || []) : [],
          missingConcepts: !a.was_correct ? (a.concepts_tested || []) : [],
          misconceptions: [],
          feedback: { whatWasCorrect: '', whatWasMissing: '', whatWasMisunderstood: '', modelAnswer: '', lostMarksExplanation: '', reasoningErrors: [] },
          markBreakdown: [],
          improvementTips: [],
        },
        conceptsTested: a.concepts_tested || [],
        commandWord: a.command_word,
        timestamp: a.created_at,
        timeTakenSecs: 0,
        isExamMode: false,
      }));

      const mockMasteries: TopicMastery[] = statsArr.map(s => ({
        topic: s.topic,
        subject: s.subject,
        classification: s.classification,
        accuracy: s.accuracy,
        improvementTrend: s.improvementTrend,
        consistencyScore: s.consistencyScore,
        totalAttempts: s.totalAttempts,
        correctAttempts: s.correctAttempts,
        conceptsMastered: 0,
        conceptsTotal: s.weakConcepts.length,
        weakConcepts: s.weakConcepts,
        lastAttemptDate: s.lastAttemptDate,
        nextReviewDate: s.nextReviewDate,
        easeFactor: 2.5,
        intervalDays: 1,
      }));

      const generatedInsights = generateInsightsFromHistory(mockAnswers, mockMasteries);
      setInsights(generatedInsights);

      // Common mistakes (concept-level)
      const mistakeMap = new Map<string, { count: number; lastSeen: string }>();
      allAttempts.filter(a => !a.was_correct).forEach(a => {
        const concepts: string[] = a.concepts_tested || [];
        concepts.forEach(c => {
          const key = c.toLowerCase().trim();
          if (!key) return;
          const existing = mistakeMap.get(key);
          if (existing) {
            existing.count++;
            if (a.created_at > existing.lastSeen) existing.lastSeen = a.created_at;
          } else {
            mistakeMap.set(key, { count: 1, lastSeen: a.created_at });
          }
        });
      });

      const mistakes: CommonMistake[] = Array.from(mistakeMap.entries())
        .map(([concept, data]) => ({ concept, frequency: data.count, lastSeen: data.lastSeen }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);
      setCommonMistakes(mistakes);
    } catch (err) {
      logger.error('[InsightsDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const masteredCount = topicStatsData.filter(t => t.classification === 'mastered').length;
  const developingCount = topicStatsData.filter(t => t.classification === 'developing').length;
  const needsReinforcementCount = topicStatsData.filter(t => t.classification === 'needs_reinforcement').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading your insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent" />
            Learning Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            {subjectName || 'All Subjects'}{topicName ? ` - ${topicName}` : ''}
          </p>
        </div>
      </div>

      {/* Overall Stats */}
      <Card className="border-accent/20">
        <CardContent className="p-5">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className={cn(
                "text-2xl font-bold",
                overallAccuracy >= 70 ? "text-success" :
                overallAccuracy >= 50 ? "text-warning" :
                "text-destructive"
              )}>
                {overallAccuracy}%
              </p>
              <p className="text-xs text-muted-foreground">Overall Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalQuestions}</p>
              <p className="text-xs text-muted-foreground">Questions Done</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{masteredCount}</p>
              <p className="text-xs text-muted-foreground">Topics Mastered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{needsReinforcementCount}</p>
              <p className="text-xs text-muted-foreground">Need Work</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mastery Distribution */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Mastery Distribution
          </h3>
          <div className="flex gap-2 h-4 rounded-full overflow-hidden bg-muted">
            {masteredCount > 0 && (
              <div
                className="bg-success rounded-l-full transition-all"
                style={{ width: `${(masteredCount / topicStatsData.length) * 100}%` }}
              />
            )}
            {developingCount > 0 && (
              <div
                className="bg-warning transition-all"
                style={{ width: `${(developingCount / topicStatsData.length) * 100}%` }}
              />
            )}
            {needsReinforcementCount > 0 && (
              <div
                className="bg-destructive rounded-r-full transition-all"
                style={{ width: `${(needsReinforcementCount / topicStatsData.length) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success" /> Mastered ({masteredCount})
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-warning" /> Developing ({developingCount})
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" /> Needs Reinforcement ({needsReinforcementCount})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      {insights.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent" />
              AI Insights
            </h3>
            {insights.map(insight => (
              <div
                key={insight.id}
                className={cn(
                  "p-3 rounded-xl border text-sm",
                  insight.type === 'weakness' || insight.severity === 'critical'
                    ? 'bg-destructive/5 border-destructive/20'
                    : insight.type === 'pattern' || insight.severity === 'warning'
                    ? 'bg-warning/5 border-warning/20'
                    : insight.type === 'strength'
                    ? 'bg-success/5 border-success/20'
                    : 'bg-accent/5 border-accent/20'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {insight.type === 'weakness' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {insight.type === 'pattern' && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                  {insight.type === 'strength' && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                  {insight.type === 'recommendation' && <Lightbulb className="h-4 w-4 text-accent shrink-0" />}
                  <p className="font-medium text-foreground">{insight.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-Topic Breakdown */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            Topic Breakdown
          </h3>

          {topicStatsData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No data yet. Complete quizzes to see your topic breakdown.
            </p>
          ) : (
            <div className="space-y-2">
              {topicStatsData.map(topic => (
                <div key={topic.topic} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedTopic(expandedTopic === topic.topic ? null : topic.topic)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {topic.classification === 'mastered' && <CheckCircle className="h-4 w-4 text-success" />}
                      {topic.classification === 'developing' && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {topic.classification === 'needs_reinforcement' && <XCircle className="h-4 w-4 text-destructive" />}
                      <span className="text-sm font-medium text-foreground">{topic.topic}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-bold",
                        topic.accuracy >= 0.7 ? "text-success" :
                        topic.accuracy >= 0.5 ? "text-warning" :
                        "text-destructive"
                      )}>
                        {Math.round(topic.accuracy * 100)}%
                      </span>
                      {topic.improvementTrend > 0.1 && <TrendingUp className="h-3 w-3 text-success" />}
                      {topic.improvementTrend < -0.1 && <TrendingDown className="h-3 w-3 text-destructive" />}
                      {expandedTopic === topic.topic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {expandedTopic === topic.topic && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <p className="font-bold text-foreground">{topic.totalAttempts}</p>
                          <p className="text-muted-foreground">Attempts</p>
                        </div>
                        <div>
                          <p className={cn("font-bold", topic.improvementTrend > 0 ? "text-success" : topic.improvementTrend < 0 ? "text-destructive" : "text-foreground")}>
                            {topic.improvementTrend > 0 ? '+' : ''}{Math.round(topic.improvementTrend * 100)}%
                          </p>
                          <p className="text-muted-foreground">Trend</p>
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{Math.round(topic.consistencyScore * 100)}%</p>
                          <p className="text-muted-foreground">Consistency</p>
                        </div>
                      </div>

                      {/* Mini score chart */}
                      {topic.recentScores.length > 1 && (
                        <div className="flex items-end gap-0.5 h-8">
                          {topic.recentScores.slice(-15).reverse().map((score, i) => (
                            <div
                              key={i}
                              className={cn(
                                "flex-1 rounded-t-sm min-w-[3px]",
                                score >= 70 ? "bg-success" :
                                score >= 50 ? "bg-warning" :
                                "bg-destructive"
                              )}
                              style={{ height: `${Math.max(2, (score / 100) * 32)}px` }}
                            />
                          ))}
                        </div>
                      )}

                      {topic.weakConcepts.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Weak concepts:</p>
                          <div className="flex flex-wrap gap-1">
                            {topic.weakConcepts.map(c => (
                              <Badge key={c} variant="outline" className="text-[10px] capitalize border-destructive/30 text-destructive">{c}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {topic.nextReviewDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" /> Next review: {topic.nextReviewDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Common Mistakes */}
      {commonMistakes.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Common Mistakes
            </h3>
            <div className="space-y-2">
              {commonMistakes.map(mistake => (
                <div key={mistake.concept} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm text-foreground capitalize">{mistake.concept}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                      {mistake.frequency}x wrong
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {topicStatsData.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No Data Yet</h3>
            <p className="text-sm text-muted-foreground">
              Complete Active Recall sessions and Exam Mode to see your insights and analytics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
