import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Target, Sparkles } from 'lucide-react';
import { FocusScoreLine } from './FocusBadge';
import type { IntegritySummary } from '../lib/integrity';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  topic: string;
  sessionXP: number;
  attempted: number;
  correct: number;
  focusSummary?: IntegritySummary | null;
  onClose: () => void;
}

export function TopicSessionSummary({ open, onOpenChange, subject, topic, sessionXP, attempted, correct, focusSummary, onClose }: Props) {
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
            Session complete
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{subject}</p>
            <p className="text-base font-semibold">{topic}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Trophy className="h-4 w-4 text-accent-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">XP</p>
                <p className="text-lg font-bold">+{sessionXP}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p className="text-lg font-bold">{accuracy}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mt-3">Answered</p>
                <p className="text-lg font-bold">{correct}/{attempted}</p>
              </CardContent>
            </Card>
          </div>

          {focusSummary && focusSummary.questionsTotal > 0 && (
            <FocusScoreLine summary={focusSummary} className="text-center px-2" />
          )}

          <p className="text-xs text-muted-foreground text-center px-2">
            This session is independent of your StudyMode progression. Your XP has been added to the leaderboards.
          </p>

          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
