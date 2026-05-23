import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";

/* ── Navbar ─────────────────────────────────────────── */
const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const openTrialFlow = (role: "learner" | "tutor") =>
    navigate(role === "tutor" ? "/tutor/auth" : "/learner/auth");

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
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <img
            src="/lovable-uploads/studysync-logo.png"
            alt="StudySync"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </button>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", id: "features" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

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

        <button
          className="md:hidden text-gray-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

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

/* ══════════════════════════════════════════════════════
   HeroSection — Navbar + full-screen swipeable carousel
   ══════════════════════════════════════════════════════ */
const HeroSection = () => (
  <>
    <Navbar />
    <HeroCarousel />
  </>
);

export default HeroSection;
