/**
 * chartToImage — Renders a Chart.js config to a PNG data URL for PDF embed.
 *
 * Uses an offscreen <canvas> so we avoid touching the DOM tree. Chart.js
 * rasterises synchronously after `update()`, so we read the canvas immediately.
 */
import {
  Chart,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler,
  type ChartConfiguration,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler
);

export interface RenderChartOptions {
  width?: number;
  height?: number;
  /** Background fill color for the canvas (default white). */
  background?: string;
}

/**
 * Render a Chart.js config to a PNG data URL.
 * Returns an empty string if the browser can't supply a 2D context.
 */
export async function renderChartToDataUrl(
  config: ChartConfiguration,
  opts: RenderChartOptions = {}
): Promise<string> {
  const { width = 1200, height = 600, background = "#ffffff" } = opts;

  // Offscreen canvas (kept off the DOM)
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Fill background so PDF doesn't show black
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Disable animations so the chart is rendered immediately
  const merged: ChartConfiguration = {
    ...config,
    options: {
      ...(config.options || {}),
      responsive: false,
      animation: false,
      devicePixelRatio: 2,
      plugins: {
        ...(config.options?.plugins || {}),
        legend: {
          display: true,
          ...(config.options?.plugins?.legend || {}),
        },
      },
    },
  };

  const chart = new Chart(ctx, merged);
  chart.resize(width, height);
  chart.update("none");

  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  return dataUrl;
}
