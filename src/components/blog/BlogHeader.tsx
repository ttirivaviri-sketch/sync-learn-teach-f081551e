import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const BlogHeader = () => (
  <header className="border-b border-border bg-background/95 backdrop-blur-md">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
      <Link to="/" aria-label="StudySync home" className="flex items-center gap-3">
        <img
          src="/lovable-uploads/studysync-logo.png"
          alt="StudySync"
          className="h-10 w-auto object-contain"
        />
        <span className="hidden border-l border-border pl-3 text-sm font-semibold text-muted-foreground sm:inline">
          Ideas for better learning
        </span>
      </Link>
      <nav aria-label="Blog navigation" className="flex items-center gap-2 sm:gap-5">
        <Link to="/blog" className="text-sm font-semibold text-foreground hover:text-primary">
          Blog
        </Link>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/learner/auth">Start free</Link>
        </Button>
      </nav>
    </div>
  </header>
);