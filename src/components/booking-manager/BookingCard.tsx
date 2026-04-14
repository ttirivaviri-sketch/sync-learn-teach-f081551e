import { useState } from "react";
import { Calendar, Clock, CheckCircle, XCircle, RefreshCw, Video, MessageCircle, User, BookOpen, GraduationCap, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookingRequest } from "@/hooks/useRealtimeBookings";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { StudentInsightsPanel } from "@/components/StudentInsightsPanel";

interface AcademicProfileInfo {
  curriculum?: string | null;
  grade?: string | null;
  subjects?: string[] | null;
  exam_year?: number | null;
  school_name?: string | null;
  target_grade?: string | null;
}

interface BookingCardProps {
  booking: BookingRequest;
  showActions?: boolean;
  isProcessing: boolean;
  isSessionReady: boolean;
  isProfileExpanded: boolean;
  academicProfile?: AcademicProfileInfo;
  learnerSubjects?: string[];
  onAccept: () => void;
  onDecline: () => void;
  onReschedule: () => void;
  onJoinSession: () => void;
  onStartChat: () => void;
  onToggleProfile: () => void;
}

function getDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function getStatusColor(status: BookingRequest["status"]) {
  const colors = {
    requested: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    confirmed: "bg-green-500/10 text-green-600 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    canceled: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return colors[status];
}

const STUDY_LEVEL_LABELS: Record<string, string> = {
  junior_primary: "Junior Primary",
  senior_primary: "Senior Primary",
  junior_high: "Junior High",
  senior_high: "Senior High",
  tertiary: "Tertiary",
};

export function BookingCard({
  booking,
  showActions = true,
  isProcessing,
  isSessionReady,
  isProfileExpanded,
  academicProfile,
  learnerSubjects,
  onAccept,
  onDecline,
  onReschedule,
  onJoinSession,
  onStartChat,
  onToggleProfile,
}: BookingCardProps) {
  const hasProfile = academicProfile && (academicProfile.curriculum || academicProfile.grade || (academicProfile.subjects && academicProfile.subjects.length > 0));
  const hasSubjects = learnerSubjects && learnerSubjects.length > 0;

  return (
    <Card
      className={`transition-all ${
        booking.status === "requested" ? "ring-2 ring-primary/50 bg-primary/5" : ""
      } ${isSessionReady ? "ring-2 ring-green-500/50" : ""}`}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium">{booking.learner_profile?.full_name || "Student"}</h4>
              <p className="text-sm text-muted-foreground">{booking.learner_profile?.email}</p>
              {booking.learner_profile?.study_level && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <GraduationCap className="h-3 w-3" />
                  {STUDY_LEVEL_LABELS[booking.learner_profile.study_level] || booking.learner_profile.study_level}
                </p>
              )}
            </div>
          </div>
          <Badge className={getStatusColor(booking.status)}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Badge>
        </div>

        {/* Academic Profile Section */}
        {(hasProfile || hasSubjects) && (
          <div className="mb-3 rounded-lg border border-primary/15 bg-primary/5 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-2.5 text-left hover:bg-primary/10 transition-colors"
              onClick={onToggleProfile}
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Academic Profile</span>
                {academicProfile?.curriculum && (
                  <Badge variant="secondary" className="text-[10px] py-0 h-4">{academicProfile.curriculum}</Badge>
                )}
                {academicProfile?.grade && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{academicProfile.grade}</Badge>
                )}
              </div>
              {isProfileExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {isProfileExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-primary/10">
                {hasProfile && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
                    {academicProfile!.curriculum && (
                      <><span className="text-muted-foreground">Curriculum</span><span className="font-medium">{academicProfile!.curriculum}</span></>
                    )}
                    {academicProfile!.grade && (
                      <><span className="text-muted-foreground">Grade</span><span className="font-medium">{academicProfile!.grade}</span></>
                    )}
                    {academicProfile!.exam_year && (
                      <><span className="text-muted-foreground">Exam Year</span><span className="font-medium">{academicProfile!.exam_year}</span></>
                    )}
                    {academicProfile!.school_name && (
                      <><span className="text-muted-foreground">School</span><span className="font-medium">{academicProfile!.school_name}</span></>
                    )}
                    {academicProfile!.target_grade && (
                      <><span className="text-muted-foreground">Target Grade</span><span className="font-medium">{academicProfile!.target_grade}</span></>
                    )}
                  </div>
                )}
                {academicProfile?.subjects && academicProfile.subjects.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Registered Subjects</p>
                    <div className="flex flex-wrap gap-1">
                      {academicProfile.subjects.map((subj) => (
                        <Badge key={subj} variant="secondary" className="text-[10px] py-0 h-4">
                          <BookOpen className="h-2.5 w-2.5 mr-0.5" />{subj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {hasSubjects && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tutoring Subjects</p>
                    <div className="flex flex-wrap gap-1">
                      {learnerSubjects!.map((subj) => (
                        <Badge key={subj} variant="outline" className="text-[10px] py-0 h-4">
                          <BookOpen className="h-2.5 w-2.5 mr-0.5" />{subj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Session Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{getDateLabel(booking.scheduled_at)}</span>
            <span className="text-muted-foreground">{format(new Date(booking.scheduled_at), "h:mm a")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{booking.duration_minutes} minutes</span>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline">
              {booking.tutor_subjects?.subject} • {booking.tutor_subjects?.level}
            </Badge>
            <span className="font-semibold text-primary">R{booking.price}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex flex-wrap gap-2">
            {booking.status === "requested" && (
              <>
                <Button size="sm" onClick={onAccept} disabled={isProcessing} className="flex-1">
                  {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" />Accept</>}
                </Button>
                <Button size="sm" variant="outline" onClick={onReschedule} disabled={isProcessing}>
                  <RefreshCw className="h-4 w-4 mr-1" />Reschedule
                </Button>
                <Button size="sm" variant="destructive" onClick={onDecline} disabled={isProcessing}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <>
                {isSessionReady && (
                  <Button size="sm" onClick={onJoinSession} className="flex-1 bg-green-600 hover:bg-green-700">
                    <Video className="h-4 w-4 mr-1" />Join Now
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={onReschedule}>
                  <RefreshCw className="h-4 w-4 mr-1" />Reschedule
                </Button>
                <Button size="sm" variant="outline" onClick={onStartChat}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}

        {booking.status === "requested" && (
          <p className="text-xs text-muted-foreground mt-2">
            Requested {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
