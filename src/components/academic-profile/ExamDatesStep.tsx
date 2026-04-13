import { Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format } from "date-fns";

interface ExamDatesStepProps {
  subjects: string[];
  examDates: Record<string, Date>;
  onSetDate: (subject: string, date: Date) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ExamDatesStep({ subjects, examDates, onSetDate, onBack, onNext }: ExamDatesStepProps) {
  const setDates = Object.entries(examDates).filter(([s]) => subjects.includes(s));

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Set Exam Dates</h2>
      <p className="text-xs text-muted-foreground">
        Set a date for each subject. This powers countdowns, calendar highlights, and study prioritisation.
      </p>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {subjects.map((subject) => (
          <div key={subject} className="p-3 rounded-xl border border-border">
            <Label className="font-medium text-sm text-foreground mb-2 block">{subject}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {examDates[subject] ? format(examDates[subject], "PPP") : "Select exam date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarWidget
                  mode="single"
                  selected={examDates[subject]}
                  onSelect={(date) => date && onSetDate(subject, date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {examDates[subject] && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil((examDates[subject].getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days away
              </p>
            )}
          </div>
        ))}
      </div>

      {setDates.length > 0 && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs font-medium text-foreground mb-1.5">Exam dates set:</p>
          <div className="flex flex-wrap gap-1.5">
            {setDates
              .sort(([, a], [, b]) => a.getTime() - b.getTime())
              .map(([subject, date]) => (
                <Badge key={subject} variant="outline" className="text-xs">
                  {subject}: {format(date, "dd MMM yyyy")}
                </Badge>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button className="flex-1" onClick={onNext}>
          Next: Review
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
