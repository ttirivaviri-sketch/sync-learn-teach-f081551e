import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  GraduationCap,
  Lock,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRICING } from "@/sail/types";

type ProductChoice = "ai" | "tutor" | "combo";
type AiTier = "moderate" | "premium";

const SUBJECT_OPTIONS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "English",
  "Accounting",
  "Life Sciences",
  "Geography",
  "Biology",
];

const fmtZAR = (n: number) =>
  `R${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

const TrialSignupFlow = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") === "tutor" ? "tutor" : "learner";
  const authPath = role === "tutor" ? "/tutor/auth" : "/learner/auth";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<ProductChoice>("combo");
  const [aiTier, setAiTier] = useState<AiTier>("moderate");
  const [subjects, setSubjects] = useState<string[]>(["Mathematics"]);
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);

  const sessionsPerMonth = lessonsPerWeek * 4;
  const tutorMonthly = sessionsPerMonth * PRICING.tutor.perSession;

  const isCombo = choice === "combo";
  const meetsComboMin =
    sessionsPerMonth >= PRICING.combo_min_sessions_per_month;

  const aiMonthly = useMemo(() => {
    if (isCombo && meetsComboMin) {
      return aiTier === "moderate"
        ? PRICING.ai_moderate_combo.monthly
        : PRICING.ai_premium_combo.monthly;
    }
    return aiTier === "moderate"
      ? PRICING.ai_moderate.monthly
      : PRICING.ai_premium.monthly;
  }, [aiTier, isCombo, meetsComboMin]);

  const aiFullPrice =
    aiTier === "moderate"
      ? PRICING.ai_moderate.monthly
      : PRICING.ai_premium.monthly;
  const aiDiscount = isCombo && meetsComboMin ? aiFullPrice - aiMonthly : 0;

  const monthlyTotal =
    (choice === "ai" || choice === "combo" ? aiMonthly : 0) +
    (choice === "tutor" || choice === "combo" ? tutorMonthly : 0);

  const toggleSubject = (s: string) =>
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const continueToAuth = () => {
    const params = new URLSearchParams({
      trial: "1",
      choice,
      ai_tier: aiTier,
      sessions_per_month: String(sessionsPerMonth),
      monthly_total: String(monthlyTotal),
    });
    if (subjects.length) params.set("subjects", subjects.join(","));
    navigate(`${authPath}?${params.toString()}`);
  };

  const goNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) {
      // If only AI chosen, skip tutor builder
      if (choice === "ai") setStep(3);
      else setStep(3);
    }
  };

  const goBack = () => {
    if (step === 1) navigate("/");
    else setStep(((step - 1) as 1 | 2 | 3));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Badge variant="secondary">Step {step} of 3</Badge>
        </div>

        {/* STEP 1 — Choose product */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">Choose Your Plan</h1>
              <p className="text-sm text-muted-foreground">
                Choose how you want to learn — AI, tutors, or both.
              </p>
            </div>

            {/* AI card */}
            <button
              type="button"
              onClick={() => setChoice("ai")}
              className={`block w-full text-left rounded-2xl border-2 p-4 transition-all ${
                choice === "ai"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">AI Study Mode</h3>
                    <span className="text-xs text-muted-foreground">From</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Learn smarter with AI</p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-primary" /> AI Study Mode</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-primary" /> Past papers &amp; flashcards</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-primary" /> Smart progress tracking</li>
                  </ul>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{fmtZAR(PRICING.ai_moderate.monthly)}</p>
                  <p className="text-[10px] text-muted-foreground">/mo</p>
                </div>
              </div>
            </button>

            {/* Tutor card */}
            <button
              type="button"
              onClick={() => setChoice("tutor")}
              className={`block w-full text-left rounded-2xl border-2 p-4 transition-all ${
                choice === "tutor"
                  ? "border-emerald-600 bg-emerald-600/5"
                  : "border-border bg-card hover:border-emerald-600/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-600/10 p-2.5">
                  <GraduationCap className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Tutor Sessions</h3>
                  <p className="text-xs text-muted-foreground">1-on-1 online tutoring</p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Verified tutors</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> R{PRICING.tutor.perSession} per session</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Choose lessons per week</li>
                  </ul>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">R{PRICING.tutor.perSession}</p>
                  <p className="text-[10px] text-muted-foreground">/ session</p>
                </div>
              </div>
            </button>

            {/* Combo card */}
            <button
              type="button"
              onClick={() => setChoice("combo")}
              className={`relative block w-full text-left rounded-2xl border-2 p-4 transition-all ${
                choice === "combo"
                  ? "border-violet-500 bg-violet-500/5"
                  : "border-border bg-card hover:border-violet-500/40"
              }`}
            >
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-violet-500 text-white border-0">
                <Star className="h-3 w-3 mr-1 fill-white" /> Most Popular
              </Badge>
              <div className="flex items-start gap-3 pt-1">
                <div className="rounded-xl bg-violet-500/10 p-2.5">
                  <Sparkles className="h-6 w-6 text-violet-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Combo Plan</h3>
                  <p className="text-xs text-muted-foreground">AI Study + Tutor Sessions</p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-violet-500" /> Discounted AI subscription</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-violet-500" /> Personalized learning</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-violet-500" /> Best value for results</li>
                  </ul>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Save up to</p>
                  <p className="text-lg font-bold text-violet-600">R100<span className="text-[10px] font-normal">/mo</span></p>
                </div>
              </div>
            </button>

            <Button size="lg" className="w-full" onClick={goNext}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Lock className="inline h-3 w-3 mr-1" />
              Cancel or change anytime
            </p>
          </div>
        )}

        {/* STEP 2 — Configure */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">
                {choice === "ai"
                  ? "AI Study Mode Plans"
                  : choice === "tutor"
                  ? "Tutor Sessions"
                  : "Build Combo Plan"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {choice === "ai"
                  ? "Choose the AI plan that fits your needs."
                  : choice === "tutor"
                  ? "Choose how many lessons you'd like each week."
                  : "Get the best of both worlds."}
              </p>
            </div>

            {/* AI tier picker */}
            {(choice === "ai" || choice === "combo") && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">
                    {choice === "combo" ? "1. Choose your AI plan" : "Choose your tier"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAiTier("moderate")}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        aiTier === "moderate"
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">Moderate</span>
                        {aiTier === "moderate" && <BadgeCheck className="h-4 w-4 text-primary" />}
                      </div>
                      {isCombo && meetsComboMin ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">
                            R{PRICING.ai_moderate.monthly}
                          </p>
                          <p className="text-xl font-bold">R{PRICING.ai_moderate_combo.monthly}</p>
                        </>
                      ) : (
                        <p className="text-xl font-bold">R{PRICING.ai_moderate.monthly}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        (${aiTier === "moderate" && isCombo && meetsComboMin
                          ? PRICING.ai_moderate_combo.usd
                          : PRICING.ai_moderate.usd} USD)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiTier("premium")}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        aiTier === "premium"
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">Premium</span>
                        {aiTier === "premium" && <BadgeCheck className="h-4 w-4 text-primary" />}
                      </div>
                      {isCombo && meetsComboMin ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">
                            R{PRICING.ai_premium.monthly}
                          </p>
                          <p className="text-xl font-bold">R{PRICING.ai_premium_combo.monthly}</p>
                        </>
                      ) : (
                        <p className="text-xl font-bold">R{PRICING.ai_premium.monthly}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        (${aiTier === "premium" && isCombo && meetsComboMin
                          ? PRICING.ai_premium_combo.usd
                          : PRICING.ai_premium.usd} USD)
                      </p>
                    </button>
                  </div>

                  {isCombo && meetsComboMin && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Discount applied because you're booking tutor sessions (minimum 1 per week).
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tutor builder */}
            {(choice === "tutor" || choice === "combo") && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {choice === "combo" ? "2. Choose your subjects" : "1. Choose your subjects"}{" "}
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECT_OPTIONS.map((s) => {
                        const active = subjects.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSubject(s)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-muted"
                            }`}
                          >
                            {active && <BadgeCheck className="inline h-3 w-3 mr-1" />}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">
                      {choice === "combo" ? "3. Lessons per week" : "2. Lessons per week"}
                    </p>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={lessonsPerWeek}
                      onChange={(e) => setLessonsPerWeek(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={n === lessonsPerWeek ? "font-semibold text-foreground" : ""}>
                          {n}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-center text-muted-foreground">
                      {lessonsPerWeek} lesson{lessonsPerWeek > 1 ? "s" : ""} per week ({sessionsPerMonth} per month)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Running total */}
            <Card className="bg-muted/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {fmtZAR(monthlyTotal)} <span className="text-xs text-muted-foreground font-normal">/ month</span>
                  </span>
                </div>
                {aiDiscount > 0 && (
                  <p className="mt-1 text-xs text-emerald-600 text-right">
                    You save {fmtZAR(aiDiscount)} / month 🎉
                  </p>
                )}
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={() => setStep(3)}>
              Continue to Payment <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 3 — Review & Pay */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">Review &amp; Pay</h1>
              <p className="text-sm text-muted-foreground">Here's what you're getting every month.</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                {choice === "combo" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Combo Plan</span>
                    <Badge className="bg-violet-500 text-white border-0">Best Value</Badge>
                  </div>
                )}

                {(choice === "ai" || choice === "combo") && (
                  <div className="flex items-start justify-between border-t border-border pt-3">
                    <div className="flex items-start gap-2">
                      <Bot className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          AI Plan ({aiTier === "moderate" ? "Moderate" : "Premium"})
                        </p>
                        {aiDiscount > 0 && (
                          <p className="text-[11px] text-emerald-600">
                            Combo discount applied
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {aiDiscount > 0 && (
                        <p className="text-[11px] text-muted-foreground line-through">
                          {fmtZAR(aiFullPrice)}
                        </p>
                      )}
                      <p className="text-sm font-semibold">{fmtZAR(aiMonthly)} <span className="text-[10px] text-muted-foreground">/mo</span></p>
                    </div>
                  </div>
                )}

                {(choice === "tutor" || choice === "combo") && (
                  <div className="flex items-start justify-between border-t border-border pt-3">
                    <div className="flex items-start gap-2">
                      <GraduationCap className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Tutor Sessions</p>
                        <p className="text-[11px] text-muted-foreground">
                          {lessonsPerWeek} lesson{lessonsPerWeek > 1 ? "s" : ""} per week ({sessionsPerMonth} per month)
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">{fmtZAR(tutorMonthly)} <span className="text-[10px] text-muted-foreground">/mo</span></p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {fmtZAR(monthlyTotal)} <span className="text-xs text-muted-foreground font-normal">/ month</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4 grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Cancel or change anytime</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> No long-term contracts</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Secure payments</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 7-day free trial for AI</div>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={continueToAuth}>
              <Lock className="mr-1 h-4 w-4" />
              Start My Plan
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              You won't be charged until your 7-day trial ends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialSignupFlow;
