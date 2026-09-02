/**
 * delete-account
 *
 * POPIA right-to-erasure: permanently deletes the CALLER's own account.
 *
 * Flow:
 *   1. Authenticate the caller from their JWT (never accepts a target user id
 *      — you can only delete yourself).
 *   2. Require a `confirm: "DELETE"` body field as a second deliberate step.
 *   3. Snapshot the user's financial records (payments via their bookings,
 *      tutor payouts) into `account_deletion_archive`, keyed by a SHA-256
 *      hash of the user id — de-identified per POPIA s24, retained for the
 *      5-year tax window.
 *   4. Remove the user's storage objects (lesson audio, avatars, uploads).
 *   5. `auth.admin.deleteUser()` — every table referencing auth.users /
 *      profiles cascades (verified: 100+ FKs are ON DELETE CASCADE; the
 *      handful of audit-style columns are ON DELETE SET NULL).
 *
 * Storage cleanup is best-effort: a failed object removal never blocks the
 * account deletion itself (orphaned objects are unreadable once RLS-owning
 * rows are gone, and bucket lifecycle cleanup can sweep them).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // 1. Authenticate the caller — the JWT is the ONLY source of the user id.
    const auth = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    const uid = userData?.user?.id;
    if (userErr || !uid) return json(401, { error: "Unauthorized" });

    // 2. Deliberate confirmation step.
    let body: { confirm?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (body.confirm !== "DELETE") {
      return json(400, { error: 'Confirmation required: send { "confirm": "DELETE" }' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. De-identified financial snapshot (5-year tax retention, POPIA s24).
    const [{ data: bookings }, { data: payouts }] = await Promise.all([
      admin.from("bookings").select("id").or(`learner_id.eq.${uid},tutor_id.eq.${uid}`),
      admin.from("tutor_payouts")
        .select("gross_amount,commission,net_payout,currency,status,processed_at,created_at")
        .eq("tutor_id", uid),
    ]);

    let payments: unknown[] = [];
    const bookingIds = (bookings ?? []).map((b: { id: string }) => b.id);
    if (bookingIds.length > 0) {
      const { data: pays } = await admin
        .from("payments")
        .select("amount,status,gateway_txn_id,created_at")
        .in("booking_id", bookingIds);
      payments = pays ?? [];
    }

    const hadFinancial = payments.length > 0 || (payouts ?? []).length > 0;
    const userHash = await sha256Hex(uid);
    const { error: archiveErr } = await admin.from("account_deletion_archive").insert({
      user_hash: userHash,
      had_financial_records: hadFinancial,
      financial_snapshot: hadFinancial ? { payments, payouts: payouts ?? [] } : {},
    });
    // The archive is a legal requirement — refuse to proceed if it fails.
    if (archiveErr) {
      console.error("delete-account: archive insert failed", archiveErr);
      return json(500, { error: "Could not archive financial records; account not deleted." });
    }

    // 4. Best-effort storage cleanup (never blocks deletion).
    const buckets = ["lesson-audio", "avatars", "tutor-documents", "study-documents"];
    for (const bucket of buckets) {
      try {
        const { data: objects } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
        if (objects && objects.length > 0) {
          await admin.storage.from(bucket).remove(objects.map((o) => `${uid}/${o.name}`));
        }
      } catch (e) {
        console.warn(`delete-account: storage cleanup skipped for ${bucket}`, e);
      }
    }

    // 5. Hard-delete the auth user — cascades wipe every personal record.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("delete-account: deleteUser failed", delErr);
      return json(500, { error: "Account deletion failed. Please contact support." });
    }

    console.log(`delete-account: user ${userHash.slice(0, 12)}… deleted (financial=${hadFinancial})`);
    return json(200, { deleted: true });
  } catch (e) {
    console.error("delete-account: unexpected error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
