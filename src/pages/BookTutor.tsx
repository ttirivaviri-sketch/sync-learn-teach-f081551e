/**
 * BookTutor — public tutor booking page (/book and /book/:tutorId).
 *
 * A visitor picks a tutor, subject, day and 1-hour start time, then confirms.
 * If they are not signed in, the selection is held in sessionStorage while they
 * create an account, and the booking is submitted automatically on return.
 * Bookings are created with status `requested`; payment happens after the tutor
 * confirms, so nothing is charged here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Seo } from "@/components/Seo";
import { AuthForm } from "@/components/AuthForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { trackEnquiryClick } from "@/utils/landingAnalytics";
import { usePublicBookableTutors, type PublicBookableTutor } from "@/hooks/usePublicBookableTutors";
import { PublicTutorPicker } from "@/components/booking/PublicTutorPicker";
import { PublicSlotPicker } from "@/components/booking/PublicSlotPicker";

const PENDING_KEY = "ss_pending_booking";
const SESSION_MINUTES = 60;

interface PendingBooking {
  tutorId: string;
  tutorName: string;
  subjectId: string;
  subjectName: string;
  scheduledAt: string;
  price: number;
  note: string;
}

const readPending = (): PendingBooking | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingBooking) : null;
  } catch {
    return null;
  }
};

const clearPending = () => {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
};

const BookTutor = () => {
  const { tutorId: routeTutorId } = useParams<{ tutorId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { tutors, loading, error, refresh } = usePublicBookableTutors();

  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState<string | undefined>(routeTutorId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<PendingBooking | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const submittedRef = useRef(false);

  const selectedTutor = useMemo<PublicBookableTutor | undefined>(
    () => tutors.find((t) => t.id === selectedTutorId),
    [tutors, selectedTutorId]
  );
  const selectedSubject = selectedTutor?.subjects.find((s) => s.id === selectedSubjectId);
  const price = selectedSubject ? selectedSubject.hourly_rate * (SESSION_MINUTES / 60) : 0;

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Pre-select subject from a ?subject= hint or the tutor's first subject.
  useEffect(() => {
    if (!selectedTutor) return;
    if (selectedSubjectId && selectedTutor.subjects.some((s) => s.id === selectedSubjectId)) return;
    const hint = searchParams.get("subject");
    const match = hint
      ? selectedTutor.subjects.find((s) => s.subject.toLowerCase() === hint.toLowerCase())
      : undefined;
    setSelectedSubjectId((match || selectedTutor.subjects[0])?.id ?? "");
  }, [selectedTutor, selectedSubjectId, searchParams]);

  // ── Booking submission ────────────────────────────────────────────────────
  const submitBooking = useCallback(
    async (pending: PendingBooking, learnerId: string) => {
      setSubmitting(true);
      try {
        const { error: insertError } = await supabase.from("bookings").insert({
          learner_id: learnerId,
          tutor_id: pending.tutorId,
          tutor_subject_id: pending.subjectId,
          scheduled_at: pending.scheduledAt,
          duration_minutes: SESSION_MINUTES,
          price: pending.price,
          room_name: `session-${crypto.randomUUID()}`,
          learner_note: pending.note || null,
        });
        if (insertError) throw insertError;

        clearPending();
        setConfirmed(pending);
        setShowAuth(false);

        trackEnquiryClick({
          channel: "booking",
          subject: pending.subjectName,
          sessionType: "1-hour session",
          source: "book_page",
          label: `Booking request — ${pending.tutorName}`,
        });
      } catch (err) {
        logger.error("Public booking failed:", err);
        submittedRef.current = false;
        toast({
          title: "We couldn't confirm that slot",
          description:
            err instanceof Error
              ? err.message
              : "Please pick another time or try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [toast]
  );

  // Resume a held booking once the visitor comes back signed in.
  useEffect(() => {
    if (!authReady || !userId || submittedRef.current || confirmed) return;
    const pending = readPending();
    if (!pending) return;
    submittedRef.current = true;
    void submitBooking(pending, userId);
  }, [authReady, userId, confirmed, submitBooking]);

  const buildPending = (): PendingBooking | null => {
    if (!selectedTutor || !selectedSubject || !selectedStart) return null;
    return {
      tutorId: selectedTutor.id,
      tutorName: selectedTutor.full_name,
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.subject,
      scheduledAt: selectedStart.toISOString(),
      price,
      note: note.trim(),
    };
  };

  const handleConfirm = () => {
    const pending = buildPending();
    if (!pending) {
      toast({
        title: "Almost there",
        description: "Choose a tutor, subject and time first.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch {
        /* ignore */
      }
      setShowAuth(true);
      return;
    }

    submittedRef.current = true;
    void submitBooking(pending, userId);
  };

  const handleTutorSelect = (tutor: PublicBookableTutor) => {
    setSelectedTutorId(tutor.id);
    setSelectedSubjectId(tutor.subjects[0]?.id ?? "");
    setSelectedStart(null);
    setShowAuth(false);
  };

  const resetFlow = () => {
    setConfirmed(null);
    setSelectedStart(null);
    setNote("");
    submittedRef.current = false;
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-4 py-16">
        <Seo
          title="Booking requested — StudySync"
          description="Your tutor session request has been sent. The tutor will confirm and you pay after that."
          path="/book"
        />
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
          <h1 className="text-2xl font-extrabold text-slate-900">Session requested</h1>
          <p className="mt-3 text-slate-600">
            {confirmed.tutorName} has been notified about your{" "}
            <strong>{confirmed.subjectName}</strong> session on{" "}
            <strong>{format(new Date(confirmed.scheduledAt), "EEEE, d MMM 'at' h:mm a")}</strong>.
            You'll get a notification as soon as it's confirmed — payment of R
            {confirmed.price.toFixed(0)} only happens after that.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/learner")} className="rounded-full">
              View my sessions
            </Button>
            <Button variant="outline" onClick={resetFlow} className="rounded-full">
              Book another session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canConfirm = Boolean(selectedTutor && selectedSubject && selectedStart) && !submitting;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Seo
        title="Book a Verified Tutor Online — StudySync"
        description="Pick a verified StudySync tutor, choose your subject and a 1-hour slot, and send a booking request. R300 per session, paid only after the tutor confirms."
        path="/book"
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to StudySync
        </Link>

        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Book a session
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Pick your tutor, day and time
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            1-hour sessions with background-checked tutors, online or in person. Send the request
            now — you only pay once the tutor confirms the slot.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified tutors
            </Badge>
            <Badge variant="secondary">No payment today</Badge>
            <Badge variant="secondary">Free cancellation before confirmation</Badge>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-slate-900">1. Choose a tutor</h2>
          <PublicTutorPicker
            tutors={tutors}
            loading={loading}
            error={error}
            selectedTutorId={selectedTutorId}
            onSelect={handleTutorSelect}
            onRetry={refresh}
          />
        </section>

        {selectedTutor && (
          <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              2. Subject and time with {selectedTutor.full_name}
            </h2>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium">Subject</label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTutor.subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.subject} ({s.level}) — R{s.hourly_rate} per session
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PublicSlotPicker
              tutorId={selectedTutor.id}
              selectedStart={selectedStart}
              onSelect={(start) => setSelectedStart(start)}
            />

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                What should the tutor prepare? (optional)
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Grade 12 trigonometry — struggling with identities from Paper 2"
                className="rounded-xl"
                maxLength={500}
              />
            </div>
          </section>
        )}

        {selectedTutor && selectedSubject && selectedStart && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">3. Confirm your slot</h2>

            <dl className="mb-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Tutor</dt>
                <dd className="font-medium text-slate-900">{selectedTutor.full_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Subject</dt>
                <dd className="font-medium text-slate-900">
                  {selectedSubject.subject} ({selectedSubject.level})
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">When</dt>
                <dd className="text-right font-medium text-slate-900">
                  {format(selectedStart, "EEEE, d MMM")} at {format(selectedStart, "h:mm a")} (1 hour)
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                <dt className="text-slate-500">Price</dt>
                <dd className="font-bold text-slate-900">R{price.toFixed(0)}</dd>
              </div>
            </dl>

            {showAuth && !userId ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Your slot is held. Create a free account (or sign in) and we'll send the request
                  straight away.
                </p>
                <AuthForm
                  userType="learner"
                  redirectTo="/book"
                  subtitle="Create your free account to confirm this booking"
                />
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full rounded-full"
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending request…
                  </>
                ) : (
                  <>
                    <CalendarCheck className="mr-2 h-4 w-4" /> Confirm booking — R
                    {price.toFixed(0)}
                  </>
                )}
              </Button>
            )}

            <p className="mt-3 text-center text-xs text-slate-500">
              No card needed now. You pay after {selectedTutor.full_name} accepts the session.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default BookTutor;
