import HeroSection from "@/components/HeroSection";
import AppShowcase from "@/components/AppShowcase";
import TrustSection from "@/components/TrustSection";
import FeaturesSection from "@/components/FeaturesSection";
import StudyModeSection from "@/components/StudyModeSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import { TestimonialSection } from "@/components/TestimonialSection";
import { StatsSection } from "@/components/StatsSection";
import Footer from "@/components/Footer";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CookieConsent } from "@/components/CookieConsent";
import { useEffect } from "react";
import { analytics } from "@/utils/analytics";
import { useDevMode } from "@/contexts/DevModeContext";

const Index = () => {
  const { registerTap } = useDevMode();

  useEffect(() => {
    analytics.pageView('home');
  }, []);

  return (
    <div className="min-h-screen">
      {/* 5-tap secret: tap the hero area to activate dev mode */}
      <div onClick={registerTap}>
        <HeroSection />
      </div>
      <StatsSection />
      <FeaturesSection />
      <StudyModeSection />
      <AppShowcase />
      <HowItWorksSection />
      <TestimonialSection />
      <TrustSection />
      <Footer />
      <PWAInstallPrompt />
      <CookieConsent />
    </div>
  );
};

export default Index;
