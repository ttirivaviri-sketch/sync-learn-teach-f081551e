import { GraduationCap, AlertTriangle, Lightbulb, Target, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentStruggle {
  topic: string;
  struggle: string;
  misconception: string;
  suggestedApproach: string;
}

interface TutorBriefingProps {
  struggles: StudentStruggle[];
  tutoringRecommended: boolean;
  tutoringReason: string | null;
  studentName?: string;
}

export function TutorBriefing({ struggles, tutoringRecommended, tutoringReason, studentName = 'Student' }: TutorBriefingProps) {
  if (!tutoringRecommended && struggles.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Tutoring Recommendation Banner */}
      {tutoringRecommended && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/30">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                Tutoring Recommended
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  AI SUGGESTION
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tutoringReason || 'Based on recent performance patterns, a tutoring session could help accelerate progress.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Student Struggles - Tutor Preparation Guide */}
      {struggles.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-accent" />
            <h3 className="font-bold text-foreground">Tutor Preparation Brief</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              FOR TUTORS
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            AI-identified areas where {studentName} needs guided support. Use this to prepare for your next lesson.
          </p>

          <div className="space-y-3">
            {struggles.map((s, i) => (
              <div key={`${s.topic}-${i}`} className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="text-sm font-semibold text-foreground">{s.topic}</h4>
                </div>
                
                <div className="pl-6 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Struggling with:</span> {s.struggle}
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Likely misconception:</span> {s.misconception}
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Lightbulb className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Suggested approach:</span> {s.suggestedApproach}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
