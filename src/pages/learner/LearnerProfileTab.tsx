/**
 * LearnerProfileTab — Uber-style clean account screen.
 */
import { useState } from "react";
import {
  Clock, Star, GraduationCap, LogOut,
  ChevronRight, Wallet, CalendarCheck, Sparkles, FileText, Shield, Bell,
} from "lucide-react";

import { Session } from "@supabase/supabase-js";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { PaymentHistory } from "@/components/PaymentHistory";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HapticsToggle } from "@/components/HapticsToggle";
import { DataSaverToggle } from "@/components/DataSaverToggle";
import { ProgressReportButton } from "@/components/ProgressReportButton";
import { GuardianWorkspaceCard } from "@/components/learner/GuardianWorkspaceCard";
import { GuardianLinkCard } from "@/components/learner/GuardianLinkCard";
import { GuardianOverviewCard } from "@/components/learner/GuardianOverviewCard";
import { TutorWorkspaceLinkCard } from "@/components/school/TutorWorkspaceLinkCard";
import { SubscriptionFlow } from "@/components/subscription/SubscriptionFlow";
import type { BookingRequest } from "@/hooks/useRealtimeBookings";

interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  user_type?: string;
  study_level?: string;
  avatar_url?: string;
}

interface AcademicProfile {
  curriculum?: string | null;
  grade?: string | null;
  subjects?: string[] | null;
  exam_year?: number | null;
  study_level?: string | null;
  exam_board?: string | null;
  school_name?: string | null;
  target_grade?: string | null;
  learning_style?: string | null;
  exam_dates?: Array<{ subject: string; date: string }> | null;
  student_email?: string | null;
  guardian_email?: string | null;
  goals?: string | null;
}

interface LearnerProfileTabProps {
  session: Session | null;
  profile: UserProfile | null;
  academicProfile: AcademicProfile | null;
  bookings: BookingRequest[];
  onRefreshProfile: () => void;
  onShowAcademicSetup: () => void;
  onShowPaymentMethods: () => void;
  onShowAllPayments: () => void;
  onNavigateTab: (tab: string) => void;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
}

const STUDY_LEVEL_LABELS: Record<string, string> = {
  junior_primary: "Junior Primary",
  senior_primary: "Senior Primary",
  junior_high: "Junior High",
  senior_high: "Senior High",
  tertiary: "Tertiary",
};

/* ── Reusable sub-components ── */

const MenuRow = ({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center gap-3 py-3.5 border-b border-border/50 last:border-0 transition-colors active:bg-muted/40"
  >
    <span className={destructive ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
    <span className={`flex-1 text-left text-sm font-medium ${destructive ? "text-destructive" : "text-foreground"}`}>
      {label}
    </span>
    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
  </button>
);

export const LearnerProfileTab = ({
  session,
  profile,
  academicProfile,
  bookings,
  onRefreshProfile,
  onShowAcademicSetup,
  onShowPaymentMethods,
  onShowAllPayments,
  onNavigateTab,
  onSignOut,
  onNavigate,
}: LearnerProfileTabProps) => {
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const completedBookings = bookings.filter((b) => b.status === "completed");
  const upcomingBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "requested");
  const totalSpent = completedBookings.reduce((sum, b) => sum + Number(b.price), 0);

  const displayName = profile?.full_name || session?.user?.email?.split("@")[0] || "Learner";
  const studyLevel = STUDY_LEVEL_LABELS[profile?.study_level || ""] || null;

  return (
    <div className="px-5 pt-6 pb-28 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
          {studyLevel && (
            <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {studyLevel}
            </span>
          )}
          <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
            <span>{completedBookings.length} sessions</span>
            <span>{upcomingBookings.length} upcoming</span>
            <span>R{totalSpent.toLocaleString()} spent</span>
          </div>
        </div>
        <ProfilePhotoUpload
          userId={session?.user?.id || ""}
          currentAvatarUrl={profile?.avatar_url}
          fullName={profile?.full_name}
          size="md"
          onUploaded={onRefreshProfile}
        />
      </div>

      {/* ── Shortcut chips — spec p.12: Academic profile / Wallet / Bookings with live values ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={onShowAcademicSetup}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm shrink-0"
        >
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          Academic profile
        </button>
        <button
          onClick={onShowPaymentMethods}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm shrink-0"
        >
          <Wallet className="h-3.5 w-3.5 text-primary" />
          Wallet · R{totalSpent.toLocaleString()}
        </button>
        <button
          onClick={() => onNavigateTab("activity")}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm shrink-0"
        >
          <CalendarCheck className="h-3.5 w-3.5 text-primary" />
          Bookings · {bookings.length}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-3">
        "Academic profile" opens the same data as Study → Settings — curriculum, subjects, risk levels, and syllabus codes all live there, not duplicated here.
      </p>

      {/* ── Progress Report — purple gradient banner (spec p.12) ── */}
      {session?.user?.id && (
        <div
          className="rounded-2xl p-4 shadow-md"
          style={{ background: "linear-gradient(135deg, hsl(258 70% 56%), hsl(243 65% 58%))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">Progress report</h3>
              <p className="text-xs text-white/75 mt-0.5">
                PDF with charts, mock scores & an AI plan.
              </p>
            </div>
            <ProgressReportButton
              learnerId={session.user.id}
              tutors={[
                ...new Map(
                  upcomingBookings
                    .filter((b) => b.tutor_id && b.tutor_profile?.full_name)
                    .map((b) => [b.tutor_id, { id: b.tutor_id, name: b.tutor_profile!.full_name }])
                ).values(),
              ]}
            />
          </div>
        </div>
      )}

      {session?.user?.id && <GuardianOverviewCard userId={session.user.id} />}
      {session?.user?.id && <GuardianLinkCard userId={session.user.id} />}
      {session?.user?.id && <GuardianWorkspaceCard userId={session.user.id} />}
      <TutorWorkspaceLinkCard />

      {/* ── Preferences — spec p.12 ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preferences</p>
        <HapticsToggle userId={session?.user?.id} />
        <div className="rounded-2xl bg-card px-4 shadow-sm border border-border/40">
          <ThemeToggle />
        </div>
        <div className="rounded-2xl bg-card px-4 py-3 shadow-sm border border-border/40">
          <DataSaverToggle />
        </div>
      </div>

      {/* ── Account — spec p.12: only what's genuinely Profile-only ── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground -mb-4">Account</p>
      <div className="rounded-2xl bg-card px-4 shadow-sm border border-border/40">
        <MenuRow
          icon={<Sparkles className="h-4 w-4" />}
          label="Subscription & Plans"
          onClick={() => setShowPlans(!showPlans)}
        />
        {showPlans && (
          <div className="pb-4">
            <SubscriptionFlow mode="profile" />
          </div>
        )}
        <MenuRow
          icon={<Clock className="h-4 w-4" />}
          label="Payment History"
          onClick={() => setShowPaymentHistory(!showPaymentHistory)}
        />
        {showPaymentHistory && session?.user?.id && (
          <div className="pb-3">
            <PaymentHistory userId={session.user.id} limit={5} showViewAll onViewAll={onShowAllPayments} />
          </div>
        )}
        <MenuRow
          icon={<Star className="h-4 w-4" />}
          label="My Reviews"
          onClick={() => onNavigateTab("activity")}
        />
        {/* Syllabus & Paper Codes + Change Study Level collapsed into "Academic profile" (spec p.12) */}
        <MenuRow
          icon={<Bell className="h-4 w-4" />}
          label="Notifications"
          onClick={() => onNavigate("/settings/notifications")}
        />
        <MenuRow
          icon={<Shield className="h-4 w-4" />}
          label="Data & Compliance"
          onClick={() => onNavigate("/settings/data-compliance")}
        />
        <MenuRow
          icon={<FileText className="h-4 w-4" />}
          label="Terms of Use"
          onClick={() => onNavigate("/legal/terms")}
        />
        <MenuRow
          icon={<FileText className="h-4 w-4" />}
          label="Privacy Policy"
          onClick={() => onNavigate("/legal/privacy")}
        />
        <MenuRow
          icon={<LogOut className="h-4 w-4" />}
          label="Sign Out"
          onClick={onSignOut}
          destructive
        />

      </div>
    </div>
  );
};
