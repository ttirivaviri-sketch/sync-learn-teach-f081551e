import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, MessageSquare, BookOpen, Target, ChevronUp, Sparkles, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';

interface TutorAssignment {
  id: string;
  subject: string;
  topic: string;
  focus_area: string | null;
  difficulty_override: string | null;
  notes: string | null;
  due_date: string | null;
}

interface StudyModeWidgetProps {
  onOpenStudyMode: () => void;
  onOpenChat?: (subject?: string, topic?: string) => void;
}

export function StudyModeWidget({ onOpenStudyMode, onOpenChat }: StudyModeWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [assignments, setAssignments] = useState<TutorAssignment[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  // Fetch tutor assignments directly from Supabase
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Query tutor assignments table directly (no edge function needed)
        const { data, error } = await supabase
          .from('tutor_assignments')
          .select('id, subject, topic, focus_area, difficulty_override, notes, due_date')
          .eq('learner_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && Array.isArray(data)) {
          setAssignments(data as unknown as TutorAssignment[]);
        }
      } catch {
        // Silent fail - assignments are optional
      }
    };

    fetchAssignments();

    // Subscribe to realtime assignment changes
    const channel = supabase
      .channel('widget-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutor_assignments' }, () => {
        fetchAssignments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const startSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { onOpenStudyMode(); return; }

      // Track session start directly in Supabase (no edge function needed)
      const { data } = await supabase
        .from('study_sessions')
        .insert({ user_id: session.user.id, started_at: new Date().toISOString() })
        .select('id')
        .single();

      if (data?.id) {
        setSessionId(data.id);
        setSessionActive(true);
      }
    } catch {
      // Continue without session tracking
    }
    onOpenStudyMode();
  }, [onOpenStudyMode]);

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      >
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-16 right-0 w-72 mb-2"
            >
              <div className="rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-primary/15 to-accent/15 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">STUDYMODE</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsExpanded(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="p-3 space-y-2">
                  <Button
                    className="w-full justify-start gap-2 h-9 text-xs gradient-primary"
                    onClick={startSession}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Launch STUDYMODE
                  </Button>

                  {onOpenChat && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 h-9 text-xs"
                      onClick={() => { onOpenChat(); setIsExpanded(false); }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      AI Tutor Chat
                    </Button>
                  )}

                  {/* Tutor Assignments */}
                  {assignments.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <GraduationCap className="h-3 w-3 text-accent" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Tutor Focus Areas
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {assignments.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            className="w-full text-left p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            onClick={() => {
                              onOpenChat?.(a.subject, a.topic);
                              setIsExpanded(false);
                            }}
                          >
                            <p className="text-xs font-medium text-foreground truncate">{a.topic}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {a.subject} {a.focus_area ? `• ${a.focus_area}` : ''}
                            </p>
                          </button>
                        ))}
                        {assignments.length > 3 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{assignments.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Session indicator */}
                {sessionActive && (
                  <div className="px-3 py-2 bg-success/10 border-t border-success/20">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-[10px] text-success font-medium">Session active</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
            "bg-gradient-to-br from-primary to-accent text-primary-foreground",
            isExpanded && "ring-2 ring-primary/30"
          )}
        >
          {isExpanded ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <Brain className="h-6 w-6" />
          )}
          {/* Notification dot for assignments */}
          {assignments.length > 0 && !isExpanded && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {assignments.length}
            </span>
          )}
        </motion.button>
      </motion.div>
    </>
  );
}
