/**
 * GeneratedCover — StudySync-branded fallback cover for resources with no
 * artwork (or whose remote thumbnail fails to load).
 * Pure SVG: deterministic palette + "SS" swirl motif derived from the title.
 */
interface GeneratedCoverProps {
  title: string;
  /** Small label shown at the top (e.g. "Book", "Past Paper", subject). */
  label?: string;
  /** Set false when the parent renders its own title overlay. */
  showText?: boolean;
  className?: string;
}

const PALETTES: Array<[string, string, string]> = [
  ["hsl(221 83% 22%)", "hsl(221 83% 42%)", "hsl(199 89% 60%)"],
  ["hsl(263 60% 22%)", "hsl(263 70% 44%)", "hsl(291 70% 62%)"],
  ["hsl(160 60% 16%)", "hsl(160 66% 32%)", "hsl(150 70% 55%)"],
  ["hsl(20 70% 22%)", "hsl(18 78% 44%)", "hsl(38 92% 60%)"],
  ["hsl(340 60% 22%)", "hsl(340 70% 44%)", "hsl(12 82% 62%)"],
  ["hsl(200 70% 18%)", "hsl(196 78% 36%)", "hsl(174 70% 55%)"],
];

function hashOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function GeneratedCover({ title, label, showText = true, className = "" }: GeneratedCoverProps) {
  const h = hashOf(title || "StudySync");
  const [c1, c2, c3] = PALETTES[h % PALETTES.length];
  const gid = `ssg-${h % 100000}`;
  const rot = (h % 30) - 15;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 300 420"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="60%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
          <linearGradient id={`${gid}-stroke`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <rect width="300" height="420" fill={`url(#${gid}-bg)`} />

        {/* Swirl motif — twin "S" ribbons */}
        <g
          transform={`translate(150 210) rotate(${rot}) translate(-150 -210)`}
          fill="none"
          stroke={`url(#${gid}-stroke)`}
          strokeLinecap="round"
        >
          <path
            d="M210 120c0-34-28-56-64-56s-62 20-62 50 24 42 60 50 62 22 62 54-28 54-66 54-66-24-66-58"
            strokeWidth="16"
            opacity="0.55"
          />
          <path
            d="M244 148c0-40-34-70-84-70s-88 28-88 66 30 56 78 66 82 26 82 62-36 66-88 66-92-32-92-72"
            strokeWidth="6"
            opacity="0.28"
          />
          <circle cx="150" cy="210" r="128" strokeWidth="1.5" opacity="0.16" />
          <circle cx="150" cy="210" r="168" strokeWidth="1.5" opacity="0.1" />
        </g>

        {/* Bottom scrim for text legibility */}
        <rect y="270" width="300" height="150" fill="#000" opacity="0.35" />
      </svg>

      {/* Text layer */}
      {showText && (
      <div className="absolute inset-0 flex flex-col justify-between p-2.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80">
          {label || "StudySync"}
        </span>
        <div>
          <p className="text-white font-bold text-xs leading-tight line-clamp-3 drop-shadow">
            {title}
          </p>
          <span className="mt-1 inline-block text-[8px] font-semibold uppercase tracking-[0.18em] text-white/65">
            StudySync
          </span>
        </div>
      </div>
      )}
    </div>
  );
}

export default GeneratedCover;
