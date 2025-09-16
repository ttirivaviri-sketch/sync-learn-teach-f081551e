-- Add RLS policy to allow everyone to view tutor profiles for discovery
CREATE POLICY "Anyone can view tutor profiles for discovery" 
ON public.profiles 
FOR SELECT 
USING (user_type = 'tutor');

-- Add RLS policy to allow everyone to view tutor subjects for discovery
CREATE POLICY "Anyone can view tutor subjects for discovery" 
ON public.tutor_subjects 
FOR SELECT 
USING (true);

-- Enable realtime for profiles table to sync online status changes
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE tutor_subjects;

-- Set replica identity to full for better realtime updates
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE tutor_subjects REPLICA IDENTITY FULL;