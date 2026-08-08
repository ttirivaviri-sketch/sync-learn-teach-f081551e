import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

/**
 * LandingStickyCTA — always-visible entry point into the app on mobile.
 * Appears once the visitor scrolls past the hero.
 */
const LandingStickyCTA = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden">
      <div className="flex items-center gap-3 pb-[env(safe-area-inset-bottom)]">
        <Button
          className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-dark"
          onClick={() => navigate("/learner/auth")}
        >
          <GraduationCap className="mr-2 h-4 w-4" />
          Start learning free
        </Button>
        <button
          className="whitespace-nowrap px-2 text-sm font-medium text-gray-600"
          onClick={() => navigate("/learner/auth")}
        >
          Sign in
        </button>
      </div>
    </div>
  );
};

export default LandingStickyCTA;
