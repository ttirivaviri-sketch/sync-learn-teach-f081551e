import { useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  rating: number;
  subject: string;
  initials: string;
  avatarColor: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "University Student",
    content:
      "StudySync helped me find an amazing calculus tutor who completely transformed my understanding. My grades went from C to A in just 6 weeks!",
    rating: 5,
    subject: "Mathematics",
    initials: "SC",
    avatarColor: "from-blue-500 to-indigo-600",
  },
  {
    id: 2,
    name: "Dr. Michael Rodriguez",
    role: "Professional Tutor",
    content:
      "As a former university professor, StudySync gives me the perfect platform to continue teaching. The booking system is seamless and students are genuinely engaged.",
    rating: 5,
    subject: "Physics",
    initials: "MR",
    avatarColor: "from-violet-500 to-purple-600",
  },
  {
    id: 3,
    name: "Emma Thompson",
    role: "High School Student",
    content:
      "The chemistry tutor I found through StudySync made complex concepts so easy to understand. I passed my matric with distinction!",
    rating: 5,
    subject: "Chemistry",
    initials: "ET",
    avatarColor: "from-teal-500 to-emerald-600",
  },
  {
    id: 4,
    name: "Sipho Dlamini",
    role: "Grade 12 Learner",
    content:
      "Finding a tutor near me used to be impossible. With StudySync I booked a verified maths tutor the same afternoon. Game-changer!",
    rating: 5,
    subject: "Mathematics",
    initials: "SD",
    avatarColor: "from-amber-500 to-orange-500",
  },
  {
    id: 5,
    name: "Aisha Patel",
    role: "Part-Time Tutor",
    content:
      "I started tutoring on StudySync while completing my Honours degree. The earnings are great and the platform is incredibly easy to use.",
    rating: 5,
    subject: "Accounting",
    initials: "AP",
    avatarColor: "from-pink-500 to-rose-600",
  },
];

/* ── Star row ────────────────────────────────────────── */
const Stars = ({ count }: { count: number }) => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < count ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
      />
    ))}
  </div>
);

/* ── Subject pill ────────────────────────────────────── */
const SubjectPill = ({ label }: { label: string }) => (
  <span className="text-xs bg-primary-light text-primary font-semibold px-2.5 py-1 rounded-full">
    {label}
  </span>
);

/* ══════════════════════════════════════════════════════
   TestimonialSection
   ══════════════════════════════════════════════════════ */
export const TestimonialSection = () => {
  const [active, setActive] = useState(0);

  const prev = () => setActive((a) => (a - 1 + testimonials.length) % testimonials.length);
  const next = () => setActive((a) => (a + 1) % testimonials.length);

  /* Visible window of 3 (wrapping) */
  const visible = [
    testimonials[(active) % testimonials.length],
    testimonials[(active + 1) % testimonials.length],
    testimonials[(active + 2) % testimonials.length],
  ];

  return (
    <section id="testimonials" className="py-28 px-4 sm:px-6 lg:px-8 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            Testimonials
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
            What our community says
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Thousands of learners and tutors trust StudySync to connect them.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {visible.map((t, i) => (
            <div
              key={t.id}
              className={`group relative bg-white rounded-2xl p-7 border transition-all duration-300 hover:-translate-y-1 ${
                i === 0
                  ? "border-primary/30 shadow-elegant"
                  : "border-border shadow-card hover:shadow-elegant"
              }`}
            >
              {/* Quote icon */}
              <Quote className="absolute top-5 right-5 h-8 w-8 text-primary/10 group-hover:text-primary/20 transition-colors" />

              {/* Stars */}
              <Stars count={t.rating} />

              {/* Content */}
              <p className="mt-4 text-muted-foreground text-sm leading-relaxed line-clamp-3 italic">
                "{t.content}"
              </p>

              {/* Author row */}
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${t.avatarColor} shadow-sm shrink-0`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                <SubjectPill label={t.subject} />
              </div>

              {/* Featured accent border */}
              {i === 0 && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-violet-500 rounded-t-2xl" />
              )}
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prev}
            className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-full transition-all ${
                  i === active ? "bg-primary w-5 h-2" : "bg-border w-2 h-2 hover:bg-muted-foreground"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Overall rating strip */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-center">
          <div>
            <p className="text-4xl font-display font-extrabold text-foreground">4.9</p>
            <Stars count={5} />
            <p className="text-xs text-muted-foreground mt-1">Overall rating</p>
          </div>
          <div className="w-px h-12 bg-border hidden sm:block" />
          <div>
            <p className="text-4xl font-display font-extrabold text-foreground">2 400+</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Verified reviews</p>
          </div>
          <div className="w-px h-12 bg-border hidden sm:block" />
          <div>
            <p className="text-4xl font-display font-extrabold text-foreground">98%</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Would recommend</p>
          </div>
        </div>

      </div>
    </section>
  );
};
