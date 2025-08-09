import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const LEVELS = [
  { key: "junior_primary", label: "Junior Primary", detail: "Grades 1–4" },
  { key: "senior_primary", label: "Senior Primary", detail: "Grades 5–7" },
  { key: "junior_high", label: "Junior High", detail: "Grades 8–9" },
  { key: "senior_high", label: "Senior High", detail: "Grades 10–12" },
  { key: "tertiary", label: "College & University", detail: "Diplomas & Degrees" },
] as const;

type LevelKey = typeof LEVELS[number]["key"];

const ChooseStudyLevel = () => {
  const [selected, setSelected] = useState<LevelKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // SEO metadata
  useEffect(() => {
    document.title = "Choose Study Level | StudySync Learner"; // < 60 chars
    const desc = "Select your study level to personalize tutor search."; // < 160 chars
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.href);
  }, []);

  // Auth/session check
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id || null;
      setUserId(uid);
      if (!uid) {
        navigate("/learner/auth");
        return;
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const saveLevel = async () => {
    if (!selected || !userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ study_level: selected })
      .eq("id", userId);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: "Saved", description: "Your study level has been updated." });
    navigate("/learner");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold">Choose Study Level</h1>
          <p className="text-sm opacity-90">Set this once to tailor your search experience</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <section aria-labelledby="levels-heading" className="space-y-4">
          <h2 id="levels-heading" className="sr-only">Study level options</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {LEVELS.map((lvl) => (
              <Card
                key={lvl.key}
                role="button"
                tabIndex={0}
                aria-pressed={selected === lvl.key}
                onClick={() => setSelected(lvl.key)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(lvl.key)}
                className={selected === lvl.key ? "ring-2 ring-primary" : "cursor-pointer"}
              >
                <CardHeader>
                  <CardTitle className="text-base">{lvl.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{lvl.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/learner")}>Back</Button>
            <Button onClick={saveLevel} disabled={!selected || saving}>
              {saving ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ChooseStudyLevel;
