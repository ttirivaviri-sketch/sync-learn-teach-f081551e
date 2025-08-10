import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AdminAuth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Admin Sign In | StudySync";
  }, []);

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Admin Sign In</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This area is for StudySync staff. Authentication will be configured here.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => navigate("/admin")}>Continue to Dashboard</Button>
          <Button variant="outline" onClick={() => navigate("/")}>Back to site</Button>
        </div>
      </section>
    </main>
  );
};

export default AdminAuth;
