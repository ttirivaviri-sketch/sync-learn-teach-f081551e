import { useEffect, useRef, useState } from "react";
import { Users, BookOpen, Award, Clock, TrendingUp } from "lucide-react";

/* ── Animated counter hook ──────────────────────────── */
const useCounter = (target: number, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out expo
      const eased = 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
};

/* ── Format with suffix ─────────────────────────────── */
const format = (n: number, suffix: string) => {
  if (suffix === "%") return `${n}%`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k+`;
  return `${n}${suffix}`;
};

/* ── Stat item ──────────────────────────────────────── */
interface Stat {
  icon: React.ElementType;
  rawValue: number;
  suffix: string;
  label: string;
  description: string;
  accentColor: string;
}

const stats: Stat[] = [
  {
    icon: Users,
    rawValue: 10000,
    suffix: "+",
    label: "Active Students",
    description: "And growing daily",
    accentColor: "from-blue-500 to-indigo-600",
  },
  {
    icon: BookOpen,
    rawValue: 500,
    suffix: "+",
    label: "Expert Tutors",
    description: "Background-checked",
    accentColor: "from-teal-500 to-emerald-600",
  },
  {
    icon: Award,
    rawValue: 95,
    suffix: "%",
    label: "Pass Rate",
    description: "Grade improvement",
    accentColor: "from-amber-500 to-orange-500",
  },
  {
    icon: Clock,
    rawValue: 50000,
    suffix: "+",
    label: "Study Hours",
    description: "AI + tutor sessions",
    accentColor: "from-violet-500 to-purple-600",
  },
];

/* ── StatCard ───────────────────────────────────────── */
const StatCard = ({ stat, animate, delay }: { stat: Stat; animate: boolean; delay: number }) => {
  const count = useCounter(stat.rawValue, 2000, animate);

  return (
    <div
      className="group relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:bg-white/15"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient blob behind icon */}
      <div
        className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${stat.accentColor} opacity-20 blur-xl transition-opacity group-hover:opacity-35`}
      />

      {/* Icon */}
      <div
        className={`relative inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${stat.accentColor} mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
      >
        <stat.icon className="w-7 h-7 text-white" />
      </div>

      {/* Number */}
      <div className="text-4xl font-display font-extrabold text-white mb-1 tabular-nums">
        {animate ? format(count, stat.suffix) : "—"}
      </div>

      {/* Label */}
      <div className="font-semibold text-white text-sm mb-0.5">{stat.label}</div>

      {/* Description */}
      <div className="text-xs text-white/55 flex items-center justify-center gap-1">
        <TrendingUp className="w-3 h-3" />
        {stat.description}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   StatsSection
   ══════════════════════════════════════════════════════ */
export const StatsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.25 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(230,90%,42%)] via-[hsl(245,85%,50%)] to-[hsl(260,88%,44%)]" />

      {/* Mesh blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/10 blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-violet-300/15 blur-[72px]" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/60 mb-3">
            <span className="w-4 h-px bg-white/40 block" />
            Our Impact
            <span className="w-4 h-px bg-white/40 block" />
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-extrabold text-white mb-4">
            Real results, real impact
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Students across South Africa and beyond are transforming their exam results with StudySync.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} animate={visible} delay={i * 80} />
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="text-center text-white/45 text-sm mt-10">
          Numbers updated in real-time · March 2026
        </p>
      </div>
    </section>
  );
};
