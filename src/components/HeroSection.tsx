import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Menu, X, Brain, Users, BookOpen, Cpu, CheckCircle } from "lucide-react";

/* ── Navbar ─────────────────────────────────────────── */
const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const openTrialFlow = (role: "learner" | "tutor") => navigate(`/start-trial?role=${role}`);

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
          ? "bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm py-3"
          : "bg-white py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <img
            src="/lovable-uploads/studysync-logo.png"
            alt="StudySync"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", id: "features" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
            className="text-gray-700 hover:text-gray-900"
            onClick={() => navigate("/learner/auth")}
          >
            Sign In
          </Button>
          <Button
            size="sm"
            className="bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-gray-900 font-semibold rounded-full px-6"
            onClick={() => openTrialFlow("learner")}
          >
            Get Started
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-gray-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 space-y-3">
          {[
            { label: "Features", id: "features" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map((item) => (
            <button
              key={item.id}
              className="block w-full text-left text-sm font-medium text-gray-600 py-2"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-gray-900 font-semibold rounded-full"
              onClick={() => openTrialFlow("learner")}
            >
              Start free trial
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-gray-300 text-gray-700 rounded-full"
              onClick={() => openTrialFlow("tutor")}
            >
              Become a Tutor
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

/* ── Feature card at bottom ──────────────────────────── */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  highlight: string;
  description: string;
}
const FeatureCard = ({ icon, title, highlight, description }: FeatureCardProps) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900">
          {title} <span className="text-blue-600">{highlight}</span>
        </h3>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════
   HeroSection
   ══════════════════════════════════════════════════════ */
const HeroSection = () => {
  const navigate = useNavigate();
  const openTrialFlow = (role: "learner" | "tutor") => navigate(`/start-trial?role=${role}`);

  const checkItems = [
    "AI study assistant",
    "Expert tutors",
    "Past paper exam practice",
    "Personalized study schedules",
  ];

  return (
    <>
      <Navbar />

      <section className="relative bg-gradient-to-b from-white to-blue-50/30 pt-24 pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main hero row */}
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Left -- copy */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-6">
                Learn <span className="text-gray-900">smarter.</span>
                <br />
                Pass <span className="text-[hsl(45,100%,45%)]">faster.</span>
              </h1>

              <p className="text-base md:text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                StudySync combines AI-powered learning, verified tutors, and a smart study library to help you master school subjects efficiently.
              </p>

              {/* Checklist 2x2 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-8 max-w-md mx-auto lg:mx-0">
                {checkItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>

              {/* Primary CTA stack */}
              <div className="flex flex-col gap-3 items-center lg:items-start mb-4 max-w-md mx-auto lg:mx-0">
                <Button
                  size="lg"
                  className="w-full bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-gray-900 font-bold text-base px-8 rounded-full shadow-md"
                  onClick={() => openTrialFlow("learner")}
                >
                  Start 7-day free trial
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-2 border-gray-300 text-gray-800 hover:bg-gray-50 font-semibold text-base px-8 rounded-full"
                  onClick={() => openTrialFlow("tutor")}
                >
                  Become a tutor
                </Button>
                <p className="text-xs text-gray-500">No card required · cancel anytime</p>
              </div>

              {/* Secondary CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-700 hover:text-gray-900 font-semibold rounded-full"
                  onClick={() => openTrialFlow("learner")}
                >
                  Start Learning →
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[hsl(220,80%,50%)] hover:text-[hsl(220,80%,40%)] font-semibold rounded-full"
                  onClick={() => openTrialFlow("tutor")}
                >
                  Find a Tutor →
                </Button>
              </div>

              <p className="text-sm text-gray-400">
                Trusted by students preparing for exams across Africa.
              </p>
            </div>

            {/* Right -- student group photo */}
            <div className="flex-1 flex justify-center items-center relative">
              <img
                src="/images/students-group.png"
                alt="Group of diverse students"
                className="w-full max-w-lg rounded-3xl object-cover"
              />
            </div>
          </div>

          {/* Bottom feature cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            <FeatureCard
              icon={<Brain className="h-6 w-6 text-blue-600" />}
              title="AI Study"
              highlight="Mode"
              description="Your AI-powered study partner."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6 text-blue-600" />}
              title="Tutor"
              highlight="Marketplace"
              description="Verified tutors available online."
            />
            <FeatureCard
              icon={<BookOpen className="h-6 w-6 text-blue-600" />}
              title="Smart Learning"
              highlight="Library"
              description="Video, textbooks & past exams."
            />
            <FeatureCard
              icon={<Cpu className="h-6 w-6 text-blue-600" />}
              title="Personalized"
              highlight="Algorithm"
              description="Adaptive study plans just for you."
            />
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
