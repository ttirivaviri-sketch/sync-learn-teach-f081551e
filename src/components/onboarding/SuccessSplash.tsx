import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessSplashProps {
  title: string;
  subtitle?: string;
  checklist?: string[];
  ctaLabel?: string;
  onCta?: () => void;
  autoAdvanceMs?: number;
}

/**
 * Full-screen celebration splash for onboarding milestones.
 */
export function SuccessSplash({ title, subtitle, checklist = [], ctaLabel, onCta, autoAdvanceMs }: SuccessSplashProps) {
  if (autoAdvanceMs && onCta) {
    setTimeout(onCta, autoAdvanceMs);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-mesh p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md text-center space-y-5 rounded-2xl border bg-card/95 backdrop-blur-xl p-7 shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 14 }}
          className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </motion.div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {checklist.length > 0 && (
          <ul className="text-left space-y-2 text-sm">
            {checklist.map((c, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="flex items-start gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{c}</span>
              </motion.li>
            ))}
          </ul>
        )}

        {ctaLabel && onCta && (
          <Button onClick={onCta} className="w-full" size="lg">{ctaLabel}</Button>
        )}
      </motion.div>
    </div>
  );
}
