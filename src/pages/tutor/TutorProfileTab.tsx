/**
 * TutorProfileTab — Uber-style clean account screen.
 */
import { useState } from "react";
import { User as UserType } from "@supabase/supabase-js";
import {
  DollarSign, Clock, ChevronRight, Download, Video,
  Wallet, BookOpen, TrendingUp, Settings, Users, Shield, FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import StarRating from "@/components/StarRating";
import TutorEarningsChart from "@/components/TutorEarningsChart";
import TutorProfile from "@/components/TutorProfile";
import { TutorSubjectManager } from "@/components/TutorSubjectManager";
import { TutorWalletPanel } from "@/components/TutorWalletPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  weeklyData: Array<{ name: string; earnings: number; sessions: number }>;
  recentEarnings: RecentEarning[];
  statsLoading: boolean;
  mySubjects: Array<{ id: string; subject: string; level: string; hourly_rate: number | null; [key: string]: unknown }>;
  onNavigateTab: (tab: string) => void;
  onToast: (opts: { title: string; description: string }) => void;
}

/* ── Reusable sub-components ── */

const ActionButton = ({
  icon,
  label,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted/60 p-4 transition-colors active:bg-muted"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm">
      {icon}
    </div>
    <span className="text-xs font-medium text-foreground">{label}</span>
    {subtitle && <span className="text-[10px] text-muted-foreground -mt-1">{subtitle}</span>}
  </button>
);

const MenuRow = ({
  icon,
  label,
  right,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center gap-3 py-3.5 border-b border-border/50 last:border-0 transition-colors active:bg-muted/40"
  >
    <span className="text-muted-foreground">{icon}</span>
    <span className="flex-1 text-left text-sm font-medium text-foreground">{label}</span>
    {right || <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
  </button>
);

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
}: TutorProfileTabProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);


  const handleDownloadTax = () => {
    if (recentEarnings.length === 0) {
      onToast({ title: "No Data", description: "No completed sessions to export." });
      return;
    }
    const header = "Date,Student,Subject,Amount (ZAR)\n";
    const rows = recentEarnings
      .map((e) => `${e.date},"${e.student}","${e.subject}",${e.amount}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studysync-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast({ title: "Downloaded!", description: "Your earnings report has been saved." });
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Tutor";

  return (
    <div className="px-5 pt-6 pb-28 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
          <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
            <span>{formattedStats.totalEarnings} earned</span>
            <span>{formattedStats.totalHours}h taught</span>
          </div>
        </div>
        <ProfilePhotoUpload
          userId={tutorId}
          currentAvatarUrl={user?.user_metadata?.avatar_url}
          fullName={displayName}
          size="md"
          onUploaded={() => {}}
        />
      </div>

      {/* ── 4-col Action Grid ── */}
      <div className="grid grid-cols-4 gap-3">
        <ActionButton
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          label="Earnings"
          subtitle={formattedStats.weekEarnings}
          onClick={() => toggle("earnings")}
        />
        <ActionButton
          icon={<Wallet className="h-5 w-5 text-primary" />}
          label="Wallet"
          onClick={() => toggle("wallet")}
        />
        <ActionButton
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          label="Subjects"
          subtitle={`${mySubjects.length}`}
          onClick={() => toggle("subjects")}
        />
        <ActionButton
          icon={<Video className="h-5 w-5 text-primary" />}
          label="Tutorials"
          onClick={() => onNavigateTab("tutorials")}
        />
      </div>

      {/* ── Expanded Sections ── */}
      {expanded === "earnings" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "This Week", value: formattedStats.weekEarnings },
              { label: "This Month", value: formattedStats.monthEarnings },
              { label: "Total Hours", value: `${formattedStats.totalHours}h` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {weeklyData.length > 0 && <TutorEarningsChart data={weeklyData} />}
          {recentEarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Sessions</h4>
              {recentEarnings.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium">{e.student}</p>
                    <p className="text-xs text-muted-foreground">{e.subject}</p>
                    {e.rating && <StarRating rating={e.rating} readonly size="sm" />}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">R{e.amount}</p>
                    <p className="text-[10px] text-muted-foreground">{e.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {expanded === "wallet" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <TutorWalletPanel tutorId={tutorId} />
        </div>
      )}

      {expanded === "subjects" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <TutorSubjectManager subjects={mySubjects} />
        </div>
      )}

      {/* ── Menu Rows ── */}
      <div className="rounded-2xl bg-card px-4 shadow-sm border border-border/40">
        <ThemeToggle />
        <MenuRow
          icon={<DollarSign className="h-4 w-4" />}
          label="Recent Earnings"
          onClick={() => toggle("earnings")}
        />
        <MenuRow
          icon={<Download className="h-4 w-4" />}
          label="Download Tax Report"
          onClick={handleDownloadTax}
        />
        <MenuRow
          icon={<Settings className="h-4 w-4" />}
          label="Edit Profile"
          onClick={() => toggle("profile")}
        />
        <MenuRow
          icon={<Users className="h-4 w-4" />}
          label="Earn More as Creator"
          onClick={() => onNavigateTab("tutorials")}
          right={
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              New
            </span>
          }
        />
        <MenuRow
          icon={<Shield className="h-4 w-4" />}
          label="Data & Compliance"
          onClick={() => navigate("/settings/data-compliance")}
        />
        <MenuRow
          icon={<FileText className="h-4 w-4" />}
          label="Terms of Use"
          onClick={() => navigate("/legal/terms")}
        />
        <MenuRow
          icon={<FileText className="h-4 w-4" />}
          label="Privacy Policy"
          onClick={() => navigate("/legal/privacy")}
        />

      </div>

      {expanded === "profile" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <TutorProfile user={user} />
        </div>
      )}
    </div>
  );
};
