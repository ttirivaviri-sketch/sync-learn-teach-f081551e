import { useEffect } from "react";

const Support = () => {
  useEffect(() => {
    document.title = "Admin Support | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
      <p className="text-muted-foreground mt-1">Ticket queue and customer support tools.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Support queue coming soon.
      </section>
    </main>
  );
};

export default Support;
