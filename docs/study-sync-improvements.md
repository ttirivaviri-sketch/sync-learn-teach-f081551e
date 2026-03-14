# StudySync Improvement Plan

This plan focuses on increasing booking reliability, improving tutor/learner experience, and making operations more observable.

## 1) Booking sync reliability

- Add **idempotency keys** for booking creation and payment updates to prevent duplicate sessions from retries.
- Introduce a **booking state machine** (`requested -> confirmed -> completed/canceled`) with transition validation and reason codes.
- Add a lightweight **reconciliation job** that checks for stale `requested` bookings and orphaned notifications.
- Store a clear `last_synced_at` and `sync_source` on integration records to troubleshoot drift.

**Success metrics**
- Duplicate booking rate < 0.1%
- Failed status transition rate < 0.5%
- Mean time to detect sync drift < 15 min

## 2) Calendar and reminder experience

- Provide one-click calendar export for learners/tutors (`.ics`, Google, Outlook).
- Send reminders at T-24h and T-1h with timezone-safe formatting and deep links to join flow.
- Add in-app “session readiness” checklist (camera, mic, network) 10 minutes before session start.

**Success metrics**
- No-show rate reduced by 20%
- Reminder delivery success > 99%

## 3) Real-time communication hardening

- Track end-to-end event delivery for booking updates (`created`, `confirmed`, `canceled`).
- Add client retry with exponential backoff for real-time channel reconnects.
- Display explicit UI status for stale data (“Last updated 2m ago, retrying…”).

**Success metrics**
- Real-time update p95 latency < 2s
- Reconnect success within 30s > 99%

## 4) Tutor matching and conversion

- Improve ranking with weighted scoring: subject fit, price fit, rating, recent response time, and proximity.
- Add “best alternative times” when requested slot is unavailable.
- Capture decline reasons from tutors and use them to improve learner suggestions.

**Success metrics**
- Search-to-booking conversion +15%
- Tutor acceptance rate +10%

## 5) Safety and trust

- Expand anti-fraud checks on first-time payments and unusual booking patterns.
- Add moderation queues for review abuse and suspicious profile changes.
- Surface verification badges with clear criteria and renewal dates.

**Success metrics**
- Chargeback rate reduced by 25%
- Time-to-resolution for trust incidents < 24h

## 6) Admin and support operations

- Build an **ops dashboard**: failed notifications, pending disputes, refund SLAs, and booking anomaly alerts.
- Add runbooks for common incidents (double-booking, payment mismatch, notification outage).
- Add “one-click replay” for failed non-destructive notifications.

**Success metrics**
- Support first-response time < 10 min during business hours
- Incident recovery time reduced by 30%

## 7) Implementation roadmap (90 days)

### Days 0–30 (stability)
- Booking transition validation
- Reminder pipeline improvements
- Realtime reconnect/backoff + stale-data UX

### Days 31–60 (conversion)
- Matching score v1
- Alternative slot recommendations
- Calendar exports

### Days 61–90 (operations)
- Ops dashboard + alerting
- Reconciliation automation
- Incident runbooks and replay tooling

## 8) Suggested instrumentation

Capture and monitor these events:

- `booking_created`, `booking_confirmed`, `booking_canceled`, `booking_completed`
- `notification_sent`, `notification_failed`
- `realtime_connected`, `realtime_reconnect_attempt`, `realtime_reconnect_success`
- `search_performed`, `tutor_profile_viewed`, `booking_checkout_started`, `booking_checkout_completed`

Include dimensions: role, platform, timezone, subject, city, price_band, and app_version.
