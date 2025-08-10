import { useEffect } from "react";

const Users = () => {
  useEffect(() => {
    document.title = "Admin Users | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-1">Manage learners and tutors.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Users table coming soon.
      </section>
    </main>
  );
};

export default Users;
