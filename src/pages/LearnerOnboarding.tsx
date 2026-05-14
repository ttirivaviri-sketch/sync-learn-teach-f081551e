/**
 * LearnerOnboarding — guided once-off post-signup flow.
 *
 * Step 1: Academic profile (curriculum, grade, subjects)
 * Step 2: Subscription / trial (skippable; learners who skip get a
 *         free-tier cap enforced by useSubscription / AI bucket limits)
 *
 * After completion → /learner.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles, ArrowRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAcademicProfile } from "@/hooks/useAcademicProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { AcademicProfileSetup } from "@/components/AcademicProfileSetup";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LearnerOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth({ redirectTo: "/learner/auth" });
  const userId = session?.user?.id;

  const { profile, loading: profileLoading, saving, saveProfile } = useAcademicProfile(userId);
  const { subscription } = useSubscription();

  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (profile && step === 1) setStep(2);
  }, [profile, step]);

  const finish = async () => {
    await supabase.rpc("mark_learner_onboarding_complete");
    navigate("/learner", { replace: true });
  };

  const skipSubscription = async () => {
    toast({
      title: "You're on the free tier",
      description: "You'll have 3 active recalls and flashcards in StudyMode. Add a card any time from Profile to unlock everything.",
    });
    await finish();
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-mesh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh py-6 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4 text-xs">
          <span className="text-muted-foreground">Step {step} of 2</span>
          <span className="font-medium">{step === 1 ? "Your studies" : "Choose your plan"}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted mb-6 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
        </div>

        {step === 1 && userId && (
          <Card className="p-5 bg-card/95 backdrop-blur">
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
                if (ok) setStep(2);
                return ok;
              }}
              compact
            />
          </Card>
        )}

        {step === 2 && (
          <Card className="p-5 bg-card/95 backdrop-blur">
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
              <Button onClick={() => navigate("/start-trial?role=learner")} className="w-full">
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
