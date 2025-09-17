# Database Schema Documentation

## Overview

StudySync uses Supabase (PostgreSQL) with Row Level Security (RLS) for data protection and real-time subscriptions for live updates.

## Core Tables

### profiles
User profile information and preferences.

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,  -- Links to auth.users.id
  email text NOT NULL,
  full_name text,
  user_type text NOT NULL DEFAULT 'learner',
  phone text,
  bio text,
  avatar_url text,
  online_status boolean DEFAULT false,
  location_lat numeric,
  location_lng numeric,
  study_level study_level_enum,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Users can view/update their own profile
- Tutor profiles are publicly viewable for discovery
- Profile creation restricted to authenticated users

### tutor_subjects
Tutor expertise areas with pricing information.

```sql
CREATE TABLE public.tutor_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  level text NOT NULL,
  hourly_rate numeric,
  created_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Users can manage their own subjects
- All subjects publicly viewable for tutor discovery

### bookings
Session booking management with status tracking.

```sql
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  tutor_subject_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  status booking_status DEFAULT 'requested',
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Status Enum:** `requested`, `accepted`, `declined`, `in_progress`, `completed`, `cancelled`

**RLS Policies:**
- Learners can create bookings
- Participants (learner/tutor) can view and update status
- Admin can manage all bookings

## Communication Tables

### conversations
Chat conversation threads between users.

```sql
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### messages
Individual messages within conversations.

```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Participants can view messages in their conversations
- Participants can send messages
- Users can mark messages as read

## Review System

### reviews
User ratings and feedback for completed sessions.

```sql
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid,
  reviewer_id uuid NOT NULL,
  reviewed_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Users can create reviews for their completed bookings
- Users can view reviews about themselves
- Users can update their own reviews

## Payment System

### payments
Transaction records for session payments.

```sql
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  status payment_status DEFAULT 'pending',
  provider text,
  provider_ref text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Status Enum:** `pending`, `processing`, `completed`, `failed`, `refunded`

## Verification System

### tutor_verifications
Document verification for tutor onboarding.

```sql
CREATE TABLE public.tutor_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  id_number text,
  id_document_url text,
  profile_photo_url text,
  police_clearance_url text,
  verification_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### verification_reviews
Admin reviews of verification documents.

```sql
CREATE TABLE public.verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  decision verification_decision NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### qualifications
Educational background documentation.

```sql
CREATE TABLE public.qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  qualification_type text NOT NULL,
  institution text NOT NULL,
  year_obtained integer,
  document_url text,
  created_at timestamptz DEFAULT now()
);
```

## Admin & Support Tables

### user_roles
Role-based access control system.

```sql
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Role Enum:** `admin`, `support`, `moderator`

### support_tickets
Customer support ticket system.

```sql
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  assignee_id uuid,
  status support_status DEFAULT 'open',
  priority priority_level DEFAULT 'medium',
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Location & Offline Support

### location_codes
Predefined location codes for offline bookings.

```sql
CREATE TABLE public.location_codes (
  code text PRIMARY KEY,
  name text NOT NULL,
  city text,
  region text,
  latitude numeric,
  longitude numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### offline_booking_requests
SMS/USSD booking requests from offline channels.

```sql
CREATE TABLE public.offline_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel offline_channel NOT NULL,
  learner_msisdn text NOT NULL,
  tutor_msisdn text,
  subject_code text,
  location_code text,
  cell_tower_id text,
  location_pin text,
  scheduled_at timestamptz,
  status offline_request_status DEFAULT 'received',
  raw_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### ussd_sessions
USSD session state management.

```sql
CREATE TABLE public.ussd_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn text NOT NULL,
  provider_session_id text NOT NULL,
  current_step text,
  data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### message_logs
Audit trail for SMS/USSD communications.

```sql
CREATE TABLE public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel message_channel NOT NULL,
  direction message_direction NOT NULL,
  from_msisdn text,
  to_msisdn text,
  body text NOT NULL,
  provider_message_id text,
  related_request_id uuid,
  error text,
  created_at timestamptz DEFAULT now()
);
```

## Custom Enums

```sql
-- Booking status progression
CREATE TYPE booking_status AS ENUM ('requested', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled');

-- Payment transaction states
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- Study level categories
CREATE TYPE study_level AS ENUM ('primary', 'secondary', 'tertiary', 'professional');

-- Support ticket management
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- Verification process
CREATE TYPE verification_decision AS ENUM ('approved', 'rejected', 'needs_revision');

-- User roles and permissions
CREATE TYPE app_role AS ENUM ('admin', 'support', 'moderator');

-- Offline booking channels
CREATE TYPE offline_channel AS ENUM ('sms', 'ussd', 'whatsapp');
CREATE TYPE offline_request_status AS ENUM ('received', 'processing', 'matched', 'confirmed', 'failed');

-- Message logging
CREATE TYPE message_channel AS ENUM ('sms', 'ussd', 'whatsapp', 'email');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
```

## Database Functions

### handle_new_user()
Automatically creates profile when user registers.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'learner')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### has_role(user_id, role)
Checks if user has specific role for RLS policies.

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### update_updated_at_column()
Automatically updates timestamp on row changes.

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Indexes for Performance

```sql
-- User lookups
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_profiles_online_status ON profiles(online_status) WHERE online_status = true;
CREATE INDEX idx_profiles_location ON profiles(location_lat, location_lng) WHERE location_lat IS NOT NULL;

-- Booking queries
CREATE INDEX idx_bookings_tutor_status ON bookings(tutor_id, status);
CREATE INDEX idx_bookings_learner_status ON bookings(learner_id, status);
CREATE INDEX idx_bookings_scheduled_at ON bookings(scheduled_at);

-- Message performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_participants ON conversations(tutor_id, learner_id);

-- Search optimization
CREATE INDEX idx_tutor_subjects_search ON tutor_subjects(subject, level);
CREATE INDEX idx_location_codes_active ON location_codes(active) WHERE active = true;
```

## Real-time Subscriptions

Tables enabled for real-time updates:
- `profiles` - Online status changes
- `bookings` - Status updates
- `messages` - New messages
- `conversations` - Last message timestamps
- `tutor_subjects` - Availability changes

## Security Considerations

1. **Row Level Security** enforced on all tables
2. **Function security** with SECURITY DEFINER where needed
3. **Input validation** at application and database levels
4. **Audit trails** through message_logs and timestamps
5. **Sensitive data encryption** in storage buckets
6. **Role-based access** with has_role() function