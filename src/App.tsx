import { Suspense, lazy } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingSpinner";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// ── Lazy-loaded page routes (code-splitting) ──────────────────────────────────
const Index = lazy(() => import("./pages/Index"));
const LearnerApp = lazy(() => import("./pages/LearnerApp"));
const LearnerAuth = lazy(() => import("./pages/LearnerAuth"));
const TutorApp = lazy(() => import("./pages/TutorApp"));
const TutorAuth = lazy(() => import("./pages/TutorAuth"));

const NotFound = lazy(() => import("./pages/NotFound"));
const ChooseStudyLevel = lazy(() => import("./pages/ChooseStudyLevel"));
const LearnerOnboarding = lazy(() => import("./pages/LearnerOnboarding"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelled = lazy(() => import("./pages/PaymentCancelled"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));

// Admin sub-pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminBookings = lazy(() => import("./pages/admin/Bookings"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const AdminSupport = lazy(() => import("./pages/admin/Support"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminRoles = lazy(() => import("./pages/admin/Roles"));
const AdminSecurity = lazy(() => import("./pages/admin/Security"));
const AdminRefunds = lazy(() => import("./pages/admin/Refunds"));
const AdminSAIL = lazy(() => import("./pages/admin/SAIL"));
const AdminVerifications = lazy(() => import("./pages/admin/Verifications"));
const AdminCurriculumTemplates = lazy(() => import("./pages/admin/CurriculumTemplates"));
const AdminLibrary = lazy(() => import("./pages/admin/Library"));

// ── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        const e = error as { status?: number };
        if (e?.status === 401 || e?.status === 403) return false;
        return failureCount < 1; // single retry — stop retry storms
      },
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <OfflineIndicator />
          <Suspense fallback={<LoadingScreen message="Loading StudySync..." />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/learner" element={<LearnerApp />} />
              <Route path="/start-trial" element={<Navigate to="/learner/auth" replace />} />
              <Route path="/learner/auth" element={<LearnerAuth />} />
              <Route path="/learner/onboarding" element={<LearnerOnboarding />} />
              <Route path="/learner/choose-level" element={<ChooseStudyLevel />} />
              <Route path="/tutor" element={<TutorApp />} />
              <Route path="/tutor/auth" element={<TutorAuth />} />

              {/* Payment routes */}
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/payment-cancelled" element={<PaymentCancelled />} />

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
                <Route path="refunds" element={<AdminRefunds />} />
                <Route path="sail" element={<AdminSAIL />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="curriculum-templates" element={<AdminCurriculumTemplates />} />
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
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
