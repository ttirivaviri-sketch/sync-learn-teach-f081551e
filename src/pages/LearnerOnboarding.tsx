/**
 * LearnerOnboarding — guided post-signup flow.
 *
 *  0. Welcome splash
 *  1. Subscription / trial (choose plan or continue with free trial)
 *  2. Academic profile (guided setup)
 *  3. Celebration → /learner
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Rocket,
  Crown,
  Gift,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAcademicProfile } from "@/hooks/useAcademicProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { AcademicProfileSetup } from "@/components/AcademicProfileSetup";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepperHeader } from "@/components/onboarding/StepperHeader";
import { SuccessSplash } from "@/components/onboarding/SuccessSplash";

const STEPS = [
  { label: "Welcome" },
  { label: "Plan" },
  { label: "Your studies" },
  { label: "All set" },
];

type Step = 0 | 1 | 2 | 3;

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

  const [step, setStep] = useState<Step>(0);

  // Returning user with profile already set → jump to celebration.
  useEffect(() => {
    if (profile && step === 2) setStep(3);
  }, [profile, step]);

  const kickOffPersonalisation = async () => {
    try {
      toast({
        title: "Personalising your study plan…",
        description: "We're setting up curriculum-aligned tasks in the background.",
      });
      supabase.functions.invoke("personalise-curriculum-deep-dive").catch(() => {});
    } catch {
      /* non-blocking */
    }
  };

  const finish = async () => {
    await supabase.rpc("mark_learner_onboarding_complete");
    navigate("/learner", { replace: true });
  };

  if (authLoading || profileLoading) {
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
          subscription.data?.status === "trial" ? "7-day free trial active" : "Free tier active",
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

            {/* ── Step 1: Subscription ── */}
            {step === 1 && (
              <Card className="p-5 bg-card/95 backdrop-blur-xl">
                <div className="text-center mb-5">
                  <h1 className="text-xl font-bold mb-1">Choose your plan</h1>
                  <p className="text-sm text-muted-foreground">
                    Start with a 7-day free trial — no card required.
                  </p>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5">
                          <Gift className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">7-day Free Trial</p>
                            <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">
                              Active
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Full access to AI Study Mode, library & tutor matching.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-violet-500/10 p-2.5">
                        <Crown className="h-5 w-5 text-violet-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">Premium</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Upgrade anytime from your Profile after the trial.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button size="lg" className="w-full" onClick={() => setStep(2)}>
                  Continue with free trial <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <p className="text-center text-[11px] text-muted-foreground mt-3">
                  You can switch plans anytime from your Profile.
                </p>
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
                  existingProfile={profile}
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
