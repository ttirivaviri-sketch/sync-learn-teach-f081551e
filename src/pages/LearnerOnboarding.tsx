/**
 * LearnerOnboarding — guided once-off post-signup flow.
 *
 *  0. Welcome splash — hello + what we'll set up
 *  1. Academic profile (curriculum, grade, subjects)
 *  2. Subscription / trial (skippable)
 *  3. Celebration — auto routes to /learner
 *
 * On profile save we:
 *  - Insert subjects into `subjects` and copy curriculum_topic_templates.topics
 *  - Fire personalise-curriculum-deep-dive (background, non-blocking) so the
 *    daily-task engine has a full concept pool by the time they land on Home.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles, ArrowRight, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAcademicProfile } from "@/hooks/useAcademicProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { AcademicProfileSetup } from "@/components/AcademicProfileSetup";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepperHeader } from "@/components/onboarding/StepperHeader";
import { SuccessSplash } from "@/components/onboarding/SuccessSplash";

const STEPS = [
  { label: "Welcome" },
  { label: "Your studies" },
  { label: "All set" },
];

export default function LearnerOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth({ redirectTo: "/learner/auth" });
  const userId = session?.user?.id;
  const firstName =
    (session?.user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    session?.user?.email?.split("@")[0] ||
    "there";

  const { profile, loading: profileLoading, saving, saveProfile } = useAcademicProfile(userId);
  const { subscription } = useSubscription();

  const [step, setStep] = useState<0 | 1 | 2>(0);

  // If profile already exists (returning user partway through), skip to celebration.
  useEffect(() => {
    if (profile && step === 1) setStep(2);
  }, [profile, step]);

  /**
   * Kick off background personalisation:
   *   1. The next StudyMode entry will copy topic templates → subjects (handled by useSeedSubjectsFromProfile).
   *   2. Pre-warm the deep-dive concept map so daily tasks are available immediately.
   * Both calls are fire-and-forget — onboarding does NOT block on them.
   */
  const kickOffPersonalisation = async () => {
    try {
      toast({
        title: "Personalising your study plan…",
        description: "We're setting up curriculum-aligned tasks in the background.",
      });
      // Fire-and-forget background calls
      supabase.functions.invoke("personalise-curriculum-deep-dive").catch(() => {});
    } catch {
      /* non-blocking */
    }
  };

  const finish = async () => {
    await supabase.rpc("mark_learner_onboarding_complete");
    navigate("/learner", { replace: true });
  };

  const skipSubscription = async () => {
    setStep(3);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-mesh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Step 3: Celebration → auto-route ────────────────────────
  if (step === 3) {
    return (
      <SuccessSplash
        title="You're all set!"
        subtitle="Your StudySync workspace is ready."
        checklist={[
          "Library personalised for your curriculum",
          "StudyMode subjects ready with topic-by-topic tasks",
          subscription.data?.status === "trial" ? "7-day free trial active" : "Free tier active",
        ]}
        ctaLabel="Enter app"
        onCta={finish}
        autoAdvanceMs={2800}
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
                  <Bullet>Tell us your curriculum, grade & subjects</Bullet>
                  <Bullet>Pick your plan (7-day free trial included)</Bullet>
                  <Bullet>Jump into a personalised library + StudyMode</Bullet>
                </ul>
                <Button size="lg" className="w-full" onClick={() => setStep(1)}>
                  Let's go <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Card>
            )}

            {/* ── Step 1: Academic profile ── */}
            {step === 1 && userId && (
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
                  existingProfile={profile}
                  saving={saving}
                  onSave={async (data) => {
                    const ok = await saveProfile(data);
                    if (ok) {
                      kickOffPersonalisation();
                      setStep(2);
                    }
                    return ok;
                  }}
                  compact
                />
              </Card>
            )}

            {/* ── Step 2: Subscription ── */}
            {step === 2 && (
              <Card className="p-5 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold">You're on a 7-day free trial</h1>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Full access to StudyMode, AI tutoring, and the library for the next 7 days.
                </p>

                <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Premium</div>
                      <div className="text-2xl font-bold">R249<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                    </div>
                    <Badge className="bg-emerald-600">Trial active</Badge>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    <Bullet>Unlimited AI tutoring & quizzes</Bullet>
                    <Bullet>Full library access</Bullet>
                    <Bullet>Mock papers & detailed insights</Bullet>
                    <Bullet>Guardian progress reports</Bullet>
                  </ul>
                </div>

                <div className="rounded-xl border p-4 mb-4 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Lock className="h-4 w-4 text-muted-foreground" /> If you skip
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll keep a free taste — <strong>3 active recalls</strong> and <strong>flashcards</strong> in StudyMode.
                    AI usage is capped after that. Add a card any time from your Profile tab to unlock everything.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button onClick={() => navigate("/start-trial?role=learner")} className="w-full" size="lg">
                    <ArrowRight className="h-4 w-4 mr-1" /> Add card & continue
                  </Button>
                  <Button variant="ghost" onClick={skipSubscription} className="w-full">
                    Remind me later
                  </Button>
                </div>

                {subscription.data?.status === "trial" && (
                  <p className="mt-3 text-xs text-center text-muted-foreground">
                    Trial ends {subscription.data.trial_end ? new Date(subscription.data.trial_end).toLocaleDateString() : "in 7 days"}.
                  </p>
                )}
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
