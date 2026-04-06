/**
 * StudentInsightsPanel — AI-generated student learning profile for tutors
 *
 * Displays study patterns, strengths, weaknesses, learning behavior,
 * and actionable recommendations. Uses the generate-student-insights
 * edge function via the useStudentInsights hook.
 */
import { useState } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Clock,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentInsights } from '@/hooks/useStudentInsights';

interface StudentInsightsPanelProps {
  studentId: string;
  studentName?: string;
  tutorId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const TREND_ICONS: Record<string, typeof TrendingUp> = {
  improving: TrendingUp,
  stable: Target,
  declining: TrendingDown,
  variable: Zap,
};

export function StudentInsightsPanel({
  studentId,
  studentName,
  tutorId,
}: StudentInsightsPanelProps) {
  const {
    insights,
    isGenerating,
    error,
    generateInsights,
    clearError,
    hasData,
  } = useStudentInsights(tutorId);

  const [expanded, setExpanded] = useState(false);

  const handleGenerate = () => {
    clearError();
    generateInsights(studentId);
  };

  // Not yet generated
  if (!hasData && !isGenerating && !error) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-foreground">AI Student Insights</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Generate an AI-powered learning profile for{' '}
            <strong>{studentName || 'this student'}</strong> to personalise your
            tutoring approach.
          </p>
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Brain className="h-4 w-4" />
            Generate Student Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <div>
              <p className="text-sm font-medium">Analyzing student data...</p>
              <p className="text-xs text-muted-foreground">
                Reviewing quiz results, task completions, and study patterns
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-red-700">Error</h3>
          </div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  const TrendIcon = TREND_ICONS[insights.performance_trajectory?.trend] || Target;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">
              {studentName ? `${studentName}'s Learning Profile` : 'Student Learning Profile'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px]"
            >
              {insights.data_coverage?.confidence_level || 'unknown'} confidence
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Overview */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-white/60 dark:bg-white/5 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-xs font-bold">
              {insights.study_pattern?.avg_daily_minutes || 0} min/day
            </p>
            <p className="text-[10px] text-muted-foreground">Study Time</p>
          </div>
          <div className="p-2 rounded-lg bg-white/60 dark:bg-white/5 text-center">
            <TrendIcon className="h-4 w-4 mx-auto mb-1 text-purple-500" />
            <p className="text-xs font-bold capitalize">
              {insights.performance_trajectory?.trend || 'unknown'}
            </p>
            <p className="text-[10px] text-muted-foreground">Trajectory</p>
          </div>
          <div className="p-2 rounded-lg bg-white/60 dark:bg-white/5 text-center">
            <BookOpen className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-xs font-bold capitalize">
              {insights.study_pattern?.type || 'unknown'}
            </p>
            <p className="text-[10px] text-muted-foreground">Pattern</p>
          </div>
        </div>

        {/* Study Pattern Description */}
        <div className="text-sm text-muted-foreground bg-white/40 dark:bg-white/5 rounded-lg p-3">
          <p>{insights.study_pattern?.description}</p>
        </div>

        {/* Strengths */}
        {insights.strengths && insights.strengths.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Strengths
            </h4>
            <div className="flex flex-wrap gap-1">
              {insights.strengths.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] bg-green-50 text-green-700 border-green-200"
                >
                  {s.topic} ({s.accuracy}%)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Weaknesses */}
        {insights.weaknesses && insights.weaknesses.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Areas to Improve
            </h4>
            <div className="flex flex-wrap gap-1">
              {insights.weaknesses.map((w, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] bg-red-50 text-red-700 border-red-200"
                >
                  {w.topic} ({w.accuracy}%)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Focus Areas */}
        {insights.focus_areas && insights.focus_areas.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
              <Target className="h-3 w-3" /> Recommended Focus Areas
            </h4>
            <div className="space-y-1.5">
              {insights.focus_areas.slice(0, expanded ? undefined : 3).map((fa, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs p-2 rounded bg-white/40 dark:bg-white/5"
                >
                  <Badge
                    variant="outline"
                    className={`text-[9px] shrink-0 ${PRIORITY_COLORS[fa.priority] || ''}`}
                  >
                    {fa.priority}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium">{fa.topic}</p>
                    <p className="text-muted-foreground">{fa.suggested_approach}</p>
                    {fa.estimated_sessions > 0 && (
                      <p className="text-muted-foreground mt-0.5">
                        ~{fa.estimated_sessions} session{fa.estimated_sessions > 1 ? 's' : ''} recommended
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {insights.focus_areas.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" /> Show {insights.focus_areas.length - 3} more
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tutor Recommendations */}
        {insights.tutor_recommendations && (
          <div className="bg-purple-100/50 dark:bg-purple-900/20 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
              <Eye className="h-3 w-3" /> Tutoring Recommendations
            </h4>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                <strong>Teaching Style:</strong>{' '}
                {insights.tutor_recommendations.teaching_style}
              </p>
              <p>
                <strong>Session Structure:</strong>{' '}
                {insights.tutor_recommendations.session_structure}
              </p>
              <p>
                <strong>Pacing:</strong>{' '}
                <span className="capitalize">
                  {insights.tutor_recommendations.pacing?.replace(/_/g, ' ')}
                </span>
              </p>
              {insights.tutor_recommendations.motivation_approach && (
                <p>
                  <strong>Motivation:</strong>{' '}
                  {insights.tutor_recommendations.motivation_approach}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Meta info */}
        <p className="text-[10px] text-muted-foreground text-right">
          Based on {insights.data_coverage?.total_activities || 0} activities over{' '}
          {insights.data_coverage?.date_range_days || 0} days
        </p>
      </CardContent>
    </Card>
  );
}
