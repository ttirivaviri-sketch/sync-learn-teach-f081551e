/**
 * LearnerAuth — Learner sign-in / sign-up page.
 *
 * Delegates all form logic to the shared AuthForm component.
 * Only provides learner-specific branding (logo, tagline).
 */
import { AuthForm } from "@/components/AuthForm";
import { Seo } from "@/components/Seo";

const LearnerAuth = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center p-4">
    <Seo
      title="Student Sign In — StudySync"
      description="Sign in or create a free StudySync student account to use AI StudyMode, book verified tutors and open the curriculum-aligned resource library."
      path="/learner/auth"
    />
    <div className="w-full max-w-md">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-3">
          <img
            src="/lovable-uploads/studysync-logo.png"
            alt="StudySync"
            className="w-auto object-contain"
            style={{ height: "160px", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))", mixBlendMode: "screen" }}
          />
        </div>
        <p className="text-xs font-semibold tracking-widest uppercase text-white/75 mb-1">
          Education, in sync with your future
        </p>
        <h1 className="text-2xl font-extrabold text-white">Sign in to StudySync</h1>
      </div>

      <AuthForm
        userType="learner"
        redirectTo="/learner"
        subtitle="Sign in to your account or create a new one"
      />
    </div>
  </div>
);

export default LearnerAuth;
