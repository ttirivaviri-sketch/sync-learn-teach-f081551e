/**
 * Audit trail for blocked (401/403) requests to gated edge functions.
 *
 * Writes one row per denial to `public.security_audit_logs` using the service
 * role, so attempts are traceable even when the caller is anonymous.
 *
 * Privacy rules (do not weaken):
 *  - NEVER log tokens, Authorization headers, API keys, or request bodies.
 *  - Only a coarse request shape is stored: function, reason, method, path,
 *    truncated user-agent, and the client IP.
 *  - Failures to log are swallowed — auditing must never block a denial.
 */

export type BlockReason =
  | "missing_token"
  | "invalid_token"
  | "auth_unavailable"
  | "not_participant"
  | "not_owner"
  | "insufficient_role"
  | "rate_limited";

export interface BlockedRequestEvent {
  /** Edge function name, e.g. "process-tutor-payout". */
  functionName: string;
  reason: BlockReason;
  /** HTTP status returned to the caller. */
  status: 401 | 403 | 429;
  /** Verified user id when the caller was authenticated but not authorised. */
  userId?: string | null;
  /** Extra non-sensitive context, e.g. { resource: "lesson_recording" }. */
  context?: Record<string, string | number | boolean | null>;
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("cf-connecting-ip") || null;
}

export async function logBlockedRequest(
  req: Request,
  event: BlockedRequestEvent,
): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Always leave a trace in the function logs, even if the DB write fails.
  console.warn(
    `[blocked] fn=${event.functionName} reason=${event.reason} status=${event.status} user=${event.userId ?? "anonymous"}`,
  );
  if (!url || !serviceKey) return;

  let path: string | null = null;
  try {
    path = new URL(req.url).pathname;
  } catch (_) {
    path = null;
  }

  const row = {
    user_id: event.userId ?? null,
    action: `blocked_request:${event.functionName}`,
    details: {
      reason: event.reason,
      status: event.status,
      method: req.method,
      path,
      ...(event.context ?? {}),
    },
    ip_address: clientIp(req),
    user_agent: (req.headers.get("user-agent") || "").slice(0, 200) || null,
  };

  try {
    await fetch(`${url}/rest/v1/security_audit_logs`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error("[logBlockedRequest] audit write failed:", (e as Error)?.message);
  }
}
