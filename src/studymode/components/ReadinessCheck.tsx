import { useState, useEffect } from 'react';
import { Moon, Battery, Smile, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ReadinessCheck as ReadinessCheckType } from '../types/study';

const READINESS_STORAGE_KEY = 'studymode_readiness_timestamp';
const READINESS_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

interface ReadinessCheckProps {
  onComplete: (readiness: ReadinessCheckType) => void;
}

export function ReadinessCheck({ onComplete }: ReadinessCheckProps) {
  const [readiness, setReadiness] = useState<ReadinessCheckType>({
    sleep: 3,
    energy: 3,
    mood: 3,
  });

  // Auto-skip if completed within cooldown period
  useEffect(() => {
    const lastCompleted = localStorage.getItem(READINESS_STORAGE_KEY);
    if (lastCompleted) {
      const elapsed = Date.now() - parseInt(lastCompleted, 10);
      if (elapsed < READINESS_COOLDOWN_MS) {
        // Auto-skip with default neutral readiness
        onComplete({ sleep: 3, energy: 3, mood: 3 });
      }
    }
  }, [onComplete]);

  const handleComplete = (data: ReadinessCheckType) => {
    localStorage.setItem(READINESS_STORAGE_KEY, Date.now().toString());
    onComplete(data);
  };

  const handleSkip = () => {
    handleComplete({ sleep: 3, energy: 3, mood: 3 });
  };

  const getEmoji = (value: number, type: 'sleep' | 'energy' | 'mood') => {
    const emojis = {
      sleep: ['😴', '😪', '😐', '😊', '🌟'],
      energy: ['🪫', '😓', '😐', '💪', '⚡'],
      mood: ['😢', '😕', '😐', '😊', '🎉'],
    };
    return emojis[type][value - 1];
  };

  const getLabel = (value: number) => {
    const labels = ['Very Low', 'Low', 'Okay', 'Good', 'Great'];
    return labels[value - 1];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-lg animate-scale-in">
        {/* Skip button */}
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground gap-1 text-xs"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </Button>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full gradient-accent text-3xl mb-4 shadow-glow">
            ✨
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">How are you feeling?</h2>
          <p className="text-muted-foreground">I'll adjust today's pace based on your readiness</p>
        </div>

        <div className="space-y-6">
          {/* Sleep */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-primary" />
                <span className="font-medium">Sleep Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getEmoji(readiness.sleep, 'sleep')}</span>
                <span className="text-sm text-muted-foreground w-16">{getLabel(readiness.sleep)}</span>
              </div>
            </div>
            <Slider
              value={[readiness.sleep]}
              onValueChange={([v]) => setReadiness(r => ({ ...r, sleep: v }))}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Energy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-accent" />
                <span className="font-medium">Energy Level</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getEmoji(readiness.energy, 'energy')}</span>
                <span className="text-sm text-muted-foreground w-16">{getLabel(readiness.energy)}</span>
              </div>
            </div>
            <Slider
              value={[readiness.energy]}
              onValueChange={([v]) => setReadiness(r => ({ ...r, energy: v }))}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>

          {/* Mood */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smile className="h-5 w-5 text-warning" />
                <span className="font-medium">Mood</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getEmoji(readiness.mood, 'mood')}</span>
                <span className="text-sm text-muted-foreground w-16">{getLabel(readiness.mood)}</span>
              </div>
            </div>
            <Slider
              value={[readiness.mood]}
              onValueChange={([v]) => setReadiness(r => ({ ...r, mood: v }))}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        <Button 
          onClick={() => handleComplete(readiness)} 
          className="w-full mt-6 h-12 text-base font-semibold gradient-primary hover:opacity-90 transition-opacity"
        >
          Let's Get Started
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}