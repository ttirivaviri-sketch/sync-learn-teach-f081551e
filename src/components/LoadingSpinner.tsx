import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className={cn(
      "animate-spin rounded-full border-2 border-transparent border-t-current",
      sizeClasses[size],
      className
    )} />
  );
};

export const LoadingScreen = ({ message = "Loading..." }: { message?: string }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <LoadingSpinner size="lg" className="text-primary mb-4" />
      <p className="text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
};