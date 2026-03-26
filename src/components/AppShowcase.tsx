import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Search,
  Calendar,
  CreditCard,
  Shield,
  Upload,
  CheckCircle,
  Star,
  ArrowRight,
  Briefcase,
  BookOpen,
  ChevronRight,
} from "lucide-react";

/* ── Feature row ─────────────────────────────────────── */
interface FeatureRowProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
}
const FeatureRow = ({ icon: Icon, title, desc, color }: FeatureRowProps) => (
  <div className="flex items-start gap-4 group">
    <div
      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${color} group-hover:scale-110 transition-transform`}
    >
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="font-semibold text-foreground text-sm mb-0.5">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </div>
);

/* ── Inline phone mockup ─────────────────────────────── */
interface PhoneMockupProps {
  accentColor: string;
  screenContent: React.ReactNode;
}
const PhoneMockup = ({ accentColor, screenContent }: PhoneMockupProps) => (
  <div className="relative flex justify-center">
    {/* Outer glow */}
    <div
      className={`absolute inset-0 rounded-[2.5rem] blur-2xl opacity-30 ${accentColor}`}
    />
    {/* Phone shell */}
    <div
      className={`relative w-56 rounded-[2.5rem] border-[5px] overflow-hidden shadow-2xl ${accentColor.replace("bg-", "border-")} border-opacity-40`}
      style={{ borderColor: "rgba(255,255,255,0.18)", background: "linear-gradient(145deg, #1e1b4b 0%, #312e81 100%)" }}
    >
      {/* Top notch */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-16 h-5 rounded-full bg-black/60" />
      </div>
      {/* Screen */}
      <div className="px-3 pb-4">{screenContent}</div>
    </div>

    {/* Decorative ring */}
    <div className="absolute -inset-4 rounded-[3rem] border border-dashed border-primary/20 -z-10 animate-spin-slow" />
  </div>
);

/* ── Learner screen content ──────────────────────────── */
const LearnerScreen = () => (
  <div className="space-y-2.5">
    <p className="text-[10px] font-bold text-white/90 mb-1">Discover Tutors</p>
    <div className="bg-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 border border-white/10">
      <Search className="h-3 w-3 text-white/60" />
      <span className="text-[9px] text-white/50">Search subject…</span>
    </div>
    {[
      { sub: "Mathematics", name: "Dr. Alex M.", stars: 5, rate: "R180/hr" },
      { sub: "Chemistry", name: "Sarah K.", stars: 5, rate: "R150/hr" },
      { sub: "Physics", name: "James T.", stars: 4, rate: "R200/hr" },
    ].map((t, i) => (
      <div key={i} className="bg-white/10 rounded-xl p-2 border border-white/10 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ background: `hsl(${200 + i * 40} 70% 50%)` }}
        >
          {t.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-white truncate">{t.name}</p>
          <p className="text-[8px] text-white/55">{t.sub}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold text-white">{t.rate}</p>
          <div className="flex gap-0.5 mt-0.5">
            {[...Array(t.stars)].map((_, s) => (
              <div key={s} className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            ))}
          </div>
        </div>
      </div>
    ))}
    <div className="bg-primary/80 rounded-xl py-2 text-center mt-1">
      <span className="text-[10px] font-bold text-white">Book a Session →</span>
    </div>
  </div>
);

/* ── Tutor screen content ────────────────────────────── */
const TutorScreen = () => (
  <div className="space-y-2.5">
    <p className="text-[10px] font-bold text-white/90 mb-1">Dashboard</p>
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: "This Month", value: "R4 200", icon: "💰" },
        { label: "Sessions", value: "24", icon: "📅" },
      ].map((m, i) => (
        <div key={i} className="bg-white/10 rounded-xl p-2 border border-white/10 text-center">
          <p className="text-base">{m.icon}</p>
          <p className="text-[11px] font-bold text-white">{m.value}</p>
          <p className="text-[8px] text-white/55">{m.label}</p>
        </div>
      ))}
    </div>
    <p className="text-[9px] text-white/55 font-medium mt-1">Upcoming sessions</p>
    {["09:00 - Sipho (Maths)", "11:30 - Ayasha (Science)", "15:00 - Liam (English)"].map((s, i) => (
      <div key={i} className="bg-white/10 rounded-xl px-2.5 py-2 border border-white/10 flex items-center gap-2">
        <div className="w-1.5 h-8 rounded-full bg-secondary/70" />
        <span className="text-[9px] text-white/80">{s}</span>
        <ChevronRight className="w-3 h-3 text-white/40 ml-auto" />
      </div>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════
   AppShowcase
   ══════════════════════════════════════════════════════ */
const AppShowcase = () => {
  const [activeTab, setActiveTab] = useState<"learner" | "tutor">("learner");

  const learnerFeatures: FeatureRowProps[] = [
    { icon: Search, title: "Find Your Perfect Tutor", desc: "Search by subject, curriculum, grade level, or location -- find the right match in seconds.", color: "bg-primary" },
    { icon: Star, title: "Verified & Rated", desc: "Every tutor is background-checked with verified qualifications and genuine student reviews.", color: "bg-amber-500" },
    { icon: Calendar, title: "Book on Your Schedule", desc: "Choose your preferred date, time, and format -- online or in person.", color: "bg-indigo-500" },
    { icon: CreditCard, title: "Secure, Flexible Payment", desc: "Pay via mobile money, card, or cash -- all protected with instant confirmation.", color: "bg-emerald-600" },
  ];

  const tutorFeatures: FeatureRowProps[] = [
    { icon: Upload, title: "Quick Onboarding", desc: "Upload your ID and qualifications -- get verified within 24 hours and start earning.", color: "bg-secondary" },
    { icon: CheckCircle, title: "Trusted & Verified", desc: "Background checks and identity verification build trust with every student.", color: "bg-teal-600" },
    { icon: BookOpen, title: "Manage Your Subjects", desc: "Set your subjects, hourly rate, and availability -- students book directly.", color: "bg-cyan-600" },
    { icon: Briefcase, title: "Track Your Earnings", desc: "Full earnings dashboard with session history, payouts, and growth analytics.", color: "bg-violet-600" },
  ];

  const isLearner = activeTab === "learner";

  return (
    <section className="py-28 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            Built for learners & tutors
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-5">
            Two apps, one mission
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Purpose-built experiences for students who want to learn and educators who want to teach.
          </p>

          {/* Tab switcher */}
          <div className="inline-flex mt-8 bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab("learner")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isLearner
                  ? "bg-primary text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              StudySync Learner
            </button>
            <button
              onClick={() => setActiveTab("tutor")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isLearner
                  ? "bg-secondary text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              StudySync Tutor
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: features */}
          <div className="space-y-8 animate-fade-up">
            {/* Heading */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${isLearner ? "bg-primary" : "bg-secondary"}`}>
                  {isLearner
                    ? <GraduationCap className="h-6 w-6 text-white" />
                    : <Shield className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold text-foreground">
                    {isLearner ? "StudySync Learner" : "StudySync Tutor"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isLearner ? "For students who need expert help" : "For educators who want to teach"}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {isLearner
                  ? (["Grade 8–12", "University", "All Subjects", "Online & In-Person"] as const).map((b) => (
                      <Badge key={b} variant="secondary" className="bg-primary-light text-primary border-0">{b}</Badge>
                    ))
                  : (["Verified", "Trusted", "Qualified", "Background Checked"] as const).map((b) => (
                      <Badge key={b} variant="outline" className="border-secondary/40 text-secondary">{b}</Badge>
                    ))}
              </div>
            </div>

            {/* Feature rows */}
            <div className="space-y-5">
              {(isLearner ? learnerFeatures : tutorFeatures).map((f, i) => (
                <FeatureRow key={i} {...f} />
              ))}
            </div>

            {/* CTA */}
            <Button
              size="lg"
              className={`gap-2 group font-semibold shadow-elegant ${
                isLearner ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90"
              }`}
              onClick={() =>
                (window.location.href = isLearner ? "/learner" : "/tutor")
              }
            >
              {isLearner ? "Try the Learner App" : "Try the Tutor App"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Right: phone mockup */}
          <div className="animate-fade-up delay-200">
            <PhoneMockup
              accentColor={isLearner ? "bg-primary/40" : "bg-secondary/40"}
              screenContent={isLearner ? <LearnerScreen /> : <TutorScreen />}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppShowcase;
