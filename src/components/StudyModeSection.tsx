import { useNavigate } from "react-router-dom";
import {
  Brain,
  Zap,
  Target,
  BarChart3,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle,
  BookOpen,
  Clock,
  TrendingUp,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudyModeFeature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const studyModeFeatures: StudyModeFeature[] = [
  {
    icon: Brain,
    title: "Active Recall Engine",
    description: "10+ AI questions per topic. Semantic answer evaluation scores 0-100%, identifies misconceptions, and gives structured feedback with model answers.",
  },
  {
    icon: Clock,
    title: "Exam Mode",
    description: "Timed questions under exam conditions. No hints. AI examiner grades with mark breakdowns, reasoning, and grade boundaries.",
  },
  {
    icon: Target,
    title: "Mastery System",
    description: "Track mastery per topic using accuracy, improvement trends, and consistency. Classify as Mastered, Developing, or Needs Reinforcement.",
  },
  {
    icon: Layers,
    title: "Spaced Repetition",
    description: "SM-2 algorithm resurfaces weak questions automatically. Previously incorrect answers get priority. Frequency adapts to your performance.",
  },
  {
    icon: BarChart3,
    title: "Insights Dashboard",
    description: "Track accuracy per topic, weak areas, improvement trends, and common mistakes. AI generates insights like 'struggles with application questions'.",
  },
  {
    icon: Zap,
    title: "Personalisation Engine",
    description: "Difficulty adapts dynamically. Struggling students get simpler questions; strong performers face harder challenges. Every answer feeds the data loop.",
  },
];

const StudyModeSection = () => {
  const navigate = useNavigate();

  return (
    <section id="studymode" className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(250,50%,8%)] via-[hsl(250,45%,12%)] to-[hsl(240,40%,10%)]" />

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-20 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          {/* Premium badge */}
          <div className="inline-flex items-center gap-2 border border-violet-400/30 bg-violet-500/10 rounded-full px-5 py-2 mb-8">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-bold text-violet-200 tracking-wide uppercase">
              StudyMode
            </span>
            <span className="text-xs font-medium text-violet-400/80 bg-violet-500/20 px-2 py-0.5 rounded-full">
              Premium
            </span>
          </div>

          <h2 className="text-4xl md:text-6xl font-display font-extrabold text-white mb-6 leading-tight">
            Your AI-Powered<br />
            <span className="bg-gradient-to-r from-violet-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
              Exam Command Centre
            </span>
          </h2>

          <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
            StudyMode turns your syllabus into a personalised, adaptive study engine.
            Upload your documents, let AI analyse your curriculum, and get a study plan
            that evolves as you improve -- all aligned to your exact exam board.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {studyModeFeatures.map((f, i) => (
            <div
              key={i}
              className="group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.07] hover:border-violet-400/20 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-400/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                <f.icon className="h-6 w-6 text-violet-300" />
              </div>

              <h3 className="text-base font-display font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Highlight stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-16">
          {[
            { icon: TrendingUp, value: "95%", label: "Pass rate improvement" },
            { icon: Clock, value: "2x", label: "Faster revision cycles" },
            { icon: BookOpen, value: "50k+", label: "AI quizzes generated" },
            { icon: Target, value: "100%", label: "Curriculum-aligned" },
          ].map(({ icon: Icon, value, label }, i) => (
            <div
              key={i}
              className="text-center bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5"
            >
              <Icon className="h-5 w-5 text-violet-400 mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-display font-extrabold text-white mb-1">{value}</p>
              <p className="text-xs text-white/45 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Vision statement */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <blockquote className="text-lg md:text-xl text-white/70 leading-relaxed italic">
            "We believe every student deserves a personal study assistant that understands their
            curriculum, adapts to their pace, and prepares them with real exam-style practice
            -- regardless of where they study or what they can afford."
          </blockquote>
          <p className="text-sm text-violet-300/60 mt-4 font-medium">-- The StudySync Team</p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-lg shadow-violet-500/25 font-bold text-base px-10 gap-2 group"
              onClick={() => navigate("/learner/auth")}
            >
              Try StudyMode Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white/80 hover:bg-white/10 hover:border-white/40 font-semibold text-base px-10"
              onClick={() => navigate("/learner/auth")}
            >
              See It In Action
            </Button>
          </div>
          <p className="text-xs text-white/35 mt-4">
            No credit card required. Full access to core AI features.
          </p>
        </div>
      </div>
    </section>
  );
};

export default StudyModeSection;
