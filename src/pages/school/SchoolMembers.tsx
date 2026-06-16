import { useOutletContext } from "react-router-dom";
import { MembersPanel } from "@/pages/admin/SchoolDetail";
import type { School } from "@/hooks/useSchools";

export default function SchoolMembers() {
  const { school } = useOutletContext<{ school: School }>();
  return (
    <section className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Members</h1>
      <MembersPanel schoolId={school.id} />
    </section>
  );
}
