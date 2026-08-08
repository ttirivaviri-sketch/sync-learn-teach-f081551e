/**
 * AuthForm — Shared sign-in / sign-up / forgot-password form.
 *
 * Used by both LearnerAuth and TutorAuth to eliminate ~80% duplicated auth UI.
 * Each page only needs to supply user-type specific copy, the redirect URL,
 * and optional extra sign-up fields (e.g. TutorAuth's verification step).
 *
 * Security: sign-up requires explicit Terms & Conditions acceptance before
 * the form can be submitted.  The acceptance timestamp + version are stored
 * on the profiles row after account creation.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TERMS_VERSION } from "@/lib/legal";

// ── Props ───────────────────────────────────────────────────────────────────
export interface AuthFormProps {
  /** 'learner' or 'tutor' — drives user_type metadata and redirect behaviour */
  userType: "learner" | "tutor";
  /** Where to redirect when user is already authenticated */
  redirectTo: string;
  /** Card subtitle text */
  subtitle?: string;
  /** Label on the sign-up tab trigger */
  signUpLabel?: string;
  /** Extra hint shown below sign-up fields (e.g. verification info) */
  signUpHint?: React.ReactNode;
  /** Called after a successful sign-up (before redirect). Receives the new session user id. */
  onSignUpSuccess?: (userId: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────
export const AuthForm = ({
  userType,
  redirectTo,
  subtitle = "Sign in to your account or create a new one",
  signUpLabel = "Sign Up",
  signUpHint,
  onSignUpSuccess,
}: AuthFormProps) => {
  // Shared auth hook handles redirect for already-authenticated users
  useAuth({ redirectIfFound: redirectTo });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Terms & Conditions acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Forgot-password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const { toast } = useToast();

  // ── Sign Up ─────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard: Terms must be accepted before we proceed
    if (!termsAccepted) {
      toast({
        title: "Terms & Conditions required",
        description:
          "Please read and accept the Terms of Service and Privacy Policy before creating your account.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const acceptedAt = new Date().toISOString();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
          data: {
            full_name: fullName,
            user_type: userType,
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION,
          },
        },
      });

      if (error) {
        toast({
          title: error.message.includes("already registered") ? "Account exists" : "Sign up failed",
          description: error.message.includes("already registered")
            ? "This email is already registered. Please sign in instead."
            : error.message,
          variant: "destructive",
        });
      } else {
        // Persist terms acceptance to the profiles row (best-effort; trigger
        // may already handle this from auth.users metadata)
        if (data.user) {
          await supabase
            .from("profiles")
            .update({
              terms_accepted_at: acceptedAt,
              terms_version: TERMS_VERSION,
            })
            .eq("id", data.user.id);
        }

        toast({
          title: userType === "tutor" ? "Account created!" : "Success!",
          description: userType === "tutor"
            ? "Please complete your verification documents."
            : "Please check your email to confirm your account.",
        });
        if (data.user && onSignUpSuccess) {
          onSignUpSuccess(data.user.id);
        }
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign In ─────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message.includes("Invalid login credentials")
            ? "Invalid email or password. Please try again."
            : error.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // Remember the intended role across the Google OAuth round-trip. Supabase
      // does not forward custom metadata through `signInWithOAuth`, so we use
      // localStorage as a short-lived intent token and reconcile it on the
      // post-redirect landing page (see useGoogleOAuthProfileSync).
      localStorage.setItem("ss-google-oauth-user-type", userType);

      // Build the post-OAuth redirect URL.
      // Must exactly match one of the "Redirect URLs" configured in
      // Supabase → Authentication → URL Configuration → Redirect URLs.
      // e.g. https://your-app.com/learner  or  https://your-app.com/tutor
      const redirectUrl = `${window.location.origin}${redirectTo}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
          scopes: "email profile",
        },
      });

      if (error) {
        localStorage.removeItem("ss-google-oauth-user-type");
        toast({
          title: "Google sign-in failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
      }
      // On success Supabase redirects the browser — no further action needed.
    } catch (err) {
      localStorage.removeItem("ss-google-oauth-user-type");
      toast({
        title: "Could not start Google sign-in",
        description: "Please try again or use email/password.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };


  // ── Forgot Password ─────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}${redirectTo}`,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Reset link sent!", description: "Check your email for a password reset link." });
        setShowForgotPassword(false);
        setForgotEmail("");
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Card className="bg-white/95 backdrop-blur-sm text-slate-900 [&_label]:text-slate-900 [&_input]:text-slate-900 [&_input]:bg-white [&_input::placeholder]:text-slate-400">
      <CardHeader>
        <CardTitle className="text-center">Welcome</CardTitle>
        <CardDescription className="text-center">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter your email to receive a password reset link
            </p>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)}>
              &larr; Back to Sign In
            </Button>
          </form>
        ) : (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">{signUpLabel}</TabsTrigger>
            </TabsList>

            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4 gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {/* ── Terms & Conditions checkbox — REQUIRED ─────────────── */}
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms-accept"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      className="mt-0.5 shrink-0"
                      aria-required="true"
                    />
                    <label
                      htmlFor="terms-accept"
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
                    >
                      I have read and agree to the{" "}
                      <a
                        href="/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary/80 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms of Service
                      </a>
                      {" "}and{" "}
                      <a
                        href="/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary/80 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>
                      . I understand that StudySync collects personal information
                      to provide educational services and will handle it in accordance
                      with applicable data-protection laws.
                    </label>
                  </div>
                  {!termsAccepted && (
                    <p className="text-xs text-amber-600 font-medium pl-6">
                      You must accept the Terms &amp; Conditions to create an account.
                    </p>
                  )}
                </div>

                {signUpHint}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !termsAccepted}
                  aria-disabled={!termsAccepted}
                >
                  {loading
                    ? "Creating account..."
                    : userType === "tutor"
                      ? "Create Tutor Account"
                      : "Sign Up"}
                </Button>

                {/* Reassurance note */}
                <p className="text-center text-xs text-muted-foreground">
                  By signing up you confirm you are 13 years or older (learners) or 18+ (tutors).
                </p>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
