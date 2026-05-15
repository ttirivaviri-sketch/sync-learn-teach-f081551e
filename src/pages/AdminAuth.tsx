import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Admin Sign In | StudySync";
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        toast({ title: "Sign-in failed", description: error?.message || "Invalid credentials", variant: "destructive" });
        return;
      }
      // Verify admin role server-side via has_role RPC.
      // Retry once on transient Safari "Load failed"/network errors so a
      // flaky connection doesn't masquerade as "Access denied".
      let isAdmin: boolean | null = null;
      let roleErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await supabase.rpc("has_role", {
          _user_id: data.session.user.id,
          _role: "admin" as never,
        });
        roleErr = res.error;
        isAdmin = res.data as boolean | null;
        const msg = (roleErr?.message || "").toLowerCase();
        const transient =
          msg.includes("load failed") ||
          msg.includes("failed to fetch") ||
          msg.includes("networkerror") ||
          msg.includes("timeout");
        if (!roleErr || !transient) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (roleErr) {
        toast({
          title: "Network error",
          description: "Couldn't verify admin access. Check your connection and try again.",
          variant: "destructive",
        });
        return;
      }
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast({ title: "Access denied", description: "Your account is not an admin.", variant: "destructive" });
        return;
      }
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border bg-card p-6">
        <img src="/lovable-uploads/studysync-logo.png" alt="StudySync" className="h-14 object-contain mb-3" />
        <h1 className="text-xl font-semibold tracking-tight">Admin Sign In</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Staff only. Access is verified server-side.
        </p>
        <form onSubmit={handleSignIn} className="mt-6 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-pwd">Password</Label>
            <Input id="admin-pwd" type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
            <Button type="button" variant="outline" onClick={() => navigate("/")}>Back to site</Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default AdminAuth;
