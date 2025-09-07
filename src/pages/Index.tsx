import HeroSection from "@/components/HeroSection";
import AppShowcase from "@/components/AppShowcase";
import TrustSection from "@/components/TrustSection";
import FeaturesSection from "@/components/FeaturesSection";
import { TestimonialSection } from "@/components/TestimonialSection";
import { StatsSection } from "@/components/StatsSection";
import Footer from "@/components/Footer";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CookieConsent } from "@/components/CookieConsent";
import { useEffect } from "react";
import { analytics } from "@/utils/analytics";

const Index = () => {
  useEffect(() => {
    analytics.pageView('home');
  }, []);

  return (
    <div className="min-h-screen">
      <HeroSection />
      <StatsSection />
      <AppShowcase />
      <FeaturesSection />
      <TestimonialSection />
      <TrustSection />
      <Footer />
      <PWAInstallPrompt />
      <CookieConsent />
    </div>
  );
};

export default Index;