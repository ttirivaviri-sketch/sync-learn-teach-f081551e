import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useStudySchedule, StudyScheduleItem } from '../hooks/useStudySchedule';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Subject } from '../types/study';
import { SubjectExamWithReadiness } from '../hooks/useSubjectExams';

interface StudyCalendarProps {
  subjects: Subject[];
  examDate?: Date;
  subjectExams?: SubjectExamWithReadiness[];
  onGenerateSchedule?: () => void;
}

const taskTypeColors: Record<string, string> = {
  revision: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  concept_learning: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  exam_prep: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
  practice: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

const taskTypeLabels: Record<string, string> = {
  revision: 'Revision',
  concept_learning: 'Concept Learning',
  exam_prep: 'Exam Prep',
  practice: 'Practice',
};

export function StudyCalendar({ subjects, examDate, subjectExams, onGenerateSchedule }: StudyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ topic: '', subjectId: '', taskType: 'revision' });
  
  const { schedule, isLoading, toggleComplete, addScheduleItem, deleteScheduleItem, generateSchedule } = useStudySchedule(currentMonth);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad days to start from Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const getScheduleForDate = (date: Date): StudyScheduleItem[] => {
    return schedule.filter(item => 
      isSameDay(new Date(item.scheduled_date), date)
    );
  };

  const handleAddTask = async () => {
    if (!selectedDate || !newTask.topic) return;

    await addScheduleItem.mutateAsync({
      subject_id: newTask.subjectId || null,
      topic_name: newTask.topic,
      scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
      task_type: newTask.taskType,
      duration_minutes: 30,
    });

    setNewTask({ topic: '', subjectId: '', taskType: 'revision' });
    setIsAddingTask(false);
  };

  const handleGenerateSchedule = async () => {
    if (subjects.length === 0) return;

    // Use per-subject exam dates if available, otherwise fallback
    const targetExamDate = examDate || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    
    // If we have per-subject exams, use the nearest one as the target
    const nearestExam = subjectExams?.length 
      ? subjectExams.reduce((nearest, exam) => {
          const examD = new Date(exam.exam_date);
          return !nearest || examD < nearest ? examD : nearest;
        }, null as Date | null)
      : null;

    await generateSchedule.mutateAsync({
      subjects: subjects.map(s => {
        // Find subject-specific exam to weight topics by urgency
        const subjectExam = subjectExams?.find(e => e.subject_id === s.id);
        return {
          id: s.id,
          name: s.name,
          topics: s.topics.map(t => ({ 
            name: t.name, 
            examWeight: t.examWeight * (subjectExam ? Math.max(1, 30 / Math.max(1, subjectExam.daysRemaining)) : 1)
          })),
        };
      }),
      examDate: nearestExam || targetExamDate,
      daysPerWeek: 5,
    });

    onGenerateSchedule?.();
  };

  const selectedDateSchedule = selectedDate ? getScheduleForDate(selectedDate) : [];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Study Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Generate Schedule Button */}
      {subjects.length > 0 && schedule.length === 0 && (
        <Button
          onClick={handleGenerateSchedule}
          disabled={generateSchedule.isPending}
          className="w-full gradient-primary"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {generateSchedule.isPending ? 'Generating...' : 'Generate Study Schedule'}
        </Button>
      )}

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {paddedDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="p-2 min-h-[80px] bg-muted/20" />;
            }

            const daySchedule = getScheduleForDate(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const hasExam = examDate && isSameDay(day, examDate);
            // Check all subject exams for this day
            const subjectExamsOnDay = (subjectExams || []).filter(e => isSameDay(new Date(e.exam_date), day));
            const hasAnyExam = hasExam || subjectExamsOnDay.length > 0;

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'p-1 min-h-[80px] border-r border-b border-border cursor-pointer transition-colors',
                  !isSameMonth(day, currentMonth) && 'bg-muted/30 text-muted-foreground',
                  isToday(day) && 'bg-accent/10',
                  isSelected && 'ring-2 ring-accent ring-inset',
                  hasAnyExam && 'bg-destructive/10'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1',
                  isToday(day) && 'text-accent font-bold'
                )}>
                  {format(day, 'd')}
                  {hasAnyExam && <span className="ml-1 text-destructive">📝</span>}
                </div>
                {subjectExamsOnDay.length > 0 && (
                  <div className="text-[10px] px-1 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 truncate mb-0.5">
                    {subjectExamsOnDay.map(e => e.subject?.name || e.exam_name).join(', ')}
                  </div>
                )}
                <div className="space-y-0.5">
                  {daySchedule.slice(0, 2).map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'text-[10px] px-1 py-0.5 rounded truncate border',
                        taskTypeColors[item.task_type] || taskTypeColors.revision,
                        item.is_completed && 'opacity-50 line-through'
                      )}
                    >
                      {item.topic_name.split(':').pop()?.trim() || item.topic_name}
                    </div>
                  ))}
                  {daySchedule.length > 2 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{daySchedule.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h3>
            <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Study Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">Topic</label>
                    <Input
                      value={newTask.topic}
                      onChange={(e) => setNewTask({ ...newTask, topic: e.target.value })}
                      placeholder="Enter topic name"
                    />
                  </div>
                  {subjects.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <Select
                        value={newTask.subjectId}
                        onValueChange={(value) => setNewTask({ ...newTask, subjectId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(subject => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.icon} {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Task Type</label>
                    <Select
                      value={newTask.taskType}
                      onValueChange={(value) => setNewTask({ ...newTask, taskType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleAddTask}
                    disabled={!newTask.topic || addScheduleItem.isPending}
                    className="w-full"
                  >
                    {addScheduleItem.isPending ? 'Adding...' : 'Add Task'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {selectedDateSchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">No study tasks scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedDateSchedule.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    taskTypeColors[item.task_type] || taskTypeColors.revision
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleComplete.mutate({ id: item.id, isCompleted: !item.is_completed })}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                        item.is_completed ? 'bg-success border-success' : 'border-current'
                      )}
                    >
                      {item.is_completed && <Check className="h-3 w-3 text-success-foreground" />}
                    </button>
                    <div>
                      <p className={cn('text-sm font-medium', item.is_completed && 'line-through opacity-60')}>
                        {item.topic_name}
                      </p>
                      <p className="text-xs opacity-70">
                        {taskTypeLabels[item.task_type]} • {item.duration_minutes} min
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteScheduleItem.mutate(item.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(taskTypeLabels).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', taskTypeColors[type]?.split(' ')[0])} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
