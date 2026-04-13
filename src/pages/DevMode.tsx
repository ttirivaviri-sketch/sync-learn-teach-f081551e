import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDevMode } from "@/contexts/DevModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Code2, Video, Users, CreditCard, Calendar, Zap,
  GraduationCap, BookOpen, ArrowRight, Shield, Lock,
  ShieldCheck, AlertTriangle, Wifi, RotateCcw
} from "lucide-react";

const DevMode = () => {
  const {
    isAuthenticated, authenticateDevMode,
    enableDevMode, config, updateConfig, resetDevState,
  } = useDevMode();

  const [passphrase, setPassphrase] = useState("");
  const [authError, setAuthError] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"learner" | "tutor" | null>(null);
  const navigate = useNavigate();

  const handleAuth = () => {
    const ok = authenticateDevMode(passphrase);
    if (!ok) setAuthError(true);
  };

  const handleLaunch = (role: "learner" | "tutor") => {
    enableDevMode(role);
    navigate(role === "learner" ? "/learner" : "/tutor");
  };

  // Gate: passphrase required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, hsl(220 20% 10%), hsl(220 15% 15%), hsl(220 20% 10%))" }}>
        <Card className="w-full max-w-sm border-yellow-500/30 bg-gray-900/80 text-white">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto mb-2" style={{ color: "hsl(48 96% 53%)" }} />
            <CardTitle className="text-lg" style={{ color: "hsl(48 96% 53%)" }}>Developer Access</CardTitle>
            <p className="text-xs text-gray-400 mt-1">Enter passphrase to continue</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => { setPassphrase(e.target.value); setAuthError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
            {authError && <p className="text-red-400 text-xs text-center">Invalid passphrase</p>}
            <Button
              className="w-full font-bold"
              style={{ backgroundColor: "hsl(48 96% 53%)", color: "hsl(40 80% 10%)" }}
              onClick={handleAuth}
            >
              Unlock Dev Mode
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(135deg, hsl(48 100% 96%), hsl(48 80% 92%), hsl(40 60% 90%))" }}>
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4 font-bold text-sm shadow"
          style={{ backgroundColor: "hsl(48 96% 53%)", color: "hsl(40 80% 15%)" }}
        >
          <Code2 className="h-4 w-4" />
          DEVELOPER MODE
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-4xl font-extrabold tracking-tight">
            <span className="text-gray-900">Study</span><span className="text-green-500">Sync</span>
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-sm">
          Full simulation layer — auth, payments, subscriptions & scheduling all controlled.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-4">
        {/* Config Panel */}
        <Card className="bg-white/80 shadow-sm" style={{ borderColor: "hsl(48 60% 75%)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: "hsl(40 80% 25%)" }}>
              <Shield className="h-4 w-4" />
              Feature Toggles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow icon={<ShieldCheck className="h-4 w-4" />} label="Bypass Auth" desc="Skip login, always authenticated" checked={config.bypassAuth} onChange={(v) => updateConfig({ bypassAuth: v })} />
            <ToggleRow icon={<CreditCard className="h-4 w-4" />} label="Bypass Payments" desc="Skip PayFast, mark all as paid" checked={config.bypassPayments} onChange={(v) => updateConfig({ bypassPayments: v, forcePaidBookings: v })} />
            <ToggleRow icon={<Calendar className="h-4 w-4" />} label="Bypass Schedule" desc="Join sessions regardless of time" checked={config.bypassSchedule} onChange={(v) => updateConfig({ bypassSchedule: v })} />

            <hr className="border-gray-200" />

            <ToggleRow icon={<AlertTriangle className="h-4 w-4" />} label="Simulate Failures" desc="30% chance of random errors" checked={config.simulateFailures} onChange={(v) => updateConfig({ simulateFailures: v })} destructive />
            <ToggleRow icon={<Wifi className="h-4 w-4" />} label="Slow Network" desc="Add 2-5s delay to operations" checked={config.simulateSlowNetwork} onChange={(v) => updateConfig({ simulateSlowNetwork: v })} destructive />

            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={resetDevState}>
              <RotateCcw className="h-3 w-3" />
              Reset All Toggles
            </Button>
          </CardContent>
        </Card>

        {/* Role Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer transition-all border-2 hover:shadow-md ${
              selectedRole === "learner" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"
            }`}
            onClick={() => setSelectedRole("learner")}
          >
            <CardContent className="p-5 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900">Learner</h3>
              <p className="text-xs text-gray-500 mt-1">Browse tutors, book sessions, study mode</p>
              {selectedRole === "learner" && <Badge className="mt-2 bg-blue-500 text-white text-[10px]">Selected</Badge>}
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all border-2 hover:shadow-md ${
              selectedRole === "tutor" ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-green-300"
            }`}
            onClick={() => setSelectedRole("tutor")}
          >
            <CardContent className="p-5 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
                <GraduationCap className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Tutor</h3>
              <p className="text-xs text-gray-500 mt-1">Manage bookings, accept sessions, teach</p>
              {selectedRole === "tutor" && <Badge className="mt-2 bg-green-500 text-white text-[10px]">Selected</Badge>}
            </CardContent>
          </Card>
        </div>

        {/* What dev mode controls */}
        <Card className="border-gray-200 bg-white/80">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Simulation Layer</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Shield, label: "Auth simulated", color: "text-red-500" },
                { icon: CreditCard, label: "Payments auto-paid", color: "text-green-500" },
                { icon: Zap, label: "Subscriptions active", color: "text-yellow-500" },
                { icon: Calendar, label: "Schedule bypassed", color: "text-purple-500" },
                { icon: Video, label: "Instant video session", color: "text-blue-500" },
                { icon: Users, label: "Simulated partner", color: "text-orange-500" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Launch buttons */}
        <div className="space-y-2">
          <Button className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2" onClick={() => handleLaunch("learner")}>
            <BookOpen className="h-5 w-5" />
            Launch as Learner
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
          <Button className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-bold gap-2" onClick={() => handleLaunch("tutor")}>
            <GraduationCap className="h-5 w-5" />
            Launch as Tutor
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Dev mode persists across reloads. Disable from the yellow banner.
        </p>
      </div>
    </div>
  );
};

// ── Toggle row helper ───────────────────────────────────────────────────────
function ToggleRow({
  icon, label, desc, checked, onChange, destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{
      backgroundColor: destructive ? "hsl(0 80% 97%)" : "hsl(48 80% 96%)",
      border: `1px solid ${destructive ? "hsl(0 50% 88%)" : "hsl(48 60% 85%)"}`,
    }}>
      <div className="flex items-center gap-2">
        <span style={{ color: destructive ? "hsl(0 60% 45%)" : "hsl(40 60% 35%)" }}>{icon}</span>
        <div>
          <p className="text-sm font-medium" style={{ color: destructive ? "hsl(0 60% 30%)" : "hsl(40 80% 15%)" }}>{label}</p>
          <p className="text-xs" style={{ color: destructive ? "hsl(0 30% 50%)" : "hsl(40 30% 50%)" }}>{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default DevMode;
