/**
 * TutorAuth — Tutor sign-in / sign-up with verification step.
 *
 * Step 1: Shared AuthForm (sign-in / sign-up).
 * Step 2: Tutor-specific verification document upload (unique to tutors).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, GraduationCap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AuthForm } from "@/components/AuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { security } from "@/utils/security";

// ── Shared logo block ────────────────────────────────────────────────────────
const LogoBlock = () => (
  <div className="text-center mb-8">
    <div className="flex items-center justify-center mb-3">
      <img
        src="/lovable-uploads/studysync-logo.png"
        alt="StudySync"
        className="w-auto object-contain"
        style={{ height: "160px", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))", mixBlendMode: "screen" }}
      />
    </div>
    <p className="text-xs font-semibold tracking-widest uppercase text-white/75 mb-1">
      Education, in sync with your future
    </p>
  </div>
);

// ── Main component ──────────────────────────────────────────────────────────
const TutorAuth = () => {
  const { session } = useAuth({});
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1 = auth form, Step 2 = verification upload
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Verification fields
  const [idNumber, setIdNumber] = useState("");
  const [files, setFiles] = useState({
    idDocument: null as File | null,
    profilePhoto: null as File | null,
    policeClearance: null as File | null,
    qualifications: [] as File[],
  });
  const [qualificationDetails, setQualificationDetails] = useState({
    type: "", institution: "", year: "",
  });

  // ── File upload helper ──────────────────────────────────────────────────
  const uploadFile = async (file: File, bucket: string, folder: string) => {
    if (!session?.user) return null;
    const ext = file.name.split(".").pop();
    const path = `${folder}/${session.user.id}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return data.path;
  };

  const handleFileChange = (type: keyof typeof files, file: File | File[]) => {
    if (type === "qualifications" && Array.isArray(file)) {
      setFiles((prev) => ({ ...prev, [type]: file }));
    } else if (!Array.isArray(file)) {
      setFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  // ── Verification submit ─────────────────────────────────────────────────
  const handleVerificationSubmit = async () => {
    if (!session?.user) return;

    const allowedImg = ["image/jpeg", "image/png", "image/jpg"];
    const allowedDoc = ["application/pdf", ...allowedImg];

    if (files.idDocument) {
      const v = security.validateFileUpload(files.idDocument, allowedDoc, 10);
      if (!v.valid) { toast({ title: "Invalid file", description: `ID Document: ${v.error}`, variant: "destructive" }); return; }
    }
    if (files.profilePhoto) {
      const v = security.validateFileUpload(files.profilePhoto, allowedImg, 5);
      if (!v.valid) { toast({ title: "Invalid file", description: `Profile Photo: ${v.error}`, variant: "destructive" }); return; }
    }
    if (files.policeClearance) {
      const v = security.validateFileUpload(files.policeClearance, allowedDoc, 10);
      if (!v.valid) { toast({ title: "Invalid file", description: `Police Clearance: ${v.error}`, variant: "destructive" }); return; }
    }

    setLoading(true);
    try {
      const idDocUrl = files.idDocument ? await uploadFile(files.idDocument, "tutor-documents", "id-documents") : null;
      const photoUrl = files.profilePhoto ? await uploadFile(files.profilePhoto, "profile-photos", "photos") : null;
      const clearanceUrl = files.policeClearance ? await uploadFile(files.policeClearance, "tutor-documents", "police-clearance") : null;

      const { error: verErr } = await supabase.from("tutor_verifications").insert({
        user_id: session.user.id,
        id_number: idNumber,
        id_document_url: idDocUrl,
        profile_photo_url: photoUrl,
        police_clearance_url: clearanceUrl,
        verification_status: "pending",
      });
      if (verErr) throw verErr;

      for (const qf of files.qualifications) {
        const qualUrl = await uploadFile(qf, "tutor-documents", "qualifications");
        await supabase.from("qualifications").insert({
          user_id: session.user.id,
          qualification_type: qualificationDetails.type,
          institution: qualificationDetails.institution,
          document_url: qualUrl,
          year_obtained: parseInt(qualificationDetails.year) || undefined,
        });
      }

      toast({ title: "Verification submitted!", description: "Your documents have been uploaded for review. You'll be notified once verified." });
      navigate("/tutor");
    } catch {
      toast({ title: "Upload failed", description: "Failed to upload verification documents. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verification ──────────────────────────────────────────────────
  if (currentStep === 2 && session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <LogoBlock />
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-white mb-1">Tutor Verification</h1>
            <p className="text-white/80">Complete your verification to start tutoring</p>
          </div>

          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Verification Documents
              </CardTitle>
              <CardDescription>Upload required documents for security and quality assurance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identity */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  Identity Verification
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-number">ID Number</Label>
                  <Input id="id-number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Enter your ID number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-document">ID Document Upload</Label>
                  <Input id="id-document" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && handleFileChange("idDocument", e.target.files[0])} required />
                </div>
              </div>

              {/* Profile Photo */}
              <div className="space-y-2">
                <Label htmlFor="profile-photo">Profile Photo</Label>
                <Input id="profile-photo" type="file" accept=".jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && handleFileChange("profilePhoto", e.target.files[0])} required />
              </div>

              {/* Police Clearance */}
              <div className="space-y-2">
                <Label htmlFor="police-clearance">Police Clearance Certificate</Label>
                <Input id="police-clearance" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && handleFileChange("policeClearance", e.target.files[0])} required />
              </div>

              {/* Qualifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="w-4 h-4" />
                  Qualifications & Transcripts
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qual-type">Qualification Type</Label>
                    <Input id="qual-type" value={qualificationDetails.type} onChange={(e) => setQualificationDetails((p) => ({ ...p, type: e.target.value }))} placeholder="e.g., Bachelor's Degree" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution</Label>
                    <Input id="institution" value={qualificationDetails.institution} onChange={(e) => setQualificationDetails((p) => ({ ...p, institution: e.target.value }))} placeholder="e.g., University of Cape Town" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year Obtained</Label>
                  <Input id="year" type="number" value={qualificationDetails.year} onChange={(e) => setQualificationDetails((p) => ({ ...p, year: e.target.value }))} placeholder="2020" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Upload Qualifications/Transcripts</Label>
                  <Input id="qualifications" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files && handleFileChange("qualifications", Array.from(e.target.files))} />
                </div>
              </div>

              <Button onClick={handleVerificationSubmit} className="w-full" disabled={loading || !idNumber || !files.idDocument || !files.profilePhoto || !files.policeClearance}>
                {loading ? "Uploading..." : "Submit Verification"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Step 1: Auth Form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LogoBlock />
        <p className="text-center text-2xl font-extrabold text-white mb-8">Confidence Starts Here</p>

        <AuthForm
          userType="tutor"
          redirectTo="/tutor"
          subtitle="Join as a verified tutor or sign in to your account"
          signUpLabel="Become a Tutor"
          signUpHint={
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  <strong>Next Steps:</strong> After registration, you'll need to upload verification
                  documents including ID, photo, police clearance, and qualifications.
                </p>
              </div>
            </div>
          }
          onSignUpSuccess={() => setCurrentStep(2)}
        />
      </div>
    </div>
  );
};

export default TutorAuth;
