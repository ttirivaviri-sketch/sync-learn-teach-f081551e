/**
 * MasteryTrackerPanel — Per-Topic Mastery UI
 *
 * Tracks mastery per topic using:
 *   - Accuracy (NOT completion)
 *   - Improvement trend
 *   - Consistency score
 *
 * Classification: Mastered / Developing / Needs Reinforcement
 * Shows spaced repetition schedule and next review dates.
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Target, CheckCircle, AlertTriangle, XCircle,
  TrendingUp, TrendingDown, Clock, RefreshCw, Loader2,
  ChevronRight, Brain, Zap, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';
import {
  classifyMastery,
  calculateImprovementTrend,
  calculateConsistencyScore,
  recommendDifficulty,
  type MasteryClassification,
  type DifficultyLevel,
  type TopicMastery,
} from '../engine/recallEngine';
import { logger } from '@/utils/logger';
import type { Subject } from '../types/study';

interface MasteryTrackerPanelProps {
  subject: Subject;
  onBack: () => void;
  onStartRecall?: (topicName: string) => void;
  onStartExam?: (topicName: string) => void;
}

interface MasteryRow {
  topic: string;
  accuracy: number;
  totalAttempts: number;
  correctAttempts: number;
  classification: MasteryClassification;
  improvementTrend: number;
  consistencyScore: number;
  recommendedDifficulty: DifficultyLevel;
  weakConcepts: string[];
  nextReviewDate: string | null;
  isDueForReview: boolean;
  lastAttemptDate: string | null;
}

const classificationConfig: Record<MasteryClassification, { label: string; icon: typeof CheckCircle; color: string; bgColor: string; borderColor: string }> = {
  mastered: { label: 'Mastered', icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/20' },
  developing: { label: 'Developing', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/20' },
  needs_reinforcement: { label: 'Needs Reinforcement', icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/20' },
};

export function MasteryTrackerPanel({ subject, onBack, onStartRecall, onStartExam }: MasteryTrackerPanelProps) {
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMasteryData();
  }, [subject.id]);

  async function loadMasteryData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      // Fetch attempts for this subject
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject_id', subject.id)
        .order('created_at', { ascending: false });

      if (!attempts || attempts.length === 0) {
        // Still show all topics from subject with default "not started" state
        const topicRows: MasteryRow[] = subject.topics.map(t => ({
          topic: t.name,
          accuracy: 0,
          totalAttempts: 0,
          correctAttempts: 0,
          classification: 'needs_reinforcement' as MasteryClassification,
          improvementTrend: 0,
          consistencyScore: 0,
          recommendedDifficulty: 'foundation' as DifficultyLevel,
          weakConcepts: [],
          nextReviewDate: null,
          isDueForReview: false,
          lastAttemptDate: null,
        }));
        setRows(topicRows);
        setIsLoading(false);
        return;
      }

      const allAttempts = attempts as any[];
      const today = new Date().toISOString().split('T')[0];

      // Group by topic
      const topicMap = new Map<string, any[]>();
      for (const attempt of allAttempts) {
        const key = attempt.topic_name || 'Unknown';
        if (!topicMap.has(key)) topicMap.set(key, []);
        topicMap.get(key)!.push(attempt);
      }

      // Build rows for all subject topics
      const masteryRows: MasteryRow[] = subject.topics.map(t => {
        const topicAttempts = topicMap.get(t.name) || [];
        const total = topicAttempts.length;
        const correct = topicAttempts.filter(a => a.was_correct).length;
        const accuracy = total > 0 ? correct / total : 0;

        const recentScores = topicAttempts.slice(0, 20).map(a => {
          if (a.marks_awarded != null && a.marks_possible != null && a.marks_possible > 0) {
            return Math.round((a.marks_awarded / a.marks_possible) * 100);
          }
          return a.was_correct ? 100 : 0;
        });

        const improvementTrend = calculateImprovementTrend(recentScores);
        const consistencyScore = calculateConsistencyScore(recentScores);
        const classification = total === 0 ? 'needs_reinforcement' as MasteryClassification : classifyMastery(accuracy, improvementTrend, consistencyScore, total);

        const mastery: TopicMastery = {
          topic: t.name,
          subject: subject.name,
          classification,
          accuracy,
          improvementTrend,
          consistencyScore,
          totalAttempts: total,
          correctAttempts: correct,
          conceptsMastered: 0,
          conceptsTotal: 0,
          weakConcepts: [],
          lastAttemptDate: topicAttempts[0]?.created_at || null,
          nextReviewDate: null,
          easeFactor: 2.5,
          intervalDays: 1,
        };

        // Weak concepts from failed attempts
        const weakConceptSet = new Set<string>();
        topicAttempts
          .filter(a => !a.was_correct)
          .forEach(a => {
            (a.concepts_tested || []).forEach((c: string) => weakConceptSet.add(c.toLowerCase().trim()));
          });

        // Next review date
        const reviewDates = topicAttempts
          .filter(a => a.next_review_date)
          .map(a => a.next_review_date)
          .sort();
        const nextReviewDate = reviewDates[0] || null;
        const isDueForReview = nextReviewDate ? nextReviewDate <= today : false;

        return {
          topic: t.name,
          accuracy,
          totalAttempts: total,
          correctAttempts: correct,
          classification,
          improvementTrend,
          consistencyScore,
          recommendedDifficulty: recommendDifficulty(mastery),
          weakConcepts: Array.from(weakConceptSet).slice(0, 4),
          nextReviewDate,
          isDueForReview,
          lastAttemptDate: topicAttempts[0]?.created_at || null,
        };
      });

      // Sort: needs_reinforcement first, then by accuracy
      const classOrder: Record<MasteryClassification, number> = { needs_reinforcement: 0, developing: 1, mastered: 2 };
      masteryRows.sort((a, b) => {
        if (a.isDueForReview !== b.isDueForReview) return a.isDueForReview ? -1 : 1;
        if (a.classification !== b.classification) return classOrder[a.classification] - classOrder[b.classification];
        return a.accuracy - b.accuracy;
      });

      setRows(masteryRows);
    } catch (err) {
      logger.error('[MasteryTracker] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const masteredCount = rows.filter(r => r.classification === 'mastered').length;
  const totalTopics = rows.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading mastery data...</p>
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
            <Target className="h-6 w-6 text-accent" />
            Mastery Tracker
          </h2>
          <p className="text-sm text-muted-foreground">
            {subject.name} - {masteredCount}/{totalTopics} topics mastered
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="border-accent/20">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Subject Mastery</span>
            <span className="text-sm font-bold text-accent">
              {totalTopics > 0 ? Math.round((masteredCount / totalTopics) * 100) : 0}%
            </span>
          </div>
          <div className="flex gap-1">
            {rows.map((r, i) => {
              const config = classificationConfig[r.classification];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 h-3 rounded-sm transition-all",
                    r.classification === 'mastered' ? 'bg-success' :
                    r.classification === 'developing' ? 'bg-warning' :
                    r.totalAttempts === 0 ? 'bg-muted' :
                    'bg-destructive'
                  )}
                  title={`${r.topic}: ${config.label}`}
                />
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" /> Mastered</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning" /> Developing</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Needs Work</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted" /> Not Started</span>
          </div>
        </CardContent>
      </Card>

      {/* Topic Rows */}
      <div className="space-y-3">
        {rows.map(row => {
          const config = classificationConfig[row.classification];
          const Icon = config.icon;

          return (
            <Card key={row.topic} className={cn("border", config.borderColor)}>
              <CardContent className="p-4 space-y-3">
                {/* Topic Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                    <div>
                      <p className="text-sm font-bold text-foreground">{row.topic}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.borderColor, config.color)}>
                          {config.label}
                        </Badge>
                        {row.isDueForReview && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/30 text-warning animate-pulse">
                            <RefreshCw className="h-2.5 w-2.5 mr-0.5" /> Due for review
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      row.accuracy >= 0.7 ? "text-success" :
                      row.accuracy >= 0.5 ? "text-warning" :
                      row.totalAttempts === 0 ? "text-muted-foreground" :
                      "text-destructive"
                    )}>
                      {row.totalAttempts > 0 ? `${Math.round(row.accuracy * 100)}%` : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.totalAttempts} attempts</p>
                  </div>
                </div>

                {/* Metrics */}
                {row.totalAttempts > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1">
                        {row.improvementTrend > 0.05 ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : row.improvementTrend < -0.05 ? (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        ) : (
                          <span className="text-muted-foreground text-xs">=</span>
                        )}
                        <span className={cn(
                          "text-xs font-bold",
                          row.improvementTrend > 0 ? "text-success" :
                          row.improvementTrend < 0 ? "text-destructive" :
                          "text-foreground"
                        )}>
                          {row.improvementTrend > 0 ? '+' : ''}{Math.round(row.improvementTrend * 100)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Trend</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-xs font-bold text-foreground">{Math.round(row.consistencyScore * 100)}%</p>
                      <p className="text-[10px] text-muted-foreground">Consistency</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className={cn(
                        "text-xs font-bold capitalize",
                        row.recommendedDifficulty === 'foundation' ? "text-success" :
                        row.recommendedDifficulty === 'advanced' ? "text-destructive" :
                        "text-accent"
                      )}>
                        {row.recommendedDifficulty}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Difficulty</p>
                    </div>
                  </div>
                )}

                {/* Weak Concepts */}
                {row.weakConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {row.weakConcepts.map(c => (
                      <Badge key={c} variant="outline" className="text-[10px] capitalize border-destructive/20 text-destructive">{c}</Badge>
                    ))}
                  </div>
                )}

                {/* Spaced repetition info */}
                {row.nextReviewDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next review: {row.nextReviewDate}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {onStartRecall && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStartRecall(row.topic)}
                      className="flex-1 text-xs"
                    >
                      <Brain className="h-3 w-3 mr-1" />
                      Active Recall
                    </Button>
                  )}
                  {onStartExam && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStartExam(row.topic)}
                      className="flex-1 text-xs"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Exam Mode
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
