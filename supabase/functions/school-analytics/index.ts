// school-analytics — KPIs for a school with optional drill-down filters.
// POST { school_id, days?, from?, to?, class_id?, grade_id? }
// Auth: school_admin or school_teacher only (returns 403 otherwise).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/ai-config.ts";
import { assertSchoolContractLive } from "../_shared/school-contract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function dayStr(d: Date): string { return d.toISOString().slice(0, 10); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const { school_id, days, from, to, class_id, grade_id } = await req.json();
    if (!school_id) return errorResponse("school_id required", 400);

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
    const isAdmin = roles.includes("school_admin");
    const isTeacher = roles.includes("school_teacher");
    if (!isAdmin && !isTeacher) {
      return errorResponse("Forbidden — teacher or admin access required", 403);
    }

    // P8: contract / billing gate — refuse suspended/archived/expired schools.
    const gate = await assertSchoolContractLive(svc, school_id);
    if (!gate.ok) return errorResponse(gate.reason, gate.status);

    // Resolve date range — explicit from/to wins, otherwise last `days` (default 14, max 90)
    const today = new Date();
    let toDate = to ? new Date(to) : today;
    let fromDate: Date;
    if (from) fromDate = new Date(from);
    else {
      const span = Math.min(Math.max(days ?? 14, 1), 90);
      fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - span);
    }
    const fromStr = dayStr(fromDate);
    const toStr = dayStr(toDate);

    // Refresh today's aggregate row
    await svc.rpc("rebuild_school_analytics_today", { _school_id: school_id });

    // Resolve class scope from grade filter if provided
    let classIds: string[] | null = null;
    if (class_id) classIds = [class_id];
    else if (grade_id) {
      const { data: gc } = await svc.from("classes").select("id").eq("school_id", school_id).eq("grade_id", grade_id);
      classIds = (gc ?? []).map((c: { id: string }) => c.id);
      if (classIds.length === 0) classIds = ["00000000-0000-0000-0000-000000000000"];
    }

    // Build daily series
    let daily: Array<Record<string, unknown>> = [];
    if (!classIds) {
      const { data } = await svc
        .from("school_analytics_daily")
        .select("*")
        .eq("school_id", school_id)
        .gte("day", fromStr)
        .lte("day", toStr)
        .order("day", { ascending: true });
      daily = data ?? [];
    } else {
      // Filtered: compute counts from raw tables grouped by day
      const fromIso = `${fromStr}T00:00:00Z`;
      const toIso = `${toStr}T23:59:59Z`;
      const [aRes, sRes, gRes] = await Promise.all([
        svc.from("assignments").select("id,created_at,class_id")
          .eq("school_id", school_id).in("class_id", classIds)
          .gte("created_at", fromIso).lte("created_at", toIso),
        svc.from("submissions").select("id,submitted_at,graded_at,assignment_id")
          .eq("school_id", school_id).gte("submitted_at", fromIso).lte("submitted_at", toIso),
        svc.from("school_quiz_attempts").select("id,created_at,class_id")
          .eq("school_id", school_id).in("class_id", classIds)
          .gte("created_at", fromIso).lte("created_at", toIso),
      ]);
      // Filter submissions to those belonging to selected classes
      const assignmentIds = new Set((aRes.data ?? []).map((a: { id: string }) => a.id));
      const allAssignmentIds = assignmentIds.size > 0 ? Array.from(assignmentIds) : null;
      // Need to filter submissions whose assignment belongs to classIds — fetch in batch
      let validSubAssignIds = new Set<string>();
      if (classIds && classIds.length) {
        const { data: aList } = await svc.from("assignments").select("id").eq("school_id", school_id).in("class_id", classIds);
        validSubAssignIds = new Set((aList ?? []).map((x: { id: string }) => x.id));
      }
      const buckets = new Map<string, { assignments_created: number; submissions: number; graded_submissions: number; quiz_attempts: number }>();
      const bump = (day: string, key: "assignments_created" | "submissions" | "graded_submissions" | "quiz_attempts") => {
        const b = buckets.get(day) ?? { assignments_created: 0, submissions: 0, graded_submissions: 0, quiz_attempts: 0 };
        b[key] += 1;
        buckets.set(day, b);
      };
      for (const a of aRes.data ?? []) bump(String(a.created_at).slice(0, 10), "assignments_created");
      for (const s of sRes.data ?? []) {
        if (!validSubAssignIds.has(s.assignment_id)) continue;
        if (s.submitted_at) bump(String(s.submitted_at).slice(0, 10), "submissions");
        if (s.graded_at) bump(String(s.graded_at).slice(0, 10), "graded_submissions");
      }
      for (const q of gRes.data ?? []) bump(String(q.created_at).slice(0, 10), "quiz_attempts");

      // Fill range
      const out: Array<Record<string, unknown>> = [];
      const cur = new Date(fromDate);
      while (cur <= toDate) {
        const d = dayStr(cur);
        const b = buckets.get(d) ?? { assignments_created: 0, submissions: 0, graded_submissions: 0, quiz_attempts: 0 };
        out.push({ day: d, active_users: 0, ai_requests: 0, storage_mb: 0, ...b });
        cur.setDate(cur.getDate() + 1);
      }
      daily = out;
      void allAssignmentIds;
    }

    const [{ data: school }, { data: quota }, { data: usage }, { data: classes }, { data: grades }] = await Promise.all([
      svc.from("schools").select("id,name,seats_teachers,seats_students,ai_quota_daily,storage_quota_mb,plan").eq("id", school_id).single(),
      svc.rpc("check_school_ai_quota", { _school_id: school_id }),
      svc
        .from("school_ai_usage_daily")
        .select("usage_date,bucket,requests,tokens_in,tokens_out")
        .eq("school_id", school_id)
        .gte("usage_date", fromStr)
        .lte("usage_date", toStr)
        .order("usage_date", { ascending: true }),
      svc.from("classes").select("id,name,grade_id").eq("school_id", school_id).order("name"),
      svc.from("grades").select("id,name").eq("school_id", school_id).order("name"),
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
      daily,
      ai_usage: usage ?? [],
      filters: { from: fromStr, to: toStr, class_id: class_id ?? null, grade_id: grade_id ?? null, applied: !!classIds },
      classes: classes ?? [],
      grades: grades ?? [],
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Internal error", 500);
  }
});
