import { useNavigate } from "react-router-dom";
import {
  Smartphone,
  Globe,
  Zap,
  DollarSign,
  BookOpen,
  Users,
  ArrowRight,
} from "lucide-react";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  bg: string;
}

const features: Feature[] = [
  {
    icon: Smartphone,
    title: "Android Optimized",
    description: "Built for Android devices — optimised for low-end phones and minimal data usage.",
    gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
  },
  {
    icon: Globe,
    title: "Multilingual Support",
    description: "Available in multiple languages to serve diverse communities and educational needs.",
    gradient: "from-teal-500 to-emerald-600",
    bg: "bg-teal-50",
  },
  {
    icon: Zap,
    title: "Low Data Usage",
    description: "Efficient design ensures the app works well even with limited or slow connections.",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
  },
  {
    icon: DollarSign,
    title: "Affordable Learning",
    description: "Competitive pricing with flexible payment — mobile money, card, or cash.",
    gradient: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50",
  },
  {
    icon: BookOpen,
    title: "All Subjects",
    description: "From Grade 8–12 school subjects to university modules across all disciplines.",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
  },
  {
    icon: Users,
    title: "Community Driven",
    description: "Built by students, for students — creating opportunities for growth and income.",
    gradient: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
  },
];

const FeaturesSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            Why StudySync
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-5">
            Built for everyone
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            StudySync works seamlessly on Android, supports multilingual users, 
            and is designed with data efficiency in mind.
          </p>
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

        {/* Bottom CTA banner */}
        <div className="mt-20 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(230,90%,42%)] via-[hsl(245,85%,50%)] to-[hsl(260,88%,44%)] p-10 md:p-14 text-center shadow-elegant">
          {/* Mesh blobs */}
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full bg-white/10 blur-[72px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-violet-300/15 blur-[60px] pointer-events-none" />

          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-4">
              Ready to transform your education?
            </h3>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Join thousands of students and tutors who are making quality education accessible for everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate("/learner/auth")}
                className="inline-flex items-center justify-center gap-2 bg-white text-primary hover:bg-white/90 px-8 py-3.5 rounded-xl font-bold text-sm shadow-glow transition-all group"
              >
                Start Learning Today
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate("/tutor/auth")}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white hover:bg-white/15 hover:border-white/60 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all"
              >
                Apply as Tutor
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default FeaturesSection;
