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

/**
 * Condense grade chips: ["Grade 1"…"Grade 12","Form 1"…"Form 6","IGCSE"]
 * → ["Grades 1–12","Forms 1–6","IGCSE"] so the header never becomes badge soup.
 */
const summarizeGrades = (grades: string[]): string[] => {
  const nums: number[] = [];
  const forms: number[] = [];
  const others: string[] = [];
  for (const g of grades) {
    const gm = /^Grade (\d+)$/.exec(g.trim());
    const fm = /^Form (\d+)$/.exec(g.trim());
    if (gm) nums.push(Number(gm[1]));
    else if (fm) forms.push(Number(fm[1]));
    else others.push(g);
  }
  const ranges = (ns: number[], singular: string, plural: string) => {
    if (!ns.length) return [] as string[];
    const sorted = [...new Set(ns)].sort((a, b) => a - b);
    const out: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const n = sorted[i];
      if (n !== prev + 1) {
        out.push(start === prev ? `${singular} ${start}` : `${plural} ${start}–${prev}`);
        start = n;
      }
      prev = n;
    }
    return out;
  };
  return [...ranges(nums, "Grade", "Grades"), ...ranges(forms, "Form", "Forms"), ...others];
};
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "@/components/StarRating";
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
        {/* Hero skeleton matches the gradient header so there's no colour jump */}
        <div className="bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5]">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-4">
            <Skeleton className="h-5 w-16 bg-white/20" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full bg-white/20" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-40 bg-white/20" />
                <Skeleton className="h-4 w-56 bg-white/15" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Skeleton className="h-16 rounded-2xl bg-white/15" />
              <Skeleton className="h-16 rounded-2xl bg-white/15" />
              <Skeleton className="h-16 rounded-2xl bg-white/15" />
            </div>
          </div>
          <div className="h-4 bg-background rounded-t-3xl" />
        </div>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-28 space-y-4">
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
  const rates = tutor.subjects.map((s) => Number(s.hourly_rate)).filter((r) => Number.isFinite(r) && r > 0);
  const fromRate = rates.length ? Math.min(...rates) : null;
  const gradeChips = summarizeGrades(tutor.grades);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Gradient hero — same visual language as the session screens ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a3fc4] via-[#2d52e0] to-[#3b63f5]">
        {/* soft glow accents */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative max-w-lg mx-auto px-4 pt-4 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white active:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {/* Identity */}
          <div className="flex items-center gap-4 mt-4">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 ring-2 ring-white/40 shadow-xl">
                <AvatarImage src={tutor.avatar_url || "/placeholder.svg"} alt={tutor.full_name} />
                <AvatarFallback className="text-xl bg-white/20 text-white backdrop-blur">{initials}</AvatarFallback>
              </Avatar>
              {tutor.online_status && (
                <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-green-400 ring-2 ring-[#2d52e0]" aria-label="Online now" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">{tutor.full_name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-xs font-medium text-white">
                  <span className={`h-1.5 w-1.5 rounded-full ${tutor.online_status ? "bg-green-400" : "bg-white/50"}`} />
                  {tutor.online_status ? "Online now" : "Offline"}
                </span>
                {tutor.rating > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-xs font-medium text-white">
                    <span className="text-yellow-300">★</span> {tutor.rating}
                    <span className="text-white/60">({tutor.totalReviews})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-xs font-medium text-white">
                    <Sparkles className="h-3 w-3" /> New tutor
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Glass stat tiles — mirrors the Session Complete summary tiles */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <div className="bg-white/10 backdrop-blur rounded-2xl px-2 py-3 text-center border border-white/15">
              <p className="text-white text-lg font-bold leading-tight">{fromRate ? `R${fromRate}` : "—"}</p>
              <p className="text-white/60 text-[11px] mt-0.5">{fromRate ? "per hour, from" : "Rate coming"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl px-2 py-3 text-center border border-white/15">
              <p className="text-white text-lg font-bold leading-tight">{tutor.subjects.length || "—"}</p>
              <p className="text-white/60 text-[11px] mt-0.5">Subject{tutor.subjects.length === 1 ? "" : "s"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl px-2 py-3 text-center border border-white/15">
              <p className="text-white text-lg font-bold leading-tight">
                {tutor.rating > 0 ? tutor.rating : <Sparkles className="h-5 w-5 mx-auto text-yellow-300" />}
              </p>
              <p className="text-white/60 text-[11px] mt-0.5">{tutor.rating > 0 ? "Rating" : "New tutor"}</p>
            </div>
          </div>

          {/* Curriculum + condensed grade coverage */}
          {(tutor.curriculums.length > 0 || gradeChips.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {tutor.curriculums.map((c) => (
                <span key={c} className="rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white uppercase tracking-wide">
                  {c}
                </span>
              ))}
              {gradeChips.map((g) => (
                <span key={g} className="rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/85">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* curved seam into the content */}
        <div className="h-4 bg-background rounded-t-3xl" />
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-1 pb-32 space-y-4">

        {/* About */}
        {tutor.bio && (
          <Card className="border-0 shadow-sm ring-1 ring-border/60 rounded-2xl">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-1.5 flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </span>
                About
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{tutor.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Subjects & rates */}
        <Card className="border-0 shadow-sm ring-1 ring-border/60 rounded-2xl">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </span>
              Subjects & rates
            </h2>
            {hasSubjects ? (
              <div className="space-y-2">
                {tutor.subjects.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/[0.06] to-primary/[0.02] border border-primary/10 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.subject}</p>
                      {s.level && <p className="text-xs text-muted-foreground mt-0.5">{s.level}</p>}
                    </div>
                    {Number(s.hourly_rate) > 0 ? (
                      <p className="text-sm font-bold text-primary shrink-0 ml-3">R{s.hourly_rate}<span className="font-medium text-primary/70">/hr</span></p>
                    ) : (
                      <p className="text-xs text-muted-foreground shrink-0 ml-3">Rate not set</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Subjects coming soon.</p>
            )}
          </CardContent>
        </Card>

        {/* Experience / qualifications */}
        <Card className="border-0 shadow-sm ring-1 ring-border/60 rounded-2xl">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
              </span>
              Experience & qualifications
            </h2>
            {tutor.qualifications.length > 0 ? (
              <div className="space-y-2.5">
                {tutor.qualifications.map((q) => (
                  <div key={q.id} className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5">
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
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 px-3.5 py-3">
                <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </span>
                <p className="text-sm text-muted-foreground">Qualifications being verified.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card className="border-0 shadow-sm ring-1 ring-border/60 rounded-2xl">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-yellow-400/15 flex items-center justify-center">
                <span className="text-yellow-500 text-sm leading-none">★</span>
              </span>
              Reviews
            </h2>
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.05] to-transparent px-4 py-6 text-center">
                <span className="inline-flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Be one of {tutor.full_name.split(" ")[0]}'s first students
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your review after the first session helps other learners.
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
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {profileIncomplete ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled className="rounded-full h-11">
                <Video className="h-4 w-4 mr-1.5" /> Booking soon
              </Button>
              <Button onClick={handleChat} className="rounded-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-4 w-4 mr-1.5" /> Chat
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={handleBook} className="rounded-full h-11">
                <MapPin className="h-4 w-4 mr-1" /> In-Person
              </Button>
              <Button onClick={handleBook} className="rounded-full h-11 bg-gradient-to-r from-[#2d52e0] to-[#3b63f5] hover:from-[#2445c4] hover:to-[#2d52e0] text-white shadow-md">
                <Video className="h-4 w-4 mr-1" /> Book Online
              </Button>
              <Button onClick={handleChat} className="rounded-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
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
