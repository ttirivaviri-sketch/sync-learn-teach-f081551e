import { useNavigate } from "react-router-dom";
import {
  Brain,
  Zap,
  BookOpen,
  Users,
  ArrowRight,
  GraduationCap,
  FileText,
  BarChart3,
  Target,
  Library,
  Shield,
} from "lucide-react";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  bg: string;
  category: "ai" | "tutors" | "library";
}

const features: Feature[] = [
  {
    icon: Brain,
    title: "AI-Generated Quizzes",
    description: "Adaptive quizzes that target your weak areas and match your exam board format -- Cambridge, IEB, or NSC.",
    gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
    category: "ai",
  },
  {
    icon: Zap,
    title: "Smart Flashcards",
    description: "AI builds flashcards from your syllabus and past papers. Spaced repetition ensures you remember what matters.",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    category: "ai",
  },
  {
    icon: Target,
    title: "Exam-Style Practice",
    description: "Real past-paper questions with AI marking, step-by-step solutions, and examiner-style feedback.",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    category: "ai",
  },
  {
    icon: Users,
    title: "Verified Expert Tutors",
    description: "Book qualified, background-checked tutors for 1-on-1 sessions -- online or in person, on your schedule.",
    gradient: "from-teal-500 to-emerald-600",
    bg: "bg-teal-50",
    category: "tutors",
  },
  {
    icon: GraduationCap,
    title: "Subject Specialists",
    description: "From Grade 8-12 sciences to university-level engineering -- find a tutor who knows your exact syllabus.",
    gradient: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50",
    category: "tutors",
  },
  {
    icon: Library,
    title: "Curriculum Resource Library",
    description: "Upload your syllabus, past papers, and notes. StudySync parses them into structured, actionable study material.",
    gradient: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
    category: "library",
  },
];

const categoryLabels: Record<string, { label: string; icon: React.ElementType }> = {
  ai: { label: "AI Study Tools", icon: Brain },
  tutors: { label: "Expert Tutors", icon: Users },
  library: { label: "Resource Library", icon: Library },
};

const FeaturesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="features" className="py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            Everything You Need to Succeed
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-5">
            Three pillars of exam success
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            AI-powered study tools, verified expert tutors, and a curriculum-aligned resource library
            -- working together so you study smarter, not harder.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {Object.entries(categoryLabels).map(([key, { label, icon: Icon }]) => (
            <div
              key={key}
              className="inline-flex items-center gap-2 bg-white border border-border/60 rounded-full px-5 py-2 shadow-sm"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-2xl p-7 shadow-card hover:shadow-elegant border border-border/60 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Top-right gradient blob */}
              <div
                className={`absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`}
              />

              {/* Category tag */}
              <div className="mb-4">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    f.category === "ai"
                      ? "bg-blue-50 text-blue-600"
                      : f.category === "tutors"
                      ? "bg-teal-50 text-teal-600"
                      : "bg-pink-50 text-pink-600"
                  }`}
                >
                  {categoryLabels[f.category].label}
                </span>
              </div>

              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-13 h-13 rounded-xl bg-gradient-to-br ${f.gradient} mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}
                style={{ width: 52, height: 52 }}
              >
                <f.icon className="h-6 w-6 text-white" />
              </div>

              <h3 className="text-lg font-display font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>

              {/* Hover indicator */}
              <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r ${f.gradient}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
