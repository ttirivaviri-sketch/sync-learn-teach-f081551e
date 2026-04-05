/**
 * TutorWalletPanel — Real-time wallet balance, earnings, and payout history
 *
 * Uses the useTutorPayouts hook to display:
 *   - Wallet balance
 *   - Commission tier
 *   - Recent payouts with details
 *   - Payout trigger for completed sessions
 */
import { useState } from 'react';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Award,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTutorPayouts } from '@/hooks/useTutorPayouts';
import { COMMISSION_TIERS } from '@/sail/types/edgeFunctions';

interface TutorWalletPanelProps {
  tutorId: string;
}

const TIER_COLORS: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  verified: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

export function TutorWalletPanel({ tutorId }: TutorWalletPanelProps) {
  const {
    wallet,
    payouts,
    isProcessing,
    isLoading,
    error,
    processPayout,
    totalEarned,
    pendingBalance,
    commissionTier,
  } = useTutorPayouts(tutorId);

  const [pendingSessionId, setPendingSessionId] = useState('');

  const tierInfo = COMMISSION_TIERS[commissionTier as keyof typeof COMMISSION_TIERS] || COMMISSION_TIERS.standard;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading wallet...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Wallet Balance */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">My Wallet</CardTitle>
            </div>
            <Badge className={`text-[10px] ${TIER_COLORS[commissionTier] || TIER_COLORS.standard}`}>
              <Award className="h-2.5 w-2.5 mr-0.5" />
              {tierInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/60 dark:bg-white/5">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-xl font-bold text-emerald-700">
                R{pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/60 dark:bg-white/5">
              <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
              <p className="text-xl font-bold text-foreground">
                R{totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Commission rate info */}
          <div className="mt-3 p-2 rounded bg-emerald-100/50 dark:bg-emerald-900/20">
            <p className="text-[11px] text-emerald-700">
              Your commission rate: <strong>{(tierInfo.rate * 100).toFixed(0)}%</strong>
              {commissionTier !== 'enterprise' && (
                <span className="ml-1 text-emerald-600">
                  (Complete more sessions to unlock lower rates)
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Recent Payouts */}
      {payouts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Recent Payouts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payouts.slice(0, 10).map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        Session payout
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(payout.processed_at).toLocaleDateString()} &bull;{' '}
                        <span className="capitalize">{payout.commission_tier}</span> tier
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-green-600">
                      +R{payout.net_payout.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      of R{payout.gross_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {payouts.length === 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">No Payouts Yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Complete tutoring sessions to start earning. Your payouts will appear here automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
