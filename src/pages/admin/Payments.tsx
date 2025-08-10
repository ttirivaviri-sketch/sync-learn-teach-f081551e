import { useEffect } from "react";

const Payments = () => {
  useEffect(() => {
    document.title = "Admin Payments | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Payments & Payouts</h1>
      <p className="text-muted-foreground mt-1">Transactions, refunds, and payouts.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Payments ledger coming soon.
      </section>
    </main>
  );
};

export default Payments;
