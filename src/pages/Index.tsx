import { Suspense, lazy, useEffect } from "react";
import { MessageCircle } from "lucide-react";
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
const ContactStrip = lazy(() => import("@/components/ContactStrip"));
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
        <ContactStrip />
        <Footer />
        <PWAInstallPrompt />
        <CookieConsent />
      </Suspense>

      <a
        href="https://wa.me/27686523995?text=Hi%20StudySync%2C%20I%27d%20like%20to%20know%20more"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:scale-110 hover:bg-emerald-600 hover:shadow-xl"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
};

export default Index;

