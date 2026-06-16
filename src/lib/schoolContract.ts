/**
 * School contract & billing state helpers (P8 — Production rollout).
 *
 * A school can only access the workspace when its contract is live:
 *   - status must be 'active' or 'trial'
 *   - contract_start (if set) must be in the past
 *   - contract_end   (if set) must be in the future
 *
 * `evaluateSchoolContract` returns a normalised gate that both the UI
 * (SchoolLayout banner / hard block) and edge functions reuse.
 */
import type { School } from "@/hooks/useSchools";

export type ContractGate =
  | { state: "active"; daysRemaining: number | null }
  | { state: "trial"; daysRemaining: number | null }
  | { state: "expiring_soon"; daysRemaining: number }
  | { state: "not_started"; startsAt: string }
  | { state: "expired"; endedAt: string }
  | { state: "suspended" }
  | { state: "archived" };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(future: string, now: Date): number {
  return Math.ceil((new Date(future).getTime() - now.getTime()) / MS_PER_DAY);
}

export function evaluateSchoolContract(
  school: Pick<School, "status" | "contract_start" | "contract_end">,
  now: Date = new Date(),
): ContractGate {
  if (school.status === "suspended") return { state: "suspended" };
  if (school.status === "archived") return { state: "archived" };

  if (school.contract_start) {
    const start = new Date(school.contract_start);
    if (start > now) return { state: "not_started", startsAt: school.contract_start };
  }
  if (school.contract_end) {
    const end = new Date(school.contract_end);
    if (end < now) return { state: "expired", endedAt: school.contract_end };
    const remaining = daysBetween(school.contract_end, now);
    if (remaining <= 14) return { state: "expiring_soon", daysRemaining: remaining };
  }

  const remaining = school.contract_end ? daysBetween(school.contract_end, now) : null;
  return school.status === "trial"
    ? { state: "trial", daysRemaining: remaining }
    : { state: "active", daysRemaining: remaining };
}

/** True when the school can be used (read/write). Trial counts as live. */
export function isContractLive(gate: ContractGate): boolean {
  return gate.state === "active" || gate.state === "trial" || gate.state === "expiring_soon";
}

export function contractMessage(gate: ContractGate): { title: string; body: string } {
  switch (gate.state) {
    case "suspended":
      return { title: "School suspended", body: "Access has been paused by StudySync billing. Contact billing@studysync.co.za to restore your school." };
    case "archived":
      return { title: "School archived", body: "This school has been archived and is read-only for super-admins. Contact StudySync to reopen it." };
    case "expired":
      return { title: "Contract ended", body: `Your contract ended on ${new Date(gate.endedAt).toLocaleDateString()}. Renew to restore teacher and student access.` };
    case "not_started":
      return { title: "Contract starts later", body: `Access opens on ${new Date(gate.startsAt).toLocaleDateString()}.` };
    case "expiring_soon":
      return { title: `Contract ends in ${gate.daysRemaining} day${gate.daysRemaining === 1 ? "" : "s"}`, body: "Contact StudySync to renew before your team loses access." };
    case "trial":
      return { title: gate.daysRemaining != null ? `Trial — ${gate.daysRemaining} day${gate.daysRemaining === 1 ? "" : "s"} remaining` : "Trial active", body: "Upgrade to keep teacher and student access after the trial ends." };
    default:
      return { title: "Active", body: "Contract is in good standing." };
  }
}

export const BILLING_CONTACT_EMAIL = "billing@studysync.co.za";
