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
        <img 
          src="/lovable-uploads/studysync-logo.png" 
          alt="StudySync" 
          className="mx-auto h-20 object-contain animate-bounce"
        />
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    </div>
  );
};

export default LaunchScreen;