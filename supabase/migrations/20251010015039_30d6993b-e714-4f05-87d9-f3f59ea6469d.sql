-- Add room_name column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN room_name text UNIQUE;

-- Create index for faster room_name lookups
CREATE INDEX idx_bookings_room_name ON public.bookings(room_name);

-- Add comment
COMMENT ON COLUMN public.bookings.room_name IS 'Unique Jitsi room name for the video session';