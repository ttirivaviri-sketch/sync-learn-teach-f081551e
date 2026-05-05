import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_PRICING } from "@/sail/types";

const TrialSignupFlow = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");

  const role = searchParams.get("role") === "tutor" ? "tutor" : "learner";
  const authPath = role === "tutor" ? "/tutor/auth" : "/learner/auth";
  const premiumPricing = PLAN_PRICING.premium;
  const annualEquivalent = Math.round(premiumPricing.annually / 12);

  const roleCopy = useMemo(
    () =>
      role === "tutor"
        ? {
            title: "Become a tutor with 7 days free",
            subtitle:
              "Set up your profile, publish clips, and unlock the tools you need to start teaching with confidence.",
            bullets: [
              "Create your verified tutor profile",
              "Upload study clips and PDF resources",
              "Manage bookings, students, and payouts",
            ],
            cta: "Continue to tutor sign up",
          }
        : {
            title: "Start your 7-day free trial",
            subtitle:
              "Get full access to StudySync before you create your account and only start billing after your trial ends.",
            bullets: [
              "AI Study Mode and personalized practice",
              "Past papers, books, and study clips",
              "Verified tutors and smart progress tracking",
            ],
            cta: "Continue to learner sign up",
          },
    [role]
  );

  const continueToAuth = () => {
    navigate(`${authPath}?trial=1&plan=premium&billing=${billing}`);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => (step === 1 ? navigate("/") : setStep(1))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "Back" : "Review trial"}
          </Button>
          <Badge variant="secondary">Step {step} of 2</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <Badge className="w-fit">7-day free trial</Badge>
              <CardTitle className="text-3xl">{roleCopy.title}</CardTitle>
              <CardDescription className="text-base">{roleCopy.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {roleCopy.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                    <span className="text-sm text-foreground">{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Today
                  </div>
                  <p className="text-2xl font-bold text-foreground">R0</p>
                  <p className="text-xs text-muted-foreground">Instant access, nothing charged now.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    After trial
                  </div>
                  <p className="text-2xl font-bold text-foreground">R{premiumPricing.monthly}/mo</p>
                  <p className="text-xs text-muted-foreground">Or save with annual billing.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Control
                  </div>
                  <p className="text-2xl font-bold text-foreground">Anytime</p>
                  <p className="text-xs text-muted-foreground">Cancel before trial ends to avoid billing.</p>
                </div>
              </div>

              {step === 1 ? (
                <Button size="lg" className="w-full sm:w-auto" onClick={() => setStep(2)}>
                  Continue to payment step
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Choose how billing should start after your free trial:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setBilling("monthly")}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        billing === "monthly"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">Monthly</span>
                        <Badge variant={billing === "monthly" ? "default" : "secondary"}>Flexible</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">R{premiumPricing.monthly}<span className="text-sm font-medium text-muted-foreground">/month</span></p>
                      <p className="mt-1 text-xs text-muted-foreground">Best if you want the freedom to cancel at any time.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBilling("annually")}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        billing === "annually"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">Annual</span>
                        <Badge variant={billing === "annually" ? "default" : "secondary"}>Save more</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">R{premiumPricing.annually}<span className="text-sm font-medium text-muted-foreground">/year</span></p>
                      <p className="mt-1 text-xs text-muted-foreground">About R{annualEquivalent}/month when billed annually.</p>
                    </button>
                  </div>

                  <Button size="lg" className="w-full sm:w-auto" onClick={continueToAuth}>
                    {roleCopy.cta}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
              <CardDescription>This keeps the signup flow clear and gives learners a cancel-anytime payment step before account creation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-medium text-foreground">1. Start free</p>
                <p>You unlock the full trial immediately and no payment is taken today.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-medium text-foreground">2. Confirm billing preference</p>
                <p>Choose monthly or annual billing so the plan is ready when the trial ends.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-medium text-foreground">3. Create your account</p>
                <p>You’ll finish sign up on the next screen and can cancel anytime before the 7 days are over.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TrialSignupFlow;