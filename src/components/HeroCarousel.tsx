import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  BookOpen,
  Calendar,
  CheckCircle,
  GraduationCap,
  MessageCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { openWhatsAppAdmin, WHATSAPP_ADMIN_URL } from "@/lib/whatsapp";
import { track } from "@/utils/landingAnalytics";
import heroTutorMarketplace from "@/assets/hero-tutor-marketplace.jpg";
import heroSmartLibrary from "@/assets/hero-smart-library.jpg";
import heroStudyPlanner from "@/assets/hero-study-planner.jpg";

/* ─────────────────────────────────────────────────────────
   Floating badge chip used in slide 1
   ───────────────────────────────────────────────────────── */
const FloatingBadge = ({
  icon,
  label,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) => (
  <div
    className={`absolute hidden md:flex flex-col items-center gap-1 rounded-2xl px-3 py-2 shadow-lg backdrop-blur-sm animate-fade-in ${className}`}
  >
    {icon}
    <span className="text-[11px] font-semibold text-gray-800 text-center leading-tight max-w-[80px]">
      {label}
    </span>
  </div>
);

/* ─────────────────────────────────────────────────────────
   Reusable slide shell
   ───────────────────────────────────────────────────────── */
const SlideShell = ({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) => (
  <div className="flex-[0_0_100%] min-w-0 h-full overflow-y-auto">
    <div className="min-h-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-20 pb-32 lg:pt-28 lg:pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div className="order-2 lg:order-1">{left}</div>
        <div className="order-1 lg:order-2 flex justify-center items-center">
          {right}
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   Slide 1 — AI Study Mode + WhatsApp CTA (matches reference)
   ───────────────────────────────────────────────────────── */
const Slide1 = () => {
  const checks = [
    "AI study assistant",
    "Expert tutors",
    "Past paper exam practice",
    "Personalized study schedules",
  ];

  const handleWhatsApp = () => {
    track("cta_click", { id: "hero_whatsapp_admin", slide: 1 });
    openWhatsAppAdmin();
  };

  return (
    <SlideShell
      left={
        <div className="text-center lg:text-left animate-fade-in">
          <h1 className="text-[clamp(2rem,8vw,4rem)] font-extrabold text-gray-900 leading-[1.05] tracking-tight mb-4 max-w-[16ch] mx-auto lg:mx-0">
            Learn <span className="text-gray-900">smarter.</span>
            <br />
            Pass <span className="text-[hsl(45,100%,45%)]">faster.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-6 max-w-xl mx-auto lg:mx-0">
            AI-powered learning, expert tutors and a smart study library — all
            in one place to help you master your subjects.
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-6 max-w-md mx-auto lg:mx-0">
            {checks.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-gray-700">{c}</span>
              </li>
            ))}
          </ul>

          <a
            href={WHATSAPP_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              handleWhatsApp();
            }}
            className="inline-flex items-center gap-3 bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-gray-900 font-bold rounded-2xl px-5 py-3.5 shadow-md transition-colors max-w-md w-full lg:w-auto"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="text-left text-sm sm:text-base leading-tight flex-1">
              Contact our admin and build your child's study plan
            </span>
            <ArrowRight className="h-5 w-5 shrink-0" />
          </a>

          <div className="flex items-center gap-3 mt-6 justify-center lg:justify-start">
            <div className="flex -space-x-2">
              {[
                "https://i.pravatar.cc/40?img=12",
                "https://i.pravatar.cc/40?img=32",
                "https://i.pravatar.cc/40?img=47",
                "https://i.pravatar.cc/40?img=58",
              ].map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-white object-cover"
                  loading="lazy"
                />
              ))}
              <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                2K+
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-tight">
              Join 2,000+ students
              <br />
              already achieving more
            </p>
          </div>
        </div>
      }
      right={
        <div className="relative w-full max-w-lg">
          <div className="absolute inset-0 -z-10 bg-blue-100/40 rounded-full blur-3xl" />
          <img
            src="/images/students-group.png"
            alt="Students learning with StudySync"
            className="w-full rounded-3xl object-cover"
          />

          <FloatingBadge
            icon={<Brain className="h-5 w-5 text-blue-600" />}
            label="AI Study Assistant"
            className="top-6 -left-2 bg-white/90"
          />
          <FloatingBadge
            icon={<GraduationCap className="h-5 w-5 text-amber-600" />}
            label="Expert Tutors"
            className="top-10 -right-2 bg-amber-100/90"
          />
          <FloatingBadge
            icon={<BookOpen className="h-5 w-5 text-purple-600" />}
            label="Smart Library"
            className="top-1/2 -left-4 bg-purple-100/90"
          />
          <FloatingBadge
            icon={<Calendar className="h-5 w-5 text-emerald-600" />}
            label="Study Planner"
            className="bottom-16 -right-4 bg-emerald-100/90"
          />
        </div>
      }
    />
  );
};

/* ─────────────────────────────────────────────────────────
   Generic feature slide
   ───────────────────────────────────────────────────────── */
const FeatureSlide = ({
  eyebrow,
  title,
  highlight,
  description,
  bullets,
  ctaLabel,
  onCta,
  image,
  imageAlt,
  accent,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
  onCta: () => void;
  image: string;
  imageAlt: string;
  accent: "blue" | "amber" | "emerald" | "purple";
}) => {
  const accents: Record<string, string> = {
    blue: "bg-blue-100/40 text-blue-700",
    amber: "bg-amber-100/40 text-amber-700",
    emerald: "bg-emerald-100/40 text-emerald-700",
    purple: "bg-purple-100/40 text-purple-700",
  };
  const ctaBg: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    amber: "bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-gray-900",
    emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
    purple: "bg-purple-600 hover:bg-purple-700 text-white",
  };

  return (
    <SlideShell
      left={
        <div className="text-center lg:text-left animate-fade-in">
          <span
            className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4 ${accents[accent]}`}
          >
            {eyebrow}
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.05] mb-5">
            {title} <span className="text-blue-600">{highlight}</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 mb-6 max-w-xl mx-auto lg:mx-0">
            {description}
          </p>

          <ul className="space-y-3 mb-8 max-w-md mx-auto lg:mx-0">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-gray-700">{b}</span>
              </li>
            ))}
          </ul>

          <Button
            size="lg"
            onClick={onCta}
            className={`rounded-full px-8 font-bold shadow-md ${ctaBg[accent]}`}
          >
            {ctaLabel}
            <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      }
      right={
        <div className="relative w-full max-w-lg">
          <div
            className={`absolute inset-0 -z-10 rounded-full blur-3xl ${accents[accent]}`}
          />
          <img
            src={image}
            alt={imageAlt}
            loading="lazy"
            className="w-full rounded-3xl object-cover shadow-xl"
          />
        </div>
      }
    />
  );
};

/* ─────────────────────────────────────────────────────────
   Main carousel
   ───────────────────────────────────────────────────────── */
const HeroCarousel = () => {
  const navigate = useNavigate();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    skipSnaps: false,
  });
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(4);

  const scrollTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi]
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    setSnapCount(emblaApi.scrollSnapList().length);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
  }, [emblaApi]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") scrollNext();
      if (e.key === "ArrowLeft") scrollPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollNext, scrollPrev]);

  const slides = [
    <Slide1 key="s1" />,
    <FeatureSlide
      key="s2"
      eyebrow="Tutor Marketplace"
      title="Verified tutors,"
      highlight="on your schedule."
      description="Find expert tutors for Maths, Sciences, English and more — book a 30-minute slot online or in person."
      bullets={[
        "Background-checked tutors",
        "Online or in-person sessions",
        "Transparent ratings & reviews",
      ]}
      ctaLabel="Find a tutor"
      onCta={() => {
        track("cta_click", { id: "hero_find_tutor", slide: 2 });
        navigate("/learner/auth");
      }}
      image={heroTutorMarketplace}
      imageAlt="Verified online tutor"
      accent="amber"
    />,
    <FeatureSlide
      key="s3"
      eyebrow="Smart Learning Library"
      title="Videos, notes,"
      highlight="past papers."
      description="Watch curated tutorials, download notes and practise with real past exam papers — all aligned to your curriculum."
      bullets={[
        "Curriculum-aligned content",
        "Real past exam papers",
        "Short, focused tutorial clips",
      ]}
      ctaLabel="Explore library"
      onCta={() => {
        track("cta_click", { id: "hero_explore_library", slide: 3 });
        navigate("/learner/auth");
      }}
      image={heroSmartLibrary}
      imageAlt="Smart learning library of books and videos"
      accent="purple"
    />,
    <FeatureSlide
      key="s4"
      eyebrow="Study Planner & Practice"
      title="Plan, practise,"
      highlight="progress."
      description="An AI study plan that adapts to how you learn — daily tasks, quizzes, and mock exams that keep you on track."
      bullets={[
        "Adaptive daily tasks",
        "Auto-marked quizzes",
        "Cancel anytime",
      ]}
      ctaLabel="Start learning today"
      onCta={() => {
        track("cta_click", { id: "hero_start_learning", slide: 4 });
        navigate("/learner/auth");
      }}
      image={heroStudyPlanner}
      imageAlt="Study planner with calendar and progress"
      accent="emerald"
    />,
  ];

  return (
    <section
      className="relative w-full h-[100svh] bg-gradient-to-b from-white to-blue-50/40 overflow-hidden"
      aria-roledescription="carousel"
      aria-label="StudySync feature highlights"
    >
      {/* Carousel viewport */}
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">{slides}</div>
      </div>

      {/* Pagination — bottom left */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 flex items-center gap-4">
        {Array.from({ length: snapCount }).map((_, i) => {
          const active = i === selected;
          return (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="flex flex-col items-center gap-1 group"
            >
              <span
                className={`text-base font-bold tabular-nums ${
                  active ? "text-blue-600" : "text-gray-400"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`h-0.5 transition-all ${
                  active
                    ? "w-10 bg-blue-600"
                    : "w-6 bg-gray-300 group-hover:bg-gray-400"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Prev / Next — bottom right */}
      <div className="absolute bottom-6 right-4 lg:right-8 flex items-center gap-3">
        <button
          onClick={scrollPrev}
          disabled={selected === 0}
          aria-label="Previous slide"
          className="h-12 w-12 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={scrollNext}
          disabled={selected === snapCount - 1}
          aria-label="Next slide"
          className="h-12 w-12 rounded-full bg-blue-600 shadow-md flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
};

export default HeroCarousel;
