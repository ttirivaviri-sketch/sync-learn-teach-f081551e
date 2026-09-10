/**
 * TutorPublicProfile — student-facing tutor profile page (/tutors/:tutorId).
 * Shows subjects & rates, bio, qualifications/experience, curriculum coverage
 * and individual reviews. Book/Chat actions hand back to the learner app via
 * navigation state so the existing booking/chat flows open preselected.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, Video, MessageCircle, Award, Sparkles, BookOpen, GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "@/components/StarRating";
import { OnlineStatus } from "@/components/OnlineStatus";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";

interface TutorReview {
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_first_name: string;
}

interface TutorData {
  id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  online_status: boolean;
  last_seen: string | null;
  subjects: { id: string; subject: string; level: string; hourly_rate: number | null }[];
  qualifications: { id: string; qualification_type: string; institution: string; year_obtained?: number | null }[];
  curriculums: string[];
  grades: string[];
  rating: number;
  totalReviews: number;
}

const TutorPublicProfile = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tutor, setTutor] = useState<TutorData | null>(null);
  const [reviews, setReviews] = useState<TutorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Authenticated app page — keep out of search indexes.
  useEffect(() => {
    document.title = tutor?.full_name ? `${tutor.full_name} — Tutor | StudySync` : "Tutor Profile | StudySync";
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex";
    return () => { robots && (robots.content = "index,follow"); };
  }, [tutor?.full_name]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      navigate("/learner/auth", { replace: true });
      return;
    }
    if (!tutorId) { setNotFound(true); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const [dirRes, subjectsRes, qualsRes, ratingsRes, teachingRes, reviewsRes] = await Promise.all([
          supabase.rpc("get_tutor_directory"),
          supabase.from("tutor_subjects").select("id, subject, level, hourly_rate").eq("user_id", tutorId),
          supabase.rpc("get_public_qualifications"),
          supabase.rpc("get_tutor_ratings"),
          supabase.from("tutor_teaching_profile").select("curriculums, grades").eq("user_id", tutorId).maybeSingle(),
          supabase.rpc("get_tutor_reviews", { _tutor_id: tutorId }),
        ]);
        if (cancelled) return;

        const dirEntry = ((dirRes.data || []) as any[]).find((t: any) => t.id === tutorId);
        if (!dirEntry) { setNotFound(true); return; }

        const ratings = ((ratingsRes.data || []) as any[]).filter((r: any) => r.reviewed_id === tutorId);
        const totalReviews = ratings.length;
        const rating = totalReviews
          ? Math.round((ratings.reduce((a: number, r: any) => a + r.rating, 0) / totalReviews) * 10) / 10
          : 0;

        setTutor({
          id: dirEntry.id,
          full_name: dirEntry.full_name || "StudySync Tutor",
          bio: dirEntry.bio,
          avatar_url: dirEntry.avatar_url,
          online_status: dirEntry.online_status || false,
          last_seen: dirEntry.last_seen,
          subjects: subjectsRes.data || [],
          qualifications: ((qualsRes.data || []) as any[]).filter((q: any) => q.user_id === tutorId),
          curriculums: teachingRes.data?.curriculums || [],
          grades: teachingRes.data?.grades || [],
          rating,
          totalReviews,
        });
        setReviews((reviewsRes.data as TutorReview[]) || []);
      } catch (err) {
        logger.error("Failed to load tutor profile:", err);
        if (!cancelled) {
          toast({ title: "Couldn't load profile", description: "Please try again.", variant: "destructive" });
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tutorId, authLoading, session?.user?.id]);

  const goToLearner = (state: Record<string, unknown>) =>
    navigate("/learner", { state });

  const handleBook = () => {
    if (!tutor) return;
    goToLearner({ bookTutorId: tutor.id, bookTutorName: tutor.full_name });
  };

  const handleChat = () => {
    if (!tutor) return;
    goToLearner({ chatWithId: tutor.id, chatWithName: tutor.full_name });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-28 space-y-5">
          <Skeleton className="h-6 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !tutor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <EmptyState
          title="Tutor not found"
          description="This tutor profile isn't available right now."
          action={{ label: "Back to tutors", onClick: () => navigate("/learner") }}
        />
      </div>
    );
  }

  const hasSubjects = tutor.subjects.length > 0;
  const profileIncomplete = !hasSubjects || !tutor.subjects.some((s) => Number(s.hourly_rate) > 0);
  const initials = tutor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32 space-y-5">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground active:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20 border border-border">
            <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} alt={tutor.full_name} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{tutor.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <OnlineStatus isOnline={tutor.online_status} lastSeen={tutor.last_seen || undefined} />
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {tutor.rating > 0 ? (
                <>
                  <StarRating rating={tutor.rating} readonly size="sm" />
                  <span className="text-sm font-medium">{tutor.rating}</span>
                  <span className="text-sm text-muted-foreground">({tutor.totalReviews} review{tutor.totalReviews === 1 ? "" : "s"})</span>
                </>
              ) : (
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="h-3 w-3 mr-1" /> New tutor
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* About */}
        {tutor.bio && (
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-1.5">About</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{tutor.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Subjects & rates */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" /> Subjects & rates
            </h2>
            {hasSubjects ? (
              <div className="space-y-2">
                {tutor.subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.subject}</p>
                      {s.level && <p className="text-xs text-muted-foreground">{s.level}</p>}
                    </div>
                    {Number(s.hourly_rate) > 0 ? (
                      <p className="text-sm font-semibold text-primary">R{s.hourly_rate}/hr</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Rate not set</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Subjects coming soon.</p>
            )}
            {(tutor.curriculums.length > 0 || tutor.grades.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tutor.curriculums.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                {tutor.grades.map((g) => <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Experience / qualifications */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-primary" /> Experience & qualifications
            </h2>
            {tutor.qualifications.length > 0 ? (
              <div className="space-y-2.5">
                {tutor.qualifications.map((q) => (
                  <div key={q.id} className="flex items-start gap-2.5">
                    <Award className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{q.qualification_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.institution}{q.year_obtained ? ` · ${q.year_obtained}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Qualifications being verified.</p>
            )}
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">Reviews</h2>
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
                <Sparkles className="h-4 w-4 mx-auto text-primary mb-1.5" />
                <p className="text-sm text-muted-foreground">
                  No reviews yet — be one of {tutor.full_name.split(" ")[0]}'s first students.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div key={i} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{r.reviewer_first_name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <StarRating rating={r.rating} readonly size="sm" />
                    {r.comment && <p className="text-sm text-muted-foreground mt-1.5">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          {profileIncomplete ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled>
                <Video className="h-4 w-4 mr-1.5" /> Booking soon
              </Button>
              <Button variant="secondary" onClick={handleChat}>
                <MessageCircle className="h-4 w-4 mr-1.5" /> Chat
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={handleBook}>
                <MapPin className="h-4 w-4 mr-1" /> In-Person
              </Button>
              <Button onClick={handleBook}>
                <Video className="h-4 w-4 mr-1" /> Book Online
              </Button>
              <Button variant="secondary" onClick={handleChat}>
                <MessageCircle className="h-4 w-4 mr-1" /> Chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorPublicProfile;
