/**
 * Canonical subject name: lowercase, parenthetical suffixes (e.g. "(IGCSE)") stripped, trimmed.
 * Used to detect & merge duplicate subject rows like "Mathematics" vs "Mathematics (IGCSE)".
 */
export function canonicalSubjectName(name: string | null | undefined): string {
  return (name ?? "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Find an existing subject row for a user whose canonical name matches the given name.
 * Returns the row id if found, otherwise null.
 */
export async function findExistingSubjectId(
  supabase: any,
  userId: string,
  name: string
): Promise<string | null> {
  const target = canonicalSubjectName(name);
  if (!target) return null;
  const { data } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", userId);
  if (!data) return null;
  const match = (data as Array<{ id: string; name: string }>).find(
    (r) => canonicalSubjectName(r.name) === target
  );
  return match?.id ?? null;
}
