/**
 * CreateClassroomDialog — one-shot wizard that creates a class and seeds
 * its subject/teacher assignment plus a roster of students. Used by both
 * the school admin Academic page and the Teacher Workspace so teachers and
 * admins build a "closed ecosystem" in a single step.
 *
 * When the school has no grades or subjects yet, the dialog lets the user
 * add them inline so they never hit a dead end with empty dropdowns.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGrades, useSchoolSubjects,
  useUpsertGrade, useUpsertSubject,
  useUpsertClass, useUpsertClassSubject, useCreateEnrollment,
  findUserIdByEmail,
} from "@/hooks/useSchoolAcademics";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  schoolId: string;
  /** When provided, the teacher's user id is used as default subject teacher. */
  defaultTeacherId?: string;
  trigger?: React.ReactNode;
  onCreated?: (classId: string) => void;
}

const CURRICULA = ["ZIMSEC", "CAPS", "IEB", "Cambridge", "Other"] as const;
const ADD_NEW = "__add_new__";

export function CreateClassroomDialog({ schoolId, defaultTeacherId, trigger, onCreated }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const grades = useGrades(schoolId);
  const subjects = useSchoolSubjects(schoolId);
  const upsertGrade = useUpsertGrade();
  const upsertSubject = useUpsertSubject();
  const upsertClass = useUpsertClass();
  const upsertClassSubject = useUpsertClassSubject();
  const enroll = useCreateEnrollment();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [curriculum, setCurriculum] = useState<string>("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [students, setStudents] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline-create state
  const [addingGrade, setAddingGrade] = useState(false);
  const [newGradeName, setNewGradeName] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const teacherDefault = defaultTeacherId ?? userId;

  function reset() {
    setName(""); setGradeId(""); setSubjectId(""); setCurriculum("");
    setTeacherEmail(""); setStudents("");
    setAddingGrade(false); setNewGradeName("");
    setAddingSubject(false); setNewSubjectName("");
  }

  async function createGrade() {
    const n = newGradeName.trim();
    if (!n) { toast.error("Give the grade a name"); return; }
    try {
      const g = await upsertGrade.mutateAsync({
        school_id: schoolId,
        name: n,
        sort_order: (grades.data?.length ?? 0) + 1,
      } as any);
      setGradeId(g.id);
      setAddingGrade(false);
      setNewGradeName("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add grade");
    }
  }

  async function createSubject() {
    const n = newSubjectName.trim();
    if (!n) { toast.error("Give the subject a name"); return; }
    try {
      const s = await upsertSubject.mutateAsync({
        school_id: schoolId,
        name: n,
      } as any);
      setSubjectId(s.id);
      setAddingSubject(false);
      setNewSubjectName("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add subject");
    }
  }

  async function submit() {
    if (!name.trim()) { toast.error("Give the classroom a name"); return; }
    if (!subjectId) { toast.error("Pick or add a subject"); return; }
    if (!gradeId) { toast.error("Pick or add a grade"); return; }
    if (!curriculum) { toast.error("Pick a curriculum"); return; }
    setBusy(true);
    try {
      // 1. Resolve teacher
      let teacherId: string | null = teacherDefault;
      if (teacherEmail.trim()) {
        teacherId = await findUserIdByEmail(teacherEmail.trim());
        if (!teacherId) throw new Error(`No user found for ${teacherEmail}`);
      }

      // 2. Create class
      const cls = await upsertClass.mutateAsync({
        school_id: schoolId,
        name: name.trim(),
        grade_id: gradeId || null,
        curriculum,
      } as any);

      // 3. Assign subject + teacher
      await upsertClassSubject.mutateAsync({
        school_id: schoolId,
        class_id: cls.id,
        subject_id: subjectId,
        teacher_id: teacherId,
      });

      // 4. Bulk enroll students by email
      const emails = students
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      let enrolled = 0;
      const skipped: string[] = [];
      for (const email of emails) {
        const id = await findUserIdByEmail(email);
        if (!id) { skipped.push(email); continue; }
        try {
          await enroll.mutateAsync({ school_id: schoolId, class_id: cls.id, student_id: id });
          enrolled += 1;
        } catch {
          skipped.push(email);
        }
      }

      toast.success(
        `Classroom "${cls.name}" created${enrolled ? ` · ${enrolled} student${enrolled === 1 ? "" : "s"} enrolled` : ""}`
      );
      if (skipped.length) {
        toast.warning(`Couldn't enroll: ${skipped.join(", ")}`, {
          description: "These emails don't match a registered learner. Invite them first.",
        });
      }
      onCreated?.(cls.id);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create classroom");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="h-4 w-4 mr-1" />New classroom</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a classroom</DialogTitle>
          <p className="text-sm text-muted-foreground">
            One closed space for a subject, grade, teacher and a roster of students.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Classroom name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 4 — Mathematics" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Grade</Label>
              {addingGrade ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    placeholder="e.g. Form 4"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createGrade(); } }}
                  />
                  <Button size="icon" variant="outline" onClick={createGrade} disabled={upsertGrade.isPending}>
                    {upsertGrade.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setAddingGrade(false); setNewGradeName(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select
                  value={gradeId}
                  onValueChange={(v) => v === ADD_NEW ? setAddingGrade(true) : setGradeId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={grades.data?.length ? "Pick a grade" : "Add your first grade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    <SelectItem value={ADD_NEW}>＋ Add new grade…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Subject</Label>
              {addingSubject ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createSubject(); } }}
                  />
                  <Button size="icon" variant="outline" onClick={createSubject} disabled={upsertSubject.isPending}>
                    {upsertSubject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setAddingSubject(false); setNewSubjectName(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select
                  value={subjectId}
                  onValueChange={(v) => v === ADD_NEW ? setAddingSubject(true) : setSubjectId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={subjects.data?.length ? "Pick a subject" : "Add your first subject"} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    <SelectItem value={ADD_NEW}>＋ Add new subject…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div>
            <Label>Curriculum</Label>
            <Select value={curriculum} onValueChange={setCurriculum}>
              <SelectTrigger><SelectValue placeholder="Pick a curriculum" /></SelectTrigger>
              <SelectContent>
                {CURRICULA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Teacher email <span className="text-muted-foreground font-normal">(blank = you)</span></Label>
            <Input
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@school.com"
              type="email"
            />
          </div>

          <div>
            <Label>Students</Label>
            <Textarea
              rows={4}
              value={students}
              onChange={(e) => setStudents(e.target.value)}
              placeholder="Paste student emails, separated by commas or new lines."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Students must already have an account at your school. Invite new learners from <em>School &rsaquo; Members</em>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create classroom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
