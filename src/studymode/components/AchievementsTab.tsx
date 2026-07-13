import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProgress } from '../hooks/useUserProgress';
import { useBadgeEarning } from '../hooks/useBadgeEarning';
import { Skeleton } from '@/components/ui/skeleton';

// Level boundary: every 100 XP = 1 level (matches useUserProgress).
const XP_PER_LEVEL = 100;

// Vivid circular badge backgrounds, cycling through the mockup palette (p.9).
const BADGE_COLORS = [
  'bg-orange-500',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-sky-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-rose-500',
  'bg-teal-600',
];

const EARNED_PREVIEW = 8;

interface NextUpItem {
  id: string;
  name: string;
  detail: string;
  percent: number;
  icon: string;
  color: string;
}

export function AchievementsTab() {
  const { progress, isLoading } = useUserProgress();
  const { allBadges, earnedBadges } = useBadgeEarning();

  const xp = progress?.xp ?? 0;
  const streak = progress?.streak ?? 0;
  const level = Math.floor(xp / XP_PER_LEVEL);
  const xpIntoLevel = xp - level * XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL - xpIntoLevel;
  const levelPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);

  const earnedIds = useMemo(() => new Set(earnedBadges.map(b => b.id)), [earnedBadges]);

  // "Next up" — in-progress badges with a computable completion percentage.
  const nextUp = useMemo<NextUpItem[]>(() => {
    const items: NextUpItem[] = [];
    const streakTargets: Array<[string, number]> = [['streak-3', 3], ['streak-7', 7], ['streak-30', 30]];
    const xpTargets: Array<[string, number]> = [['xp-100', 100], ['xp-500', 500], ['xp-1000', 1000]];

    for (const [id, target] of streakTargets) {
      if (earnedIds.has(id)) continue;
      const badge = allBadges.find(b => b.id === id);
      if (!badge) continue;
      items.push({
        id,
        name: badge.name,
        detail: `${Math.min(streak, target)} of ${target} days`,
        percent: Math.min(100, Math.round((streak / target) * 100)),
        icon: badge.icon,
        color: BADGE_COLORS[allBadges.findIndex(b => b.id === id) % BADGE_COLORS.length],
      });
      break; // only the nearest streak badge
    }
    for (const [id, target] of xpTargets) {
      if (earnedIds.has(id)) continue;
      const badge = allBadges.find(b => b.id === id);
      if (!badge) continue;
      items.push({
        id,
        name: badge.name,
        detail: `${Math.min(xp, target)} of ${target} XP`,
        percent: Math.min(100, Math.round((xp / target) * 100)),
        icon: badge.icon,
        color: BADGE_COLORS[allBadges.findIndex(b => b.id === id) % BADGE_COLORS.length],
      });
      break; // only the nearest XP badge
    }
    return items;
  }, [earnedIds, allBadges, streak, xp]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  // Earned first, then locked; cap the grid like the mockup ("+N more" tile).
  const orderedBadges = [...allBadges].sort((a, b) => {
    const ae = earnedIds.has(a.id) ? 0 : 1;
    const be = earnedIds.has(b.id) ? 0 : 1;
    return ae - be;
  });
  const visibleBadges = orderedBadges.slice(0, EARNED_PREVIEW);
  const overflowCount = orderedBadges.length - EARNED_PREVIEW;

  // Ring geometry for the level ring (amber on gradient, per mockup)
  const ringSize = 56;
  const ringStroke = 5;
  const r = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="space-y-5">
      {/* Level / XP gradient header card with completion ring */}
      <div
        className="rounded-2xl p-5 text-white shadow-md flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))' }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Level {level}</p>
          <p className="text-3xl font-extrabold leading-tight">{xp} XP</p>
          <p className="text-xs text-white/70 mt-0.5">{xpToNext} XP to level {level + 1}</p>
        </div>
        <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={ringStroke}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              fill="none" stroke="#fbbf24" strokeWidth={ringStroke} strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - levelPct / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {levelPct}%
          </span>
        </div>
      </div>

      {/* Badges earned grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Badges earned</h2>
          <span className="text-xs text-muted-foreground">{earnedBadges.length} of {allBadges.length}</span>
        </div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {visibleBadges.map((badge, i) => {
            const earned = earnedIds.has(badge.id);
            return (
              <div key={badge.id} className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-sm',
                    earned
                      ? BADGE_COLORS[allBadges.findIndex(b => b.id === badge.id) % BADGE_COLORS.length]
                      : 'bg-muted'
                  )}
                >
                  {earned ? (
                    <span aria-hidden>{badge.icon}</span>
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className={cn('text-[10px] font-medium leading-tight', earned ? 'text-foreground' : 'text-muted-foreground')}>
                  {badge.name}
                </span>
              </div>
            );
          })}
          {overflowCount > 0 && (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">+{overflowCount} more</span>
            </div>
          )}
        </div>
      </div>

      {/* Next up — in-progress badges with completion percentage */}
      {nextUp.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">Next up</h2>
          <div className="space-y-2.5">
            {nextUp.map(item => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-base shrink-0 opacity-80', item.color)}>
                    <span aria-hidden>{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className={cn(
                    'text-sm font-bold shrink-0',
                    item.percent > 70 ? 'text-emerald-600' : item.percent >= 30 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {item.percent}%
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      item.percent > 70 ? 'bg-emerald-500' : item.percent >= 30 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
