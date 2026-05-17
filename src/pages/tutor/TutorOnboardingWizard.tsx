/**
 * TutorOnboardingWizard — guided one-time setup for new tutors.
 *
 * 9 steps (last is Review & Submit). Form state is persisted to localStorage
 * so a refresh mid-flow doesn't reset progress (file inputs still need
 * re-picking — they can't be serialised).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Upload, GraduationCap, Briefcase, IdCard,
  Camera, BookOpen, FileText, CheckCircle2, ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useResumableWizard } from "@/hooks/useResumableWizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { security } from "@/utils/security";
import { CURRICULUM_SUBJECTS, GRADE_LEVELS_BY_CURRICULUM, type Curriculum } from "@/types/academicProfile";
import { StepperHeader } from "@/components/onboarding/StepperHeader";
import { SuccessSplash } from "@/components/onboarding/SuccessSplash";

const CURRICULUMS: { code: Curriculum; label: string }[] = [
  { code: "ZIMSEC", label: "ZIMSEC" },
  { code: "CAMB", label: "Cambridge (IGCSE / O / A-Level)" },
  { code: "IEB", label: "IEB (South Africa)" },
  { code: "NSC", label: "NSC (South Africa)" },
];

const STEPS = [
  { label: "Identity" }, { label: "Photo" }, { label: "Status" }, { label: "Document" },
  { label: "Curriculums" }, { label: "Grades" }, { label: "Subjects" }, { label: "Bio" },
  { label: "Review" },
];

interface SerialState {
  step: number;
  idNumber: string;
  studentStatus: "current_student" | "graduate" | "";
  qualType: string;
  institution: string;
  year: string;
  curriculums: Curriculum[];
  grades: string[];
  subjects: string[];
  rate: string;
  bio: string;
  style: string;
}

const INITIAL: SerialState = {
  step: 0, idNumber: "", studentStatus: "", qualType: "", institution: "", year: "",
  curriculums: [], grades: [], subjects: [], rate: "250", bio: "", style: "",
};

export default function TutorOnboardingWizard() {
  const { session } = useAuth({ redirectTo: "/tutor/auth" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const { state, setState, clear } = useResumableWizard<SerialState>(
    `tutor-onboarding:${session?.user?.id ?? "anon"}`,
    INITIAL,
  );
  const setField = <K extends keyof SerialState>(k: K, v: SerialState[K]) =>
    setState((s) => ({ ...s, [k]: v }));
  const step = state.step;
  const setStep = (n: number) => setField("step", n);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Files are NOT persisted — kept in component state only.
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [qualification, setQualification] = useState<File | null>(null);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    state.curriculums.forEach((c) => GRADE_LEVELS_BY_CURRICULUM[c]?.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [state.curriculums]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    state.curriculums.forEach((c) => CURRICULUM_SUBJECTS[c]?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [state.curriculums]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const canNext = () => {
    switch (step) {
      case 0: return !!state.idNumber.trim() && !!idDoc;
      case 1: return !!photo;
      case 2: return !!state.studentStatus;
      case 3: return state.studentStatus === "current_student"
        ? !!transcript
        : (!!qualification && !!state.qualType.trim() && !!state.institution.trim());
      case 4: return state.curriculums.length > 0;
      case 5: return state.grades.length > 0;
      case 6: return state.subjects.length > 0 && Number(state.rate) > 0;
      case 7: return state.bio.trim().length >= 30;
      case 8: return true;
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
    const path = `${session.user.id}/${folder}/${Date.now()}.${ext}`;
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
        id_number: state.idNumber,
        id_document_url: idDocUrl,
        profile_photo_url: photoUrl,
        student_status: state.studentStatus,
        transcript_url: transcriptUrl,
        qualification_url: qualUrl,
        verification_status: "pending",
        submitted_at: new Date().toISOString(),
      } as any);
      if (vErr) throw vErr;

      if (state.studentStatus === "graduate" && qualUrl) {
        await supabase.from("qualifications").insert({
          user_id: session.user.id,
          qualification_type: state.qualType,
          institution: state.institution,
          document_url: qualUrl,
          year_obtained: Number(state.year) || null,
        });
      }

      const { error: pErr } = await supabase.from("tutor_teaching_profile").upsert({
        user_id: session.user.id,
        curriculums: state.curriculums,
        grades: state.grades,
        bio: state.bio,
        teaching_style: state.style || null,
        onboarding_completed_at: new Date().toISOString(),
      } as any);
      if (pErr) throw pErr;

      const rateNum = Number(state.rate);
      const levelLabel = state.grades[0] ?? "All";
      const { data: existing } = await supabase
        .from("tutor_subjects").select("id, subject").eq("user_id", session.user.id);
      const have = new Map((existing ?? []).map((r: any) => [r.subject, r.id]));
      const wanted = new Set(state.subjects);
      // Insert missing
      const rows = state.subjects
        .filter((s) => !have.has(s))
        .map((s) => ({ user_id: session.user.id, subject: s, level: levelLabel, hourly_rate: rateNum }));
      if (rows.length) await supabase.from("tutor_subjects").insert(rows as any);
      // Remove stale (subjects the tutor unselected)
      const staleIds = (existing ?? [])
        .filter((r: any) => !wanted.has(r.subject))
        .map((r: any) => r.id);
      if (staleIds.length) await supabase.from("tutor_subjects").delete().in("id", staleIds);

      if (photoUrl) {
        const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(photoUrl);
        await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", session.user.id);
      }

      clear();
      setSubmitted(true);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SuccessSplash
        title="Application submitted!"
        subtitle="Our team reviews tutor documents within 24–48 hours. You'll be notified the moment you're approved."
        checklist={[
          "Identity & documents received",
          "Teaching profile saved",
          `${state.subjects.length} subject${state.subjects.length === 1 ? "" : "s"} ready to teach`,
        ]}
        ctaLabel="Continue"
        onCta={() => navigate("/tutor", { replace: true })}
        autoAdvanceMs={3500}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh py-6 px-4">
      <div className="max-w-xl mx-auto">
        <StepperHeader steps={STEPS} current={step} className="mb-6" />

        <Card className="p-5 bg-card/95 backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <Section icon={IdCard} title="Identity verification" desc="We verify your ID with the relevant authority. Your details are encrypted.">
                  <Label>ID / Passport number</Label>
                  <Input value={state.idNumber} onChange={(e) => setField("idNumber", e.target.value)} placeholder="e.g. 9001015800087" />
                  <Label className="mt-3 block">Upload ID document (PDF / JPG / PNG, ≤10MB)</Label>
                  <FileDropzone
                    accept=".pdf,.jpg,.jpeg,.png"
                    file={idDoc}
                    onFile={(f) => {
                      if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                      setIdDoc(f);
                    }}
                  />
                </Section>
              )}

              {step === 1 && (
                <Section icon={Camera} title="Profile photo" desc="A clear, recent photo of your face. Learners will see this.">
                  <FileDropzone
                    accept=".jpg,.jpeg,.png"
                    file={photo}
                    isImage
                    onFile={(f) => {
                      if (!validateFile(f, ["image/png","image/jpeg","image/jpg"], 5)) return;
                      setPhoto(f);
                    }}
                  />
                </Section>
              )}

              {step === 2 && (
                <Section icon={GraduationCap} title="Where are you in your studies?">
                  {(["current_student","graduate"] as const).map((s) => (
                    <button key={s} type="button"
                      onClick={() => setField("studentStatus", s)}
                      className={`w-full text-left p-3 rounded-lg border mb-2 transition ${state.studentStatus === s ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <div className="font-medium">{s === "current_student" ? "I'm currently at university" : "I've completed my qualification"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s === "current_student" ? "We'll need your most recent academic transcript." : "We'll need your degree / diploma certificate."}</div>
                    </button>
                  ))}
                </Section>
              )}

              {step === 3 && state.studentStatus === "current_student" && (
                <Section icon={FileText} title="Upload your latest transcript">
                  <FileDropzone
                    accept=".pdf,.jpg,.jpeg,.png"
                    file={transcript}
                    onFile={(f) => {
                      if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                      setTranscript(f);
                    }}
                  />
                </Section>
              )}

              {step === 3 && state.studentStatus === "graduate" && (
                <Section icon={FileText} title="Qualification details">
                  <Label>Qualification type</Label>
                  <Input value={state.qualType} onChange={(e) => setField("qualType", e.target.value)} placeholder="e.g. BSc Mathematics" />
                  <Label className="mt-3 block">Institution</Label>
                  <Input value={state.institution} onChange={(e) => setField("institution", e.target.value)} placeholder="e.g. University of Zimbabwe" />
                  <Label className="mt-3 block">Year obtained</Label>
                  <Input type="number" value={state.year} onChange={(e) => setField("year", e.target.value)} placeholder="2022" />
                  <Label className="mt-3 block">Upload certificate (PDF / JPG / PNG, ≤10MB)</Label>
                  <FileDropzone
                    accept=".pdf,.jpg,.jpeg,.png"
                    file={qualification}
                    onFile={(f) => {
                      if (!validateFile(f, ["application/pdf","image/png","image/jpeg","image/jpg"], 10)) return;
                      setQualification(f);
                    }}
                  />
                </Section>
              )}

              {step === 4 && (
                <Section icon={BookOpen} title="Which curriculums do you teach?" desc="Pick all that apply — learners will be matched to you based on this.">
                  <div className="flex flex-wrap gap-2">
                    {CURRICULUMS.map((c) => (
                      <button key={c.code} type="button" onClick={() => setField("curriculums", toggle(state.curriculums, c.code))}
                        className={`px-3 py-2 rounded-full border text-sm transition ${state.curriculums.includes(c.code) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"}`}>
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
                      <button key={g} type="button" onClick={() => setField("grades", toggle(state.grades, g))}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${state.grades.includes(g) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"}`}>
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
                      <button key={s} type="button" onClick={() => setField("subjects", toggle(state.subjects, s))}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${state.subjects.includes(s) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <Label className="mt-4 block">Default hourly rate (R)</Label>
                  <Input type="number" min={50} step={50} value={state.rate} onChange={(e) => setField("rate", e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">You can set per-subject rates from your profile later.</p>
                </Section>
              )}

              {step === 7 && (
                <Section icon={CheckCircle2} title="Tell learners about yourself">
                  <Label>Bio (min 30 characters)</Label>
                  <Textarea value={state.bio} onChange={(e) => setField("bio", e.target.value)} rows={4} placeholder="Briefly: who you are, your experience, and what makes your tutoring effective." />
                  <Label className="mt-3 block">Teaching style (optional)</Label>
                  <Textarea value={state.style} onChange={(e) => setField("style", e.target.value)} rows={2} placeholder="e.g. Visual, exam-focused, build from first principles…" />
                </Section>
              )}

              {step === 8 && (
                <Section icon={ClipboardCheck} title="Review & submit" desc="Quick check before we send to our review team.">
                  <ReviewBlock label="ID number" value={state.idNumber} />
                  <ReviewBlock label="Status" value={state.studentStatus === "current_student" ? "Current student" : "Graduate"} />
                  {state.studentStatus === "graduate" && (
                    <>
                      <ReviewBlock label="Qualification" value={`${state.qualType} · ${state.institution}${state.year ? ` (${state.year})` : ""}`} />
                    </>
                  )}
                  <ReviewBlock label="Curriculums" value={state.curriculums.join(", ")} />
                  <ReviewBlock label="Grades" value={state.grades.join(", ")} />
                  <ReviewBlock label="Subjects" value={`${state.subjects.length} · ${state.subjects.slice(0, 4).join(", ")}${state.subjects.length > 4 ? "…" : ""}`} />
                  <ReviewBlock label="Default rate" value={`R${state.rate}/hr`} />
                  <ReviewBlock label="Documents" value={[
                    idDoc && "ID", photo && "Photo",
                    transcript && "Transcript", qualification && "Certificate",
                  ].filter(Boolean).join(" · ") || "—"} />
                  <div className="mt-4 flex flex-wrap gap-1">
                    {state.curriculums.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                    {state.grades.map((g) => <Badge key={g} variant="outline">{g}</Badge>)}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">After submission your application is reviewed within 24–48 hours.</p>
                </Section>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between gap-2 mt-6">
            <Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
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

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value || "—"}</span>
    </div>
  );
}

function FileDropzone({
  accept, file, onFile, isImage,
}: { accept: string; file: File | null; onFile: (f: File) => void; isImage?: boolean }) {
  const id = `dz-${Math.random().toString(36).slice(2, 8)}`;
  const previewUrl = isImage && file ? URL.createObjectURL(file) : null;
  return (
    <label
      htmlFor={id}
      className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/30 transition cursor-pointer p-6 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="preview" className="h-24 w-24 rounded-full object-cover" />
      ) : (
        <Upload className="h-7 w-7 text-muted-foreground" />
      )}
      <div className="text-sm">
        {file ? (
          <span className="text-emerald-600 font-medium">✓ {file.name} <span className="text-xs text-muted-foreground">({Math.round(file.size / 1024)} KB)</span></span>
        ) : (
          <span className="text-muted-foreground">Drag & drop or <span className="text-primary font-medium">click to upload</span></span>
        )}
      </div>
      <input id={id} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
}
