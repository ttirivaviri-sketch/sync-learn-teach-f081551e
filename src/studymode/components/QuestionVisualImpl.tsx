/**
 * QuestionVisual
 *
 * Deterministically renders the AI-authored `visual` spec attached to a quiz
 * or exam question. Supports four kinds:
 *   - function-graph  → SVG plot of f(x) expressions (mathjs)
 *   - data-chart      → recharts bar/line/scatter
 *   - svg-diagram     → sanitized inline SVG (DOMPurify)
 *   - ai-image        → lazily generated past-paper-style image (cached)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { evaluate } from "mathjs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Loader2, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

import type { QuestionVisualSpec } from "./QuestionVisual";

interface Props {
  visual?: QuestionVisualSpec | null;
  className?: string;
}

export default function QuestionVisualImpl({ visual, className }: Props) {
  if (!visual || !visual.type) return null;

  return (
    <figure
      className={
        "my-4 rounded-xl border border-border bg-card/40 p-3 sm:p-4 " +
        (className ?? "")
      }
    >
      <div className="w-full overflow-hidden rounded-lg bg-background">
        {visual.type === "function-graph" && <FunctionGraph spec={visual} />}
        {visual.type === "data-chart" && <DataChart spec={visual} />}
        {visual.type === "svg-diagram" && <SvgDiagram spec={visual} />}
        {visual.type === "ai-image" && <AIImage spec={visual} />}
      </div>
      {visual.caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground italic">
          {visual.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ─── function-graph ──────────────────────────────────────────────────────────

function FunctionGraph({ spec }: { spec: QuestionVisualSpec }) {
  const width = 480;
  const height = 320;
  const padding = 36;

  const xMin = spec.xRange?.[0] ?? -10;
  const xMax = spec.xRange?.[1] ?? 10;
  let yMin = spec.yRange?.[0];
  let yMax = spec.yRange?.[1];

  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))"];

  const series = useMemo(() => {
    const fns = spec.functions || [];
    return fns.map((fn, idx) => {
      const samples: { x: number; y: number }[] = [];
      const dom = fn.domain ?? [xMin, xMax];
      const steps = 200;
      const step = (dom[1] - dom[0]) / steps;
      for (let i = 0; i <= steps; i++) {
        const x = dom[0] + i * step;
        try {
          const y = evaluate(fn.expression, { x });
          if (typeof y === "number" && Number.isFinite(y)) {
            samples.push({ x, y });
          }
        } catch {
          /* skip invalid */
        }
      }
      return { color: fn.color || colors[idx % colors.length], samples };
    });
  }, [spec.functions, xMin, xMax]);

  // Auto y-range if not provided
  if (yMin === undefined || yMax === undefined) {
    const ys = series.flatMap((s) => s.samples.map((p) => p.y));
    if (ys.length) {
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      const pad = Math.max((hi - lo) * 0.1, 1);
      yMin = yMin ?? Math.floor(lo - pad);
      yMax = yMax ?? Math.ceil(hi + pad);
    } else {
      yMin = -10;
      yMax = 10;
    }
  }

  const sx = (x: number) =>
    padding + ((x - xMin) / (xMax - xMin)) * (width - padding * 2);
  const sy = (y: number) =>
    height - padding - ((y - yMin!) / (yMax! - yMin!)) * (height - padding * 2);

  const xTicks = niceTicks(xMin, xMax, 8);
  const yTicks = niceTicks(yMin, yMax, 6);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label={spec.caption || "Function graph"}
    >
      {/* Gridlines */}
      {spec.gridlines !== false &&
        xTicks.map((t) => (
          <line
            key={`gx${t}`}
            x1={sx(t)}
            x2={sx(t)}
            y1={padding}
            y2={height - padding}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
          />
        ))}
      {spec.gridlines !== false &&
        yTicks.map((t) => (
          <line
            key={`gy${t}`}
            y1={sy(t)}
            y2={sy(t)}
            x1={padding}
            x2={width - padding}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
          />
        ))}

      {/* Axes */}
      {yMin <= 0 && yMax >= 0 && (
        <line
          x1={padding}
          x2={width - padding}
          y1={sy(0)}
          y2={sy(0)}
          stroke="hsl(var(--foreground))"
          strokeWidth={1}
        />
      )}
      {xMin <= 0 && xMax >= 0 && (
        <line
          y1={padding}
          y2={height - padding}
          x1={sx(0)}
          x2={sx(0)}
          stroke="hsl(var(--foreground))"
          strokeWidth={1}
        />
      )}

      {/* Tick labels */}
      {xTicks.map((t) => (
        <text
          key={`tx${t}`}
          x={sx(t)}
          y={height - padding + 14}
          textAnchor="middle"
          fontSize={10}
          fill="hsl(var(--muted-foreground))"
        >
          {t}
        </text>
      ))}
      {yTicks.map((t) => (
        <text
          key={`ty${t}`}
          x={padding - 6}
          y={sy(t) + 3}
          textAnchor="end"
          fontSize={10}
          fill="hsl(var(--muted-foreground))"
        >
          {t}
        </text>
      ))}

      {/* Plot lines */}
      {series.map((s, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          points={s.samples.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
        />
      ))}

      {/* Marked points */}
      {(spec.points || []).map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={3} fill="hsl(var(--primary))" />
          {p.label && (
            <text
              x={sx(p.x) + 6}
              y={sy(p.y) - 6}
              fontSize={10}
              fill="hsl(var(--foreground))"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}

      {/* Function legend */}
      {spec.functions && spec.functions.length > 0 && (
        <text
          x={width - padding}
          y={padding - 8}
          textAnchor="end"
          fontSize={11}
          fill="hsl(var(--foreground))"
        >
          {spec.functions.map((f) => `y = ${f.expression}`).join("   ")}
        </text>
      )}
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step =
    (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}

// ─── data-chart ──────────────────────────────────────────────────────────────

function DataChart({ spec }: { spec: QuestionVisualSpec }) {
  const data = (spec.data || []).map((d) => ({ ...d }));
  const kind = spec.chartKind || "bar";

  if (data.length === 0) {
    return <EmptyVisual label="No chart data" />;
  }

  return (
    <div className="w-full h-[280px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" label={spec.xLabel ? { value: spec.xLabel, position: "insideBottom", offset: -4 } : undefined} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft" } : undefined} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip />
            <Bar dataKey="y" fill="hsl(var(--primary))" />
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={2} dot />
          </LineChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis type="number" dataKey="y" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip />
            <Scatter data={data} fill="hsl(var(--primary))" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── svg-diagram ─────────────────────────────────────────────────────────────

function SvgDiagram({ spec }: { spec: QuestionVisualSpec }) {
  const clean = useMemo(() => {
    if (!spec.svg) return "";
    return DOMPurify.sanitize(spec.svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onload", "onclick", "onerror", "onmouseover"],
    });
  }, [spec.svg]);

  if (!clean) return <EmptyVisual label="No diagram" />;

  return (
    <div
      className="w-full flex justify-center p-3 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:max-h-[360px]"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ─── ai-image ────────────────────────────────────────────────────────────────

function AIImage({ spec }: { spec: QuestionVisualSpec }) {
  const [url, setUrl] = useState<string | null>(spec.imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (url || requested.current || !spec.imagePrompt) return;
    requested.current = true;
    setLoading(true);
    supabase.functions
      .invoke("render-question-visual", {
        body: { imagePrompt: spec.imagePrompt },
      })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.url) {
          setUrl(data.url);
          spec.imageUrl = data.url; // cache on the spec for future renders
        } else {
          throw new Error("No image returned");
        }
      })
      .catch((e) => {
        logger.error("ai-image generation failed:", e);
        setError(e instanceof Error ? e.message : "Failed to load diagram");
      })
      .finally(() => setLoading(false));
  }, [spec, url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-xs">Generating diagram…</p>
      </div>
    );
  }
  if (error) return <EmptyVisual label={`Diagram unavailable: ${error}`} />;
  if (!url) return <EmptyVisual label="No diagram" />;

  return (
    <img
      src={url}
      alt={spec.caption || "Question diagram"}
      className="mx-auto max-h-[420px] w-auto object-contain"
      loading="lazy"
    />
  );
}

function EmptyVisual({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
      <ImageOff className="h-6 w-6" />
      <p className="text-xs">{label}</p>
    </div>
  );
}
