import { Trophy, Flame, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLeaderboard, type LeaderboardRow } from '../hooks/useLeaderboard';

interface LeaderboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curriculum: string | null | undefined;
  /** Pass for per-subject board. Omit for global. */
  subject?: string;
  title?: string;
}

function rankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Row({ row, highlight }: { row: { rank: number; full_name: string; avatar_url: string | null; xp: number; streak: number; user_id?: string }; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        highlight
          ? 'bg-accent/15 border-accent/40'
          : 'bg-card border-border hover:bg-muted/50'
      )}
    >
      <div className="w-9 text-center font-bold text-sm text-foreground shrink-0">
        {rankBadge(row.rank)}
      </div>
      <Avatar className="h-9 w-9 shrink-0">
        {row.avatar_url && <AvatarImage src={row.avatar_url} alt={row.full_name} />}
        <AvatarFallback className="text-xs">{initials(row.full_name || 'S')}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{row.full_name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Flame className="h-3 w-3 text-orange-500" />
            {row.streak}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground">{row.xp.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">XP</p>
      </div>
    </div>
  );
}

export function Leaderboard({ open, onOpenChange, curriculum, subject, title }: LeaderboardProps) {
  const { data, isLoading } = useLeaderboard(curriculum, subject);

  const top: LeaderboardRow[] = data?.top ?? [];
  const me = data?.me ?? null;
  const meInTop = me && top.some((r) => r.user_id === (me as any).user_id || r.rank === me.rank);
  const heading = title || (subject ? `${subject} Leaderboard` : 'Global Leaderboard');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            {heading}
          </SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[10px]">
              {curriculum || 'ZIMSEC'}
            </Badge>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.total_participants} student{data.total_participants === 1 ? '' : 's'} competing
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : top.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No XP yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete a task to be the first on the board!
              </p>
            </div>
          ) : (
            <>
              {top.map((row) => (
                <Row
                  key={row.user_id + row.rank}
                  row={row}
                  highlight={!!me && row.user_id === (me as any).user_id}
                />
              ))}
            </>
          )}
        </div>

        {me && !meInTop && (
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
              Your position
            </p>
            <Row row={{ ...me, user_id: 'me' }} highlight />
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              #{me.rank} of {me.total_participants}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
