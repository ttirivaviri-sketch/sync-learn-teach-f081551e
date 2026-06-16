import { useParams, useOutletContext, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  useSchoolAnalytics,
  useSchoolSearch,
  useIngestSchoolDocument,
  useSchoolAIDocuments,
  useRetrySchoolIngest,
  type AnalyticsFilters,
} from "@/hooks/useSchoolAI";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Brain, Upload, Search, Users, BookOpen, FileText, Database,
  Download, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock, CreditCard,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isContractGateError, type ContractGateError } from "@/lib/contractError";
import { BILLING_CONTACT_EMAIL } from "@/lib/schoolContract";

type Ctx = { school: { id: string; name: string }; role: string };

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function SchoolAnalytics() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const ctx = useOutletContext<Ctx | undefined>();
  const role = ctx?.role;
  const allowed = role === "school_admin" || role === "school_teacher";

  const [from, setFrom] = useState<string>(todayStr(-14));
  const [to, setTo] = useState<string>(todayStr(0));
  const [classId, setClassId] = useState<string>("all");
  const [gradeId, setGradeId] = useState<string>("all");

  const filters: AnalyticsFilters = useMemo(() => ({
    from,
    to,
    classId: classId === "all" ? undefined : classId,
    gradeId: gradeId === "all" ? undefined : gradeId,
  }), [from, to, classId, gradeId]);

  const { data, isLoading, error, refetch } = useSchoolAnalytics(allowed ? schoolId : undefined, filters);
  const search = useSchoolSearch();
  const ingest = useIngestSchoolDocument();
  const docs = useSchoolAIDocuments(allowed ? schoolId : undefined);
  const retry = useRetrySchoolIngest();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ content: string; similarity: number }>>([]);
  const [docText, setDocText] = useState("");
  const [docTitle, setDocTitle] = useState("");

  if (!schoolId) return null;

  if (!allowed) {
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-1 text-lg font-semibold">Restricted area</h2>
        <p className="text-sm text-muted-foreground">
          School analytics and AI usage are only available to teachers and school admins.
          {role ? <> Your current role is <strong>{role.replace("school_", "")}</strong>.</> : null}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to={`/school/${schoolId}`}>Back to dashboard</Link>
        </Button>
      </Card>
    );
  }

  if (error) {
    if (isContractGateError(error)) {
      return <ContractGateNotice err={error} schoolId={schoolId} onRetry={() => refetch()} />;
    }
    const msg = (error as Error).message || "Failed to load analytics";
    const forbidden = /403|forbidden/i.test(msg);
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 text-center">
        {forbidden ? <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" /> : <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />}
        <h2 className="mb-1 text-lg font-semibold">{forbidden ? "Access denied" : "Couldn't load analytics"}</h2>
        <p className="text-sm text-muted-foreground">{msg}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button>
      </Card>
    );
  }

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const r = await search.mutateAsync({ schoolId, query, classId: filters.classId });
      setResults(r);
    } catch (e) {
      if (isContractGateError(e)) {
        toast({ title: "Search unavailable — contract paused", description: e.reason, variant: "destructive" });
        return;
      }
      toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleIngest = async () => {
    if (!docText.trim()) return;
    try {
      const r = await ingest.mutateAsync({
        schoolId,
        title: docTitle || undefined,
        content: docText,
        classId: filters.classId,
      });
      toast({ title: "Indexed", description: `${r.chunks} chunks, ${r.tokens} tokens` });
      setDocText("");
      setDocTitle("");
      refetch();
    } catch (e) {
      if (isContractGateError(e)) {
        toast({ title: "Ingest unavailable — contract paused", description: e.reason, variant: "destructive" });
        return;
      }
      toast({ title: "Ingest failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleRetry = async (id: string, title: string | null) => {
    try {
      await retry.mutateAsync({ schoolId, documentId: id });
      setDocTitle(title ?? "");
      toast({
        title: "Reset to queued",
        description: "Paste the document content above and run 'Ingest' again to retry.",
      });
    } catch (e) {
      toast({ title: "Retry failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push(`School Analytics Export`);
    rows.push(`School,${csvEscape(data.school?.name ?? "")}`);
    rows.push(`Date range,${data.filters.from} to ${data.filters.to}`);
    rows.push(`Class filter,${csvEscape(filters.classId ? data.classes.find(c => c.id === filters.classId)?.name ?? filters.classId : "All")}`);
    rows.push(`Grade filter,${csvEscape(filters.gradeId ? data.grades.find(g => g.id === filters.gradeId)?.name ?? filters.gradeId : "All")}`);
    rows.push("");
    rows.push("Daily activity");
    rows.push("Day,Active users,Assignments created,Submissions,Graded submissions,Quiz attempts,AI requests,Storage MB");
    for (const d of data.daily) {
      rows.push([d.day, d.active_users, d.assignments_created, d.submissions, d.graded_submissions, d.quiz_attempts, d.ai_requests, d.storage_mb].join(","));
    }
    rows.push("");
    rows.push("AI usage by bucket");
    rows.push("Date,Bucket,Requests,Tokens in,Tokens out");
    for (const u of data.ai_usage) {
      rows.push([u.usage_date, csvEscape(u.bucket), u.requests, u.tokens_in, u.tokens_out].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `school-analytics-${data.school?.name?.replace(/\s+/g, "_") ?? "export"}-${data.filters.from}_${data.filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const filteredClasses = gradeId === "all"
    ? (data?.classes ?? [])
    : (data?.classes ?? []).filter(c => c.grade_id === gradeId);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">School Analytics & AI</h1>
          <p className="text-sm text-muted-foreground">
            {data?.filters.from} → {data?.filters.to} · {data?.school?.name}
            {data?.filters.applied ? " · filtered" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!data}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="grid gap-3 p-3 md:grid-cols-5">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} min={from} max={todayStr(0)} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Grade</label>
          <Select value={gradeId} onValueChange={(v) => { setGradeId(v); setClassId("all"); }}>
            <SelectTrigger><SelectValue placeholder="All grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {(data?.grades ?? []).map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Class</label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {filteredClasses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setFrom(todayStr(-14)); setTo(todayStr(0)); setClassId("all"); setGradeId("all"); }}>
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Teachers" value={`${data?.counts.teachers ?? 0}${data?.school?.seats_teachers ? ` / ${data.school.seats_teachers}` : ""}`} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Students" value={`${data?.counts.students ?? 0}${data?.school?.seats_students ? ` / ${data.school.seats_students}` : ""}`} />
        <KpiCard icon={<BookOpen className="h-4 w-4" />} label="Classes" value={`${data?.counts.classes ?? 0}`} />
        <KpiCard icon={<Database className="h-4 w-4" />} label="Storage" value={`${today?.storage_mb ?? 0} MB${data?.school?.storage_quota_mb ? ` / ${data.school.storage_quota_mb}` : ""}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Active users" value={totals.active.toString()} />
        <KpiCard label="Assignments" value={totals.assignments.toString()} />
        <KpiCard label="Submissions" value={totals.submissions.toString()} />
        <KpiCard label="Quiz attempts" value={totals.quizzes.toString()} />
        <KpiCard label="AI requests" value={`${totals.ai}${data?.quota?.limit ? ` / ${data.quota.limit}/day` : ""}`} />
      </div>

      {/* Daily activity */}
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
                <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">No activity in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI usage */}
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
            <p className="text-xs text-muted-foreground">No AI calls in range.</p>
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

      {/* Ingest job status */}
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4" /> Ingest jobs
        </h2>
        <div className="space-y-2">
          {(docs.data ?? []).map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="truncate font-medium">{d.title || "Untitled document"}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {d.page_count ?? 0} chunks · {d.total_tokens ?? 0} tokens · {new Date(d.created_at).toLocaleString()}
                </div>
                {d.error && <div className="mt-1 text-xs text-destructive">{d.error}</div>}
              </div>
              {d.status === "failed" && (
                <Button size="sm" variant="outline" onClick={() => handleRetry(d.id, d.title)} disabled={retry.isPending}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
          ))}
          {(!docs.data || docs.data.length === 0) && (
            <p className="text-xs text-muted-foreground">No ingest jobs yet.</p>
          )}
        </div>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    queued: { label: "Queued", cls: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
    parsed: { label: "Processing", cls: "bg-blue-500/15 text-blue-600", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    embedded: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-600", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive", icon: <XCircle className="h-3 w-3" /> },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
