/**
 * TutorProfileTab — Earnings overview, wallet, subject manager, profile settings.
 */
import { User as UserType } from "@supabase/supabase-js";
import {
  DollarSign, Clock, TrendingUp, BarChart3, Video, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "@/components/StarRating";
import TutorEarningsChart from "@/components/TutorEarningsChart";
import TutorProfile from "@/components/TutorProfile";
import { TutorSubjectManager } from "@/components/TutorSubjectManager";
import { TutorWalletPanel } from "@/components/TutorWalletPanel";

interface FormattedStats {
  weekEarnings: string;
  monthEarnings: string;
  totalEarnings: string;
  totalHours: number;
}

interface RecentEarning {
  id: string;
  student: string;
  subject: string;
  amount: number;
  date: string;
  rating?: number;
}

interface TutorProfileTabProps {
  tutorId: string;
  user?: UserType;
  formattedStats: FormattedStats;
  weeklyData: Array<{ name: string; amount: number }>;
  recentEarnings: RecentEarning[];
  statsLoading: boolean;
  mySubjects: unknown[];
  onNavigateTab: (tab: string) => void;
  onToast: (opts: { title: string; description: string }) => void;
}

export const TutorProfileTab = ({
  tutorId,
  user,
  formattedStats,
  weeklyData,
  recentEarnings,
  statsLoading,
  mySubjects,
  onNavigateTab,
  onToast,
}: TutorProfileTabProps) => (
  <div className="space-y-4">
    {/* Earnings Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "This Week", value: formattedStats.weekEarnings, Icon: TrendingUp, color: "text-primary" },
        { label: "This Month", value: formattedStats.monthEarnings, Icon: DollarSign, color: "text-green-600" },
        { label: "Total Earned", value: formattedStats.totalEarnings, Icon: BarChart3, color: "text-blue-600" },
        { label: "Total Hours", value: `${formattedStats.totalHours}h`, Icon: Clock, color: "text-purple-600" },
      ].map(({ label, value, Icon, color }) => (
        <Card key={label}>
          <CardContent className="p-4 text-center">
            {statsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <Icon className={`h-8 w-8 mx-auto mb-2 ${color}`} />
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>

    {weeklyData.length > 0 && <TutorEarningsChart data={weeklyData} />}

    {/* Recent Earnings */}
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold">Recent Earnings</h3>
        {statsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : recentEarnings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No completed sessions yet
          </p>
        ) : (
          recentEarnings.map((earning) => (
            <div key={earning.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <h4 className="font-medium">{earning.student}</h4>
                <p className="text-sm text-muted-foreground">{earning.subject}</p>
                {earning.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <StarRating rating={earning.rating} readonly size="sm" />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">R{earning.amount}</p>
                <p className="text-xs text-muted-foreground">{earning.date}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>

    {/* Wallet & Payouts */}
    <TutorWalletPanel tutorId={tutorId} />

    {/* Tax Report */}
    <Button
      variant="outline"
      className="w-full"
      size="lg"
      onClick={() => onToast({ title: "Tax Report", description: "Feature coming soon!" })}
    >
      <Download className="h-4 w-4 mr-2" />
      Download Tax Report
    </Button>

    {/* Creator shortcut */}
    <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10 border-emerald-200">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Earn More as a Creator</h4>
          <p className="text-xs text-muted-foreground">Upload tutorials · reach thousands of students</p>
        </div>
        <Button size="sm" onClick={() => onNavigateTab("tutorials")}>
          <Video className="h-3.5 w-3.5 mr-1" />
          My Tutorials
        </Button>
      </CardContent>
    </Card>

    <TutorSubjectManager subjects={mySubjects} />

    <TutorProfile user={user} />
  </div>
);
