/**
 * TutorOnboardingWizard — guided one-time setup for new tutors.
 *
 * Steps:
 *  1. Identity: ID number + ID document
 *  2. Profile photo
 *  3. Student status: current_student | graduate
 *  4. Transcript (student) OR Qualification doc (graduate)
 *  5. Teaching profile: curriculums + grades
 *  6. Subjects + hourly rate per subject
 *  7. Bio + teaching style
 *
 * On submit:
 *  - Creates/updates tutor_verifications (status='pending')
 *  - Creates tutor_teaching_profile (onboarding_completed_at = now())
 *  - Creates tutor_subjects rows with rate
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Upload, GraduationCap, Briefcase, IdCard, Camera, BookOpen, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { security } from "@/utils/security";
import { CURRICULUM_SUBJECTS, GRADE_LEVELS_BY_CURRICULUM, type Curriculum } from "@/types/academicProfile";

const CURRICULUMS: { code: Curriculum; label: string }[] = [
  { code: "ZIMSEC", label: "ZIMSEC" },
  { code: "CAMB", label: "Cambridge (IGCSE / O / A-Level)" },
  { code: "IEB", label: "IEB (South Africa)" },
  { code: "NSC", label: "NSC (South Africa)" },
];

const STEPS = ["Identity", "Photo", "Status", "Document", "Curriculums", "Grades", "Subjects", "Bio"] as const;

export default function TutorOnboardingWizard() {
  const { session } = useAuth({ redirectTo: "/tutor/auth" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [idNumber, setIdNumber] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [studentStatus, setStudentStatus] = useState<"current_student" | "graduate" | "">("");
  const [transcript, setTranscript] = useState<File | null>(null);
  const [qualification, setQualification] = useState<File | null>(null);
  const [qualType, setQualType] = useState("");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");

  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rate, setRate] = useState("250");
  const [bio, setBio] = useState("");
  const [style, setStyle] = useState("");

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    curriculums.forEach((c) => GRADE_LEVELS_BY_CURRICULUM[c]?.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [curriculums]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    curriculums.forEach((c) => CURRICULUM_SUBJECTS[c]?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [curriculums]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // ── validation per step ───────────────────────────
  const canNext = () => {
    switch (step) {
      case 0: return !!idNumber.trim() && !!idDoc;
      case 1: return !!photo;
      case 2: return !!studentStatus;
      case 3: return studentStatus === "current_student" ? !!transcript : (!!qualification && !!qualType.trim() && !!institution.trim());
      case 4: return curriculums.length > 0;
      case 5: return grades.length > 0;
      case 6: return subjects.length > 0 && Number(rate) > 0;
      case 7: return bio.trim().length >= 30;
      default: return true;
    }
  };

  const validateFile = (f: File, allowed: string[], mb: number): boolean => {
    const v = security.validateFileUpload(f, allowed, mb);
    if (!v.valid) {
      toast({ title: "Invalid file", description: v.error, variant: "destructive" });
      return false;
    }
    return true;
  };

  const upload = async (file: File, bucket: string, folder: string): Promise<string | null> => {
    if (!session?.user) return null;
    const ext = file.name.split(".").pop();
    const path = `${folder}/${session.user.id}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return data.path;
  };

  const handleSubmit = async () => {
    if (!session?.user) return;
    setSubmitting(true);
    try {
      const idDocUrl = idDoc ? await upload(idDoc, "tutor-documents", "id-documents") : null;
      const photoUrl = photo ? await upload(photo, "profile-photos", "photos") : null;
      const transcriptUrl = transcript ? await upload(transcript, "tutor-documents", "transcripts") : null;
      const qualUrl = qualification ? await upload(qualification, "tutor-documents", "qualifications") : null;

      const { error: vErr } = await supabase.from("tutor_verifications").upsert({
        user_id: session.user.id,
        id_number: idNumber,
        id_document_url: idDocUrl,
        profile_photo_url: photoUrl,
        student_status: studentStatus,
        transcript_url: transcriptUrl,
        qualification_url: qualUrl,
        verification_status: "pending",
        submitted_at: new Date().toISOString(),
      } as any);
      if (vErr) throw vErr;

      if (studentStatus === "graduate" && qualUrl) {
        await supabase.from("qualifications").insert({
          user_id: session.user.id,
          qualification_type: qualType,
          institution,
          document_url: qualUrl,
          year_obtained: Number(year) || null,
        });
      }

      const { error: pErr } = await supabase.from("tutor_teaching_profile").upsert({
        user_id: session.user.id,
        curriculums,
        grades,
        bio,
        teaching_style: style || null,
        onboarding_completed_at: new Date().toISOString(),
      } as any);
      if (pErr) throw pErr;

      // Insert tutor_subjects (level required, default to first grade)
      const rateNum = Number(rate);
      const levelLabel = grades[0] ?? "All";
      // Avoid duplicates: fetch existing subjects first
      const { data: existing } = await supabase
        .from("tutor_subjects")
        .select("subject")
        .eq("user_id", session.user.id);
      const have = new Set((existing ?? []).map((r: any) => r.subject));
      const rows = subjects
        .filter((s) => !have.has(s))
        .map((s) => ({ user_id: session.user.id, subject: s, level: levelLabel, hourly_rate: rateNum }));
      if (rows.length) await supabase.from("tutor_subjects").insert(rows as any);

      // Update profile photo url (publicly visible avatar)
      if (photoUrl) {
        const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(photoUrl);
        await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", session.user.id);
      }

      toast({ title: "Submitted!", description: "Your application is in review. We'll notify you within 24–48 hours." });
      navigate("/tutor", { replace: true });
    } catch (e: any) {
      toast({ title: "Submission failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh py-6 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
          <div className="text-xs font-medium">{STEPS[step]}</div>
        </div>
        <div className="h-1 w-full rounded-full bg-muted mb-6 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <Card className="p-5 bg-card/95 backdrop-blur">
          {step === 0 && (
            <Section icon={IdCard} title="Identity verification" desc="We'll verify your ID with the relevant authority.">
              <Label>ID / Passport number</Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 9001015800087" />
              <Label className="mt-3 block">Upload ID document (PDF/JPG/PNG, ≤10MB)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                setIdDoc(f);
              }} />
              {idDoc && <p className="mt-1 text-xs text-emerald-600">✓ {idDoc.name}</p>}
            </Section>
          )}

          {step === 1 && (
            <Section icon={Camera} title="Profile photo" desc="Clear, recent photo of your face. Learners will see this.">
              <Input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (!validateFile(f, ["image/png","image/jpeg","image/jpg"], 5)) return;
                setPhoto(f);
              }} />
              {photo && <p className="mt-1 text-xs text-emerald-600">✓ {photo.name}</p>}
            </Section>
          )}

          {step === 2 && (
            <Section icon={GraduationCap} title="Where are you in your studies?">
              {(["current_student","graduate"] as const).map((s) => (
                <button key={s} type="button"
                  onClick={() => setStudentStatus(s)}
                  className={`w-full text-left p-3 rounded-lg border mb-2 transition ${studentStatus === s ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <div className="font-medium">{s === "current_student" ? "I'm currently at university" : "I've completed my qualification"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s === "current_student" ? "We'll need your most recent academic transcript." : "We'll need your degree / diploma certificate."}</div>
                </button>
              ))}
            </Section>
          )}

          {step === 3 && studentStatus === "current_student" && (
            <Section icon={FileText} title="Upload your latest transcript">
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                setTranscript(f);
              }} />
              {transcript && <p className="mt-1 text-xs text-emerald-600">✓ {transcript.name}</p>}
            </Section>
          )}

          {step === 3 && studentStatus === "graduate" && (
            <Section icon={FileText} title="Qualification details">
              <Label>Qualification type</Label>
              <Input value={qualType} onChange={(e) => setQualType(e.target.value)} placeholder="e.g. BSc Mathematics" />
              <Label className="mt-3 block">Institution</Label>
              <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Zimbabwe" />
              <Label className="mt-3 block">Year obtained</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
              <Label className="mt-3 block">Upload certificate (PDF/JPG/PNG, ≤10MB)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                setQualification(f);
              }} />
              {qualification && <p className="mt-1 text-xs text-emerald-600">✓ {qualification.name}</p>}
            </Section>
          )}

          {step === 4 && (
            <Section icon={BookOpen} title="Which curriculums do you teach?" desc="Pick all that apply — learners will be matched to you based on this.">
              <div className="flex flex-wrap gap-2">
                {CURRICULUMS.map((c) => (
                  <button key={c.code} type="button" onClick={() => setCurriculums((prev) => toggle(prev, c.code))}
                    className={`px-3 py-2 rounded-full border text-sm ${curriculums.includes(c.code) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {step === 5 && (
            <Section icon={GraduationCap} title="Which grades / levels do you teach?">
              <div className="flex flex-wrap gap-2">
                {availableGrades.map((g) => (
                  <button key={g} type="button" onClick={() => setGrades((prev) => toggle(prev, g))}
                    className={`px-3 py-1.5 rounded-full border text-sm ${grades.includes(g) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {step === 6 && (
            <Section icon={Briefcase} title="Subjects & hourly rate">
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-1">
                {availableSubjects.map((s) => (
                  <button key={s} type="button" onClick={() => setSubjects((prev) => toggle(prev, s))}
                    className={`px-3 py-1.5 rounded-full border text-sm ${subjects.includes(s) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <Label className="mt-4 block">Default hourly rate (R)</Label>
              <Input type="number" min={50} step={50} value={rate} onChange={(e) => setRate(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">You can set per-subject rates from your profile later.</p>
            </Section>
          )}

          {step === 7 && (
            <Section icon={CheckCircle2} title="Tell learners about yourself">
              <Label>Bio (min 30 characters)</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Briefly: who you are, your experience, and what makes your tutoring effective." />
              <Label className="mt-3 block">Teaching style (optional)</Label>
              <Textarea value={style} onChange={(e) => setStyle(e.target.value)} rows={2} placeholder="e.g. Visual, exam-focused, build from first principles…" />
              <div className="mt-4 flex flex-wrap gap-1">
                {curriculums.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                {grades.map((g) => <Badge key={g} variant="outline">{g}</Badge>)}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">After submission your application is reviewed within 24–48 hours.</p>
            </Section>
          )}

          <div className="flex justify-between gap-2 mt-6">
            <Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button disabled={!canNext() || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting…" : <><Upload className="h-4 w-4 mr-1" /> Submit application</>}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1"><Icon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">{title}</h2></div>
      {desc && <p className="text-sm text-muted-foreground mb-3">{desc}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
