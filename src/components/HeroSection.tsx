import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-education.jpg";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="StudySync - Connecting learners with verified tutors"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-hero opacity-80"></div>
      </div>
      
      {/* Admin Panel link for staff */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          size="sm"
          variant="outline"
          className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
          onClick={() => navigate("/admin/auth")}
          aria-label="Open Admin Panel"
        >
          Admin Panel
        </Button>
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-float">
          <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6">
            Study<span className="text-primary-glow">Sync</span>
          </h1>
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-3xl mx-auto">
            Connecting learners with verified, qualified tutors for school and university subjects
          </p>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-2xl mx-auto">
            Making quality education accessible while helping educated individuals earn income by teaching what they know
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Button 
            size="lg" 
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-elegant px-8 py-4 text-lg"
            onClick={() => navigate("/learner/auth")}
          >
            Find a Tutor
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-4 text-lg"
            onClick={() => navigate("/tutor/auth")}
          >
            Become a Tutor
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;