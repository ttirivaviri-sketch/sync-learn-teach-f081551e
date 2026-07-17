// _shared/school-generators.ts
// Common helpers for studymode-generate-school-* edge functions:
//   - assertTeacher: verify caller is school_admin or school_teacher in the school
//   - loadDocumentChunks: pull all chunks for a school_ai_documents row
//   - callAIJson: call Lovable AI Gateway and parse structured JSON
//
// Tenant isolation: every helper requires school_id and verifies it against
// the caller's membership. school_id from the request body is treated as
// untrusted input.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { safeJsonParse, reportTokenUsage, type UsageAttribution } from "./ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export interface AuthResult {
  ok: boolean;
  userId?: string;
  role?: string;
  svc: SupabaseClient;
  status?: number;
  reason?: string;
}

export async function authenticateTeacher(req: Request, schoolId: string): Promise<AuthResult> {
  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return { ok: false, svc, status: 401, reason: "Unauthorized" };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, svc, status: 401, reason: "Unauthorized" };

  const { data: memberships } = await svc
    .from("school_memberships")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .eq("status", "active");

  const roles = (memberships ?? []).map((m: { role: string }) => m.role);
  const role = roles.includes("school_admin") ? "school_admin"
    : roles.includes("school_teacher") ? "school_teacher" : null;
  if (!role) return { ok: false, svc, userId, status: 403, reason: "Not a school teacher/admin" };

  return { ok: true, svc, userId, role };
}

export async function loadDocumentChunks(
  svc: SupabaseClient,
  schoolId: string,
  documentId: string,
  maxChars = 16000,
): Promise<{ doc: { id: string; title: string | null; status: string } | null; text: string }> {
  const { data: doc } = await svc
    .from("school_ai_documents")
    .select("id, title, status")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!doc) return { doc: null, text: "" };

  const { data: chunks } = await svc
    .from("school_ai_chunks")
    .select("content, ord")
    .eq("document_id", documentId)
    .eq("school_id", schoolId)
    .order("ord", { ascending: true });

  let acc = "";
  for (const c of chunks ?? []) {
    if (acc.length + c.content.length > maxChars) break;
    acc += c.content + "\n\n";
  }
  return { doc, text: acc.trim() };
}

export async function callAIJson<T>(
  prompt: string,
  system: string,
  usage?: UsageAttribution
): Promise<T | null> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI call failed ${r.status}: ${await r.text()}`);
  const j = await r.json();

  // Record real token usage (fire-and-forget) when attribution is supplied.
  if (usage && j?.usage) {
    reportTokenUsage({
      userId: usage.userId,
      bucket: usage.bucket,
      schoolId: usage.schoolId ?? null,
      tokensIn: Number(j.usage.prompt_tokens ?? 0),
      tokensOut: Number(j.usage.completion_tokens ?? 0),
    });
  }

  const text = j.choices?.[0]?.message?.content ?? "";
  return safeJsonParse<T>(text);
}
