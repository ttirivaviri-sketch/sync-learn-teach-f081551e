import { Suspense, lazy, useEffect } from "react";
import HeroSection from "@/components/HeroSection";
import { analytics } from "@/utils/analytics";

// Below-the-fold sections — lazy so the hero paints first.
const AppShowcase = lazy(() => import("@/components/AppShowcase"));
const TrustSection = lazy(() => import("@/components/TrustSection"));
const FeaturesSection = lazy(() => import("@/components/FeaturesSection"));
const StudyModeSection = lazy(() => import("@/components/StudyModeSection"));
const HowItWorksSection = lazy(() => import("@/components/HowItWorksSection"));
const TestimonialSection = lazy(() =>
  import("@/components/TestimonialSection").then((m) => ({ default: m.TestimonialSection }))
);
const StatsSection = lazy(() =>
  import("@/components/StatsSection").then((m) => ({ default: m.StatsSection }))
);
const Footer = lazy(() => import("@/components/Footer"));
const PWAInstallPrompt = lazy(() =>
  import("@/components/PWAInstallPrompt").then((m) => ({ default: m.PWAInstallPrompt }))
);
const CookieConsent = lazy(() =>
  import("@/components/CookieConsent").then((m) => ({ default: m.CookieConsent }))
);

// Lightweight placeholder so layout doesn't jump while chunks load.
const SectionFallback = () => <div className="min-h-[40vh]" aria-hidden />;

const Index = () => {
  useEffect(() => {
    analytics.pageView('home');
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <Suspense fallback={<SectionFallback />}>
        <AppShowcase />
        <HowItWorksSection />
        <FeaturesSection />
        <StudyModeSection />
        <StatsSection />
        <TestimonialSection />
        <TrustSection />
        <Footer />
        <PWAInstallPrompt />
        <CookieConsent />
      </Suspense>
    </div>
  );
};

export default Index;
