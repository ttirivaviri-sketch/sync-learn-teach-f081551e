import HeroSection from "@/components/HeroSection";
import AppShowcase from "@/components/AppShowcase";
import TrustSection from "@/components/TrustSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <AppShowcase />
      <TrustSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Index;