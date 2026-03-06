import { useEffect, useState } from "react";

interface LaunchScreenProps {
  onComplete: () => void;
}

const LaunchScreen = ({ onComplete }: LaunchScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500); // Wait for fade animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center transition-opacity duration-500 z-50 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center space-y-6 animate-pulse">
        <div className="flex items-center justify-center">
          <img 
            src="/lovable-uploads/studysync-logo.png" 
            alt="StudySync" 
            className="h-20 w-auto object-contain animate-bounce"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
          />
        </div>
        <p className="text-xs font-semibold tracking-widest uppercase text-white/75" style={{ letterSpacing: "0.12em" }}>
          Education, in sync with your future
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    </div>
  );
};

export default LaunchScreen;