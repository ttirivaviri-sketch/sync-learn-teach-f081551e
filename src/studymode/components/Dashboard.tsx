import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Upload, BookOpen, BarChart3, Settings, Calendar, Brain, TrendingUp, Trophy, GraduationCap, FileText, AlertCircle, Clock, Lock, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Subject, ReadinessCheck as ReadinessCheckType, DailyTask } from '../types/study';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SubjectCard } from './SubjectCard';
import { SubjectDetail } from './SubjectDetail';
import { Leaderboard } from './Leaderboard';
// Heavy tab contents — lazy so the default Subjects tab paints first.
const StudyCalendar = lazy(() => import('./StudyCalendar').then(m => ({ default: m.StudyCalendar })));
const ExamSetupCard = lazy(() => import('./ExamSetupCard').then(m => ({ default: m.ExamSetupCard })));
const MultiExamCountdown = lazy(() => import('./MultiExamCountdown').then(m => ({ default: m.MultiExamCountdown })));
const SpacedRepetitionWidget = lazy(() => import('./SpacedRepetitionWidget').then(m => ({ default: m.SpacedRepetitionWidget })));
const ProgressCharts = lazy(() => import('./ProgressCharts').then(m => ({ default: m.ProgressCharts })));
const AIProgressInsights = lazy(() => import('./AIProgressInsights').then(m => ({ default: m.AIProgressInsights })));
const AIWeakTopicAlerts = lazy(() => import('./AIWeakTopicAlerts').then(m => ({ default: m.AIWeakTopicAlerts })));
const DailySummary = lazy(() => import('./DailySummary').then(m => ({ default: m.DailySummary })));
const AdaptivePlanBanner = lazy(() => import('./AdaptivePlanBanner').then(m => ({ default: m.AdaptivePlanBanner })));
const MockExamSection = lazy(() => import('./MockExamSection').then(m => ({ default: m.MockExamSection })));
import { Button } from '@/components/ui/button';
import { StuckHelpPrompt } from '@/components/StuckHelpPrompt';
import { cn } from '@/lib/utils';
import { useSubjects } from '../hooks/useSubjects';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useExamSettings } from '../hooks/useExamSettings';
import { useSubjectExams } from '../hooks/useSubjectExams';
import { useUserProgress } from '../hooks/useUserProgress';
import { useDailyTasks } from '../hooks/useDailyTasks';
import { useBadgeEarning } from '../hooks/useBadgeEarning';
import { useTopicProgression } from '../hooks/useTopicProgression';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../../integrations/supabase/client';
import type { AcademicProfile, SubjectExamDate } from '@/types/academicProfile';
import { SyllabusSetupGate } from '@/components/SyllabusSetupGate';
import { RiskLevelSummary, buildSubjectRisks } from '@/components/RiskLevelIndicator';
import { useAIStudyIntelligence } from '../hooks/useAIStudyIntelligence';
import { useAdaptiveLearningEngine } from '../hooks/useAdaptiveLearningEngine';
import { useStudyActivity } from '@/hooks/useStudyActivity';
import { useSubjectXP } from '../hooks/useSubjectXP';
import { logger } from "@/utils/logger";

interface DashboardProps {
  readiness: ReadinessCheckType;
  onUploadClick?: () => void;
  onOpenChat?: (subject: string, topic: string) => void;
  onNeedHelp?: () => void;
  onBrowseLibrary?: () => void;
  academicProfile?: AcademicProfile | null;
}

export function Dashboard({ readiness, onUploadClick, onOpenChat, onNeedHelp, onBrowseLibrary, academicProfile }: DashboardProps) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeTab, setActiveTab] = useState<'subjects' | 'calendar' | 'exams' | 'progress' | 'setup'>('subjects');
  const [userId, setUserId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const { data: dbSubjects, isLoading: subjectsLoading } = useSubjects();
  const { awardXP } = useSubjectXP();
  const curriculum = academicProfile?.curriculum || 'ZIMSEC';
  
  const { settings: examSettings, getExamDate, isLoading: examSettingsLoading, saveSettings, isSaving: examSettingsSaving } = useExamSettings();
  const { exams: subjectExams, addExam, deleteExam, getNextExam } = useSubjectExams();
  
  const [syllabusSetupDone, setSyllabusSetupDone] = useState(false);

  // AI Study Intelligence Engine — the brain of the system
  const aiIntelligence = useAIStudyIntelligence(academicProfile);

  // Study activity tracking
  const { getWeeklySummary, logActivity } = useStudyActivity(userId ?? undefined);

  // Wire AI context into the adaptive learning engine
  const [aiContextPayload, setAIContextPayload] = useState<any>(null);
  useEffect(() => {
    if (academicProfile && !aiIntelligence.isLoading) {
      aiIntelligence.buildAIContext().then(ctx => {
        setAIContextPayload(ctx);
      }).catch((e) => logger.warn(e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicProfile, aiIntelligence.isLoading]);

  const adaptiveEngine = useAdaptiveLearningEngine(aiContextPayload);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  // Check if user has uploaded documents (syllabi/past papers)
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => {
        setHasDocuments((count ?? 0) > 0);
      });
  }, [userId]);
  
  const { 
    getStrugglingTopics, 
    getTopicsDueToday,
    topicStats,
  } = useSpacedRepetition(userId);
  
  const { progress, dailyStats } = useUserProgress();
  const subjects = dbSubjects ?? [];
  const hasSubjects = subjects.length > 0;
  
  // Task persistence — enhanced with AI context
  const { getTasksForSubject, completeTask, ensureTasks, addBonusTask, yesterdayIncomplete, todayIncomplete, isLoading: tasksLoading, tasksCount } = useDailyTasks(subjects, aiContextPayload);

  // Seed today's tasks — only after the query has settled and no tasks exist
  useEffect(() => {
    if (subjects.length > 0 && !tasksLoading && tasksCount === 0) {
      ensureTasks.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.length, tasksLoading, tasksCount]);

  // Streak reminder state
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const currentHour = new Date().getHours();
  
  // Badge earning — auto-checks on progress changes
  useBadgeEarning();
  
  // Topic progression
  const { canAdvance } = useTopicProgression();
  
  const strugglingTopics = getStrugglingTopics();
  const topicsDueToday = getTopicsDueToday();
  
  const examDate = getExamDate();
  const examName = examSettings?.exam_name || 'Examinations';

  // === Profile-driven exam dates & risk levels ===
  const profileExamDates: SubjectExamDate[] = useMemo(() => {
    return academicProfile?.exam_dates || [];
  }, [academicProfile?.exam_dates]);

  // Auto-sync profile exam dates into subject_exams if they don't exist
  useEffect(() => {
    if (!userId || profileExamDates.length === 0 || !subjects.length) return;
    const syncExamDates = async () => {
      for (const ed of profileExamDates) {
        const matchingSubject = subjects.find(
          (s) => s.name.toLowerCase() === ed.subject.toLowerCase()
        );
        if (matchingSubject) {
          const existing = subjectExams.find(
            (se) => se.subject_id === matchingSubject.id && se.exam_date === ed.date
          );
          if (!existing) {
            try {
              addExam.mutate({
                subject_id: matchingSubject.id,
                exam_name: `${ed.subject} Exam`,
                exam_date: ed.date,
              });
              logger.info(`[Dashboard] Synced exam date for ${ed.subject}: ${ed.date}`);
            } catch (err) {
              logger.warn(`[Dashboard] Failed to sync exam date for ${ed.subject}:`, err);
            }
          }
        }
      }
    };
    syncExamDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileExamDates.length, subjects.length]);

  // Build risk level indicators from profile exam dates + activity data
  const subjectRisks = useMemo(() => {
    if (!academicProfile?.subjects || academicProfile.subjects.length === 0) return [];
    const weeklySummary = getWeeklySummary();
    const activityMap: Record<string, { tasksCompleted: number; tasksMissed: number; avgScore: number }> = {};
    for (const ws of weeklySummary) {
      activityMap[ws.subject] = {
        tasksCompleted: ws.tasksCompleted,
        tasksMissed: ws.tasksMissed,
        avgScore: ws.avgScore,
      };
    }
    return buildSubjectRisks({
      subjects: academicProfile.subjects,
      examDates: profileExamDates,
      activitySummary: activityMap,
    });
  }, [academicProfile?.subjects, profileExamDates, getWeeklySummary]);

  // Subjects sorted by exam proximity (nearest exam first)
  const sortedSubjects = useMemo(() => {
    if (profileExamDates.length === 0) return subjects;
    return [...subjects].sort((a, b) => {
      const aExam = profileExamDates.find((e) => e.subject.toLowerCase() === a.name.toLowerCase());
      const bExam = profileExamDates.find((e) => e.subject.toLowerCase() === b.name.toLowerCase());
      const aDate = aExam ? new Date(aExam.date).getTime() : Infinity;
      const bDate = bExam ? new Date(bExam.date).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [subjects, profileExamDates]);
 
  const getReadinessMessage = () => {
    const avg = (readiness.sleep + readiness.energy + readiness.mood) / 3;
    if (avg >= 4) return "You're in great shape! Let's tackle some challenging topics today.";
    if (avg >= 3) return "Good to go! I'll keep things at a comfortable pace.";
    return "Taking it easy today. Focus on review and consolidation.";
  };

  if (selectedSubject) {
    const dynamicTasks = getTasksForSubject(selectedSubject);
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SubjectDetail
          subject={selectedSubject}
          tasks={dynamicTasks}
          onBack={() => setSelectedSubject(null)}
          onOpenChat={onOpenChat}
          curriculum={curriculum}
          onCompleteTask={(taskId) => {
            completeTask.mutate(taskId);
            awardXP.mutate({ subject: selectedSubject.name, curriculum, amount: 10 });
          }}
          onAddBonusTask={() => addBonusTask.mutate(selectedSubject.id)}
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Daily Summary Modal */}
      {showSummary && (
        <Suspense fallback={null}>
          <DailySummary onClose={() => setShowSummary(false)} />
        </Suspense>
      )}

      {/* AI Message */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
        <p className="text-sm text-foreground">
          <span className="font-semibold text-accent">AI Tutor:</span>{' '}
          {getReadinessMessage()}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="subjects">
            <BookOpen className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline text-xs">Subjects</span>
          </TabsTrigger>
          <TabsTrigger value="progress">
            <TrendingUp className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline text-xs">Progress</span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline text-xs">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="exams" className="relative">
            <Trophy className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline text-xs">Exams</span>
            {(topicsDueToday.length > 0 || strugglingTopics.length > 0) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
                {topicsDueToday.length + strugglingTopics.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Settings className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline text-xs">Setup</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: SUBJECTS (clean, subjects only) ===== */}
        <TabsContent value="subjects" className="mt-4">
          {subjectsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Streak & Missed Task Reminders */}
              {!reminderDismissed && hasSubjects && (
                <>
                  {yesterdayIncomplete.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          You left {yesterdayIncomplete.length} task{yesterdayIncomplete.length > 1 ? 's' : ''} unfinished yesterday.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Complete today's tasks to keep your streak going!
                        </p>
                      </div>
                      <button onClick={() => setReminderDismissed(true)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
                    </div>
                  )}
                  {currentHour >= 20 && todayIncomplete.length > 0 && yesterdayIncomplete.length === 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-start gap-3">
                      <Clock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Don't forget to finish today's {todayIncomplete.length} remaining task{todayIncomplete.length > 1 ? 's' : ''} before midnight!
                        </p>
                      </div>
                      <button onClick={() => setReminderDismissed(true)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
                    </div>
                  )}
                </>
              )}
              {/* Exam Readiness moved to Progress tab; Mock Exams moved to Exams tab */}
              {hasSubjects ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-1">Your Subjects</h2>
                  {profileExamDates.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-4">Sorted by nearest exam date</p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sortedSubjects.map((subject, index) => {
                      const examEntry = profileExamDates.find(
                        (e) => e.subject.toLowerCase() === subject.name.toLowerCase()
                      );
                      const daysUntil = examEntry
                        ? Math.ceil((new Date(examEntry.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;

                      return (
                        <div 
                          key={subject.id}
                          style={{ animationDelay: `${index * 100}ms` }}
                          className="animate-fade-in relative"
                        >
                          {daysUntil !== null && daysUntil > 0 && daysUntil <= 30 && (
                            <Badge
                              variant="destructive"
                              className="absolute -top-2 -right-2 z-10 text-[10px] px-1.5 py-0"
                            >
                              {daysUntil}d to exam
                            </Badge>
                          )}
                          {hasDocuments === false && (
                            <Badge
                              variant="secondary"
                              className="absolute -top-2 -left-2 z-10 text-[10px] px-1.5 py-0"
                            >
                              <Lock className="h-2.5 w-2.5 mr-0.5" />
                              Upload docs
                            </Badge>
                          )}
                          <SubjectCard
                            subject={subject}
                            tasksCount={4}
                            onClick={() => {
                              if (hasDocuments === false) {
                                window.dispatchEvent(
                                  new CustomEvent('show-toast', {
                                    detail: {
                                      title: 'Upload Documents First',
                                      description: 'Upload your syllabus or past papers before generating study tasks.',
                                    },
                                  })
                                );
                                return;
                              }
                              setSelectedSubject(subject);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">No subjects yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Upload a syllabus to add your first subject.</p>
                  <Button variant="outline" size="sm" onClick={onUploadClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Syllabus
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== TAB 2: PROGRESS ===== */}
        <TabsContent value="progress" className="mt-4 space-y-6">
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <AIProgressInsights
              subjects={subjects.map(s => ({
                name: s.name,
                currentTopic: s.currentTopic.name,
                mastery: s.currentTopic.mastery,
              }))}
              dailyStats={dailyStats}
              streak={progress?.streak || 0}
              xp={progress?.xp || 0}
              quizHistory={topicStats.map(s => ({
                topic_name: s.topic_name,
                accuracy: s.accuracy,
                total_attempts: s.total_attempts,
                due_for_review: s.due_for_review,
              }))}
              masteryData={[]}
            />
            <ProgressCharts />
          </Suspense>
        </TabsContent>

        {/* ===== TAB 3: CALENDAR ===== */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
            {hasSubjects && (
              <MultiExamCountdown
                exams={subjectExams}
                subjects={subjects}
                onAddExam={(exam) => addExam.mutate(exam)}
                onDeleteExam={(id) => deleteExam.mutate(id)}
                isAdding={addExam.isPending}
              />
            )}

            {!hasSubjects && (
              <ExamSetupCard
                currentExamName={examSettings?.exam_name}
                currentExamDate={examSettings?.exam_date ? new Date(examSettings.exam_date) : undefined}
                onSave={async (name, date) => {
                  const success = await saveSettings(name, date);
                  return !!success;
                }}
                isSaving={examSettingsSaving}
              />
            )}

            <AdaptivePlanBanner />

            <StudyCalendar
              subjects={subjects}
              examDate={getNextExam()?.exam_date ? new Date(getNextExam()!.exam_date) : examDate}
              subjectExams={subjectExams}
            />
          </Suspense>
        </TabsContent>

        {/* ===== TAB 4: EXAMS (Spaced Repetition + Mock Exams) ===== */}
        <TabsContent value="exams" className="mt-4">
         <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <div className="space-y-4">
            <MockExamSection />
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Spaced Repetition</h2>
              <span className="text-xs text-muted-foreground">
                Powered by SM-2 algorithm
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Smart review system that automatically re-quizzes you on topics you're struggling with.
            </p>
            <AIWeakTopicAlerts
              topicStats={topicStats}
              subjects={subjects.map(s => ({
                name: s.name,
                currentTopic: s.currentTopic.name,
                mastery: s.currentTopic.mastery,
              }))}
              onStartReview={(topicName) => {
                const matchingSubject = subjects.find(s =>
                  s.topics.some(t => t.name === topicName) ||
                  s.currentTopic.name === topicName
                );
                if (matchingSubject) setSelectedSubject(matchingSubject);
              }}
            />

            {strugglingTopics.length > 1 && (
              <StuckHelpPrompt
                topic={strugglingTopics[0]?.topic_name}
                subject={subjects[0]?.name}
                failedAttempts={strugglingTopics.length}
                variant="after-quiz"
                onWatchMore={onBrowseLibrary}
                onBookTutor={onNeedHelp}
                onBrowseLibrary={onBrowseLibrary}
              />
            )}

            <SpacedRepetitionWidget
              strugglingTopics={strugglingTopics}
              topicsDueToday={topicsDueToday}
              onStartReview={(topic) => {
                const matchingSubject = subjects.find(s => 
                  s.topics.some(t => t.name === topic.topic_name) ||
                  s.currentTopic.name === topic.topic_name
                );
                if (matchingSubject) {
                  setSelectedSubject(matchingSubject);
                }
              }}
            />
            
            {topicStats.length > 0 && (
              <div className="p-4 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-3">Your Quiz History</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {topicStats.map((stat, index) => (
                    <div 
                      key={`${stat.subject_id}-${stat.topic_name}-${index}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{stat.topic_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.total_attempts} attempts
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          stat.accuracy >= 70 ? "text-success" :
                          stat.accuracy >= 50 ? "text-warning" : "text-destructive"
                        )}>
                          {stat.accuracy}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stat.due_for_review ? 'Due now' : `Next: ${stat.next_review_date}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
         </Suspense>
        </TabsContent>

        {/* ===== TAB 5: PROFILE (academic profile, syllabus, documents, daily progress) ===== */}
        <TabsContent value="setup" className="mt-4 space-y-4">
          {/* Academic Profile Card */}
          {academicProfile ? (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Your Academic Profile</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {aiIntelligence.isEnriching ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 animate-pulse border-primary/50">
                        <Brain className="h-3 w-3 mr-0.5 text-primary" />
                        AI Syncing...
                      </Badge>
                    ) : aiIntelligence.syllabusIntelligence ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-600">
                        <Brain className="h-3 w-3 mr-0.5" />
                        AI Active
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Curriculum</span>
                    <p className="font-medium text-foreground">{academicProfile.curriculum || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grade</span>
                    <p className="font-medium text-foreground">{academicProfile.grade || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exam Year</span>
                    <p className="font-medium text-foreground">{academicProfile.exam_year || '—'}</p>
                  </div>
                </div>
                {academicProfile.subjects && academicProfile.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {academicProfile.subjects.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                    ))}
                  </div>
                )}
                {subjectRisks.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <RiskLevelSummary risks={subjectRisks} />
                  </div>
                )}
                {aiIntelligence.learningProfile && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="grid grid-cols-4 gap-2 text-xs text-center">
                      <div>
                        <p className="font-bold text-primary">{aiIntelligence.learningProfile.overallUnderstanding}%</p>
                        <p className="text-[10px] text-muted-foreground">Understanding</p>
                      </div>
                      <div>
                        <p className="font-bold text-accent capitalize">{aiIntelligence.learningProfile.learningPace}</p>
                        <p className="text-[10px] text-muted-foreground">Pace</p>
                      </div>
                      <div>
                        <p className="font-bold text-warning capitalize">{aiIntelligence.learningProfile.recommendedDifficulty}</p>
                        <p className="text-[10px] text-muted-foreground">Level</p>
                      </div>
                      <div>
                        <p className="font-bold text-destructive">
                          {aiIntelligence.learningProfile.daysUntilExam !== null
                            ? `${aiIntelligence.learningProfile.daysUntilExam}d`
                            : '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">To Exam</p>
                      </div>
                    </div>
                    {aiIntelligence.learningProfile.persistentWeakAreas.length > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[10px] text-destructive font-medium mb-0.5">Focus Areas:</p>
                        <div className="flex flex-wrap gap-1">
                          {aiIntelligence.learningProfile.persistentWeakAreas.slice(0, 4).map((t) => (
                            <Badge key={t} variant="destructive" className="text-[9px] px-1 py-0">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-warning mb-2" />
                <h3 className="font-semibold text-sm mb-1">Academic Profile Not Set</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Go to your Profile tab to set your curriculum, grade, and subjects first.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Syllabus & Paper Codes Setup Gate */}
          {userId && (
            <SyllabusSetupGate
              userId={userId}
              academicProfile={academicProfile}
              onSetupComplete={() => setSyllabusSetupDone(true)}
              onUploadDocuments={onUploadClick}
            />
          )}

          {/* Document upload card */}
          {hasDocuments === false && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="p-5 text-center">
                <FileText className="h-10 w-10 mx-auto text-accent mb-2" />
                <h3 className="font-bold text-foreground mb-1">Upload Your Syllabus & Past Papers</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Study Mode needs your documents to generate personalised quizzes, tasks, and study plans.
                </p>
                <Button className="gradient-primary" onClick={onUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Compact summary trigger only — full daily stats live on Home tab */}
          <Button variant="outline" size="sm" onClick={() => setShowSummary(true)} className="w-full">
            <Trophy className="mr-2 h-4 w-4" />
            View Today's Summary
          </Button>

          {/* Exam date prompt if no exams set */}
          {hasSubjects && subjectExams.length === 0 && (
            <div className="p-5 rounded-2xl bg-accent/10 border border-accent/30 text-center">
              <GraduationCap className="h-10 w-10 mx-auto text-accent mb-2" />
              <h3 className="font-bold text-foreground mb-1">Set Your Exam Dates</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add exam dates for each subject in the Calendar tab to get countdowns and smarter study scheduling.
              </p>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('calendar')}>
                <Calendar className="mr-2 h-4 w-4" />
                Go to Calendar
              </Button>
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
