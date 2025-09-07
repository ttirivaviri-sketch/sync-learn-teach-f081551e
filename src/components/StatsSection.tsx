import { Users, BookOpen, Award, Clock } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "10,000+",
    label: "Active Students",
    description: "Learning every day"
  },
  {
    icon: BookOpen,
    value: "500+",
    label: "Expert Tutors",
    description: "Verified professionals"
  },
  {
    icon: Award,
    value: "95%",
    label: "Success Rate",
    description: "Grade improvement"
  },
  {
    icon: Clock,
    value: "50,000+",
    label: "Hours Taught",
    description: "Knowledge shared"
  }
];

export const StatsSection = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-hero">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Trusted by Students Worldwide
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Join our growing community of learners and educators
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-foreground/10 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-primary-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-primary-foreground font-semibold mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-primary-foreground/70">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};