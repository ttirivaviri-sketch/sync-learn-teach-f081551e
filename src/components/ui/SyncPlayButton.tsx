/**
 * SyncPlayButton — StudySync's branded play button.
 *
 * Visual language is lifted straight from the logo: two interlocking "S"
 * swirl arcs wrapping a sphere, in the brand gradient (blue → teal → lime),
 * with the play triangle sitting at the centre. On hover the swirl ring
 * spins slowly, echoing the "sync" motion of the mark.
 */
import { cn } from "@/lib/utils";

interface SyncPlayButtonProps {
  /** Diameter in px (default 56) */
  size?: number;
  className?: string;
  /** Renders as a purely decorative overlay (no button semantics) */
  decorative?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  "aria-label"?: string;
}

export function SyncPlayButton({
  size = 56,
  className,
  decorative = false,
  onClick,
  "aria-label": ariaLabel = "Play video",
}: SyncPlayButtonProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_4px_14px_rgba(14,29,71,0.45)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ssSwirlA" x1="6" y1="10" x2="58" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5aa9f7" />
          <stop offset="50%" stopColor="#3860f0" />
          <stop offset="100%" stopColor="#17a184" />
        </linearGradient>
        <linearGradient id="ssSwirlB" x1="58" y1="10" x2="6" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a8e04a" />
          <stop offset="55%" stopColor="#4fc98a" />
          <stop offset="100%" stopColor="#3860f0" />
        </linearGradient>
        <radialGradient id="ssSphere" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#1d3a8f" />
          <stop offset="100%" stopColor="#0e1d47" />
        </radialGradient>
      </defs>

      {/* Sphere */}
      <circle cx="32" cy="32" r="26" fill="url(#ssSphere)" />

      {/* Swirl ring — two interlocking S-arcs, like the logo mark */}
      <g className="ss-swirl origin-center">
        <path
          d="M32 4 A28 28 0 0 1 60 32 A28 28 0 0 1 46 56.2"
          stroke="url(#ssSwirlA)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 60 A28 28 0 0 1 4 32 A28 28 0 0 1 18 7.8"
          stroke="url(#ssSwirlB)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {/* inner counter-swirl accents */}
        <path
          d="M44.5 13.5 A22 22 0 0 1 54 32"
          stroke="url(#ssSwirlB)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M19.5 50.5 A22 22 0 0 1 10 32"
          stroke="url(#ssSwirlA)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
      </g>

      {/* Play triangle */}
      <path
        d="M26.5 21.5 L45 32 L26.5 42.5 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  const spinStyles = (
    <style>{`
      .ss-play-btn .ss-swirl { transition: transform .5s ease; transform-box: fill-box; transform-origin: center; }
      .ss-play-btn:hover .ss-swirl, .group:hover .ss-play-btn .ss-swirl { animation: ss-spin 2.6s linear infinite; }
      @keyframes ss-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .ss-play-btn:hover .ss-swirl, .group:hover .ss-play-btn .ss-swirl { animation: none; }
      }
    `}</style>
  );

  if (decorative) {
    return (
      <span className={cn("ss-play-btn inline-flex", className)} aria-hidden="true">
        {spinStyles}
        {svg}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "ss-play-btn inline-flex items-center justify-center rounded-full",
        "transition-transform duration-200 hover:scale-110 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
    >
      {spinStyles}
      {svg}
    </button>
  );
}

export default SyncPlayButton;
