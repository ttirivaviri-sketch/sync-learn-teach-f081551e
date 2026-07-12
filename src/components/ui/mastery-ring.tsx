/**
 * MasteryRing — circular progress ring with the percentage centred inside.
 *
 * Per the StudySync UI spec, every mastery / readiness value in the app is
 * shown as a ring (never a thin horizontal bar). Colour is bound to the
 * value: red < 30%, amber 30–70%, green > 70% — unless an explicit
 * `colorClass` override is supplied.
 */
import { cn } from "@/lib/utils";

export function readinessColorClass(value: number): string {
  if (value < 30) return "text-red-500";
  if (value <= 70) return "text-amber-500";
  return "text-emerald-500";
}

/** Hex stroke used when we can't rely on a Tailwind text-* class (SVG stroke). */
export function readinessStroke(value: number): string {
  if (value < 30) return "#ef4444";
  if (value <= 70) return "#f59e0b";
  return "#10b981";
}

interface MasteryRingProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Outer diameter in px. Default 56. */
  size?: number;
  /** Stroke width in px. Default 5. */
  strokeWidth?: number;
  /** Override the automatic severity colour (any CSS colour). */
  stroke?: string;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Optional small label under the percentage (e.g. "ready"). */
  label?: string;
  /** Hide the numeric percentage (for tiny rings). */
  hideValue?: boolean;
}

export function MasteryRing({
  value,
  size = 56,
  strokeWidth = 5,
  stroke,
  className,
  label,
  hideValue = false,
}: MasteryRingProps) {
  const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (v / 100) * circumference;
  const color = stroke || readinessStroke(v);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${v}%${label ? ` ${label}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      {!hideValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span
            className="font-bold text-foreground"
            style={{ fontSize: Math.max(10, size * 0.24) }}
          >
            {v}%
          </span>
          {label && (
            <span
              className="text-muted-foreground"
              style={{ fontSize: Math.max(7, size * 0.13) }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
