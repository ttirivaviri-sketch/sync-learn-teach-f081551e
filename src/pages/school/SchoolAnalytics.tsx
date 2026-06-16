import { useParams } from "react-router-dom";
import { useState } from "react";
import { useSchoolAnalytics, useSchoolSearch, useIngestSchoolDocument } from "@/hooks/useSchoolAI";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Upload, Search, Users, BookOpen, FileText, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function SchoolAnalytics() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { data, isLoading, refetch } = useSchoolAnalytics(schoolId, 14);
  const search = useSchoolSearch();
  const ingest = useIngestSchoolDocument();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ content: string; similarity: number }>>([]);
  const [docText, setDocText] = useState("");
  const [docTitle, setDocTitle] = useState("");

  if (!schoolId) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const r = await search.mutateAsync({ schoolId, query });
      setResults(r);
    } catch (e) {
      toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleIngest = async () => {
    if (!docText.trim()) return;
    try {
      const r = await ingest.mutateAsync({ schoolId, title: docTitle || undefined, content: docText });
      toast({ title: "Indexed", description: `${r.chunks} chunks, ${r.tokens} tokens` });
      setDocText("");
      setDocTitle("");
      refetch();
    } catch (e) {
      toast({ title: "Ingest failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const today = data?.daily?.[data.daily.length - 1];
  const totals = (data?.daily ?? []).reduce(
    (acc, d) => ({
      active: acc.active + d.active_users,
      submissions: acc.submissions + d.submissions,
      assignments: acc.assignments + d.assignments_created,
      quizzes: acc.quizzes + d.quiz_attempts,
      ai: acc.ai + d.ai_requests,
    }),
    { active: 0, submissions: 0, assignments: 0, quizzes: 0, ai: 0 },
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">School Analytics & AI</h1>
        <p className="text-sm text-muted-foreground">Last 14 days · {data?.school?.name}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Teachers" value={`${data?.counts.teachers ?? 0}${data?.school?.seats_teachers ? ` / ${data.school.seats_teachers}` : ""}`} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Students" value={`${data?.counts.students ?? 0}${data?.school?.seats_students ? ` / ${data.school.seats_students}` : ""}`} />
        <KpiCard icon={<BookOpen className="h-4 w-4" />} label="Classes" value={`${data?.counts.classes ?? 0}`} />
        <KpiCard icon={<Database className="h-4 w-4" />} label="Storage" value={`${today?.storage_mb ?? 0} MB${data?.school?.storage_quota_mb ? ` / ${data.school.storage_quota_mb}` : ""}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Active users (14d)" value={totals.active.toString()} />
        <KpiCard label="Assignments" value={totals.assignments.toString()} />
        <KpiCard label="Submissions" value={totals.submissions.toString()} />
        <KpiCard label="Quiz attempts" value={totals.quizzes.toString()} />
        <KpiCard
          label="AI requests"
          value={`${totals.ai}${data?.quota?.limit ? ` / ${data.quota.limit}/day` : ""}`}
        />
      </div>

      {/* Daily activity sparkline (simple table) */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Daily activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3">Day</th>
                <th className="py-1 pr-3">Active</th>
                <th className="py-1 pr-3">Assign.</th>
                <th className="py-1 pr-3">Subm.</th>
                <th className="py-1 pr-3">Graded</th>
                <th className="py-1 pr-3">Quiz</th>
                <th className="py-1 pr-3">AI</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily ?? []).map((d) => (
                <tr key={d.day} className="border-t border-border/50">
                  <td className="py-1 pr-3">{d.day.slice(5)}</td>
                  <td className="py-1 pr-3">{d.active_users}</td>
                  <td className="py-1 pr-3">{d.assignments_created}</td>
                  <td className="py-1 pr-3">{d.submissions}</td>
                  <td className="py-1 pr-3">{d.graded_submissions}</td>
                  <td className="py-1 pr-3">{d.quiz_attempts}</td>
                  <td className="py-1 pr-3">{d.ai_requests}</td>
                </tr>
              ))}
              {(!data?.daily || data.daily.length === 0) && (
                <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">No activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI usage by bucket */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Brain className="h-4 w-4" /> AI usage
        </h2>
        <div className="flex flex-wrap gap-2">
          {(data?.ai_usage ?? []).slice(-30).map((u, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {u.usage_date.slice(5)} · {u.bucket}: {u.requests}
            </Badge>
          ))}
          {(!data?.ai_usage || data.ai_usage.length === 0) && (
            <p className="text-xs text-muted-foreground">No AI calls yet.</p>
          )}
        </div>
      </Card>

      {/* Knowledge ingest */}
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4" /> Add document to school AI knowledge
        </h2>
        <Input
          placeholder="Title (e.g. Form 4 Chemistry — Stoichiometry notes)"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
        />
        <Textarea
          placeholder="Paste text content to index (PDF text, notes, syllabus excerpts)…"
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          rows={6}
        />
        <Button onClick={handleIngest} disabled={ingest.isPending || !docText.trim()}>
          {ingest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Ingest into school RAG
        </Button>
      </Card>

      {/* RAG search */}
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4" /> Test school knowledge search
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Ask anything covered by your school's documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={search.isPending || !query.trim()}>
            {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-md border border-border/60 p-2 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">similarity: {r.similarity.toFixed(3)}</div>
              <div className="line-clamp-4 whitespace-pre-wrap">{r.content}</div>
            </div>
          ))}
          {results.length === 0 && <p className="text-xs text-muted-foreground">No results yet — run a search.</p>}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </Card>
  );
}
