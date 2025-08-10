import { useEffect } from "react";

const Reports = () => {
  useEffect(() => {
    document.title = "Admin Reports | StudySync";
  }, []);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-muted-foreground mt-1">Export CSVs and analyze metrics.</p>
      <section className="mt-6 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Reports builder coming soon.
      </section>
    </main>
  );
};

export default Reports;
