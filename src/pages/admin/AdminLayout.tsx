import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/admin/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type GuardState = "checking" | "ok" | "denied";

const AdminLayout = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    document.title = "Admin Panel | StudySync";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", "StudySync Admin Panel for managing users, bookings, payments, and support.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) {
          setState("denied");
          navigate("/admin/auth", { replace: true });
        }
        return;
      }
      const { data: isAdmin, error } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin" as never,
      });
      if (cancelled) return;
      if (error || !isAdmin) {
        setState("denied");
        navigate("/admin/auth", { replace: true });
        return;
      }
      setState("ok");
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (state === "checking") {
    return (
      <main className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying admin access…
      </main>
    );
  }
  if (state !== "ok") return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger aria-label="Toggle admin sidebar" />
              <Link to="/admin">
                <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-10 object-contain" />
              </Link>
            </div>
            <nav className="text-sm">
              <Link to="/" className="hover:underline">Back to site</Link>
            </nav>
          </div>
        </header>

        <div className="flex w-full min-h-[calc(100vh-56px)]">
          <aside aria-label="Admin navigation">
            <AppSidebar />
          </aside>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
