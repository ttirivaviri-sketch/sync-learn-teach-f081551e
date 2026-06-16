/**
 * PhotoAnswerButton
 *
 * A drop-in button to add next to any answer Textarea. Opens the existing
 * PhotoSolvePanel in a bottom Sheet. When the AI returns a graded result,
 * the parent receives both a plain-text answer (final answer + working
 * summary) and the raw PhotoSolveResult so it can pre-fill its own
 * answer field.
 */

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PhotoSolvePanel, type PhotoSolveResult } from './PhotoSolvePanel';
import type { Subject, Topic } from '../types/study';
import { cn } from '@/lib/utils';

interface PhotoAnswerButtonProps {
  question?: string;
  subject?: Subject;
  topic?: Topic;
  totalMarks?: number;
  curriculum?: string | null;
  /** Receives the formatted text answer (drop into the Textarea) + raw grading. */
  onAnswer: (text: string, result: PhotoSolveResult) => void;
  className?: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'secondary';
  label?: string;
}

/** Turn a grading result into a clean answer string for a free-text field. */
export function photoResultToAnswerText(result: PhotoSolveResult): string {
  const lines: string[] = [];
  if (result.steps.length > 0) {
    lines.push('Working:');
    result.steps.forEach((s, i) => {
      if (s.student_step) lines.push(`${i + 1}. ${s.student_step}`);
    });
  }
  if (result.final_answer) {
    if (lines.length) lines.push('');
    lines.push(`Answer: ${result.final_answer}`);
  }
  return lines.join('\n').trim() || result.question_detected || '';
}

export function PhotoAnswerButton({
  question,
  subject,
  topic,
  totalMarks,
  curriculum,
  onAnswer,
  className,
  size = 'sm',
  variant = 'outline',
  label = 'Solve with photo',
}: PhotoAnswerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
        className={cn('gap-1.5', className)}
      >
        <Camera className="h-4 w-4" />
        {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto p-4">
          <PhotoSolvePanel
            subject={subject}
            topic={topic}
            question={question}
            totalMarks={totalMarks}
            curriculum={curriculum}
            onBack={() => setOpen(false)}
            onResult={(r) => onAnswer(photoResultToAnswerText(r), r)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
