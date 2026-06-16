// studymode-detect-gaps — aggregates wrong answers across quizzes, daily tasks,
// and school homework over the last 30 days and returns weak topics + suggested
// practice tasks. Strict caller-only access (uses the caller's JWT).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Bucket {
  topic: string;
  subject_id: string | null;
  attempts: number;
  wrong: number;
  evidence: Set<string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const buckets = new Map<string, Bucket>();
    const bump = (topic: string, subject_id: string | null, wrong: boolean, source: string) => {
      const key = `${(topic || "general").toLowerCase()}::${subject_id ?? ""}`;
      const b = buckets.get(key) ?? { topic: topic || "General", subject_id, attempts: 0, wrong: 0, evidence: new Set() };
      b.attempts += 1;
      if (wrong) b.wrong += 1;
      b.evidence.add(source);
      buckets.set(key, b);
    };

    // 1. Quiz attempts: pull recent attempts, score/total < 0.6 counts wrong.
    const { data: quizzes } = await svc
      .from("quiz_attempts")
      .select("score,total_questions,topic,subject_id,created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(500);
    for (const q of quizzes ?? []) {
      const total = Number(q.total_questions ?? 0);
      if (total <= 0) continue;
      const pct = Number(q.score ?? 0) / total;
      bump(q.topic ?? "General", q.subject_id ?? null, pct < 0.6, "quiz");
    }

    // 2. Daily task attempts — count incorrect via score/max_score.
    const { data: tasks } = await svc
      .from("daily_task_attempts")
      .select("score,max_score,topic,subject_id,created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(500);
    for (const t of tasks ?? []) {
      const max = Number(t.max_score ?? 0);
      if (max <= 0) continue;
      const pct = Number(t.score ?? 0) / max;
      bump((t as any).topic ?? "General", (t as any).subject_id ?? null, pct < 0.6, "daily_task");
    }

    // 3. School homework — pull responses joined to questions for topics/concepts.
    const { data: hw } = await svc
      .from("school_homework_responses")
      .select("ai_score,teacher_score,status,school_homework_questions(prompt,concepts,marks),school_homework!inner(subject_id,topic)")
      .eq("student_id", userId)
      .gte("created_at", since)
      .limit(500);
    for (const r of (hw as any[]) ?? []) {
      const q = r.school_homework_questions;
      const h = r.school_homework;
      if (!q || !h) continue;
      const score = r.teacher_score ?? r.ai_score ?? 0;
      const marks = Number(q.marks ?? 1);
      if (marks <= 0) continue;
      const pct = Number(score) / marks;
      const topic = h.topic || (Array.isArray(q.concepts) && q.concepts[0]) || "General";
      bump(topic, h.subject_id ?? null, pct < 0.6, "homework");
    }

    // Build weak topics: at least 2 attempts + accuracy < 70%.
    const weak_topics = Array.from(buckets.values())
      .filter((b) => b.attempts >= 2)
      .map((b) => ({
        topic: b.topic,
        subject_id: b.subject_id,
        attempts: b.attempts,
        accuracy: Math.round(((b.attempts - b.wrong) / b.attempts) * 100),
        evidence_source: Array.from(b.evidence),
        severity: b.wrong / b.attempts >= 0.6 ? "critical" : b.wrong / b.attempts >= 0.4 ? "warning" : "watch",
      }))
      .filter((b) => b.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);

    const suggested_tasks = weak_topics.slice(0, 5).map((w) => ({
      task_type: "active-recall",
      title: `Practice: ${w.topic}`,
      description: `You're at ${w.accuracy}% accuracy on ${w.topic}. Run a short recall set to lift it.`,
      topic: w.topic,
      subject_id: w.subject_id,
    }));

    return json({
      generated_at: new Date().toISOString(),
      window_days: 30,
      weak_topics,
      suggested_tasks,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
