import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  BookOpen,
  Star,
  Users,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  Brain,
  Zap,
} from "lucide-react";

/* ── Floating stat card ─────────────────────────────── */
interface FloatingCardProps {
  className?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "secondary";
}
const FloatingCard = ({ className = "", icon, label, value, color }: FloatingCardProps) => (
  <div
    className={`absolute glass rounded-2xl px-4 py-3 shadow-xl border border-white/30 flex items-center gap-3 ${className}`}
  >
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        color === "primary" ? "bg-primary/20" : "bg-secondary/20"
      }`}
    >
      {icon}
    </div>
    <div>
      <p className="text-xs text-white/70 leading-none mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white leading-none">{value}</p>
    </div>
  </div>
);

/* ── Navbar ─────────────────────────────────────────── */
const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-white/20 shadow-md py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 group"
        >
          <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-10 sm:h-12 w-auto object-contain" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }} />
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", id: "features" },
            { label: "StudyMode", id: "studymode" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Testimonials", id: "testimonials" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="text-white/90 hover:text-white hover:bg-white/15 border border-white/20"
            onClick={() => navigate("/learner/auth")}
          >
            Sign In
          </Button>
          <Button
            size="sm"
            className="bg-white text-primary hover:bg-white/90 font-semibold shadow-glow-sm"
            onClick={() => navigate("/learner/auth")}
          >
            Get Started
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white/80 hover:bg-white/15 hover:text-white"
            onClick={() => navigate("/tutor/auth")}
          >
            Become a Tutor
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden glass border-t border-white/20 px-4 pb-4 space-y-3 animate-fade-up">
          {[
            { label: "Features", id: "features" },
            { label: "StudyMode", id: "studymode" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Testimonials", id: "testimonials" },
          ].map((item) => (
            <button
              key={item.id}
              className="block w-full text-left text-sm font-medium text-white/80 py-2"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold"
              onClick={() => navigate("/learner/auth")}
            >
              Get Started
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/30 text-white hover:bg-white/15"
              onClick={() => navigate("/tutor/auth")}
            >
              Become a Tutor
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

/* ======================================================
   HeroSection
   ====================================================== */
const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* ── Deep gradient background ── */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(230,90%,42%)] via-[hsl(245,85%,50%)] to-[hsl(260,88%,44%)]" />

        {/* ── Mesh blobs ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-white/10 blur-[80px] animate-float-slow" />
          <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-violet-400/20 blur-[80px] animate-float" />
          <div className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] rounded-full bg-cyan-400/15 blur-[72px] animate-float-slow" />
        </div>

        {/* ── Subtle grid pattern ── */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* Left -- copy */}
            <div className="flex-1 text-center lg:text-left">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 glass-dark border border-white/20 rounded-full px-4 py-1.5 mb-8 animate-fade-up">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                <span className="text-xs font-semibold text-white tracking-wide uppercase">
                  AI-Powered Learning Platform
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold text-white leading-[1.05] mb-6 animate-fade-up delay-100">
                Your Exam Success<br />
                <span className="text-white/80">Starts </span>
                <span className="relative inline-block">
                  <span className="text-yellow-300">Here</span>
                  {/* underline squiggle */}
                  <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 200 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 6 C40 1, 80 7, 120 3 C160 -1, 185 5, 198 3"
                      stroke="hsl(50 100% 65%)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-up delay-200">
                <strong className="text-white font-semibold">AI study tools</strong>,{" "}
                <strong className="text-white font-semibold">expert tutors</strong>, and a{" "}
                <strong className="text-white font-semibold">curriculum-aligned resource library</strong>{" "}
                -- everything you need to ace your exams, in one place.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up delay-300">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 shadow-glow font-bold text-base px-8 gap-2 group"
                  onClick={() => navigate("/learner/auth")}
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/15 hover:border-white/60 font-semibold text-base px-8"
                  onClick={() => navigate("/tutor/auth")}
                >
                  Become a Tutor
                </Button>
              </div>

              {/* Social proof row */}
              <div className="flex items-center gap-6 mt-10 justify-center lg:justify-start animate-fade-up delay-400">
                <div className="flex -space-x-2.5">
                  {["SC", "MT", "AL", "RJ", "KP"].map((initials, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `hsl(${210 + i * 25} 80% 55%)` }}
                    >
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-xs text-white/70">
                    <span className="font-semibold text-white">4.9/5</span> from 2 400+ student reviews
                  </p>
                </div>
              </div>
            </div>

            {/* Right -- visual */}
            <div className="flex-1 flex justify-center items-center relative w-full max-w-sm lg:max-w-md xl:max-w-lg animate-fade-up delay-200">
              {/* Central phone mockup */}
              <div className="relative z-10 animate-float">
                {/* Phone shell */}
                <div className="w-64 h-[500px] rounded-[2.5rem] border-[6px] border-white/30 bg-white/10 backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col">
                  {/* Status bar */}
                  <div className="flex justify-between items-center px-5 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-white/90">9:41</span>
                    <div className="w-20 h-5 rounded-full bg-black/40" />
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-white/60" />
                      <div className="w-3 h-3 rounded-full bg-white/60" />
                    </div>
                  </div>
                  {/* Screen content */}
                  <div className="flex-1 px-4 py-3 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-5 w-auto object-contain" />
                    </div>
                    <p className="text-[11px] text-white/70 font-medium">Today's Study Plan</p>
                    {/* AI study cards */}
                    {[
                      { name: "Algebra Revision", sub: "AI Quiz Ready", icon: "brain", color: "from-blue-400/30" },
                      { name: "Chemistry Notes", sub: "Flashcards Generated", icon: "zap", color: "from-teal-400/30" },
                      { name: "Physics Exam Prep", sub: "Past Papers Loaded", icon: "book", color: "from-purple-400/30" },
                    ].map((t, i) => (
                      <div
                        key={i}
                        className={`bg-gradient-to-r ${t.color} to-transparent rounded-xl p-2.5 border border-white/20`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ background: `hsl(${200 + i * 40} 70% 50%)` }}
                            >
                              {t.icon === "brain" ? <Brain className="w-3.5 h-3.5" /> : t.icon === "zap" ? <Zap className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-white leading-tight">{t.name}</p>
                              <p className="text-[9px] text-white/65">{t.sub}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-0.5 justify-end mt-0.5">
                              <div className="w-4 h-1.5 rounded-full bg-emerald-400" />
                              <div className="w-4 h-1.5 rounded-full bg-emerald-400/50" />
                              <div className="w-4 h-1.5 rounded-full bg-white/20" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Start button */}
                    <div className="bg-white rounded-xl py-2 text-center mt-auto">
                      <span className="text-[11px] font-bold text-primary">Start Studying</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat cards */}
              <FloatingCard
                className="-left-4 top-10 animate-float-slow"
                icon={<Brain className="h-4 w-4 text-primary" />}
                label="AI Quizzes"
                value="50 000+"
                color="primary"
              />
              <FloatingCard
                className="-right-4 top-1/3 animate-float"
                icon={<Star className="h-4 w-4 text-yellow-400" />}
                label="Pass Rate"
                value="95%"
                color="secondary"
              />
              <FloatingCard
                className="left-0 bottom-16 animate-float-slow"
                icon={<BookOpen className="h-4 w-4 text-secondary" />}
                label="Study Hours"
                value="50 000+"
                color="secondary"
              />

              {/* Decorative ring */}
              <div className="absolute inset-0 -z-10 rounded-full opacity-20 animate-pulse-ring scale-75 border-2 border-white" />
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 animate-bounce">
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
