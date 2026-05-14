/**
 * PlanPicker — single-source-of-truth subscription plan selector.
 *
 * Used in onboarding (to set the learner's plan during their 7-day trial)
 * and inside the Profile tab (to manage / upgrade later).
 *
 * Pricing comes from PRICING in src/sail/types/index.ts so it stays in sync
 * with the SAIL monetization engine.
 */
import { useMemo, useState } from "react";
import { Check, Sparkles, Crown, Users, Layers, Loader2, Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PRICING } from "@/sail/types";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export type PlanKey =
  | "free"
  | "ai_moderate"
  | "ai_premium"
  | "tutor_payg"
  | "combo_moderate"
  | "combo_premium";

interface PlanDef {
  key: PlanKey;
  name: string;
  tagline: string;
  price: string;
  perks: string[];
  icon: typeof Sparkles;
  highlight?: boolean;
  group: "ai" | "tutor" | "combo";
}

const PLANS: PlanDef[] = [
  {
    key: "ai_moderate",
    name: "AI Moderate",
    tagline: "Daily AI study tasks aligned to your curriculum.",
    price: `R${PRICING.ai_moderate.monthly}/mo`,
    perks: ["Topic-by-topic StudyMode", "Past-paper drills", "Up to 30 AI calls / day"],
    icon: Sparkles,
    group: "ai",
  },
  {
    key: "ai_premium",
    name: "AI Premium",
    tagline: "Unlimited AI tutoring, mock exams & deep analytics.",
    price: `R${PRICING.ai_premium.monthly}/mo`,
    perks: ["Unlimited AI calls", "Adaptive mock exams", "Weekly progress reports"],
    icon: Crown,
    group: "ai",
  },
  {
    key: "tutor_payg",
    name: "Tutor Sessions",
    tagline: "Pay only for the sessions you book — no monthly fee.",
    price: `R${PRICING.tutor.perSession}/session`,
    perks: ["Verified human tutors", "30-min slot booking", "Pay per session"],
    icon: Users,
    group: "tutor",
  },
  {
    key: "combo_moderate",
    name: "Combo Moderate",
    tagline: "AI Moderate + tutor sessions, save when you book ≥4/mo.",
    price: `R${PRICING.ai_moderate_combo.monthly}/mo + sessions`,
    perks: [
      `AI Moderate at R${PRICING.ai_moderate_combo.monthly} (save R${(PRICING.ai_moderate.monthly - PRICING.ai_moderate_combo.monthly).toFixed(0)})`,
      "All Tutor Sessions perks",
      `Min ${PRICING.combo_min_sessions_per_month} sessions/month`,
    ],
    icon: Layers,
    group: "combo",
  },
  {
    key: "combo_premium",
    name: "Combo Premium",
    tagline: "AI Premium + tutor sessions, our best value.",
    price: `R${PRICING.ai_premium_combo.monthly}/mo + sessions`,
    perks: [
      `AI Premium at R${PRICING.ai_premium_combo.monthly} (save R${(PRICING.ai_premium.monthly - PRICING.ai_premium_combo.monthly).toFixed(0)})`,
      "All Tutor Sessions perks",
      `Min ${PRICING.combo_min_sessions_per_month} sessions/month`,
    ],
    icon: Crown,
    highlight: true,
    group: "combo",
  },
];

interface PlanPickerProps {
  /** "onboarding" hides the "stay on free trial" copy as separate; "profile" shows current plan badge. */
  mode?: "onboarding" | "profile";
  /** Called when the user opts to continue (free trial in onboarding). */
  onContinue?: () => void;
  /** Optional callback after a paid plan is selected. */
  onPlanSelected?: (plan: PlanKey) => void;
}

export function PlanPicker({ mode = "onboarding", onContinue, onPlanSelected }: PlanPickerProps) {
  const { toast } = useToast();
  const { subscription, isTrialActive } = useSubscription();
  const queryClient = useQueryClient();
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);

  const currentPlan = (subscription.data?.plan as PlanKey | undefined) ?? "free";
  const trialActive = isTrialActive();

  const trialDaysLeft = useMemo(() => {
    const end = subscription.data?.trial_end;
    if (!end) return 0;
    return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000));
  }, [subscription.data?.trial_end]);

  const choosePlan = async (plan: PlanKey) => {
    setBusyPlan(plan);
    try {
      const { error } = await supabase.rpc("set_subscription_plan", { p_plan: plan });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast({
        title: "Plan saved",
        description: trialActive
          ? `Your ${PLANS.find(p => p.key === plan)?.name} plan starts after your free trial.`
          : `You're now on ${PLANS.find(p => p.key === plan)?.name}.`,
      });
      onPlanSelected?.(plan);
      onContinue?.();
    } catch (e) {
      toast({
        title: "Couldn't save plan",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Trial banner */}
      {trialActive && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">7-day Free Trial</p>
              <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">
                Active · {trialDaysLeft}d left
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full access to AI Study Mode, library and tutor matching while you choose a plan.
            </p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.key;
          const isBusy = busyPlan === plan.key;
          return (
            <Card
              key={plan.key}
              className={cn(
                "p-4 transition-all",
                plan.highlight && "border-primary/40 shadow-md",
                isCurrent && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "rounded-xl p-2.5 shrink-0",
                    plan.group === "ai" && "bg-violet-500/10 text-violet-600",
                    plan.group === "tutor" && "bg-blue-500/10 text-blue-600",
                    plan.group === "combo" && "bg-emerald-500/10 text-emerald-600",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{plan.name}</p>
                      {plan.highlight && (
                        <Badge className="bg-emerald-500 text-white border-0 text-[10px]">Best value</Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">Selected</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
                    <p className="text-sm font-semibold mt-1">{plan.price}</p>
                    <ul className="mt-2 space-y-1">
                      {plan.perks.map((p) => (
                        <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => choosePlan(plan.key)}
                disabled={isBusy || isCurrent}
                size="sm"
                variant={plan.highlight ? "default" : "outline"}
                className="w-full mt-3"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current plan" : `Choose ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Skip / continue (onboarding only) */}
      {mode === "onboarding" && (
        <div className="pt-1">
          <Button variant="ghost" className="w-full" onClick={onContinue}>
            Decide later — continue with free trial
          </Button>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            You can change or cancel anytime from your Profile.
          </p>
        </div>
      )}
    </div>
  );
}
