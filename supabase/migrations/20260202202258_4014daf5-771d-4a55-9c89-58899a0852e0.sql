-- Create tutor_availability table for storing weekly schedules
CREATE TABLE public.tutor_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_tutor_day_slot UNIQUE (tutor_id, day_of_week, start_time, end_time)
);

-- Enable RLS
ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;

-- Tutors can manage their own availability
CREATE POLICY "Tutors can manage their own availability"
ON public.tutor_availability
FOR ALL
USING (auth.uid() = tutor_id)
WITH CHECK (auth.uid() = tutor_id);

-- Anyone can view tutor availability for booking purposes
CREATE POLICY "Anyone can view tutor availability"
ON public.tutor_availability
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_tutor_availability_updated_at
BEFORE UPDATE ON public.tutor_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_tutor_availability_tutor_id ON public.tutor_availability(tutor_id);
CREATE INDEX idx_tutor_availability_day ON public.tutor_availability(day_of_week);