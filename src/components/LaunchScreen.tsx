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
      <div className="text-center space-y-8 animate-pulse">
        <div className="w-32 h-32 mx-auto">
          <img 
            src="/lovable-uploads/studysync-logo.png" 
            alt="StudySync Logo" 
            className="w-full h-full object-contain animate-bounce"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">StudySync</h1>
          <p className="text-white/80 text-lg">Learner App</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    </div>
  );
};

export default LaunchScreen;