import { useOutletContext } from "react-router-dom";
import { InvitationsPanel } from "@/pages/admin/SchoolDetail";
import type { School } from "@/hooks/useSchools";

export default function SchoolInvitations() {
  const { school } = useOutletContext<{ school: School }>();
  return (
    <section className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Invitations</h1>
      <InvitationsPanel schoolId={school.id} />
    </section>
  );
}
