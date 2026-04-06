import { ReactNode } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) => {
  return (
    <div className={cn("card-themed p-1", className)}>
      <div className="bg-card rounded-[calc(var(--radius)-2px)] p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="gradient-ring">
            <div className="p-6">
              {icon || <User className="h-12 w-12 text-muted-foreground" />}
            </div>
          </div>
        </div>
        <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          {description}
        </p>
        {action && (
          <Button
            onClick={action.onClick}
            className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-elegant"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
};