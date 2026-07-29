/**
 * GuardianPortal — read-only parent view (/guardian).
 *
 * Flow: parent signs in with a normal account → redeems the code their
 * learner shared → sees a per-learner digest served by the SECURITY DEFINER
 * RPC get_guardian_learner_overview (profile, subscription status, weekly
 * study activity and score trend, recent sessions). No write access.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, CreditCard, HeartHandshake, Loader2,
  TrendingDown, TrendingUp,
} from "lucide-react";

interface LinkRow {
  id: string;
  learner_user_id: string;
  status: string;
}

interface Overview {
  profile: { full_name?: string | null; avatar_url?: string | null };
  subscription: {
    plan?: string; status?: string; amount?: number | null;
    currency?: string | null; trial_end?: string | null;
  } | null;
  week: {
    sessions_this_week?: number; sessions_last_week?: number;
    avg_score_this_week?: number | null; avg_score_last_week?: number | null;
  };
  recent: Array<{
    occurred_at: string; source: string;
    topic_name: string | null; score_pct: number | null;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  topic_session: "Topic practice",
  school_homework: "School homework",
  lesson_reinforcement: "Lesson review",
  school_quiz: "Class quiz",
  daily_task: "Daily task",
  mock_exam: "Mock exam",
  booking_completed: "Tutor session",
  photo_solve: "Photo solve",
};

export default function GuardianPortal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ["guardian-learners", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("guardian_links")
        .select("id,learner_user_id,status")
        .eq("guardian_user_id", userId)
        .eq("status", "active");
      if (error) return [] as LinkRow[];
      return (data ?? []) as LinkRow[];
    },
  });

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc("accept_guardian_invite", {
        p_code: code.trim(),
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Invalid code");
      toast.success("Linked! You can now follow this learner's progress.");
      setCode("");
      qc.invalidateQueries({ queryKey: ["guardian-learners", userId] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <HeartHandshake className="h-10 w-10 text-rose-500 mx-auto" />
            <h1 className="text-xl font-semibold">Parent / Guardian Portal</h1>
            <p className="text-sm text-muted-foreground">
              Sign in (or create a free account) to follow your learner's progress.
              You'll need the invite code from your child's Profile tab.
            </p>
            <Button className="w-full" onClick={() => navigate("/learner/auth?redirect=/guardian")}>
              Sign in to continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <HeartHandshake className="h-5 w-5 text-rose-500" />
          <h1 className="text-lg font-semibold">Guardian Portal</h1>
        </div>

        {/* Redeem a code */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Link a learner</p>
            <p className="text-xs text-muted-foreground">
              Ask your child to create an invite code from their Profile tab
              (Parent / guardian access), then enter it here.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 4F7A2C1B"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest uppercase"
                maxLength={12}
              />
              <Button onClick={redeem} disabled={redeeming || !code.trim()}>
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {linksLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {(links ?? []).map((l) => (
          <LearnerOverviewCard key={l.id} learnerId={l.learner_user_id} />
        ))}

        {!linksLoading && (links ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No learners linked yet.
          </p>
        )}
      </div>
    </div>
  );
}

function LearnerOverviewCard({ learnerId }: { learnerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["guardian-overview", learnerId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_guardian_learner_overview",
        { p_learner: learnerId },
      );
      if (error) throw error;
      return data as Overview;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (error || !data) return null;

  const name = data.profile?.full_name || "Your learner";
  const w = data.week ?? {};
  const scoreDelta =
    w.avg_score_this_week != null && w.avg_score_last_week != null
      ? Math.round((w.avg_score_this_week - w.avg_score_last_week) * 10) / 10
      : null;
  const sub = data.subscription;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          {data.profile?.avatar_url ? (
            <img
              src={data.profile.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </div>
          {sub && (
            <Badge
              variant={sub.status === "active" || sub.status === "trialing" ? "default" : "destructive"}
              className="gap-1"
            >
              <CreditCard className="h-3 w-3" />
              {sub.plan ?? "plan"} · {sub.status ?? "unknown"}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-lg font-bold">{w.sessions_this_week ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">sessions this week</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-lg font-bold">
              {w.avg_score_this_week != null ? `${w.avg_score_this_week}%` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">avg score</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className={`text-lg font-bold flex items-center justify-center gap-1 ${
              scoreDelta == null ? "" : scoreDelta >= 0 ? "text-emerald-600" : "text-red-500"
            }`}>
              {scoreDelta == null ? "—" : (
                <>
                  {scoreDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                </>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">vs last week</p>
          </div>
        </div>

        {(data.recent ?? []).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
            {data.recent.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-center justify-between text-xs rounded-md bg-muted/30 px-2.5 py-1.5">
                <span className="truncate">
                  {SOURCE_LABELS[e.source] ?? e.source}
                  {e.topic_name ? ` · ${e.topic_name}` : ""}
                </span>
                <span className="shrink-0 flex items-center gap-2 text-muted-foreground">
                  {e.score_pct != null && (
                    <span className="font-semibold text-foreground">{Math.round(e.score_pct)}%</span>
                  )}
                  {new Date(e.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
