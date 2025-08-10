import { useEffect } from "react";

const Roles = () => {
  useEffect(() => {
    document.title = "Admin Roles & Access | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
      <p className="text-muted-foreground mt-1">Admin, Finance, and Support access.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Role management coming soon.
      </section>
    </main>
  );
};

export default Roles;
