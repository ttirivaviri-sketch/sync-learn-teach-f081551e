/**
 * DEV-ONLY helper: runs the student → teacher submission flow end-to-end
 * for an assignment the signed-in user is enrolled in. Surfaces permission
 * checks (storage upload, RLS on submissions) and final grading visibility.
 *
 * Route: /dev/submission-test
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Step = { name: string; status: "pending" | "running" | "ok" | "fail" | "skip"; detail?: string };

export default function DevSubmissionTest() {
  const [assignmentId, setAssignmentId] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  function push(s: Step) {
    setSteps((prev) => [...prev, s]);
  }
  function update(idx: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
    const idx = steps.length + 0; // approximate; we use functional push
    let myIdx = -1;
    setSteps((prev) => {
      myIdx = prev.length;
      return [...prev, { name, status: "running" }];
    });
    await new Promise((r) => setTimeout(r, 0));
    try {
      const out = await fn();
      setSteps((prev) => prev.map((s, i) => (i === myIdx ? { ...s, status: "ok", detail: typeof out === "string" ? out : undefined } : s)));
      return out;
    } catch (e: any) {
      setSteps((prev) => prev.map((s, i) => (i === myIdx ? { ...s, status: "fail", detail: e?.message ?? String(e) } : s)));
      throw e;
    }
  }

  async function run() {
    setSteps([]);
    setRunning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await step("Signed in", async () => {
        if (!user) throw new Error("Not authenticated — sign in as a student first");
        return user.email ?? user.id;
      });

      const assignment: any = await step("Load assignment", async () => {
        const { data, error } = await (supabase as any).from("assignments").select("*").eq("id", assignmentId).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Assignment not found or not visible (RLS)");
        return data;
      });

      await step("Enrollment in class", async () => {
        const { data, error } = await (supabase as any).from("enrollments")
          .select("id").eq("class_id", assignment.class_id).eq("student_id", user!.id).eq("status", "active").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Not enrolled in assignment class — storage upload should be blocked by RLS");
        return "active";
      });

      // 1) Text-only draft
      await step("Save text DRAFT", async () => {
        const { error } = await (supabase as any).from("submissions").upsert({
          school_id: assignment.school_id,
          assignment_id: assignment.id,
          student_id: user!.id,
          text_response: "DEV TEST draft @ " + new Date().toISOString(),
          status: "draft",
        }, { onConflict: "assignment_id,student_id" });
        if (error) throw error;
        return "draft saved";
      });

      // 2) File upload to correct path
      const uploadedPath: any = await step("Upload file to student folder", async () => {
        const path = `${assignment.school_id}/submissions/${assignment.id}/${user!.id}/${Date.now()}-devtest.txt`;
        const blob = new Blob([`hello from dev test ${new Date().toISOString()}`], { type: "text/plain" });
        const { error } = await supabase.storage.from("school-content").upload(path, blob, { upsert: false });
        if (error) throw error;
        return path;
      });

      // 3) Attempt forbidden upload to another student's folder — must fail
      await step("Forbidden upload to other-student folder (should FAIL)", async () => {
        const other = "00000000-0000-0000-0000-000000000000";
        const path = `${assignment.school_id}/submissions/${assignment.id}/${other}/hack.txt`;
        const blob = new Blob(["nope"], { type: "text/plain" });
        const { error } = await supabase.storage.from("school-content").upload(path, blob, { upsert: false });
        if (!error) throw new Error("Upload SUCCEEDED — storage RLS is not protecting other students' folders");
        return "blocked: " + error.message;
      });

      // 4) Final submission with attachment_paths
      await step("Submit FINAL with attachment", async () => {
        const { error } = await (supabase as any).from("submissions").upsert({
          school_id: assignment.school_id,
          assignment_id: assignment.id,
          student_id: user!.id,
          text_response: "DEV TEST final @ " + new Date().toISOString(),
          attachment_paths: [uploadedPath],
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }, { onConflict: "assignment_id,student_id" });
        if (error) throw error;
        return "submitted";
      });

      // 5) Read back own submission
      await step("Read back own submission", async () => {
        const { data, error } = await (supabase as any).from("submissions")
          .select("*").eq("assignment_id", assignment.id).eq("student_id", user!.id).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Submission not readable by owner");
        return `status=${data.status}, files=${data.attachment_paths?.length ?? 0}`;
      });

      // 6) Signed URL for own attachment
      await step("Signed URL for own attachment", async () => {
        const { data, error } = await supabase.storage.from("school-content").createSignedUrl(uploadedPath, 60);
        if (error || !data) throw error ?? new Error("No URL");
        return data.signedUrl.slice(0, 80) + "…";
      });

      // 7) Forbidden read of another student's submission folder
      await step("Forbidden signed URL for fake other-student file (should FAIL)", async () => {
        const path = `${assignment.school_id}/submissions/${assignment.id}/00000000-0000-0000-0000-000000000000/whatever.txt`;
        const { data, error } = await supabase.storage.from("school-content").createSignedUrl(path, 60);
        if (!error && data) throw new Error("Got a signed URL for someone else's submission");
        return "blocked";
      });
    } catch {
      // already recorded in step()
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container max-w-3xl py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Submission flow dev test</h1>
        <p className="text-sm text-muted-foreground">
          Sign in as a student enrolled in a class, paste an assignment id, and run. The test exercises both
          text and file paths and asserts that storage RLS blocks writes/reads to other students' folders.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <Label>Assignment ID</Label>
          <Input value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} placeholder="uuid of an assignment you're enrolled in" />
        </div>
        <Button disabled={!assignmentId || running} onClick={run}>
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Run test
        </Button>
      </Card>

      {steps.length > 0 && (
        <Card className="p-4 space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {s.status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />}
              {s.status === "fail" && <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
              {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin mt-0.5" />}
              {s.status === "skip" && <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />}
              {s.status === "pending" && <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />}
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                {s.detail && <div className="text-xs text-muted-foreground break-all">{s.detail}</div>}
              </div>
              <Badge variant={s.status === "ok" ? "default" : s.status === "fail" ? "destructive" : "outline"}>{s.status}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
