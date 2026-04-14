import {
  Brain,
  Zap,
  BookOpen,
  Users,
  GraduationCap,
  Library,
  Target,
} from "lucide-react";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: Brain,
    title: "AI-Generated Quizzes",
    description: "Adaptive quizzes that target your weak areas and match your exam board format.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Zap,
    title: "Smart Flashcards",
    description: "AI builds flashcards from your syllabus. Spaced repetition ensures you remember.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Target,
    title: "Exam-Style Practice",
    description: "Real past-paper questions with AI marking and examiner-style feedback.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Users,
    title: "Verified Expert Tutors",
    description: "Book qualified, background-checked tutors for 1-on-1 sessions.",
    color: "bg-teal-50 text-teal-600",
  },
  {
    icon: GraduationCap,
    title: "Subject Specialists",
    description: "From Grade 8-12 sciences to university-level -- find a tutor for your syllabus.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Library,
    title: "Curriculum Library",
    description: "Upload syllabus, past papers, and notes. AI parses them into study material.",
    color: "bg-pink-50 text-pink-600",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            Everything you need to succeed
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            AI-powered study tools, verified expert tutors, and a curriculum-aligned resource library.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const colorBg = f.color.split(" ")[0];
            const colorText = f.color.split(" ")[1];
            return (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colorBg} mb-4`}>
                  <f.icon className={`h-6 w-6 ${colorText}`} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
