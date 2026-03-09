import { Bell, BellRing, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { useNotifications, AppNotification } from '../hooks/useNotifications';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

function NotificationItem({ notification, onRead }: { notification: AppNotification; onRead: (id: string) => void }) {
  const typeStyles = {
    review_due: 'border-l-warning',
    session_upcoming: 'border-l-accent',
    session_starting: 'border-l-destructive',
  };

  return (
    <div
      className={cn(
        'p-3 border-l-4 rounded-r-lg cursor-pointer transition-colors',
        typeStyles[notification.type],
        notification.read ? 'bg-muted/30 opacity-60' : 'bg-card hover:bg-muted/50'
      )}
      onClick={() => onRead(notification.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm', notification.read ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.message}</p>
        </div>
        {!notification.read && (
          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-accent mt-1.5" />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
      </p>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, permissionGranted, requestPermission } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllAsRead} title="Mark all read">
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAll} title="Clear all">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {!permissionGranted && (
          <button
            onClick={requestPermission}
            className="w-full px-3 py-2 text-xs text-accent hover:bg-accent/10 transition-colors text-left border-b border-border"
          >
            🔔 Enable browser notifications for reminders outside the app
          </button>
        )}

        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">You'll be reminded about reviews & study sessions</p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
