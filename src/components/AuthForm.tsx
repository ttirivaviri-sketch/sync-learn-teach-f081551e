/**
 * AuthForm — Shared sign-in / sign-up / forgot-password form.
 *
 * Used by both LearnerAuth and TutorAuth to eliminate ~80% duplicated auth UI.
 * Each page only needs to supply user-type specific copy, the redirect URL,
 * and optional extra sign-up fields (e.g. TutorAuth's verification step).
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Forgot-password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const { toast } = useToast();

  // ── Sign Up ─────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
          data: { full_name: fullName, user_type: userType },
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
          queryParams: { user_type: userType },
        },
      });
      if (error) {
        toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not start Google sign-in.", variant: "destructive" });
    } finally {
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
    <Card className="bg-white/95 backdrop-blur-sm">
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
                {signUpHint}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : userType === "tutor" ? "Create Tutor Account" : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
