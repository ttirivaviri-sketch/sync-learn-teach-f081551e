import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LearnerApp from "./pages/LearnerApp";
import LearnerAuth from "./pages/LearnerAuth";
import TutorApp from "./pages/TutorApp";
import TutorAuth from "./pages/TutorAuth";
import NotFound from "./pages/NotFound";
import ChooseStudyLevel from "./pages/ChooseStudyLevel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/learner" element={<LearnerApp />} />
          <Route path="/learner/auth" element={<LearnerAuth />} />
          <Route path="/learner/choose-level" element={<ChooseStudyLevel />} />
          <Route path="/tutor" element={<TutorApp />} />
          <Route path="/tutor/auth" element={<TutorAuth />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
