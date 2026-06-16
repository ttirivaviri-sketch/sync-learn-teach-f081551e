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
const AdminAllocations = lazy(() => import("./pages/admin/Allocations"));
const AdminStudyAnalytics = lazy(() => import("./pages/admin/StudyAnalytics"));
const AdminSchools = lazy(() => import("./pages/admin/Schools"));
const AdminSchoolDetail = lazy(() => import("./pages/admin/SchoolDetail"));

// School admin portal
const SchoolLayout = lazy(() => import("./pages/school/SchoolLayout"));
const SchoolDashboard = lazy(() => import("./pages/school/SchoolDashboard"));
const SchoolMembers = lazy(() => import("./pages/school/SchoolMembers"));
const SchoolInvitations = lazy(() => import("./pages/school/SchoolInvitations"));
const SchoolSettings = lazy(() => import("./pages/school/SchoolSettings"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));

// Legal pages
const LegalTerms = lazy(() => import("./pages/legal/Terms"));
const LegalPrivacy = lazy(() => import("./pages/legal/Privacy"));
const LegalCookies = lazy(() => import("./pages/legal/Cookies"));
const LegalCopyright = lazy(() => import("./pages/legal/Copyright"));
const LegalLibrary = lazy(() => import("./pages/legal/LibraryDisclaimer"));
const LegalCommunity = lazy(() => import("./pages/legal/Community"));
const LegalRefunds = lazy(() => import("./pages/legal/Refunds"));
const LegalDataCompliance = lazy(() => import("./pages/legal/DataCompliance"));

// Settings
const SettingsDataCompliance = lazy(() => import("./pages/settings/DataCompliance"));
const DebugHaptics = lazy(() => import("./pages/DebugHaptics"));


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
              <Route path="/index" element={<Navigate to="/" replace />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
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
                <Route path="library" element={<AdminLibrary />} />
                <Route path="allocations" element={<AdminAllocations />} />
                <Route path="study-analytics" element={<AdminStudyAnalytics />} />
              </Route>

              {/* Legal */}
              <Route path="/legal/terms" element={<LegalTerms />} />
              <Route path="/legal/privacy" element={<LegalPrivacy />} />
              <Route path="/legal/cookies" element={<LegalCookies />} />
              <Route path="/legal/copyright" element={<LegalCopyright />} />
              <Route path="/legal/library" element={<LegalLibrary />} />
              <Route path="/legal/community" element={<LegalCommunity />} />
              <Route path="/legal/refunds" element={<LegalRefunds />} />
              <Route path="/legal/data-compliance" element={<LegalDataCompliance />} />

              {/* Settings */}
              <Route path="/settings/data-compliance" element={<SettingsDataCompliance />} />

              {/* Debug */}
              <Route path="/debug/haptics" element={<DebugHaptics />} />

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
