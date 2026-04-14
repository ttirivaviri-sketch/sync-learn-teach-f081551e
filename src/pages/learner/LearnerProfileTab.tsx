/**
 * LearnerProfileTab — Uber-style clean account screen.
 */
import { useState } from "react";
import {
  User, CreditCard, Clock, Star, GraduationCap, LogOut,
  ChevronRight, BookOpen, Wallet, CalendarCheck, Sparkles, Settings, FileText,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { SyllabusSetupGate } from "@/components/SyllabusSetupGate";
import { PaymentHistory } from "@/components/PaymentHistory";
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

const ActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
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
  </button>
);

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
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

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

      {/* ── 2×2 Action Grid ── */}
      <div className="grid grid-cols-4 gap-3">
        <ActionButton
          icon={<GraduationCap className="h-5 w-5 text-primary" />}
          label="Academic"
          onClick={onShowAcademicSetup}
        />
        <ActionButton
          icon={<Wallet className="h-5 w-5 text-primary" />}
          label="Wallet"
          onClick={onShowPaymentMethods}
        />
        <ActionButton
          icon={<CalendarCheck className="h-5 w-5 text-primary" />}
          label="Bookings"
          onClick={() => onNavigateTab("activity")}
        />
        <ActionButton
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          label="Study Mode"
          onClick={() => onNavigateTab("library")}
        />
      </div>

      {/* ── Menu Rows ── */}
      <div className="rounded-2xl bg-card px-4 shadow-sm border border-border/40">
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
        <MenuRow
          icon={<FileText className="h-4 w-4" />}
          label="Syllabus & Paper Codes"
          onClick={() => setShowSyllabus(!showSyllabus)}
        />
        {showSyllabus && session?.user?.id && (
          <div className="pb-3">
            <SyllabusSetupGate userId={session.user.id} academicProfile={academicProfile as any} advisory />
          </div>
        )}
        <MenuRow
          icon={<Settings className="h-4 w-4" />}
          label="Change Study Level"
          onClick={() => onNavigate("/learner/choose-level")}
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
