import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Index from "./pages/Index";
import LearnerApp from "./pages/LearnerApp";
import LearnerAuth from "./pages/LearnerAuth";
import TutorApp from "./pages/TutorApp";
import TutorAuth from "./pages/TutorAuth";
import NotFound from "./pages/NotFound";
import ChooseStudyLevel from "./pages/ChooseStudyLevel";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminBookings from "./pages/admin/Bookings";
import AdminPayments from "./pages/admin/Payments";
import AdminSupport from "./pages/admin/Support";
import AdminReports from "./pages/admin/Reports";
import AdminRoles from "./pages/admin/Roles";
import AdminSecurity from "./pages/admin/Security";
import AdminAuth from "./pages/AdminAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <OfflineIndicator />
          <Suspense fallback={<LoadingScreen message="Loading StudySync..." />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/learner" element={<LearnerApp />} />
              <Route path="/learner/auth" element={<LearnerAuth />} />
              <Route path="/learner/choose-level" element={<ChooseStudyLevel />} />
              <Route path="/tutor" element={<TutorApp />} />
              <Route path="/tutor/auth" element={<TutorAuth />} />

              {/* Admin routes */}
              <Route path="/admin/auth" element={<AdminAuth />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="roles" element={<AdminRoles />} />
                <Route path="security" element={<AdminSecurity />} />
              </Route>

              {/* 404 handling */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;