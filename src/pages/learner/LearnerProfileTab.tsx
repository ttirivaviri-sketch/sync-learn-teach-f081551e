/**
 * LearnerProfileTab — User info, academic profile, payment history, quick actions.
 */
import { User, CreditCard, Clock, Star, GraduationCap, LogOut } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  junior_primary: "Junior Primary (Grades 1–4)",
  senior_primary: "Senior Primary (Grades 5–7)",
  junior_high: "Junior High (Grades 8–9)",
  senior_high: "Senior High (Grades 10–12)",
  tertiary: "College & University",
};

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
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const upcomingBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "requested");
  const totalSpent = completedBookings.reduce((sum, b) => sum + Number(b.price), 0);

  // Academic profile completeness
  const profileCompleteness = (() => {
    if (!academicProfile) return 0;
    const fields = [
      academicProfile.curriculum,
      academicProfile.grade,
      academicProfile.subjects && academicProfile.subjects.length > 0 ? "yes" : null,
      academicProfile.exam_year,
      academicProfile.study_level,
      academicProfile.school_name,
      academicProfile.target_grade,
      academicProfile.learning_style,
      academicProfile.exam_dates && academicProfile.exam_dates.length > 0 ? "yes" : null,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  })();

  return (
    <div className="space-y-4 p-4 mt-0">
      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <ProfilePhotoUpload
              userId={session?.user?.id || ""}
              currentAvatarUrl={profile?.avatar_url}
              fullName={profile?.full_name}
              size="md"
              onUploaded={onRefreshProfile}
            />
            <div>
              <h3 className="font-semibold">{profile?.full_name || session?.user?.email?.split("@")[0] || "Learner"}</h3>
              <p className="text-sm text-muted-foreground">
                {profile?.user_type === "learner" ? "Student" : "User"} • Johannesburg Central
              </p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Study Level: {STUDY_LEVEL_LABELS[profile?.study_level || ""] || "Not set"}
              </p>
            </div>
          </div>

          {/* Profile Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-lg font-semibold">{completedBookings.length}</p>
              <p className="text-xs text-muted-foreground">Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{upcomingBookings.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">R{totalSpent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Spent</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={onShowPaymentMethods}>
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => onNavigateTab("activity")}>
              <Clock className="h-4 w-4 mr-2" />
              Booking History
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => onNavigateTab("activity")}>
              <Star className="h-4 w-4 mr-2" />
              My Reviews
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Academic Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Academic Profile
            {academicProfile && (
              <Badge
                variant="outline"
                className={`ml-auto text-[10px] ${
                  profileCompleteness >= 80
                    ? "border-green-500/50 text-green-600"
                    : profileCompleteness >= 50
                      ? "border-yellow-500/50 text-yellow-600"
                      : "border-red-500/50 text-red-600"
                }`}
              >
                {profileCompleteness}% complete
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {academicProfile ? (
            <div className="space-y-3">
              {profile?.full_name && (
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{profile.full_name}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Curriculum</span>
                <span className="font-medium">{academicProfile.curriculum || "—"}</span>
                <span className="text-muted-foreground">Grade</span>
                <span className="font-medium">{academicProfile.grade || "—"}</span>
                {academicProfile.exam_year && (
                  <>
                    <span className="text-muted-foreground">Exam Year</span>
                    <span className="font-medium">{academicProfile.exam_year}</span>
                  </>
                )}
                {academicProfile.study_level && (
                  <>
                    <span className="text-muted-foreground">Study Level</span>
                    <span className="font-medium">{academicProfile.study_level}</span>
                  </>
                )}
                {academicProfile.exam_board && (
                  <>
                    <span className="text-muted-foreground">Exam Board</span>
                    <span className="font-medium">{academicProfile.exam_board}</span>
                  </>
                )}
                {academicProfile.school_name && (
                  <>
                    <span className="text-muted-foreground">School</span>
                    <span className="font-medium">{academicProfile.school_name}</span>
                  </>
                )}
                {academicProfile.target_grade && (
                  <>
                    <span className="text-muted-foreground">Target Grade</span>
                    <span className="font-medium">{academicProfile.target_grade}</span>
                  </>
                )}
                {academicProfile.learning_style && (
                  <>
                    <span className="text-muted-foreground">Learning Style</span>
                    <span className="font-medium">{academicProfile.learning_style}</span>
                  </>
                )}
                {session?.user?.email && (
                  <>
                    <span className="text-muted-foreground">Account Email</span>
                    <span className="font-medium truncate">{session.user.email}</span>
                  </>
                )}
              </div>

              {/* Subjects */}
              {academicProfile.subjects && academicProfile.subjects.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Subjects ({academicProfile.subjects.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {academicProfile.subjects.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Exam Dates */}
              {academicProfile.exam_dates && academicProfile.exam_dates.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Exam Dates</p>
                  <div className="space-y-1">
                    {academicProfile.exam_dates
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((ed) => {
                        const daysLeft = Math.ceil((new Date(ed.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={ed.subject} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{ed.subject}</span>
                            <span
                              className={`${daysLeft <= 14 ? "text-destructive font-bold" : daysLeft <= 30 ? "text-warning" : "text-muted-foreground"}`}
                            >
                              {new Date(ed.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                              {daysLeft > 0 ? ` (${daysLeft}d)` : daysLeft === 0 ? " (Today!)" : " (Passed)"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Private Contact Info */}
              {(academicProfile.student_email || academicProfile.guardian_email) && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <span>Contact Info</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      Private
                    </Badge>
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {academicProfile.student_email && (
                      <>
                        <span className="text-muted-foreground">Your Email</span>
                        <span className="font-medium truncate">{academicProfile.student_email}</span>
                      </>
                    )}
                    {academicProfile.guardian_email && (
                      <>
                        <span className="text-muted-foreground">Guardian Email</span>
                        <span className="font-medium truncate">{academicProfile.guardian_email}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {academicProfile.goals && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Goals</p>
                  <p className="text-sm">{academicProfile.goals}</p>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={onShowAcademicSetup}>
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground mb-3">Set your curriculum & subjects to personalise your library.</p>
              <Button size="sm" onClick={onShowAcademicSetup}>
                <GraduationCap className="h-4 w-4 mr-1" />
                Set Academic Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Syllabus & Paper Codes Manager */}
      {session?.user?.id && <SyllabusSetupGate userId={session.user.id} academicProfile={academicProfile} advisory />}

      {/* Payment History */}
      {session?.user?.id && <PaymentHistory userId={session.user.id} limit={5} showViewAll onViewAll={onShowAllPayments} />}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => onNavigateTab("home")}>
            Find New Tutor
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => onNavigateTab("library")}>
            Browse Study Materials
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => onNavigate("/learner/choose-level")}>
            Change Study Level
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
