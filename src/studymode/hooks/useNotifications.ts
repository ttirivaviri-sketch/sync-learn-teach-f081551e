import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from './use-toast';

export interface AppNotification {
  id: string;
  type: 'review_due' | 'session_upcoming' | 'session_starting';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

function requestBrowserPermission(): Promise<boolean> {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then(p => p === 'granted');
}

function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { toast } = useToast();
  const checkedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => {
      // Deduplicate by type + title within last 5 minutes
      const isDupe = prev.some(
        p => p.type === newNotif.type && p.title === newNotif.title &&
          (newNotif.timestamp.getTime() - p.timestamp.getTime()) < 5 * 60 * 1000
      );
      if (isDupe) return prev;
      return [newNotif, ...prev].slice(0, 50);
    });

    // In-app toast
    toast({ title: notif.title, description: notif.message });

    // Browser push
    sendBrowserNotification(notif.title, notif.message);
  }, [toast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Request browser permission on mount
  useEffect(() => {
    requestBrowserPermission().then(setPermissionGranted);
  }, []);

  // Check for due reviews and upcoming sessions
  const checkForReminders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check due spaced repetition reviews
    try {
      const { data: dueReviews } = await supabase
        .from('quiz_attempts' as any)
        .select('command_word')
        .eq('user_id', user.id)
        .lte('next_review_date', today);

      if (dueReviews && dueReviews.length > 0) {
        const uniqueTopics = [...new Set((dueReviews as any[]).map(r => r.command_word || 'Review'))];
        addNotification({
          type: 'review_due',
          title: `${uniqueTopics.length} topic${uniqueTopics.length > 1 ? 's' : ''} due for review`,
          message: uniqueTopics.slice(0, 3).join(', ') + (uniqueTopics.length > 3 ? ` +${uniqueTopics.length - 3} more` : ''),
        });
      }
    } catch (e) {
      // silent
    }

    // Check upcoming study sessions (within next 30 minutes)
    try {
      const { data: sessions } = await supabase
        .from('study_schedule')
        .select('topic_name, scheduled_date, duration_minutes')
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
        .eq('is_completed', false);

      if (sessions && sessions.length > 0) {
        // Since we only have date (no time), notify about today's incomplete sessions
        addNotification({
          type: 'session_upcoming',
          title: `${sessions.length} study session${sessions.length > 1 ? 's' : ''} today`,
          message: sessions.slice(0, 2).map(s => s.topic_name).join(', '),
        });
      }
    } catch (e) {
      // silent
    }
  }, [addNotification]);

  // Run check on mount and every 15 minutes
  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      // Delay initial check by 3 seconds to let app load
      const timeout = setTimeout(checkForReminders, 3000);
      intervalRef.current = setInterval(checkForReminders, 15 * 60 * 1000);
      return () => {
        clearTimeout(timeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [checkForReminders]);

  return {
    notifications,
    unreadCount,
    permissionGranted,
    markAsRead,
    markAllAsRead,
    clearAll,
    requestPermission: () => requestBrowserPermission().then(setPermissionGranted),
  };
}
