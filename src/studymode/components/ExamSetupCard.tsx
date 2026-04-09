import { useState } from 'react';
import { Calendar as CalendarIcon, GraduationCap, Save, Loader2, CheckCircle, Plus, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ExamSetupCardProps {
  currentExamName?: string;
  currentExamDate?: Date;
  onSave: (examName: string, examDate: Date) => Promise<boolean>;
  isSaving?: boolean;
  compact?: boolean;
}

export function ExamSetupCard({ currentExamName, currentExamDate, onSave, isSaving, compact }: ExamSetupCardProps) {
  const [isEditing, setIsEditing] = useState(!currentExamDate);
  const [examName, setExamName] = useState(currentExamName || '');
  const [examDate, setExamDate] = useState<Date | undefined>(currentExamDate);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!examName.trim() || !examDate) return;
    const success = await onSave(examName.trim(), examDate);
    if (success) {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setIsEditing(false);
      }, 1500);
    }
  };

  const daysUntil = examDate ? differenceInDays(examDate, new Date()) : null;

  // Compact display mode when exam is already set
  if (!isEditing && currentExamDate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-2xl bg-card border border-border"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
              <GraduationCap className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{currentExamName}</p>
              <p className="text-xs text-muted-foreground">
                {format(currentExamDate, 'PPP')} • <span className={cn(
                  'font-semibold',
                  daysUntil && daysUntil <= 14 ? 'text-destructive' :
                  daysUntil && daysUntil <= 30 ? 'text-accent' : 'text-success'
                )}>{daysUntil} days away</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
            <GraduationCap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {currentExamDate ? 'Edit Exam Date' : 'Set Your Exam Date'}
            </h3>
            <p className="text-xs text-muted-foreground">
              This powers your countdown & study schedule
            </p>
          </div>
        </div>
        {currentExamDate && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="exam-name" className="text-xs">Exam Name</Label>
          <Input
            id="exam-name"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder="e.g., Mathematics, Biology, ZIMSEC Accounts"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Exam Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm",
                  !examDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {examDate ? format(examDate, 'PPP') : 'Pick your exam date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={examDate}
                onSelect={setExamDate}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {examDate && daysUntil !== null && (
            <p className="text-xs text-muted-foreground">
              {daysUntil > 0 ? `${daysUntil} days from now` : 'Date is in the past'}
            </p>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-2 text-success"
          >
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Saved!</span>
          </motion.div>
        ) : (
          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button
              onClick={handleSave}
              disabled={!examName.trim() || !examDate || isSaving}
              className="w-full"
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Exam Date'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
