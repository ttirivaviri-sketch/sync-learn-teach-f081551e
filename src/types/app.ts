/**
 * Shared application-level TypeScript interfaces.
 * Replaces all `any` type usage across LearnerApp, TutorApp, and auth pages.
 */

// ── User / Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: 'learner' | 'tutor' | null;
  avatar_url: string | null;
  study_level: string | null;
  bio: string | null;
  online_status: boolean;
  last_seen: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

// ── Video Meeting ─────────────────────────────────────────────────────────────

export interface VideoMeetingData {
  partnerName: string;
  subject: string;
  booking: {
    id: string;
    room_name?: string;
    tutor_profile?: { full_name: string };
    learner_profile?: { full_name: string };
    tutor_subjects?: { subject: string; level: string };
    scheduled_at: string;
    duration_minutes: number;
    price: number;
  };
}

// ── Review ────────────────────────────────────────────────────────────────────

export interface ReviewData {
  bookingId: string;
  reviewedId: string;
  reviewedName: string;
  userType: 'learner' | 'tutor';
}

// ── Upcoming Session (derived / display) ─────────────────────────────────────

export interface UpcomingSessionDisplay {
  tutor: string;
  subject: string;
  time: string;
  price: string;
  sessionId: string;
}

// ── Booking tutor selection payload ──────────────────────────────────────────

export interface SelectedTutor {
  id: string;
  name: string;
  subject: string;
  level: string;
  price: number;
  subjectId: string;
  avatar?: string;
}

// ── Booking session type ──────────────────────────────────────────────────────

export type BookingSessionType = 'in-person' | 'online';
