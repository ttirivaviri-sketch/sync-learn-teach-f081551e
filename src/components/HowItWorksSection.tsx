import { UserPlus, FileText, Users, ListChecks, HelpCircle } from "lucide-react";

interface Step {
  number: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description?: string;
  highlighted?: boolean;
}

const steps: Step[] = [
  {
    number: 1,
    icon: UserPlus,
    title: "Create",
    subtitle: "your profile",
    description: "",
  },
  {
    number: 2,
    icon: FileText,
    title: "Upload syllabus",
    subtitle: "& select subjects",
    description: "Tell us what you're studying",
  },
  {
    number: 3,
    icon: Users,
    title: "Book a tutor",
    subtitle: "",
    description: "Connect with an expert tutor for extra help",
    highlighted: true,
  },
  {
    number: 4,
    icon: ListChecks,
    title: "Get daily",
    subtitle: "personalized tasks",
    description: "",
  },
  {
    number: 5,
    icon: HelpCircle,
    title: "Book tutors",
    subtitle: "when needed",
    description: "Get help from tutors when you face challenges",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            How <span className="font-extrabold">StudySync</span> Works
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-12">
          {/* Left -- video call photo */}
          <div className="w-full lg:w-[380px] shrink-0">
            <img
              src="/images/boy-videocall.png"
              alt="Student on video call with tutor"
              className="w-full rounded-2xl object-cover shadow-lg"
            />
          </div>

          {/* Right -- steps */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className={`relative rounded-2xl p-5 transition-all ${
                  step.highlighted
                    ? "bg-white border-2 border-blue-200 shadow-md col-span-2 sm:col-span-1"
                    : "bg-white border border-gray-100"
                }`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                  step.highlighted ? "bg-blue-100" : "bg-gray-100"
                }`}>
                  <step.icon className={`h-5 w-5 ${step.highlighted ? "text-blue-600" : "text-gray-600"}`} />
                </div>

                {/* Number */}
                <span className="text-xs font-bold text-blue-500 mb-1 block">{step.number}</span>

                {/* Title */}
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {step.title}
                </h3>
                {step.subtitle && (
                  <p className="text-sm font-bold text-gray-900 leading-tight">{step.subtitle}</p>
                )}

                {/* Description */}
                {step.description && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{step.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
