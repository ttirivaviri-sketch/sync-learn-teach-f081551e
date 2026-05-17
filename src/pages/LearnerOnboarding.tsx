/**
 * LearnerOnboarding — guided post-signup flow.
 *
 *  0. Welcome splash
 *  1. Plan selection (PlanPicker)
 *  2. Academic profile (guided setup)
 *  3. Celebration → /learner
 *
 * Idempotent: returning users with `onboarding_completed_at` are bounced
 * straight to /learner. Wizard step is persisted per-user in localStorage.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAcademicProfile } from "@/hooks/useAcademicProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useResumableWizard } from "@/hooks/useResumableWizard";
import { AcademicProfileSetup } from "@/components/AcademicProfileSetup";
import { SubscriptionFlow } from "@/components/subscription/SubscriptionFlow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepperHeader } from "@/components/onboarding/StepperHeader";
import { SuccessSplash } from "@/components/onboarding/SuccessSplash";

const STEPS = [
  { label: "Welcome" },
  { label: "Plan" },
  { label: "Studies" },
  { label: "All set" },
];

type Step = 0 | 1 | 2 | 3;

export default function LearnerOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth({ redirectTo: "/learner/auth" });
  const userId = session?.user?.id;
  const isReady = !authLoading && !!userId;
  const firstName =
    (session?.user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    session?.user?.email?.split("@")[0] ||
    "there";

  const { profile: academicProfile, loading: profileLoading, saving, saveProfile } = useAcademicProfile(userId);
  const { subscription } = useSubscription();

  // Persisted step state (per user) so refresh resumes the wizard cleanly.
  const wizardKey = `learner-onboarding:${userId ?? "pending"}`;
  const { state, setState, clear } = useResumableWizard<{ step: Step }>(wizardKey, { step: 0 });
  const step = state.step;
  const setStep = useCallback((s: Step) => setState({ step: s }), [setState]);

  // Has the user already completed onboarding? Bounce to app.
  const [completedCheckLoading, setCompletedCheckLoading] = useState(true);
  const [onboardingFlag, setOnboardingFlag] = useState<boolean>(false);
  const completedRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setOnboardingFlag(!!data?.onboarding_completed_at);
        setCompletedCheckLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Only bounce to /learner if BOTH the flag AND academic profile exist —
  // otherwise the user gets stuck in a loop with LearnerApp (which itself
  // redirects back here when the academic profile is missing).
  useEffect(() => {
    if (completedCheckLoading || profileLoading) return;
    if (onboardingFlag && academicProfile && !completedRef.current) {
      completedRef.current = true;
      clear();
      navigate("/learner", { replace: true });
    } else if (onboardingFlag && !academicProfile) {
      // Flag set but profile missing — jump straight to the academic step.
      setStep(2);
    }
  }, [completedCheckLoading, profileLoading, onboardingFlag, academicProfile, navigate, clear, setStep]);

  // Honour ?step= query (e.g. PayFast return) — clamp to valid range.
  useEffect(() => {
    const q = searchParams.get("step");
    const n = q ? Number(q) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= 3) setStep(n as Step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the academic profile already exists, skip past Step 2.
  useEffect(() => {
    if (academicProfile && step === 2) setStep(3);
  }, [academicProfile, step, setStep]);

  const kickOffPersonalisation = () => {
    toast({
      title: "Personalising your study plan…",
      description: "We're setting up curriculum-aligned tasks in the background.",
    });
    supabase.functions.invoke("personalise-curriculum-deep-dive").catch(() => {});
  };

  const finishingRef = useRef(false);
  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      await supabase.rpc("mark_learner_onboarding_complete");
    } catch {
      /* non-blocking */
    }
    clear();
    navigate("/learner", { replace: true });
  }, [navigate, clear]);

  if (!isReady || profileLoading || completedCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-mesh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (step === 3) {
    return (
      <SuccessSplash
        title="You're all set!"
        subtitle="Your StudySync workspace is ready."
        checklist={[
          "Library personalised for your curriculum",
          "StudyMode subjects ready with topic-by-topic tasks",
          subscription.data?.status === "trial" ? "7-day free trial active" : "Plan saved",
        ]}
        ctaLabel="Enter app"
        onCta={finish}
        autoAdvanceMs={2200}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh py-6 px-4">
      <div className="max-w-xl mx-auto">
        <StepperHeader steps={STEPS} current={step} className="mb-6" />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── Step 0: Welcome ── */}
            {step === 0 && (
              <Card className="p-6 bg-card/95 backdrop-blur-xl text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 15 }}
                  className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
                >
                  <Rocket className="h-8 w-8 text-primary" />
                </motion.div>
                <h1 className="text-2xl font-bold mb-1">Hi {firstName} 👋</h1>
                <p className="text-sm text-muted-foreground mb-5">
                  Let's set up your StudySync in under a minute.
                </p>
                <ul className="text-left text-sm space-y-2 mb-6 max-w-xs mx-auto">
                  <Bullet>Pick your plan (free trial included)</Bullet>
                  <Bullet>Tell us your curriculum, grade & subjects</Bullet>
                  <Bullet>We'll personalise your library & StudyMode</Bullet>
                </ul>
                <Button size="lg" className="w-full" onClick={() => setStep(1)}>
                  Let's go <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Card>
            )}

            {/* ── Step 1: Plan ── */}
            {step === 1 && (
              <Card className="p-5 bg-card/95 backdrop-blur-xl">
                <SubscriptionFlow mode="onboarding" onComplete={() => setStep(2)} />
                <div className="pt-4 mt-4 border-t">
                  <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>
                    Decide later — continue with free trial
                  </Button>
                </div>
              </Card>
            )}

            {/* ── Step 2: Academic profile ── */}
            {step === 2 && userId && (
              <Card className="p-5 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold">Tell us about your studies</h1>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll personalise your library, StudyMode tasks, and tutor matches.
                </p>
                <AcademicProfileSetup
                  userId={userId}
                  existingProfile={academicProfile}
                  saving={saving}
                  onSave={async (data) => {
                    const ok = await saveProfile(data);
                    if (ok) {
                      kickOffPersonalisation();
                      setStep(3);
                    }
                    return ok;
                  }}
                  compact
                />
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
