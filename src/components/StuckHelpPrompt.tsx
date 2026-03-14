import { AlertCircle, Video, BookOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StuckHelpPromptProps {
  topic?: string;
  subject?: string;
  failedAttempts?: number;
  variant?: "after-tutorial" | "after-quiz";
  onWatchMore?: () => void;
  onBookTutor?: () => void;
  onBrowseLibrary?: () => void;
}

/**
 * Non-intrusive help prompt shown:
 *   1. After a student watches a tutorial ("Still need help?")
 *   2. Inside StudyMode after repeated wrong answers ("You're struggling with X")
 */
export function StuckHelpPrompt({
  topic,
  subject,
  failedAttempts = 0,
  variant = "after-tutorial",
  onWatchMore,
  onBookTutor,
  onBrowseLibrary,
}: StuckHelpPromptProps) {
  if (variant === "after-quiz" && failedAttempts < 2) return null;

  const isQuiz = variant === "after-quiz";

  return (
    <Card className={`border-${isQuiz ? "amber" : "blue"}-200 bg-${isQuiz ? "amber" : "blue"}-50 dark:bg-${isQuiz ? "amber" : "blue"}-950/20`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
            isQuiz ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
          }`}>
            <AlertCircle className="h-4 w-4" />
          </div>

          <div className="flex-1">
            <h4 className={`font-semibold text-sm ${isQuiz ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"}`}>
              {isQuiz
                ? `You're struggling with ${topic || subject || "this topic"}.`
                : "Still need help?"}
            </h4>
            <p className={`text-xs mt-0.5 ${isQuiz ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`}>
              {isQuiz
                ? "Don't worry — live tutoring and video explanations can help."
                : "A live tutor can explain this in minutes."}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {onWatchMore && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onWatchMore}
                >
                  <Video className="h-3 w-3 mr-1" />
                  Watch Tutorials
                </Button>
              )}
              {onBrowseLibrary && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onBrowseLibrary}
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  More Explanations
                </Button>
              )}
              {onBookTutor && (
                <Button
                  size="sm"
                  className={`h-7 text-xs ${
                    isQuiz
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={onBookTutor}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Book a Tutor
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
