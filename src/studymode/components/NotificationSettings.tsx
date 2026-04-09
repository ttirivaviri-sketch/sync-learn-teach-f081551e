import { useState, useEffect } from 'react';
import { Bell, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '../../integrations/supabase/client';

interface NotificationPrefs {
  reviewReminders: boolean;
  sessionReminders: boolean;
  streakReminders: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  reminderFrequency: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  reviewReminders: true,
  sessionReminders: true,
  streakReminders: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  reminderFrequency: 15,
};

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage (fallback until DB table exists)
  useEffect(() => {
    const stored = localStorage.getItem('notification-prefs');
    if (stored) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {
        // Use defaults
      }
    }

    // Also try DB
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setPrefs({
            reviewReminders: data.review_reminders ?? true,
            sessionReminders: data.session_reminders ?? true,
            streakReminders: data.streak_reminders ?? true,
            quietHoursStart: data.quiet_hours_start ?? '22:00',
            quietHoursEnd: data.quiet_hours_end ?? '07:00',
            reminderFrequency: data.reminder_frequency_minutes ?? 15,
          });
        }
      } catch {
        // Table might not exist yet
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);

    // Always save to localStorage
    localStorage.setItem('notification-prefs', JSON.stringify(prefs));

    // Try to save to DB
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            review_reminders: prefs.reviewReminders,
            session_reminders: prefs.sessionReminders,
            streak_reminders: prefs.streakReminders,
            quiet_hours_start: prefs.quietHoursStart,
            quiet_hours_end: prefs.quietHoursEnd,
            reminder_frequency_minutes: prefs.reminderFrequency,
          }, { onConflict: 'user_id' });
      }
    } catch {
      // DB table might not exist yet — localStorage is the fallback
    }

    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
          <Bell className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground">Control when and how you receive reminders</p>
        </div>
      </div>

      {saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-success" />
          <p className="text-sm text-success">Preferences saved!</p>
        </div>
      )}

      {/* Reminder Types */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Reminder Types</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <Label>Review Reminders</Label>
            <p className="text-xs text-muted-foreground">When spaced repetition topics are due</p>
          </div>
          <Switch
            checked={prefs.reviewReminders}
            onCheckedChange={(v) => setPrefs(p => ({ ...p, reviewReminders: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Session Reminders</Label>
            <p className="text-xs text-muted-foreground">Before scheduled study sessions</p>
          </div>
          <Switch
            checked={prefs.sessionReminders}
            onCheckedChange={(v) => setPrefs(p => ({ ...p, sessionReminders: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Streak Reminders</Label>
            <p className="text-xs text-muted-foreground">Don't lose your streak!</p>
          </div>
          <Switch
            checked={prefs.streakReminders}
            onCheckedChange={(v) => setPrefs(p => ({ ...p, streakReminders: v }))}
          />
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Quiet Hours
        </h3>
        <p className="text-xs text-muted-foreground">No notifications during these hours</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Select value={prefs.quietHoursStart} onValueChange={(v) => setPrefs(p => ({ ...p, quietHoursStart: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const time = `${String(i).padStart(2, '0')}:00`;
                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Select value={prefs.quietHoursEnd} onValueChange={(v) => setPrefs(p => ({ ...p, quietHoursEnd: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const time = `${String(i).padStart(2, '0')}:00`;
                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <Label>Check Frequency</Label>
        <Select
          value={prefs.reminderFrequency.toString()}
          onValueChange={(v) => setPrefs(p => ({ ...p, reminderFrequency: parseInt(v) }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Every 5 minutes</SelectItem>
            <SelectItem value="15">Every 15 minutes</SelectItem>
            <SelectItem value="30">Every 30 minutes</SelectItem>
            <SelectItem value="60">Every hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full gradient-primary">
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </>
        )}
      </Button>
    </div>
  );
}
