import { useState } from 'react';
import { BookOpen, Calendar, Check, ChevronRight, GraduationCap, Layers3 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { useAdaptiveLearningEngine } from '../hooks/useAdaptiveLearningEngine';

interface CurriculumLevel {
  id: string;
  name: string;
  description: string;
}

interface CurriculumBoard {
  id: string;
  name: string;
  description: string;
  levels: CurriculumLevel[];
}

const CURRICULUM_BOARDS: CurriculumBoard[] = [
  {
    id: 'primary',
    name: 'Primary',
    description: 'Primary / elementary school',
    levels: [
      { id: 'primary', name: 'Primary', description: 'Grades 1-7 (or equivalent)' },
    ],
  },
  {
    id: 'cambridge',
    name: 'Cambridge',
    description: 'Cambridge International Examinations',
    levels: [
      { id: 'igcse', name: 'IGCSE', description: 'International General Certificate of Secondary Education' },
      { id: 'o-level', name: 'GCE O Level', description: 'General Certificate of Education Ordinary Level' },
      { id: 'as-level', name: 'AS Level', description: 'Advanced Subsidiary Level' },
      { id: 'a-level', name: 'A Level', description: 'Advanced Level' },
    ],
  },
  {
    id: 'zimsec',
    name: 'ZIMSEC',
    description: 'Zimbabwe School Examinations Council',
    levels: [
      { id: 'zimsec-o', name: 'O Level', description: 'Ordinary Level' },
      { id: 'zimsec-a', name: 'A Level', description: 'Advanced Level' },
    ],
  },
  {
    id: 'caps',
    name: 'CAPS',
    description: 'South African Curriculum & Assessment',
    levels: [
      { id: 'caps-fet', name: 'FET Phase', description: 'Further Education and Training (Grades 10-12)' },
    ],
  },
  {
    id: 'ieb',
    name: 'IEB',
    description: 'Independent Examinations Board (South Africa)',
    levels: [
      { id: 'ieb-nsc', name: 'NSC', description: 'National Senior Certificate' },
    ],
  },
  {
    id: 'nssc',
    name: 'NSSC',
    description: 'Namibia Senior Secondary Certificate',
    levels: [
      { id: 'nssco', name: 'NSSCO', description: 'Ordinary Level' },
      { id: 'nssch', name: 'NSSCH', description: 'Higher Level' },
    ],
  },
  {
    id: 'bgcse',
    name: 'BGCSE',
    description: 'Botswana General Certificate of Secondary Education',
    levels: [
      { id: 'bgcse', name: 'BGCSE', description: 'General Certificate' },
    ],
  },
  {
    id: 'gcse',
    name: 'GCSE',
    description: 'UK General Certificate of Secondary Education',
    levels: [
      { id: 'gcse', name: 'GCSE', description: 'General Certificate' },
      { id: 'a-level-uk', name: 'A Level', description: 'Advanced Level' },
    ],
  },
  {
    id: 'kcse',
    name: 'KCSE',
    description: 'Kenya Certificate of Secondary Education',
    levels: [
      { id: 'kcse', name: 'KCSE', description: 'Secondary Certificate' },
    ],
  },
  {
    id: 'tertiary',
    name: 'University / College',
    description: 'Tertiary education (college, polytechnic, university)',
    levels: [
      { id: 'certificate', name: 'Certificate', description: 'Short course / certificate level' },
      { id: 'diploma', name: 'Diploma', description: 'Diploma / associate level' },
      { id: 'undergraduate', name: 'Undergraduate', description: 'Bachelor / undergraduate level' },
      { id: 'postgraduate', name: 'Postgraduate', description: 'Masters / postgraduate level' },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Custom curriculum',
    levels: [{ id: 'custom', name: 'Custom', description: 'Custom curriculum' }],
  },
];

const PRIMARY_SUBJECTS = [
  { name: 'Literacy', icon: '📖', color: 'from-purple-500 to-violet-600' },
  { name: 'Numeracy', icon: '🔢', color: 'from-blue-500 to-indigo-600' },
  { name: 'Environmental Science', icon: '🌱', color: 'from-green-500 to-emerald-600' },
  { name: 'Social Studies', icon: '🏘️', color: 'from-amber-500 to-yellow-600' },
  { name: 'Art & Craft', icon: '🎨', color: 'from-pink-500 to-rose-600' },
  { name: 'Physical Education', icon: '⚽', color: 'from-orange-500 to-red-500' },
  { name: 'Music', icon: '🎵', color: 'from-cyan-500 to-teal-600' },
  { name: 'Religious & Moral Education', icon: '📿', color: 'from-slate-500 to-gray-600' },
];

const SECONDARY_SUBJECTS = [
  { name: 'Mathematics', icon: '📐', color: 'from-blue-500 to-indigo-600' },
  { name: 'Physics', icon: '⚡', color: 'from-orange-500 to-red-500' },
  { name: 'Chemistry', icon: '🧪', color: 'from-green-500 to-emerald-600' },
  { name: 'Biology', icon: '🧬', color: 'from-pink-500 to-rose-600' },
  { name: 'English', icon: '📚', color: 'from-purple-500 to-violet-600' },
  { name: 'History', icon: '🏛️', color: 'from-amber-500 to-yellow-600' },
  { name: 'Geography', icon: '🌍', color: 'from-cyan-500 to-teal-600' },
  { name: 'Computer Science', icon: '💻', color: 'from-slate-500 to-gray-600' },
];

// Subject icon/gradient mapping (mirrors edge function)
const SUBJECT_VISUALS: Record<string, { icon: string; gradient: string }> = {
  mathematics: { icon: '📐', gradient: 'from-purple-500 to-violet-600' },
  maths: { icon: '📐', gradient: 'from-purple-500 to-violet-600' },
  physics: { icon: '⚛️', gradient: 'from-blue-500 to-indigo-600' },
  chemistry: { icon: '🧪', gradient: 'from-green-500 to-emerald-600' },
  biology: { icon: '🧬', gradient: 'from-pink-500 to-rose-600' },
  english: { icon: '📖', gradient: 'from-orange-500 to-amber-600' },
  geography: { icon: '🌍', gradient: 'from-lime-500 to-green-600' },
  history: { icon: '🏛️', gradient: 'from-stone-500 to-amber-700' },
  'computer science': { icon: '💻', gradient: 'from-cyan-500 to-sky-600' },
  economics: { icon: '📊', gradient: 'from-teal-500 to-cyan-600' },
  accounting: { icon: '🧮', gradient: 'from-blue-500 to-indigo-600' },
  'business studies': { icon: '💼', gradient: 'from-teal-500 to-cyan-600' },
  literacy: { icon: '📖', gradient: 'from-purple-500 to-violet-600' },
  numeracy: { icon: '🔢', gradient: 'from-blue-500 to-indigo-600' },
};

function getSubjectVisuals(name: string) {
  const key = name.trim().toLowerCase();
  return SUBJECT_VISUALS[key] || { icon: '📚', gradient: 'from-gray-500 to-slate-600' };
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { onSignupComplete } = useAdaptiveLearningEngine();
  const [step, setStep] = useState<'board' | 'level' | 'subjects' | 'exams'>('board');

  const [selectedBoard, setSelectedBoard] = useState<CurriculumBoard | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CurriculumLevel | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [examDates, setExamDates] = useState<Record<string, Date>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (trimmed && !selectedSubjects.includes(trimmed)) {
      setSelectedSubjects(prev => [...prev, trimmed]);
      setCustomSubject('');
    }
  };

  const handleBoardSelect = (board: CurriculumBoard) => {
    setSelectedBoard(board);
    if (board.levels.length === 1) {
      setSelectedLevel(board.levels[0]);
      setStep('subjects');
    } else {
      setStep('level');
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const curriculum = (selectedBoard?.id || 'other').toUpperCase();
      const studyLevel = selectedLevel?.id || selectedBoard?.id || 'secondary';

      // Save to localStorage for offline/no-auth usage
      const setupData = {
        board: selectedBoard?.id,
        level: selectedLevel?.id,
        curriculum,
        studyLevel,
        subjects: selectedSubjects,
        examDates: Object.fromEntries(
          Object.entries(examDates).map(([k, v]) => [k, v.toISOString()])
        ),
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem('studymode_setup', JSON.stringify(setupData));

      // Try saving to DB if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Save academic profile (including exam_dates)
        try {
          // Build exam_dates array for the profile
          const examDatesArray = Object.entries(examDates).map(([subject, date]) => ({
            subject,
            date: date.toISOString().split('T')[0],
          }));

          const { error: profileError } = await supabase
            .from('academic_profiles')
            .upsert(
              {
                user_id: user.id,
                curriculum,
                study_level: studyLevel,
                grade: studyLevel,
                subjects: selectedSubjects,
                exam_dates: examDatesArray,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: 'user_id' }
            );

          if (profileError) {
            console.error('[OnboardingFlow] Profile save error:', profileError);
          } else {
            console.log('[OnboardingFlow] Profile saved with exam_dates:', examDatesArray.length);
          }
        } catch (profileErr) {
          console.error('[OnboardingFlow] Profile save exception:', profileErr);
        }

        // 2. Create subjects
        for (const subjectName of selectedSubjects) {
          try {
            // Check if subject already exists
            const { data: existingSubject } = await supabase
              .from('subjects')
              .select('id')
              .eq('user_id', user.id)
              .ilike('name', subjectName)
              .maybeSingle();

            let subjectId = existingSubject?.id;

            if (!subjectId) {
              // Create the subject with visual defaults
              const visuals = getSubjectVisuals(subjectName);
              const { data: newSubject, error: subjectError } = await supabase
                .from('subjects')
                .insert({
                  user_id: user.id,
                  name: subjectName,
                  syllabus_code: selectedLevel?.id || 'custom',
                  topics: [],
                  icon_emoji: visuals.icon,
                  icon_gradient: visuals.gradient,
                })
                .select('id')
                .single();

              if (subjectError) {
                console.error(`[OnboardingFlow] Subject "${subjectName}" insert error:`, subjectError);
                continue;
              }
              subjectId = newSubject?.id;
            }

            // 3. Save exam date for this subject
            if (examDates[subjectName] && subjectId) {
              const examDateStr = examDates[subjectName].toISOString().split('T')[0];

              // Upsert exam settings (global — one per user)
              try {
                await supabase
                  .from('exam_settings')
                  .upsert(
                    {
                      user_id: user.id,
                      exam_name: `${curriculum} Examinations`,
                      exam_date: examDateStr,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id' }
                  );
              } catch (examSettingsErr) {
                console.warn('[OnboardingFlow] exam_settings upsert error:', examSettingsErr);
              }

              // Insert per-subject exam record
              try {
                await supabase
                  .from('subject_exams')
                  .insert({
                    user_id: user.id,
                    subject_id: subjectId,
                    subject_name: subjectName,
                    exam_name: `${subjectName} Exam`,
                    exam_date: examDateStr,
                  });
              } catch (subjectExamErr) {
                console.warn(`[OnboardingFlow] subject_exams insert error for "${subjectName}":`, subjectExamErr);
              }
            }
          } catch (subjectErr) {
            console.error(`[OnboardingFlow] Subject "${subjectName}" processing error:`, subjectErr);
          }
        }
      }

      sessionStorage.setItem('onboarding_complete', 'true');

      toast({
        title: 'Welcome to STUDYMODE!',
        description: 'Your learning journey begins now. Your subjects have been saved.',
      });

      // Trigger initial AI study plan generation in the background
      onSignupComplete().catch((err) =>
        console.warn('[OnboardingFlow] Initial plan generation failed:', err)
      );

      onComplete();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: 'Setup Error',
        description: 'Something went wrong. Your selections were saved locally and you can continue.',
        variant: 'destructive',
      });
      // Even on error, let them proceed — data is in localStorage
      sessionStorage.setItem('onboarding_complete', 'true');
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressSteps = [
    { id: 'board' as const, label: 'Board', icon: GraduationCap },
    { id: 'level' as const, label: 'Level', icon: Layers3 },
    { id: 'subjects' as const, label: 'Subjects', icon: BookOpen },
    { id: 'exams' as const, label: 'Exam Dates', icon: Calendar },
  ];
  const stepOrder: Array<'board' | 'level' | 'subjects' | 'exams'> = ['board', 'level', 'subjects', 'exams'];
  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-success/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6 animate-fade-in">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {progressSteps.map((s, index) => {
            const thisStepIndex = stepOrder.indexOf(s.id);
            const isDone = thisStepIndex < currentStepIndex;
            const isActive = thisStepIndex === currentStepIndex;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground scale-110'
                      : isDone
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isDone ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                {index < progressSteps.length - 1 && (
                  <div
                    className={cn('h-1 w-10 sm:w-16 mx-2 transition-all', isDone ? 'bg-success' : 'bg-muted')}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step: Board Selection */}
        {step === 'board' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Choose Your Examination Board</h2>
              <p className="text-muted-foreground">Select the examination board you're studying under</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {CURRICULUM_BOARDS.map(board => (
                <button
                  key={board.id}
                  onClick={() => handleBoardSelect(board)}
                  className={cn(
                    'p-6 rounded-2xl border-2 transition-all text-left hover:scale-105',
                    selectedBoard?.id === board.id
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <h3 className="font-bold text-foreground mb-1">{board.name}</h3>
                  <p className="text-sm text-muted-foreground">{board.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Level Selection */}
        {step === 'level' && selectedBoard && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Choose Your Level</h2>
              <p className="text-muted-foreground">Select the qualification level for {selectedBoard.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedBoard.levels.map(level => (
                <button
                  key={level.id}
                  onClick={() => {
                    setSelectedLevel(level);
                    setStep('subjects');
                  }}
                  className={cn(
                    'p-6 rounded-2xl border-2 transition-all text-left hover:scale-105',
                    selectedLevel?.id === level.id
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <h3 className="font-bold text-foreground mb-1">{level.name}</h3>
                  <p className="text-sm text-muted-foreground">{level.description}</p>
                </button>
              ))}
            </div>

            <Button onClick={() => setStep('board')} variant="outline" className="w-full">
              Back to Boards
            </Button>
          </div>
        )}

        {/* Step: Subject Selection */}
        {step === 'subjects' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Add Your Subjects</h2>
              <p className="text-muted-foreground">Select the subjects you're studying</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(selectedBoard?.id === 'primary' ? PRIMARY_SUBJECTS : SECONDARY_SUBJECTS).map(subject => (
                <button
                  key={subject.name}
                  onClick={() => toggleSubject(subject.name)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all hover:scale-105',
                    selectedSubjects.includes(subject.name)
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{subject.icon}</span>
                    <span className="font-medium text-foreground">{subject.name}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Add Custom Subject */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom subject..."
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomSubject()}
              />
              <Button onClick={addCustomSubject} variant="outline">
                Add
              </Button>
            </div>

            {/* Show selected subjects count */}
            {selectedSubjects.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''} selected: {selectedSubjects.join(', ')}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => (selectedBoard && selectedBoard.levels.length > 1 ? setStep('level') : setStep('board'))}
                variant="outline"
                className="w-full"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('exams')}
                disabled={selectedSubjects.length === 0}
                className="w-full gradient-primary"
              >
                Continue
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Exam Dates */}
        {step === 'exams' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Set Exam Dates</h2>
              <p className="text-muted-foreground">When are your exams? (You can set these later)</p>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {selectedSubjects.map(subject => (
                <div key={subject} className="p-4 rounded-xl border border-border">
                  <Label className="font-medium text-foreground mb-2 block">{subject}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {examDates[subject] ? format(examDates[subject], 'PPP') : 'Select exam date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={examDates[subject]}
                        onSelect={date => date && setExamDates(prev => ({ ...prev, [subject]: date }))}
                        disabled={date => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep('subjects')} variant="outline" className="w-full">
                Back
              </Button>
              <Button onClick={handleComplete} disabled={isSubmitting} className="w-full gradient-success" size="lg">
                {isSubmitting ? 'Setting up...' : 'Complete Setup'}
                <Check className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
