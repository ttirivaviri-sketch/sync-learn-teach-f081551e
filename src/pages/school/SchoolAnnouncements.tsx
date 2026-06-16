/**
 * School-wide announcements feed.
 * - Admins & teachers can post (audience: school, grade, or class).
 * - Members see everything they're allowed to (RLS-scoped).
 * - Filter by class or grade in the toolbar.
 */
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pin, Loader2 } from "lucide-react";
import {
  useAnnouncements, useCreateAnnouncement,
  useClasses, useGrades,
} from "@/hooks/useSchoolAcademics";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Audience = "school" | "grade" | "class";

export default function SchoolAnnouncements() {
  const { school, role } = useOutletContext<{ school: any; role: string }>();
  const list = useAnnouncements({ schoolId: school.id });
  const create = useCreateAnnouncement();
  const classes = useClasses(school.id);
  const grades = useGrades(school.id);
  const canPost = role === "school_admin" || role === "school_teacher";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("school");
  const [classId, setClassId] = useState<string>("");
  const [gradeId, setGradeId] = useState<string>("");

  // Filter controls
  const [filterKind, setFilterKind] = useState<"all" | "school" | "grade" | "class">("all");
  const [filterId, setFilterId] = useState<string>("");

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    if (filterKind === "all") return rows;
    if (filterKind === "school") return rows.filter((a) => a.audience === "school");
    if (filterKind === "grade") return rows.filter((a) => a.audience === "grade" && (!filterId || a.grade_id === filterId));
    if (filterKind === "class") return rows.filter((a) => a.audience === "class" && (!filterId || a.class_id === filterId));
    return rows;
  }, [list.data, filterKind, filterId]);

  async function post() {
    if (!title.trim() || !body.trim()) return;
    if (audience === "class" && !classId) return toast.error("Pick a class");
    if (audience === "grade" && !gradeId) return toast.error("Pick a grade");
    await create.mutateAsync({
      school_id: school.id,
      title: title.trim(),
      body: body.trim(),
      audience,
      class_id: audience === "class" ? classId : null,
      grade_id: audience === "grade" ? gradeId : null,
    } as any);
    setTitle(""); setBody("");
    toast.success("Posted — learners will be notified");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Announcements</h1>

      {canPost && (
        <Card className="p-4 space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important update" />
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />

          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <Label>Send to</Label>
              <Select value={audience} onValueChange={(v: Audience) => setAudience(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">Whole school</SelectItem>
                  <SelectItem value="grade">A grade</SelectItem>
                  <SelectItem value="class">A class</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audience === "grade" && (
              <div className="sm:col-span-2">
                <Label>Grade</Label>
                <Select value={gradeId} onValueChange={setGradeId}>
                  <SelectTrigger><SelectValue placeholder="Choose grade" /></SelectTrigger>
                  <SelectContent>
                    {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {audience === "class" && (
              <div className="sm:col-span-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                  <SelectContent>
                    {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button disabled={!title.trim() || !body.trim() || create.isPending} onClick={post}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Post
            </Button>
          </div>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px]">
          <Label>Filter</Label>
          <Select value={filterKind} onValueChange={(v: any) => { setFilterKind(v); setFilterId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="school">Whole school</SelectItem>
              <SelectItem value="grade">By grade</SelectItem>
              <SelectItem value="class">By class</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filterKind === "grade" && (
          <div className="min-w-[200px]">
            <Label>Grade</Label>
            <Select value={filterId} onValueChange={setFilterId}>
              <SelectTrigger><SelectValue placeholder="All grades" /></SelectTrigger>
              <SelectContent>
                {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {filterKind === "class" && (
          <div className="min-w-[200px]">
            <Label>Class</Label>
            <Select value={filterId} onValueChange={setFilterId}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                {classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</p>}
        {filtered.length === 0 && !list.isLoading && <p className="text-sm text-muted-foreground">No announcements match.</p>}
        {filtered.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}{a.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })} · {a.audience}
                  {a.audience === "class" && a.class_id && (() => {
                    const c = classes.data?.find((x) => x.id === a.class_id);
                    return c ? ` · ${c.name}` : "";
                  })()}
                  {a.audience === "grade" && a.grade_id && (() => {
                    const g = grades.data?.find((x) => x.id === a.grade_id);
                    return g ? ` · ${g.name}` : "";
                  })()}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{a.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
