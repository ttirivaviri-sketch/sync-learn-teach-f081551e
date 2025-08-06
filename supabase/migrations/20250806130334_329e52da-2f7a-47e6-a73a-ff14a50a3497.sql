-- Create storage buckets for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('tutor-documents', 'tutor-documents', false),
  ('profile-photos', 'profile-photos', true);

-- Create tutor verification documents table
CREATE TABLE public.tutor_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  id_number TEXT,
  id_document_url TEXT,
  profile_photo_url TEXT,
  police_clearance_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create qualifications table
CREATE TABLE public.qualifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  qualification_type TEXT NOT NULL,
  institution TEXT NOT NULL,
  document_url TEXT,
  year_obtained INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;

-- Create policies for tutor_verifications
CREATE POLICY "Users can view their own verifications" 
ON public.tutor_verifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verifications" 
ON public.tutor_verifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verifications" 
ON public.tutor_verifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policies for qualifications
CREATE POLICY "Users can view their own qualifications" 
ON public.qualifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own qualifications" 
ON public.qualifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own qualifications" 
ON public.qualifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own qualifications" 
ON public.qualifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage policies for tutor documents
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tutor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tutor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for profile photos
CREATE POLICY "Profile photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add triggers for timestamp updates
CREATE TRIGGER update_tutor_verifications_updated_at
BEFORE UPDATE ON public.tutor_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add subjects table for tutors
CREATE TABLE public.tutor_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  level TEXT NOT NULL,
  hourly_rate DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subjects" 
ON public.tutor_subjects 
FOR ALL 
USING (auth.uid() = user_id);