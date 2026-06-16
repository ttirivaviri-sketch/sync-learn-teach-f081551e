/**
 * Hooks for the StudySync multi-school system.
 * Covers super-admin (all schools) and school-admin (scoped to current school) flows.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SchoolStatus = "active" | "suspended" | "archived" | "trial";
export type SchoolPlan = "trial" | "standard" | "premium" | "enterprise";
export type SchoolRole = "school_admin" | "school_teacher" | "school_student";
export type MembershipStatus = "invited" | "active" | "suspended" | "removed";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  country: string | null;
  school_type: string | null;
  address: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: SchoolStatus;
  plan: SchoolPlan;
  seats_teachers: number;
  seats_students: number;
  ai_quota_daily: number;
  storage_quota_mb: number;
  contract_start: string | null;
  contract_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchoolMembership {
  id: string;
  school_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: SchoolRole;
  status: MembershipStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

export interface SchoolInvitation {
  id: string;
  school_id: string;
  email: string;
  role: SchoolRole;
  token: string;
  status: InvitationStatus;
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Super-admin: list/create/update schools
// ─────────────────────────────────────────────────────────────────────────────
export function useAdminSchools(filters?: { status?: SchoolStatus; search?: string }) {
  return useQuery({
    queryKey: ["admin-schools", filters],
    queryFn: async () => {
      let q = supabase.from("schools" as any).select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as School[];
    },
  });
}

export function useSchool(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools" as any).select("*").eq("id", schoolId!).maybeSingle();
      if (error) throw error;
      return data as unknown as School | null;
    },
  });
}

export function useCreateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<School> & { name: string; slug: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("schools" as any)
        .insert({ ...input, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as School;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-schools"] }),
  });
}

export function useUpdateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<School> }) => {
      const { data, error } = await supabase.from("schools" as any).update(patch as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as School;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["school", s.id] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Memberships (works for both super-admin and school-admin via RLS)
// ─────────────────────────────────────────────────────────────────────────────
export function useSchoolMemberships(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-memberships", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_memberships" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .neq("status", "removed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as SchoolMembership[];

      // Hydrate profiles
      const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email,avatar_url")
          .in("id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        rows.forEach((r) => {
          r.profile = r.user_id ? (map.get(r.user_id) as any) ?? null : null;
        });
      }
      return rows;
    },
  });
}

export function useUpdateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SchoolMembership> }) => {
      const { data, error } = await supabase
        .from("school_memberships" as any)
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SchoolMembership;
    },
    onSuccess: (m) => qc.invalidateQueries({ queryKey: ["school-memberships", m.school_id] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────────────────────
export function useSchoolInvitations(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-invitations", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_invitations" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SchoolInvitation[];
    },
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { school_id: string; email: string; role: SchoolRole; message?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("school_invitations" as any)
        .insert({
          school_id: input.school_id,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          message: input.message ?? null,
          invited_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SchoolInvitation;
    },
    onSuccess: (i) => qc.invalidateQueries({ queryKey: ["school-invitations", i.school_id] }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitation: SchoolInvitation) => {
      const { error } = await supabase
        .from("school_invitations" as any)
        .update({ status: "revoked" } as any)
        .eq("id", invitation.id);
      if (error) throw error;
      return invitation;
    },
    onSuccess: (i) => qc.invalidateQueries({ queryKey: ["school-invitations", i.school_id] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_school_invitation" as any, { _token: token });
      if (error) throw error;
      return data as { school_id: string; role: SchoolRole };
    },
  });
}

export async function fetchInvitationSummary(token: string) {
  const { data, error } = await supabase.rpc("get_invitation_summary" as any, { _token: token });
  if (error) throw error;
  return data as null | {
    email: string;
    role: SchoolRole;
    status: InvitationStatus;
    expires_at: string;
    school_name: string;
    school_slug: string;
    expired: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// "My schools" — schools the current user belongs to (used by /school portal)
// ─────────────────────────────────────────────────────────────────────────────
export function useMySchoolMemberships() {
  return useQuery({
    queryKey: ["my-school-memberships"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("school_memberships" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      const memberships = (data ?? []) as unknown as SchoolMembership[];
      const ids = Array.from(new Set(memberships.map((m) => m.school_id)));
      if (!ids.length) return [];
      const { data: schools } = await supabase.from("schools" as any).select("*").in("id", ids);
      const sMap = new Map(((schools ?? []) as any[]).map((s) => [s.id, s as School]));
      return memberships
        .map((m) => ({ membership: m, school: sMap.get(m.school_id) as School | undefined }))
        .filter((x) => x.school) as { membership: SchoolMembership; school: School }[];
    },
  });
}
