import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Users, Layers } from "lucide-react";
import { PRICING, TRIAL_DURATION_DAYS } from "@/sail/types";

/**
 * PricingSection — real prices from the single PRICING source of truth.
 * Gives the navbar's "Pricing" anchor a destination (was a dead link).
 */
const tiers = [
  {
    icon: Sparkles,
    name: "AI Study",
    price: `R${PRICING.ai_moderate.monthly}`,
    cadence: "/month",
    tagline: "The full AI study engine",
    features: [
      "Quizzes, flashcards & mock exams",
      "Photo Solve with correction practice",
      "AI tutor chat & daily tasks",
      `Premium tier available (R${PRICING.ai_premium.monthly}/mo)`,
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    icon: Layers,
    name: "AI + Tutor Combo",
    price: `R${PRICING.ai_moderate_combo.monthly}`,
    cadence: "/month + sessions",
    tagline: "Best value for serious students",
    features: [
      "Everything in AI Study — discounted",
      `Unlocked with ${PRICING.combo_min_sessions_per_month}+ tutor sessions/month`,
      "Tutor sees your AI study progress",
      `Premium combo R${PRICING.ai_premium_combo.monthly}/mo`,
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    icon: Users,
    name: "Tutor Sessions",
    price: `R${PRICING.tutor.perSession}`,
    cadence: "/session",
    tagline: "Verified experts, pay as you go",
    features: [
      "Background-checked tutors",
      "Online or in-person",
      "Book 30-minute slots",
      "No subscription required",
    ],
    cta: "Find a tutor",
    highlighted: false,
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            Simple, honest pricing
          </h2>
          <p className="mt-3 text-gray-600">
            Every plan starts with a {TRIAL_DURATION_DAYS}-day free trial. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl p-6 flex flex-col ${
                t.highlighted
                  ? "border-2 border-primary bg-primary/5 shadow-lg"
                  : "border border-gray-200 bg-white"
              }`}
            >
              {t.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <t.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-gray-900">{t.name}</h3>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-gray-900">{t.price}</span>
                <span className="text-sm text-gray-500">{t.cadence}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{t.tagline}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/learner/auth")}
                className={
                  t.highlighted
                    ? "w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full"
                    : "w-full rounded-full font-semibold"
                }
                variant={t.highlighted ? "default" : "outline"}
              >
                {t.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Prices in ZAR. Combo pricing applies when booking {PRICING.combo_min_sessions_per_month}+ tutor sessions in a month.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
