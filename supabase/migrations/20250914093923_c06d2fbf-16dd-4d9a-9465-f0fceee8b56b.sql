-- Add online status tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN online_status boolean DEFAULT false,
ADD COLUMN last_seen timestamp with time zone DEFAULT now(),
ADD COLUMN location_lat numeric,
ADD COLUMN location_lng numeric,
ADD COLUMN bio text,
ADD COLUMN avatar_url text;

-- Create index for online tutors query
CREATE INDEX idx_profiles_online_tutors ON public.profiles (user_type, online_status) WHERE user_type = 'tutor';

-- Create function to update last_seen timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_seen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.last_seen = now();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic last_seen updates
CREATE TRIGGER update_profiles_last_seen
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_seen();