import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Upload,
  Brain,
  Trophy,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  number: string;
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  gradient: string;
}

const steps: Step[] = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Profile",
    description: "Sign up in under 60 seconds. Tell us your curriculum, subjects, and exam dates.",
    details: [
      "Choose your exam board (Cambridge, IEB, NSC)",
      "Select your subjects and grade level",
      "Set your exam dates for countdown tracking",
    ],
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    number: "02",
    icon: Upload,
    title: "Upload Your Materials",
    description: "Add your syllabus, past papers, or notes. AI parses them into structured study content.",
    details: [
      "Drag-and-drop PDF upload",
      "AI extracts topics, weightings, and patterns",
      "Builds your personalised curriculum map",
    ],
    gradient: "from-violet-500 to-purple-600",
  },
  {
    number: "03",
    icon: Brain,
    title: "Study with AI",
    description: "Get a daily adaptive study plan with quizzes, flashcards, and exam practice -- all aligned to your syllabus.",
    details: [
      "AI-generated quizzes target weak areas",
      "Spaced repetition locks in key concepts",
      "Real-time feedback from AI tutor chat",
    ],
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    number: "04",
    icon: Trophy,
    title: "Ace Your Exams",
    description: "Track your mastery, close knowledge gaps, and walk into every exam confident and prepared.",
    details: [
      "Performance analytics per topic",
      "Mastery progress tracking",
      "Exam readiness score before test day",
    ],
    gradient: "from-amber-500 to-orange-500",
  },
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section id="how-it-works" className="py-28 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-20">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            How It Works
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-5">
            From sign-up to exam success<br className="hidden md:block" /> in four steps
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            StudySync gets you studying in minutes, not hours. Here's how it works.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical connecting line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-border via-primary/30 to-border -translate-x-1/2" />

          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, i) => {
              const isEven = i % 2 === 0;

              return (
                <div
                  key={i}
                  className={`relative flex flex-col lg:flex-row items-center gap-8 lg:gap-16 ${
                    !isEven ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  {/* Content side */}
                  <div className={`flex-1 ${isEven ? "lg:text-right" : "lg:text-left"}`}>
                    <div className={`max-w-md ${isEven ? "lg:ml-auto" : ""}`}>
                      {/* Step number */}
                      <span
                        className={`inline-block text-xs font-bold uppercase tracking-widest mb-3 bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent`}
                      >
                        Step {step.number}
                      </span>

                      <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
                        {step.title}
                      </h3>

                      <p className="text-muted-foreground text-base leading-relaxed mb-5">
                        {step.description}
                      </p>

                      {/* Detail checklist */}
                      <ul className={`space-y-2.5 ${isEven ? "lg:flex lg:flex-col lg:items-end" : ""}`}>
                        {step.details.map((detail, j) => (
                          <li
                            key={j}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Center icon (on the timeline) */}
                  <div className="relative shrink-0 z-10">
                    <div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}
                    >
                      <step.icon className="h-9 w-9 text-white" />
                    </div>
                    {/* Glow */}
                    <div
                      className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient} blur-xl opacity-30`}
                    />
                  </div>

                  {/* Spacer side (for layout balance on desktop) */}
                  <div className="flex-1 hidden lg:block" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-3xl blur-xl" />
            <div className="relative bg-white border border-border/60 rounded-3xl p-10 md:p-14 shadow-elegant">
              <h3 className="text-3xl md:text-4xl font-display font-extrabold text-foreground mb-4">
                Ready to start studying smarter?
              </h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of students who are acing their exams with StudySync's AI-powered study tools and expert tutors.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white shadow-glow font-bold text-base px-8 gap-2 group"
                  onClick={() => navigate("/learner/auth")}
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border font-semibold text-base px-8"
                  onClick={() => navigate("/tutor/auth")}
                >
                  Become a Tutor
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowItWorksSection;
