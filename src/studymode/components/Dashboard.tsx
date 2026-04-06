import { useState, useEffect } from 'react';
import { Upload, BookOpen, BarChart3, Settings, Calendar, Brain, TrendingUp, Trophy, GraduationCap, FileText, AlertCircle } from 'lucide-react';
import { Subject, ReadinessCheck as ReadinessCheckType, DailyTask } from '../types/study';
import { SubjectCard } from './SubjectCard';
import { SubjectDetail } from './SubjectDetail';
import { StudyCalendar } from './StudyCalendar';
import { ExamCountdownWidget } from './ExamCountdownWidget';
import { ExamSetupCard } from './ExamSetupCard';
import { MultiExamCountdown } from './MultiExamCountdown';
import { SpacedRepetitionWidget } from './SpacedRepetitionWidget';
import { ProgressCharts } from './ProgressCharts';
import { AIProgressInsights } from './AIProgressInsights';
import { AIWeakTopicAlerts } from './AIWeakTopicAlerts';
import { DailySummary } from './DailySummary';
import { AdaptivePlanBanner } from './AdaptivePlanBanner';
import { Button } from './ui/button';
import { StuckHelpPrompt } from '@/components/StuckHelpPrompt';
import { cn } from '../lib/utils';
import { useSubjects } from '../hooks/useSubjects';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useExamSettings } from '../hooks/useExamSettings';
import { useSubjectExams } from '../hooks/useSubjectExams';
import { useUserProgress } from '../hooks/useUserProgress';
import { useDailyTasks } from '../hooks/useDailyTasks';
import { useBadgeEarning } from '../hooks/useBadgeEarning';
import { useTopicProgression } from '../hooks/useTopicProgression';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { supabase } from '../../integrations/supabase/client';
import type { AcademicProfile } from '@/types/academicProfile';
import { SyllabusSetupGate } from '@/components/SyllabusSetupGate';
import { useAIStudyIntelligence } from '../hooks/useAIStudyIntelligence';
import { useAdaptiveLearningEngine } from '../hooks/useAdaptiveLearningEngine';

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
  const [activeTab, setActiveTab] = useState<'subjects' | 'calendar' | 'review' | 'progress'>('subjects');
  const [userId, setUserId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const { data: dbSubjects, isLoading: subjectsLoading } = useSubjects();
  
  const { settings: examSettings, getExamDate, isLoading: examSettingsLoading, saveSettings, isSaving: examSettingsSaving } = useExamSettings();
  const { exams: subjectExams, addExam, deleteExam, getNextExam } = useSubjectExams();
  
  const [syllabusSetupDone, setSyllabusSetupDone] = useState(false);

  // AI Study Intelligence Engine — the brain of the system
  const aiIntelligence = useAIStudyIntelligence(academicProfile);

  // Wire AI context into the adaptive learning engine
  const [aiContextPayload, setAIContextPayload] = useState<any>(null);
  useEffect(() => {
    if (academicProfile && !aiIntelligence.isLoading) {
      aiIntelligence.buildAIContext().then(ctx => {
        setAIContextPayload(ctx);
      }).catch(console.warn);
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
  const { getTasksForSubject } = useDailyTasks(subjects, aiContextPayload);
  
  // Badge earning — auto-checks on progress changes
  useBadgeEarning();
  
  // Topic progression
  const { canAdvance } = useTopicProgression();
  
  const strugglingTopics = getStrugglingTopics();
  const topicsDueToday = getTopicsDueToday();
  
  const examDate = getExamDate();
  const examName = examSettings?.exam_name || 'Examinations';
 
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
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Daily Summary Modal */}
      {showSummary && <DailySummary onClose={() => setShowSummary(false)} />}

      {/* Academic Profile Card with AI Intelligence Status */}
      {academicProfile ? (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Your Academic Profile</h3>
              </div>
              {/* AI Intelligence Status Indicator */}
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
            {/* AI Learning Profile Summary */}
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

      {/* Document upload gate — show when syllabus is set but no documents uploaded */}
      {syllabusSetupDone && hasDocuments === false && (
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

      {/* AI Message */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
        <p className="text-sm text-foreground">
          <span className="font-semibold text-accent">AI Tutor:</span>{' '}
          {getReadinessMessage()}
        </p>
      </div>

       {/* Exam Countdowns — always driven by subject_exams from calendar */}
       {subjectExams.length > 0 ? (
         <MultiExamCountdown
           exams={subjectExams}
           subjects={subjects}
           onAddExam={(exam) => addExam.mutate(exam)}
           onDeleteExam={(id) => deleteExam.mutate(id)}
           isAdding={addExam.isPending}
         />
       ) : hasSubjects ? (
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
       ) : null}
 
      {!hasSubjects && !subjectsLoading && !syllabusSetupDone && (
        <div className="p-6 rounded-2xl bg-warning/10 border border-warning/30 text-center">
          <Upload className="h-12 w-12 mx-auto text-warning mb-3" />
          <h3 className="text-lg font-bold text-foreground mb-2">Set Up Your Syllabi</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your subjects with syllabus codes and paper codes above, or upload your official syllabi to get started.
          </p>
          <Button className="gradient-primary" onClick={onUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button variant="outline" size="sm" className="shrink-0" onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Documents
        </Button>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setActiveTab('calendar')}>
          <BookOpen className="mr-2 h-4 w-4" />
          Past Papers
        </Button>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowSummary(true)}>
          <Trophy className="mr-2 h-4 w-4" />
          Daily Summary
        </Button>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setActiveTab('progress')}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Progress
        </Button>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setActiveTab('review')}>
          <Settings className="mr-2 h-4 w-4" />
          Review
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="subjects">
            <BookOpen className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Subjects</span>
          </TabsTrigger>
          <TabsTrigger value="progress">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Progress</span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="relative">
            <Brain className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Review</span>
            {(topicsDueToday.length > 0 || strugglingTopics.length > 0) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
                {topicsDueToday.length + strugglingTopics.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="mt-4">
          {subjectsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {hasSubjects ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-4">Your Subjects</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {subjects.map((subject, index) => (
                      <div 
                        key={subject.id}
                        style={{ animationDelay: `${index * 100}ms` }}
                        className="animate-fade-in"
                      >
                        <SubjectCard
                          subject={subject}
                          tasksCount={4}
                          onClick={() => setSelectedSubject(subject)}
                        />
                      </div>
                    ))}
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

        <TabsContent value="progress" className="mt-4 space-y-6">
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
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-4">
          {/* Per-Subject Exam Dates */}
          {hasSubjects && (
            <MultiExamCountdown
              exams={subjectExams}
              subjects={subjects}
              onAddExam={(exam) => addExam.mutate(exam)}
              onDeleteExam={(id) => deleteExam.mutate(id)}
              isAdding={addExam.isPending}
            />
          )}

          {/* Fallback: Global Exam Date */}
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

        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Spaced Repetition</h2>
              <span className="text-xs text-muted-foreground">
                Powered by SM-2 algorithm
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Smart review system that automatically re-quizzes you on topics you're struggling with.
            </p>
            {/* AI Weak Topic Alerts */}
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

            {/* Stuck → Get Help prompt (shows if weak topics exist) */}
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
        </TabsContent>

      </Tabs>

      {/* Daily Progress Summary */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Today's Progress</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowSummary(true)} className="text-accent">
            View Summary
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-accent">
              {dailyStats.tasksCompletedToday}/{dailyStats.totalTasksToday || subjects.length * 4}
            </p>
            <p className="text-xs text-muted-foreground">Tasks Done</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-success">{dailyStats.examQuestionsToday}</p>
            <p className="text-xs text-muted-foreground">Exam Qs</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-warning">+{dailyStats.xpToday}</p>
            <p className="text-xs text-muted-foreground">XP Today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">🔥 {progress?.streak || 0}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
}
