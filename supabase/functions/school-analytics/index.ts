// school-analytics — returns aggregated KPIs for a school.
// POST { school_id, days? }  (days default 14)
// Auth: school_admin or school_teacher (teachers see read-only).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const { school_id, days } = await req.json();
    if (!school_id) return errorResponse("school_id required", 400);
    const span = Math.min(Math.max(days ?? 14, 1), 90);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return errorResponse("Unauthorized", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: memberships } = await svc
      .from("school_memberships")
      .select("role")
      .eq("school_id", school_id)
      .eq("user_id", userId)
      .eq("status", "active");
    const roles = (memberships ?? []).map((m: { role: string }) => m.role);
    if (!roles.includes("school_admin") && !roles.includes("school_teacher")) {
      return errorResponse("Forbidden", 403);
    }

    // Rebuild today's row so the latest numbers are present
    await svc.rpc("rebuild_school_analytics_today", { _school_id: school_id });

    const since = new Date();
    since.setDate(since.getDate() - span);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: daily } = await svc
      .from("school_analytics_daily")
      .select("*")
      .eq("school_id", school_id)
      .gte("day", sinceStr)
      .order("day", { ascending: true });

    const [{ data: school }, { data: quota }, { data: usage }] = await Promise.all([
      svc.from("schools").select("id,name,seats_teachers,seats_students,ai_quota_daily,storage_quota_mb,plan").eq("id", school_id).single(),
      svc.rpc("check_school_ai_quota", { _school_id: school_id }),
      svc
        .from("school_ai_usage_daily")
        .select("usage_date,bucket,requests,tokens_in,tokens_out")
        .eq("school_id", school_id)
        .gte("usage_date", sinceStr)
        .order("usage_date", { ascending: true }),
    ]);

    const [{ count: teacherCount }, { count: studentCount }, { count: classCount }] = await Promise.all([
      svc.from("school_memberships").select("*", { count: "exact", head: true }).eq("school_id", school_id).eq("role", "school_teacher").eq("status", "active"),
      svc.from("school_memberships").select("*", { count: "exact", head: true }).eq("school_id", school_id).eq("role", "school_student").eq("status", "active"),
      svc.from("classes").select("*", { count: "exact", head: true }).eq("school_id", school_id),
    ]);

    return jsonResponse({
      school,
      quota: Array.isArray(quota) ? quota[0] : quota,
      counts: { teachers: teacherCount ?? 0, students: studentCount ?? 0, classes: classCount ?? 0 },
      daily: daily ?? [],
      ai_usage: usage ?? [],
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
