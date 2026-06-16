// Deno tests for the shared school contract gate.
// Run via: supabase functions test (uses _shared/school-contract.ts).

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSchoolContractLive,
  enforceSchoolContract,
  type SchoolContractRow,
} from "./school-contract.ts";

interface AuditCall {
  table: string;
  row: Record<string, unknown>;
}

function makeStubClient(school: SchoolContractRow | null, audit: AuditCall[]) {
  // Minimal stub matching the surface we use: from(...).select(...).eq(...).maybeSingle()
  // and from('school_audit_logs').insert(row).
  return {
    from(table: string) {
      if (table === "schools") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: school, error: null }),
            }),
          }),
        };
      }
      if (table === "school_audit_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            audit.push({ table, row });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof assertSchoolContractLive>[0];
}

const baseSchool: SchoolContractRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test High",
  status: "active",
  plan: "standard",
  contract_start: "2026-01-01",
  contract_end: "2099-01-01",
};

Deno.test("assertSchoolContractLive — active school passes", async () => {
  const svc = makeStubClient(baseSchool, []);
  const r = await assertSchoolContractLive(svc, baseSchool.id);
  assert(r.ok);
});

Deno.test("assertSchoolContractLive — suspended → 402 SUSPENDED", async () => {
  const svc = makeStubClient({ ...baseSchool, status: "suspended" }, []);
  const r = await assertSchoolContractLive(svc, baseSchool.id);
  assert(!r.ok);
  assertEquals(r.status, 402);
  assertEquals(r.code, "SUSPENDED");
});

Deno.test("assertSchoolContractLive — archived → 410 ARCHIVED", async () => {
  const svc = makeStubClient({ ...baseSchool, status: "archived" }, []);
  const r = await assertSchoolContractLive(svc, baseSchool.id);
  assert(!r.ok);
  assertEquals(r.status, 410);
  assertEquals(r.code, "ARCHIVED");
});

Deno.test("assertSchoolContractLive — expired → 402 EXPIRED", async () => {
  const svc = makeStubClient({ ...baseSchool, contract_end: "2000-01-01" }, []);
  const r = await assertSchoolContractLive(svc, baseSchool.id);
  assert(!r.ok);
  assertEquals(r.status, 402);
  assertEquals(r.code, "EXPIRED");
});

Deno.test("assertSchoolContractLive — not started → 423 NOT_STARTED", async () => {
  const svc = makeStubClient({ ...baseSchool, contract_start: "2999-01-01" }, []);
  const r = await assertSchoolContractLive(svc, baseSchool.id);
  assert(!r.ok);
  assertEquals(r.status, 423);
  assertEquals(r.code, "NOT_STARTED");
});

Deno.test("enforceSchoolContract — writes an audit row on denial", async () => {
  const audit: AuditCall[] = [];
  const svc = makeStubClient({ ...baseSchool, status: "suspended" }, audit);
  const r = await enforceSchoolContract(svc, baseSchool.id, {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "school_teacher",
    feature: "analytics",
  });
  assert("response" in r);
  assertEquals(r.response.status, 402);
  const body = await r.response.json();
  assertEquals(body.code, "SUSPENDED");
  assertEquals(body.feature, "analytics");
  assertEquals(audit.length, 1);
  assertEquals(audit[0].row.action, "contract_gate_denied");
  const diff = audit[0].row.diff as Record<string, unknown>;
  assertEquals(diff.code, "SUSPENDED");
  assertEquals(diff.feature, "analytics");
  assertEquals(diff.role, "school_teacher");
});

Deno.test("enforceSchoolContract — active school does not audit", async () => {
  const audit: AuditCall[] = [];
  const svc = makeStubClient(baseSchool, audit);
  const r = await enforceSchoolContract(svc, baseSchool.id, {
    userId: "u1",
    role: "school_admin",
    feature: "rag.search",
  });
  assert("school" in r);
  assertEquals(audit.length, 0);
});
