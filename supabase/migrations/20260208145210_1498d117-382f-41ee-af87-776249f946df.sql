
-- Create learner_subjects table for storing student syllabus
CREATE TABLE public.learner_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject)
);

-- Enable RLS
ALTER TABLE public.learner_subjects ENABLE ROW LEVEL SECURITY;

-- Learners can manage their own subjects
CREATE POLICY "Users can manage their own learner subjects"
ON public.learner_subjects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Anyone can view learner subjects (tutors need to see student profiles)
CREATE POLICY "Anyone can view learner subjects"
ON public.learner_subjects
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_learner_subjects_updated_at
BEFORE UPDATE ON public.learner_subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
