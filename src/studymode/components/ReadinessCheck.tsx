import { useState } from 'react';
import { Moon, Battery, Smile, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ReadinessCheck as ReadinessCheckType } from '../types/study';

interface ReadinessCheckProps {
  onComplete: (readiness: ReadinessCheckType) => void;
}

export function ReadinessCheck({ onComplete }: ReadinessCheckProps) {
  const [readiness, setReadiness] = useState<ReadinessCheckType>({
    sleep: 3,
    energy: 3,
    mood: 3,
  });

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
          onClick={() => onComplete(readiness)} 
          className="w-full mt-6 h-12 text-base font-semibold gradient-primary hover:opacity-90 transition-opacity"
        >
          Let's Get Started
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
