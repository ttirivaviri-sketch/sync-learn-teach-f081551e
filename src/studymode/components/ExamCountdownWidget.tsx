import { Calendar, Flame, Brain, Zap, Settings } from 'lucide-react';
import { ReadinessCheck } from '../types/study';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExamCountdownWidgetProps {
  examDate: Date;
  examName: string;
  readiness?: ReadinessCheck;
  onSettingsClick?: () => void;
}

export function ExamCountdownWidget({ examDate, examName, readiness, onSettingsClick }: ExamCountdownWidgetProps) {
   const now = new Date();
   const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
   
   // Calculate study intensity based on days remaining and readiness
   const getStudyIntensity = () => {
     // Base intensity on days remaining
     let baseIntensity: 'low' | 'moderate' | 'high' | 'intense' = 'moderate';
     if (daysRemaining <= 7) baseIntensity = 'intense';
     else if (daysRemaining <= 14) baseIntensity = 'high';
     else if (daysRemaining <= 30) baseIntensity = 'moderate';
     else baseIntensity = 'low';
 
     // Adjust based on readiness if available
     if (readiness) {
       const avgReadiness = (readiness.sleep + readiness.energy + readiness.mood) / 3;
       if (avgReadiness < 3 && baseIntensity !== 'low') {
         // Reduce intensity if readiness is low
         if (baseIntensity === 'intense') return 'high';
         if (baseIntensity === 'high') return 'moderate';
         return 'low';
       }
     }
     
     return baseIntensity;
   };
 
   const intensity = getStudyIntensity();
 
   const intensityConfig = {
     low: {
       label: 'Light Review',
       description: 'Focus on consolidation and confidence building',
       color: 'text-success',
       bgColor: 'bg-success/10',
       borderColor: 'border-success/30',
       sessions: '1-2 sessions',
       icon: Brain,
     },
     moderate: {
       label: 'Steady Progress',
       description: 'Balanced learning with regular practice',
       color: 'text-accent',
       bgColor: 'bg-accent/10',
       borderColor: 'border-accent/30',
       sessions: '2-3 sessions',
       icon: Brain,
     },
     high: {
       label: 'Focused Study',
       description: 'Prioritize weak areas with exam practice',
       color: 'text-warning',
       bgColor: 'bg-warning/10',
       borderColor: 'border-warning/30',
       sessions: '3-4 sessions',
       icon: Zap,
     },
     intense: {
       label: 'Exam Mode',
       description: 'Intensive revision and past paper practice',
       color: 'text-destructive',
       bgColor: 'bg-destructive/10',
       borderColor: 'border-destructive/30',
       sessions: '4-5 sessions',
       icon: Flame,
     },
   };
 
   const config = intensityConfig[intensity];
   const IntensityIcon = config.icon;
 
   const getUrgencyColor = () => {
     if (daysRemaining <= 7) return 'text-destructive';
     if (daysRemaining <= 14) return 'text-warning';
     if (daysRemaining <= 30) return 'text-accent';
     return 'text-success';
   };
 
   return (
     <div className={cn(
       "p-5 rounded-2xl border",
       config.bgColor,
       config.borderColor
     )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className={cn("h-5 w-5", getUrgencyColor())} />
            <span className="font-semibold text-foreground">Exam Countdown</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-background/50 text-muted-foreground">
              {examName}
            </span>
            {onSettingsClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onSettingsClick}
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
 
       {/* Days Counter */}
       <div className="text-center mb-4">
         <p className={cn("text-5xl font-bold", getUrgencyColor())}>
           {daysRemaining}
         </p>
         <p className="text-sm text-muted-foreground">days remaining</p>
       </div>
 
       {/* Intensity Recommendation */}
       <div className={cn(
         "p-3 rounded-xl bg-background/50 border",
         config.borderColor
       )}>
         <div className="flex items-center gap-2 mb-1">
           <IntensityIcon className={cn("h-4 w-4", config.color)} />
           <span className={cn("font-semibold text-sm", config.color)}>
             {config.label}
           </span>
           <span className="text-xs text-muted-foreground ml-auto">
             {config.sessions}/day
           </span>
         </div>
         <p className="text-xs text-muted-foreground">
           {config.description}
         </p>
       </div>
 
       {/* Readiness Modifier */}
       {readiness && (
         <div className="mt-3 pt-3 border-t border-border/50">
           <div className="flex items-center justify-between text-xs">
             <span className="text-muted-foreground">Today's readiness:</span>
             <div className="flex items-center gap-2">
               <span>😴 {readiness.sleep}</span>
               <span>⚡ {readiness.energy}</span>
               <span>😊 {readiness.mood}</span>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 }