/**
 * School Admin: manage Grades, Subjects, Classes (+ subject teachers), Enrollments.
 * One page with internal sub-tabs to keep the IA flat.
 */
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useGrades, useUpsertGrade, useDeleteGrade,
  useSchoolSubjects, useUpsertSubject, useDeleteSubject,
  useClasses, useUpsertClass, useDeleteClass,
  useClassSubjects, useUpsertClassSubject, useDeleteClassSubject,
  useEnrollments, useCreateEnrollment, useRemoveEnrollment,
  findUserIdByEmail,
} from "@/hooks/useSchoolAcademics";
import { CreateClassroomDialog } from "@/components/school/CreateClassroomDialog";

export default function SchoolAcademic() {
  const { school } = useOutletContext<{ school: any }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Academic structure</h1>
        <p className="text-sm text-muted-foreground">Grades, subjects, classes and student rosters.</p>
      </div>
      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
        </TabsList>
        <TabsContent value="grades"><GradesPanel schoolId={school.id} /></TabsContent>
        <TabsContent value="subjects"><SubjectsPanel schoolId={school.id} /></TabsContent>
        <TabsContent value="classes"><ClassesPanel schoolId={school.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function GradesPanel({ schoolId }: { schoolId: string }) {
  const grades = useGrades(schoolId);
  const upsert = useUpsertGrade();
  const del = useDeleteGrade();
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");
  return (
    <Card className="p-4 space-y-3 mt-3">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <Label>Grade name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Form 4" />
        </div>
        <div className="w-24">
          <Label>Order</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await upsert.mutateAsync({ school_id: schoolId, name: name.trim(), sort_order: Number(order) || 0 });
            setName(""); setOrder("0"); toast.success("Grade added");
          }}
          disabled={upsert.isPending}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="divide-y border rounded-md">
        {grades.isLoading && <div className="p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>}
        {grades.data?.length === 0 && <div className="p-4 text-sm text-muted-foreground">No grades yet.</div>}
        {grades.data?.map((g) => (
          <div key={g.id} className="p-3 flex items-center justify-between">
            <div><span className="font-medium">{g.name}</span> <span className="text-xs text-muted-foreground">#{g.sort_order}</span></div>
            <Button variant="ghost" size="sm" onClick={() => del.mutate(g)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SubjectsPanel({ schoolId }: { schoolId: string }) {
  const subjects = useSchoolSubjects(schoolId);
  const upsert = useUpsertSubject();
  const del = useDeleteSubject();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <Card className="p-4 space-y-3 mt-3">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <Label>Subject name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" />
        </div>
        <div className="w-32">
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MATH" />
        </div>
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await upsert.mutateAsync({ school_id: schoolId, name: name.trim(), code: code.trim() || null });
            setName(""); setCode(""); toast.success("Subject added");
          }}
          disabled={upsert.isPending}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="divide-y border rounded-md">
        {subjects.data?.length === 0 && <div className="p-4 text-sm text-muted-foreground">No subjects yet.</div>}
        {subjects.data?.map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between">
            <div><span className="font-medium">{s.name}</span> {s.code && <span className="text-xs text-muted-foreground">· {s.code}</span>}</div>
            <Button variant="ghost" size="sm" onClick={() => del.mutate(s)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ClassesPanel({ schoolId }: { schoolId: string }) {
  const classes = useClasses(schoolId);
  const grades = useGrades(schoolId);
  const upsert = useUpsertClass();
  const del = useDeleteClass();
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-3 mt-3">
      <div className="flex justify-end">
        <CreateClassroomDialog schoolId={schoolId} onCreated={(id) => setSelected(id)} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Label>Class name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 4A" />
          </div>
          <div className="w-40">
            <Label>Grade</Label>
            <Select value={gradeId} onValueChange={setGradeId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={async () => {
            if (!name.trim()) return;
            await upsert.mutateAsync({ school_id: schoolId, name: name.trim(), grade_id: gradeId || null });
            setName(""); toast.success("Class created");
          }} disabled={upsert.isPending}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        <div className="divide-y border rounded-md max-h-[420px] overflow-auto">
          {classes.data?.length === 0 && <div className="p-4 text-sm text-muted-foreground">No classes yet.</div>}
          {classes.data?.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full text-left p-3 flex items-center justify-between hover:bg-muted/50 ${selected === c.id ? "bg-muted" : ""}`}>
              <span className="font-medium">{c.name}</span>
              <Trash2 className="h-4 w-4 text-muted-foreground" onClick={(e) => { e.stopPropagation(); del.mutate(c); }} />
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a class to manage subjects and enrollments.</p>
        ) : (
          <ClassEditor schoolId={schoolId} classId={selected} />
        )}
      </Card>
      </div>
    </div>
  );
}

function ClassEditor({ schoolId, classId }: { schoolId: string; classId: string }) {
  const subjects = useSchoolSubjects(schoolId);
  const cs = useClassSubjects(classId);
  const addCs = useUpsertClassSubject();
  const delCs = useDeleteClassSubject();
  const enrollments = useEnrollments(classId);
  const enroll = useCreateEnrollment();
  const unenroll = useRemoveEnrollment();
  const [subjectId, setSubjectId] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Subjects & teachers</h3>
        <div className="flex gap-2 flex-wrap">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="flex-1 min-w-[140px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              {subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} placeholder="Teacher email (optional)" className="flex-1 min-w-[180px]" />
          <Button
            disabled={!subjectId}
            onClick={async () => {
              let teacherId: string | null = null;
              if (teacherEmail.trim()) {
                teacherId = await findUserIdByEmail(teacherEmail);
                if (!teacherId) { toast.error("No user with that email"); return; }
              }
              await addCs.mutateAsync({ school_id: schoolId, class_id: classId, subject_id: subjectId, teacher_id: teacherId });
              setSubjectId(""); setTeacherEmail(""); toast.success("Assigned");
            }}
          ><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="divide-y border rounded-md">
          {cs.data?.length === 0 && <div className="p-3 text-sm text-muted-foreground">No subjects assigned.</div>}
          {cs.data?.map((row) => {
            const s = subjects.data?.find((x) => x.id === row.subject_id);
            return (
              <div key={row.id} className="p-3 flex items-center justify-between text-sm">
                <span>{s?.name ?? "—"} {row.teacher_id && <span className="text-xs text-muted-foreground">· teacher set</span>}</span>
                <Button variant="ghost" size="sm" onClick={() => delCs.mutate(row)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Enrolled students ({enrollments.data?.length ?? 0})</h3>
        <div className="flex gap-2">
          <Input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="Student email" />
          <Button
            disabled={enroll.isPending}
            onClick={async () => {
              const id = await findUserIdByEmail(studentEmail);
              if (!id) { toast.error("No user with that email"); return; }
              await enroll.mutateAsync({ school_id: schoolId, class_id: classId, student_id: id });
              setStudentEmail(""); toast.success("Enrolled");
            }}
          ><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="divide-y border rounded-md max-h-[260px] overflow-auto">
          {enrollments.data?.length === 0 && <div className="p-3 text-sm text-muted-foreground">No students enrolled.</div>}
          {enrollments.data?.map((e) => (
            <div key={e.id} className="p-3 flex items-center justify-between text-sm">
              <span>{e.profile?.full_name ?? e.profile?.email ?? e.student_id.slice(0,8)}</span>
              <Button variant="ghost" size="sm" onClick={() => unenroll.mutate(e)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
