import { useEffect } from "react";

const Bookings = () => {
  useEffect(() => {
    document.title = "Admin Bookings | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
      <p className="text-muted-foreground mt-1">View and manage bookings.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Bookings table coming soon.
      </section>
    </main>
  );
};

export default Bookings;
