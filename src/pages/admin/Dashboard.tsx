import { useEffect } from "react";

const AdminDashboard = () => {
  useEffect(() => {
    document.title = "Admin Dashboard | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-1">Key metrics and recent activity.</p>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm text-muted-foreground">Active Sessions</h2>
          <p className="text-3xl font-bold">—</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm text-muted-foreground">Today's Revenue</h2>
          <p className="text-3xl font-bold">—</p>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h2 className="text-sm text-muted-foreground">Pending Tutor Approvals</h2>
          <p className="text-3xl font-bold">—</p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Recent Bookings</h2>
        <div className="mt-3 rounded-md border bg-card p-4 text-sm text-muted-foreground">Table coming soon.</div>
      </section>
    </main>
  );
};

export default AdminDashboard;
