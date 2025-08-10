import { useEffect } from "react";
import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/admin/AppSidebar";

const AdminLayout = () => {
  useEffect(() => {
    document.title = "Admin Panel | StudySync";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", "StudySync Admin Panel for managing users, bookings, payments, and support.");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger aria-label="Toggle admin sidebar" />
            <Link to="/admin" className="font-semibold tracking-tight">StudySync Admin</Link>
          </div>
          <nav className="text-sm">
            <Link to="/" className="hover:underline">Back to site</Link>
          </nav>
        </div>
      </header>

      <SidebarProvider>
        <div className="flex w-full min-h-[calc(100vh-56px)]">
          <aside aria-label="Admin navigation">
            <AppSidebar />
          </aside>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default AdminLayout;
