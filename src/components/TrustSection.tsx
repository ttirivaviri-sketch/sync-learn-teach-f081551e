import {
  Shield,
  Award,
  Users,
  CheckCircle,
  FileCheck,
  Star,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TrustCard {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  steps: string[];
}

const trustCards: TrustCard[] = [
  {
    icon: FileCheck,
    title: "Document Verification",
    description:
      "All tutors must provide valid ID and academic certificates. We verify Matric certificates and university transcripts.",
    gradient: "from-blue-500 to-indigo-600",
    steps: ["ID document", "Academic certificates", "Matric / university transcript"],
  },
  {
    icon: Shield,
    title: "Background Checks",
    description:
      "Criminal background verification ensures the safety and security of all learning interactions on our platform.",
    gradient: "from-teal-500 to-emerald-600",
    steps: ["Criminal record check", "Identity confirmation", "Ongoing monitoring"],
  },
  {
    icon: Star,
    title: "Quality Ratings",
    description:
      "Student feedback and ratings help maintain high teaching standards and guide future learners in their selection.",
    gradient: "from-amber-500 to-orange-500",
    steps: ["Post-session reviews", "Verified ratings", "Performance monitoring"],
  },
];

const TrustSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-28 bg-muted/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-4 h-px bg-border block" />
            Safety & Trust
            <span className="w-4 h-px bg-border block" />
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-5">
            Your safety, our commitment
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Every tutor on StudySync is verified, background-checked, and rated by real students --
            so you can focus on learning with complete confidence.
          </p>
        </div>

        {/* Trust cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {trustCards.map((card, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl p-8 shadow-card border border-border/60 hover:border-primary/20 hover:shadow-elegant hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
            >
              {/* Gradient blob */}
              <div
                className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`}
              />

              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} mb-6 shadow-md group-hover:scale-110 transition-transform duration-300`}
              >
                <card.icon className="h-7 w-7 text-white" />
              </div>

              <h3 className="text-lg font-display font-bold text-foreground mb-3">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{card.description}</p>

              {/* Steps checklist */}
              <ul className="space-y-2">
                {card.steps.map((step, j) => (
                  <li key={j} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>

              {/* Bottom accent */}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r ${card.gradient}`} />
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div className="bg-white rounded-3xl shadow-elegant border border-border/50 p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-10 text-center">
            {[
              { Icon: CheckCircle, value: "100%", label: "Verified Tutors", color: "text-primary", gradient: "from-blue-500 to-indigo-600" },
              { Icon: Award,        value: "500+",  label: "Qualified Educators", color: "text-secondary", gradient: "from-teal-500 to-emerald-600" },
              { Icon: Users,        value: "1 000+",label: "Happy Students", color: "text-primary", gradient: "from-violet-500 to-purple-600" },
            ].map(({ Icon, value, label, gradient }, i) => (
              <div key={i} className="group flex flex-col items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-display font-extrabold text-foreground mb-1">{value}</p>
                  <p className="text-sm text-muted-foreground font-medium">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate("/learner/auth")}
              className="inline-flex items-center gap-2 bg-primary text-white hover:bg-primary/90 px-7 py-3 rounded-xl font-bold text-sm shadow-elegant transition-all group"
            >
              Get Started Safely
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};

export default TrustSection;
