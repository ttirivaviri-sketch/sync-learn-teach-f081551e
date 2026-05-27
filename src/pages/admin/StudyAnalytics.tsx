import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface CompletionRow { subject_id: string; subject_name: string; total: number; completed: number; completion_rate: number; }
interface RegenRow { subject_id: string; subject_name: string; tasks_with_regen: number; total_regens: number; avg_regens: number; max_regens: number; }
interface MasteryRow { subject_id: string; subject_name: string; learners: number; avg_mastery: number; avg_mastery_7d_ago: number; delta: number; }

export default function StudyAnalytics() {
  const [loading, setLoading] = useState(true);
  const [completion, setCompletion] = useState<CompletionRow[]>([]);
  const [regen, setRegen] = useState<RegenRow[]>([]);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Study Analytics | Admin";
    (async () => {
      setLoading(true);
      const [c, r, m] = await Promise.all([
        supabase.rpc("admin_study_completion_rate", { p_days: 30 }),
        supabase.rpc("admin_study_regen_usage", { p_days: 30 }),
        supabase.rpc("admin_study_mastery_progression"),
      ]);
      if (c.error || r.error || m.error) {
        setError(c.error?.message || r.error?.message || m.error?.message || "Failed to load");
      } else {
        setCompletion((c.data as any) ?? []);
        setRegen((r.data as any) ?? []);
        setMastery((m.data as any) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…</div>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Study Mode Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days · per subject</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily task completion rate</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={completion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject_name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="completion_rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Subject</th><th>Total</th><th>Completed</th><th>Rate</th></tr></thead>
              <tbody>
                {completion.map((r) => (
                  <tr key={r.subject_id} className="border-t"><td className="py-2">{r.subject_name}</td><td>{r.total}</td><td>{r.completed}</td><td>{r.completion_rate}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Regenerate usage</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={regen}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject_name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_regens" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Subject</th><th>Tasks regenerated</th><th>Total regens</th><th>Avg / task</th><th>Max</th></tr></thead>
              <tbody>
                {regen.map((r) => (
                  <tr key={r.subject_id} className="border-t"><td className="py-2">{r.subject_name}</td><td>{r.tasks_with_regen}</td><td>{r.total_regens}</td><td>{r.avg_regens}</td><td>{r.max_regens}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mastery progression (7-day delta)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Subject</th><th>Learners</th><th>Avg mastery</th><th>7d ago</th><th>Δ</th></tr></thead>
              <tbody>
                {mastery.map((r) => (
                  <tr key={r.subject_id} className="border-t">
                    <td className="py-2">{r.subject_name}</td>
                    <td>{r.learners}</td>
                    <td>{r.avg_mastery}%</td>
                    <td>{r.avg_mastery_7d_ago}%</td>
                    <td className={r.delta > 0 ? "text-success" : r.delta < 0 ? "text-destructive" : ""}>{r.delta > 0 ? "+" : ""}{r.delta}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
