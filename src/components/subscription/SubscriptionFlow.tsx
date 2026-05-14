/**
 * SubscriptionFlow — multi-screen subscription chooser mirroring the published app.
 *
 * Screens:
 *   choose  → 3 cards (AI / Tutor / Combo)
 *   ai      → Moderate/Premium toggle + perks
 *   tutor   → subjects + lessons-per-week slider
 *   combo   → Moderate/Premium toggle + lessons-per-week slider
 *   review  → line-itemed summary + Start My Plan
 *
 * Used in:
 *   - LearnerOnboarding step 1 (mode="onboarding")
 *   - Profile → Subscription & Plans (mode="profile")
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bot, Users, Layers, Check, Star, Loader2, Shield, CreditCard, RefreshCw, Gift,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PRICING } from "@/sail/types";
import { cn } from "@/lib/utils";

type PlanGroup = "ai" | "tutor" | "combo";
type AITier = "moderate" | "premium";
type Step = "choose" | "ai" | "tutor" | "combo" | "review";

export type ResolvedPlanKey =
  | "ai_moderate" | "ai_premium" | "tutor_payg" | "combo_moderate" | "combo_premium";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English",
  "History", "Geography", "Accounting", "Economics", "Computer Science",
];

interface Props {
  mode?: "onboarding" | "profile";
  onComplete?: (plan: ResolvedPlanKey) => void;
}

export function SubscriptionFlow({ mode = "onboarding", onComplete }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { subscription, isTrialActive } = useSubscription();
  const trialActive = isTrialActive();

  const [step, setStep] = useState<Step>("choose");
  const [group, setGroup] = useState<PlanGroup>("combo");
  const [aiTier, setAiTier] = useState<AITier>("moderate");
  const [comboTier, setComboTier] = useState<AITier>("moderate");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(2);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const currentPlan = subscription.data?.plan as string | undefined;

  const resolvedPlan: ResolvedPlanKey = useMemo(() => {
    if (group === "ai") return aiTier === "premium" ? "ai_premium" : "ai_moderate";
    if (group === "combo") return comboTier === "premium" ? "combo_premium" : "combo_moderate";
    return "tutor_payg";
  }, [group, aiTier, comboTier]);

  const goto = (s: Step) => setStep(s);
  const back = () => {
    if (step === "review") setStep(group);
    else if (step !== "choose") setStep("choose");
  };

  const toggleSubject = (s: string) =>
    setSubjects((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_subscription_plan", { p_plan: resolvedPlan });
      if (error) throw error;
      // Stash preferences for the booking flow
      try {
        const uid = subscription.data?.user_id ?? "anon";
        localStorage.setItem(
          `subscription:preferences:${uid}`,
          JSON.stringify({ lessonsPerWeek, subjects, group, resolvedPlan }),
        );
      } catch { /* ignore */ }
      await qc.invalidateQueries({ queryKey: ["subscription"] });
      toast({
        title: trialActive ? "Plan saved" : "Plan activated",
        description: trialActive
          ? "Your plan starts after your free trial ends."
          : "Welcome aboard!",
      });
      onComplete?.(resolvedPlan);
      if (mode === "profile") setStep("choose");
    } catch (e) {
      toast({
        title: "Couldn't save plan",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {step !== "choose" && (
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === "choose" && (
            <PlanChooser
              currentPlan={currentPlan}
              trialActive={trialActive}
              onPick={(g) => { setGroup(g); goto(g); }}
            />
          )}
          {step === "ai" && (
            <AIPlanScreen
              tier={aiTier}
              onTierChange={setAiTier}
              trialActive={trialActive}
              onContinue={() => goto("review")}
            />
          )}
          {step === "tutor" && (
            <TutorSessionsScreen
              subjects={subjects}
              onToggleSubject={toggleSubject}
              lessonsPerWeek={lessonsPerWeek}
              onLessonsChange={setLessonsPerWeek}
              onContinue={() => goto("review")}
            />
          )}
          {step === "combo" && (
            <ComboScreen
              tier={comboTier}
              onTierChange={setComboTier}
              lessonsPerWeek={lessonsPerWeek}
              onLessonsChange={setLessonsPerWeek}
              onContinue={() => goto("review")}
            />
          )}
          {step === "review" && (
            <ReviewPayScreen
              group={group}
              resolvedPlan={resolvedPlan}
              aiTier={aiTier}
              comboTier={comboTier}
              lessonsPerWeek={lessonsPerWeek}
              trialActive={trialActive}
              saving={saving}
              onConfirm={handleConfirm}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Screen 2: Plan Chooser ───────────────────────── */

function PlanChooser({
  currentPlan, trialActive, onPick,
}: { currentPlan?: string; trialActive: boolean; onPick: (g: PlanGroup) => void }) {
  const cards: Array<{
    group: PlanGroup; title: string; subtitle: string; icon: React.ReactNode;
    accent: string; iconBg: string; price: string; matchesPlan: (p?: string) => boolean;
    badge?: string;
  }> = [
    {
      group: "ai",
      title: "AI Study Mode",
      subtitle: "Daily AI tutor, mock exams, adaptive practice.",
      icon: <Bot className="h-6 w-6" />,
      accent: "border-blue-500/40",
      iconBg: "bg-blue-500/10 text-blue-600",
      price: `From R${PRICING.ai_moderate.monthly}/mo`,
      matchesPlan: (p) => p === "ai_moderate" || p === "ai_premium",
    },
    {
      group: "tutor",
      title: "Tutor Sessions",
      subtitle: "Pay per session with verified human tutors.",
      icon: <Users className="h-6 w-6" />,
      accent: "border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-600",
      price: `R${PRICING.tutor.perSession}/session`,
      matchesPlan: (p) => p === "tutor_payg",
    },
    {
      group: "combo",
      title: "Combo Plan",
      subtitle: "AI + tutor sessions. Best value, save monthly.",
      icon: <Layers className="h-6 w-6" />,
      accent: "border-violet-500/40",
      iconBg: "bg-violet-500/10 text-violet-600",
      price: `From R${PRICING.ai_moderate_combo.monthly}/mo`,
      matchesPlan: (p) => p === "combo_moderate" || p === "combo_premium",
      badge: "Most Popular",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Choose Your Plan</h2>
        <p className="text-sm text-muted-foreground">
          {trialActive
            ? "Your 7-day free trial is active — pick what kicks in after."
            : "Pick the plan that fits how you study."}
        </p>
      </div>

      <div className="grid gap-3">
        {cards.map((c) => {
          const isCurrent = c.matchesPlan(currentPlan);
          return (
            <button
              key={c.group}
              onClick={() => onPick(c.group)}
              className={cn(
                "relative text-left rounded-2xl border-2 bg-card p-4 transition-all",
                "hover:shadow-md active:scale-[0.99]",
                c.accent,
              )}
            >
              {c.badge && (
                <Badge className="absolute -top-2 left-4 bg-violet-600 text-white border-0 gap-1">
                  <Star className="h-3 w-3 fill-current" /> {c.badge}
                </Badge>
              )}
              <div className="flex items-start gap-3">
                <div className={cn("rounded-xl p-2.5 shrink-0", c.iconBg)}>{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{c.title}</p>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px]">Selected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>
                  <p className="text-sm font-semibold mt-1.5">{c.price}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Cancel or change anytime from your Profile.
      </p>
    </div>
  );
}

/* ───────────────────────── Screen 3: AI Plan ───────────────────────── */

function AIPlanScreen({
  tier, onTierChange, trialActive, onContinue,
}: { tier: AITier; onTierChange: (t: AITier) => void; trialActive: boolean; onContinue: () => void }) {
  const price = tier === "premium" ? PRICING.ai_premium.monthly : PRICING.ai_moderate.monthly;
  const perks = tier === "premium"
    ? [
        "Unlimited AI tutor calls",
        "Adaptive mock exams & analytics",
        "Weekly progress reports",
        "Past-paper deep dives",
        "Priority AI response time",
      ]
    : [
        "Topic-by-topic StudyMode",
        "Past-paper drills",
        "Up to 30 AI calls / day",
        "Adaptive practice tasks",
      ];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
          <Bot className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">AI Study Mode Plans</h2>
        <p className="text-sm text-muted-foreground">Pick your AI tier</p>
      </div>

      <SegmentedToggle
        value={tier}
        onChange={onTierChange}
        options={[
          { value: "moderate", label: "Moderate", price: `R${PRICING.ai_moderate.monthly}/mo` },
          { value: "premium", label: "Premium", price: `R${PRICING.ai_premium.monthly}/mo` },
        ]}
      />

      <Card className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">AI {tier === "premium" ? "Premium" : "Moderate"}</p>
          <p className="text-2xl font-bold">R{price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
        </div>
        <ul className="space-y-2">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      {trialActive && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
          <Gift className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your 7-day free trial is active — you won't be charged until it ends.
          </p>
        </div>
      )}

      <Button size="lg" className="w-full" onClick={onContinue}>
        {trialActive ? "Continue with Free Trial" : "Continue to Payment"}
      </Button>
    </div>
  );
}

/* ───────────────────────── Screen 4: Tutor Sessions ───────────────────────── */

function TutorSessionsScreen({
  subjects, onToggleSubject, lessonsPerWeek, onLessonsChange, onContinue,
}: {
  subjects: string[]; onToggleSubject: (s: string) => void;
  lessonsPerWeek: number; onLessonsChange: (n: number) => void; onContinue: () => void;
}) {
  const monthly = PRICING.tutor.perSession * 4 * lessonsPerWeek;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <Users className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">Tutor Sessions</h2>
        <p className="text-sm text-muted-foreground">Pay per session, R{PRICING.tutor.perSession} each</p>
      </div>

      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">Subjects you need help with <span className="text-muted-foreground font-normal">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => {
            const active = subjects.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggleSubject(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-foreground border-border hover:bg-muted",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Lessons per week</p>
          <p className="text-2xl font-bold">{lessonsPerWeek}</p>
        </div>
        <Slider
          value={[lessonsPerWeek]}
          onValueChange={(v) => onLessonsChange(v[0])}
          min={1} max={5} step={1}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        </div>
      </Card>

      <MonthlySummary
        lines={[
          { label: `${lessonsPerWeek} lesson${lessonsPerWeek > 1 ? "s" : ""}/week × 4 weeks`, value: `R${monthly.toLocaleString()}` },
        ]}
        total={`R${monthly.toLocaleString()}/mo`}
      />

      <Button size="lg" className="w-full" onClick={onContinue}>
        Continue to Payment
      </Button>
    </div>
  );
}

/* ───────────────────────── Screen 5: Combo ───────────────────────── */

function ComboScreen({
  tier, onTierChange, lessonsPerWeek, onLessonsChange, onContinue,
}: {
  tier: AITier; onTierChange: (t: AITier) => void;
  lessonsPerWeek: number; onLessonsChange: (n: number) => void; onContinue: () => void;
}) {
  const aiCombo = tier === "premium" ? PRICING.ai_premium_combo.monthly : PRICING.ai_moderate_combo.monthly;
  const aiStandalone = tier === "premium" ? PRICING.ai_premium.monthly : PRICING.ai_moderate.monthly;
  const tutorMonthly = PRICING.tutor.perSession * 4 * lessonsPerWeek;
  const total = aiCombo + tutorMonthly;
  const savings = Math.round(aiStandalone - aiCombo);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
          <Layers className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">Build Combo Plan</h2>
        <p className="text-sm text-muted-foreground">AI + tutor sessions — discount applied</p>
      </div>

      <SegmentedToggle
        value={tier}
        onChange={onTierChange}
        options={[
          { value: "moderate", label: "Moderate", price: `R${PRICING.ai_moderate_combo.monthly}/mo` },
          { value: "premium", label: "Premium", price: `R${PRICING.ai_premium_combo.monthly}/mo` },
        ]}
      />

      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2">
        <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Combo discount: AI {tier === "premium" ? "Premium" : "Moderate"} drops from R{aiStandalone} to R{aiCombo}/mo
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Tutor lessons per week</p>
          <p className="text-2xl font-bold">{lessonsPerWeek}</p>
        </div>
        <Slider
          value={[lessonsPerWeek]}
          onValueChange={(v) => onLessonsChange(v[0])}
          min={1} max={5} step={1}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        </div>
      </Card>

      <MonthlySummary
        lines={[
          { label: `AI ${tier === "premium" ? "Premium" : "Moderate"} (combo)`, value: `R${aiCombo}` },
          { label: `${lessonsPerWeek} lesson${lessonsPerWeek > 1 ? "s" : ""}/week × 4`, value: `R${tutorMonthly.toLocaleString()}` },
        ]}
        total={`R${total.toLocaleString()}/mo`}
        footer={`You save R${savings} / month 🎉`}
      />

      <Button size="lg" className="w-full" onClick={onContinue}>
        Continue to Payment
      </Button>
    </div>
  );
}

/* ───────────────────────── Screen 6: Review & Pay ───────────────────────── */

function ReviewPayScreen({
  group, resolvedPlan, aiTier, comboTier, lessonsPerWeek, trialActive, saving, onConfirm,
}: {
  group: PlanGroup; resolvedPlan: ResolvedPlanKey;
  aiTier: AITier; comboTier: AITier; lessonsPerWeek: number;
  trialActive: boolean; saving: boolean; onConfirm: () => void;
}) {
  const lines: Array<{ label: string; value: string }> = [];
  let total = 0;
  let title = "";

  if (group === "ai") {
    const price = aiTier === "premium" ? PRICING.ai_premium.monthly : PRICING.ai_moderate.monthly;
    title = `AI Plan (${aiTier === "premium" ? "Premium" : "Moderate"})`;
    lines.push({ label: title, value: `R${price}/mo` });
    total = price;
  } else if (group === "tutor") {
    const tutorMonthly = PRICING.tutor.perSession * 4 * lessonsPerWeek;
    title = "Tutor Sessions";
    lines.push({ label: `${lessonsPerWeek}×/week tutor sessions`, value: `R${tutorMonthly.toLocaleString()}/mo` });
    total = tutorMonthly;
  } else {
    const ai = comboTier === "premium" ? PRICING.ai_premium_combo.monthly : PRICING.ai_moderate_combo.monthly;
    const tutor = PRICING.tutor.perSession * 4 * lessonsPerWeek;
    title = `Combo Plan (${comboTier === "premium" ? "Premium" : "Moderate"})`;
    lines.push({ label: `AI ${comboTier === "premium" ? "Premium" : "Moderate"} (combo)`, value: `R${ai}` });
    lines.push({ label: `${lessonsPerWeek}×/week tutor sessions`, value: `R${tutor.toLocaleString()}` });
    total = ai + tutor;
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Review & Pay</h2>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>

      <Card className="p-4 space-y-3">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{l.label}</span>
            <span className="font-medium">{l.value}</span>
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">R{total.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <TrustBullet icon={<RefreshCw className="h-4 w-4" />}>Cancel anytime</TrustBullet>
        <TrustBullet icon={<Shield className="h-4 w-4" />}>No long-term contracts</TrustBullet>
        <TrustBullet icon={<CreditCard className="h-4 w-4" />}>Secure payments via PayFast</TrustBullet>
        {group === "ai" && trialActive && (
          <TrustBullet icon={<Gift className="h-4 w-4" />}>7-day free trial included</TrustBullet>
        )}
      </Card>

      <Button size="lg" className="w-full" onClick={onConfirm} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start My Plan"}
      </Button>

      {trialActive && (
        <p className="text-center text-[11px] text-muted-foreground">
          Your plan kicks in after your free trial ends.
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */

function SegmentedToggle<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; price: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
            value === o.value
              ? "bg-card shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div>{o.label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{o.price}</div>
        </button>
      ))}
    </div>
  );
}

function MonthlySummary({
  lines, total, footer,
}: { lines: Array<{ label: string; value: string }>; total: string; footer?: string }) {
  return (
    <Card className="p-4 space-y-2 bg-muted/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly summary</p>
      {lines.map((l) => (
        <div key={l.label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{l.label}</span>
          <span className="font-medium">{l.value}</span>
        </div>
      ))}
      <div className="border-t pt-2 flex justify-between">
        <span className="font-semibold">Total</span>
        <span className="font-bold">{total}</span>
      </div>
      {footer && (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1">{footer}</p>
      )}
    </Card>
  );
}

function TrustBullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-primary">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
