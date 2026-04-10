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
  GraduationCap, BookOpen, ArrowRight, Shield, Lock
} from "lucide-react";

const DevMode = () => {
  const {
    isAuthenticated, authenticateDevMode,
    enableDevMode, bypassPayments, bypassSchedule,
    toggleBypassPayments, toggleBypassSchedule,
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm border-yellow-500/30 bg-gray-900/80 text-white">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
            <CardTitle className="text-lg text-yellow-400">Developer Access</CardTitle>
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
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold"
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-yellow-100 to-amber-100 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-yellow-400 text-yellow-900 rounded-full px-4 py-2 mb-4 font-bold text-sm shadow">
          <Code2 className="h-4 w-4" />
          DEVELOPER MODE
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-4xl font-extrabold tracking-tight">
            <span className="text-gray-900">Study</span><span className="text-green-500">Sync</span>
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-sm">
          Full app access — auth, payments, subscriptions & scheduling all bypassed.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-4">
        {/* Config Panel */}
        <Card className="border-yellow-300 bg-white/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
              <Shield className="h-4 w-4" />
              Bypass Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-700" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Bypass Payments</p>
                  <p className="text-xs text-yellow-600">Skip PayFast, mark all bookings as paid</p>
                </div>
              </div>
              <Switch checked={bypassPayments} onCheckedChange={toggleBypassPayments} className="data-[state=checked]:bg-yellow-500" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-700" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Bypass Schedule</p>
                  <p className="text-xs text-yellow-600">Join sessions regardless of scheduled time</p>
                </div>
              </div>
              <Switch checked={bypassSchedule} onCheckedChange={toggleBypassSchedule} className="data-[state=checked]:bg-yellow-500" />
            </div>
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

        {/* What dev mode enables */}
        <Card className="border-gray-200 bg-white/80">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Everything Bypassed</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Shield, label: "Auth bypassed", color: "text-red-500" },
                { icon: CreditCard, label: "Payments auto-paid", color: "text-green-500" },
                { icon: Zap, label: "Subscriptions active", color: "text-yellow-500" },
                { icon: Calendar, label: "Schedule ignored", color: "text-purple-500" },
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

export default DevMode;
