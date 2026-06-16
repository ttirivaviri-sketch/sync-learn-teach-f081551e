/**
 * Helpers for extracting contract-gate failures from supabase.functions.invoke.
 *
 * Edge functions (school-analytics, school-search, school-ingest-document)
 * return structured JSON bodies on contract-gate denials:
 *   { error, code, status, reason, feature }
 *
 * `supabase.functions.invoke` throws a FunctionsHttpError whose `context`
 * is the raw Response. We read it here so callers can render contract-aware
 * UI ("Contract paused — contact billing").
 */
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface ContractGateError {
  /** HTTP status returned by the edge function (402/410/423). */
  status: number;
  /** Machine-readable reason code. */
  code: "SUSPENDED" | "ARCHIVED" | "EXPIRED" | "NOT_STARTED" | "ROLE_DENIED" | "SCHOOL_NOT_FOUND" | string;
  /** Human-friendly explanation. */
  reason: string;
  /** Feature label the edge function was gating (e.g. 'analytics'). */
  feature?: string;
  /** Original error message. */
  message: string;
}

const CONTRACT_STATUSES = new Set([402, 410, 423]);

export function isContractGateError(e: unknown): e is ContractGateError {
  return !!e && typeof e === "object" && "status" in (e as Record<string, unknown>)
    && CONTRACT_STATUSES.has(Number((e as { status: unknown }).status));
}

/**
 * Wrap a supabase.functions.invoke call. Returns `{ data }` on success or
 * throws either a typed `ContractGateError` (for billing failures) or a
 * normal `Error` for everything else.
 */
export async function invokeWithContract<T>(
  call: () => Promise<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await call();
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    let body: Record<string, unknown> | null = null;
    try { body = await error.context.clone().json(); } catch { /* fall through */ }
    const status = error.context?.status ?? 500;
    if (body && CONTRACT_STATUSES.has(status)) {
      const gateErr: ContractGateError = {
        status,
        code: String(body.code ?? "CONTRACT_GATE"),
        reason: String(body.reason ?? body.error ?? "Contract is not active"),
        feature: typeof body.feature === "string" ? body.feature : undefined,
        message: String(body.error ?? body.reason ?? error.message),
      };
      throw gateErr;
    }
    const msg = (body && (body.error || body.reason)) || error.message;
    throw new Error(String(msg));
  }

  if (error instanceof Error) throw error;
  throw new Error(String(error));
}
