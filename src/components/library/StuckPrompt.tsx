import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StuckPromptProps {
  onNeedHelp?: () => void;
  onEnterStudyMode: () => void;
}

export function StuckPrompt({ onNeedHelp, onEnterStudyMode }: StuckPromptProps) {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              Still need help?
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              A live tutor can explain this topic in minutes.
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                onClick={() => onNeedHelp?.()}
              >
                Book a Tutor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300"
                onClick={onEnterStudyMode}
              >
                Try Study Mode
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
