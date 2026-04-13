/**
 * DevService — centralized simulation layer for Dev Mode.
 *
 * Single source of truth for mock data, payment simulation,
 * booking normalization, and error simulation.
 *
 * PRODUCTION SAFETY: Completely inert when not in dev mode.
 */

// ── Production safety lock ──────────────────────────────────────────────────
const isProduction = typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  !window.location.hostname.includes("preview") &&
  !window.location.hostname.includes("lovable");

// ── Dev user fixtures ───────────────────────────────────────────────────────
const DEV_LEARNER = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Dev Learner",
  email: "dev-learner@studysync.test",
  role: "learner" as const,
  study_level: "senior_high",
};

const DEV_TUTOR = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "Dev Tutor",
  email: "dev-tutor@studysync.test",
  role: "tutor" as const,
};

// ── Mock bookings ───────────────────────────────────────────────────────────
const MOCK_BOOKINGS = [
  {
    id: "dev-booking-001",
    status: "confirmed",
    scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 60,
    price: 300,
    room_name: "StudySync-Dev-Test-Room",
    tutor_profile: { full_name: "Dev Tutor" },
    tutor_subjects: { subject: "Mathematics", level: "O Level" },
  },
  {
    id: "dev-booking-002",
    status: "requested",
    scheduled_at: new Date(Date.now() + 86400_000).toISOString(),
    duration_minutes: 45,
    price: 200,
    room_name: null,
    tutor_profile: { full_name: "Dev Tutor" },
    tutor_subjects: { subject: "Physics", level: "A Level" },
  },
];

// ── Types ───────────────────────────────────────────────────────────────────
export interface DevConfig {
  bypassAuth: boolean;
  bypassPayments: boolean;
  bypassSchedule: boolean;
  forcePaidBookings: boolean;
  simulateFailures: boolean;
  simulateSlowNetwork: boolean;
}

export const DEFAULT_DEV_CONFIG: DevConfig = {
  bypassAuth: true,
  bypassPayments: true,
  bypassSchedule: true,
  forcePaidBookings: true,
  simulateFailures: false,
  simulateSlowNetwork: false,
};

// ── Service ─────────────────────────────────────────────────────────────────
export const DevService = {
  /**
   * Whether dev mode can be activated at all.
   * Blocked entirely in production builds.
   */
  isAllowed: () => !isProduction,

  // ── Users ───────────────────────────────────────────────────────────────
  getUser: (role: "learner" | "tutor") =>
    role === "tutor" ? DEV_TUTOR : DEV_LEARNER,

  // ── Payments ────────────────────────────────────────────────────────────
  simulatePaymentSuccess: <T extends Record<string, unknown>>(booking: T): T => ({
    ...booking,
    paymentStatus: "completed",
    status: "confirmed",
    paidAt: new Date().toISOString(),
  }),

  simulatePaymentFailure: <T extends Record<string, unknown>>(booking: T): T => ({
    ...booking,
    paymentStatus: "failed",
    status: "pending_payment",
  }),

  // ── Bookings ────────────────────────────────────────────────────────────
  normalizeBooking: <T extends Record<string, unknown>>(booking: T, config: DevConfig): T => {
    if (config.forcePaidBookings) {
      return { ...booking, paymentStatus: "completed", status: "confirmed" };
    }
    return booking;
  },

  getMockBookings: () => MOCK_BOOKINGS,

  // ── State helpers ───────────────────────────────────────────────────────
  isPaid: (bookingId: string, config: DevConfig, realCheck: (id: string) => boolean): boolean => {
    if (config.forcePaidBookings) return true;
    return realCheck(bookingId);
  },

  needsPayment: (bookingId: string, config: DevConfig, realCheck: (id: string) => boolean): boolean => {
    if (config.bypassPayments || config.forcePaidBookings) return false;
    return realCheck(bookingId);
  },

  // ── Network simulation ────────────────────────────────────────────────
  maybeDelay: async (config: DevConfig): Promise<void> => {
    if (config.simulateSlowNetwork) {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
    }
  },

  // ── Error simulation ──────────────────────────────────────────────────
  maybeThrow: (config: DevConfig, context: string): void => {
    if (config.simulateFailures && Math.random() < 0.3) {
      throw new Error(`[DevService] Simulated failure in ${context}`);
    }
  },
};
