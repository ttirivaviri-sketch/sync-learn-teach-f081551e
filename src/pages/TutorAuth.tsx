import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { Upload, Shield, GraduationCap, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { security } from "@/utils/security";

const TutorAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState({
    idDocument: null as File | null,
    profilePhoto: null as File | null,
    policeClearance: null as File | null,
    qualifications: [] as File[]
  });
  const [qualificationDetails, setQualificationDetails] = useState({
    type: "",
    institution: "",
    year: ""
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user && currentStep === 1) {
          setCurrentStep(2); // Move to verification step after successful signup
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        navigate("/tutor");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, currentStep]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/tutor`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            user_type: 'tutor'
          }
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Account created!",
          description: "Please complete your verification documents.",
        });
        setCurrentStep(2);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    if (!session?.user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${session.user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) throw error;
    return data.path;
  };

  const handleVerificationSubmit = async () => {
    if (!session?.user) return;
    
    // Validate all uploaded files
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const allowedDocTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (files.idDocument) {
      const validation = security.validateFileUpload(files.idDocument, allowedDocTypes, 10);
      if (!validation.valid) {
        toast({
          title: "Invalid file",
          description: `ID Document: ${validation.error}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    if (files.profilePhoto) {
      const validation = security.validateFileUpload(files.profilePhoto, allowedImageTypes, 5);
      if (!validation.valid) {
        toast({
          title: "Invalid file",
          description: `Profile Photo: ${validation.error}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    if (files.policeClearance) {
      const validation = security.validateFileUpload(files.policeClearance, allowedDocTypes, 10);
      if (!validation.valid) {
        toast({
          title: "Invalid file",
          description: `Police Clearance: ${validation.error}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);
    try {
      let idDocumentUrl = null;
      let profilePhotoUrl = null;
      let policeClearanceUrl = null;

      // Upload files
      if (files.idDocument) {
        idDocumentUrl = await uploadFile(files.idDocument, 'tutor-documents', 'id-documents');
      }
      if (files.profilePhoto) {
        profilePhotoUrl = await uploadFile(files.profilePhoto, 'profile-photos', 'photos');
      }
      if (files.policeClearance) {
        policeClearanceUrl = await uploadFile(files.policeClearance, 'tutor-documents', 'police-clearance');
      }

      // Save verification data
      const { error: verificationError } = await supabase
        .from('tutor_verifications')
        .insert({
          user_id: session.user.id,
          id_number: idNumber,
          id_document_url: idDocumentUrl,
          profile_photo_url: profilePhotoUrl,
          police_clearance_url: policeClearanceUrl,
          verification_status: 'pending'
        });

      if (verificationError) throw verificationError;

      // Upload qualifications
      for (const qualFile of files.qualifications) {
        const qualUrl = await uploadFile(qualFile, 'tutor-documents', 'qualifications');
        
        await supabase
          .from('qualifications')
          .insert({
            user_id: session.user.id,
            qualification_type: qualificationDetails.type,
            institution: qualificationDetails.institution,
            document_url: qualUrl,
            year_obtained: parseInt(qualificationDetails.year)
          });
      }

      toast({
        title: "Verification submitted!",
        description: "Your documents have been uploaded for review. You'll be notified once verified.",
      });

      navigate("/tutor");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload verification documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (type: keyof typeof files, file: File | File[]) => {
    if (type === 'qualifications' && Array.isArray(file)) {
      setFiles(prev => ({ ...prev, [type]: file }));
    } else if (!Array.isArray(file)) {
      setFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  if (currentStep === 2 && session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img 
                src="/lovable-uploads/studysync-logo.png" 
                alt="StudySync" 
                className="h-16 w-auto object-contain mix-blend-screen"
              />
              <span className="text-4xl font-extrabold tracking-tight">
                <span className="text-white">Study</span><span className="text-green-400">Sync</span>
              </span>
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase text-white/75 mb-1" style={{ letterSpacing: "0.12em" }}>
              Education, in sync with your future
            </p>
            <h1 className="text-2xl font-extrabold text-white mb-1">Tutor Verification</h1>
            <p className="text-white/80">Complete your verification to start tutoring</p>
          </div>

          <Card className="bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Verification Documents
              </CardTitle>
              <CardDescription>
                Upload required documents for security and quality assurance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID Number & Document */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  Identity Verification
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-number">ID Number</Label>
                  <Input
                    id="id-number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="Enter your ID number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-document">ID Document Upload</Label>
                  <Input
                    id="id-document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => e.target.files?.[0] && handleFileChange('idDocument', e.target.files[0])}
                    required
                  />
                </div>
              </div>

              {/* Profile Photo */}
              <div className="space-y-2">
                <Label htmlFor="profile-photo">Profile Photo</Label>
                <Input
                  id="profile-photo"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('profilePhoto', e.target.files[0])}
                  required
                />
              </div>

              {/* Police Clearance */}
              <div className="space-y-2">
                <Label htmlFor="police-clearance">Police Clearance Certificate</Label>
                <Input
                  id="police-clearance"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('policeClearance', e.target.files[0])}
                  required
                />
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
                    <Input
                      id="qual-type"
                      value={qualificationDetails.type}
                      onChange={(e) => setQualificationDetails(prev => ({ ...prev, type: e.target.value }))}
                      placeholder="e.g., Bachelor's Degree"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution</Label>
                    <Input
                      id="institution"
                      value={qualificationDetails.institution}
                      onChange={(e) => setQualificationDetails(prev => ({ ...prev, institution: e.target.value }))}
                      placeholder="e.g., University of Cape Town"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year Obtained</Label>
                  <Input
                    id="year"
                    type="number"
                    value={qualificationDetails.year}
                    onChange={(e) => setQualificationDetails(prev => ({ ...prev, year: e.target.value }))}
                    placeholder="2020"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Upload Qualifications/Transcripts</Label>
                  <Input
                    id="qualifications"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => e.target.files && handleFileChange('qualifications', Array.from(e.target.files))}
                  />
                </div>
              </div>

              <Button 
                onClick={handleVerificationSubmit} 
                className="w-full" 
                disabled={loading || !idNumber || !files.idDocument || !files.profilePhoto || !files.policeClearance}
              >
                {loading ? "Uploading..." : "Submit Verification"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img 
              src="/lovable-uploads/studysync-logo.png" 
              alt="StudySync" 
              className="h-16 w-auto object-contain mix-blend-screen"
            />
            <span className="text-4xl font-extrabold tracking-tight">
              <span className="text-white">Study</span><span className="text-green-400">Sync</span>
            </span>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase text-white/75 mb-1" style={{ letterSpacing: "0.12em" }}>
            Education, in sync with your future
          </p>
          <p className="text-2xl font-extrabold text-white">Confidence Starts Here</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Join as a verified tutor or sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Become a Tutor</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-xs text-blue-800">
                        <strong>Next Steps:</strong> After registration, you'll need to upload verification documents including ID, photo, police clearance, and qualifications.
                      </div>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Tutor Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TutorAuth;