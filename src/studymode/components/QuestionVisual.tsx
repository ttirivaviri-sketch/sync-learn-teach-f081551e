/**
 * QuestionVisual — thin lazy wrapper.
 *
 * The actual renderer (QuestionVisualImpl) statically imports mathjs (~600KB)
 * and recharts (~400KB). Most quiz/exam questions have NO visual at all, so
 * loading those libraries eagerly punished every low-end device for a feature
 * that is usually unused. This wrapper:
 *   1. keeps the `QuestionVisualSpec` type export (imported type-only by
 *      recallEngine / useQuizGenerator — erased at compile time)
 *   2. returns null without loading anything when there is no visual
 *   3. lazy-loads the heavy implementation only when a visual is present
 */

import { lazy, Suspense } from "react";

export interface QuestionVisualSpec {
  type: "function-graph" | "data-chart" | "svg-diagram" | "ai-image";
  required?: boolean;
  caption?: string;

  // function-graph
  functions?: { expression: string; color?: string; domain?: [number, number] }[];
  xRange?: [number, number];
  yRange?: [number, number];
  gridlines?: boolean;
  points?: { x: number; y: number; label?: string }[];

  // data-chart
  chartKind?: "bar" | "line" | "scatter";
  data?: { x: number | string; y: number; series?: string }[];
  xLabel?: string;
  yLabel?: string;

  // svg-diagram
  svg?: string;

  // ai-image
  imagePrompt?: string;
  imageUrl?: string;
}

interface Props {
  visual?: QuestionVisualSpec | null;
  className?: string;
}

const QuestionVisualImpl = lazy(() => import("./QuestionVisualImpl"));

export function QuestionVisual({ visual, className }: Props) {
  // No visual → no chunk download at all.
  if (!visual || !visual.type) return null;

  return (
    <Suspense
      fallback={
        <div className="my-4 h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
      }
    >
      <QuestionVisualImpl visual={visual} className={className} />
    </Suspense>
  );
}
