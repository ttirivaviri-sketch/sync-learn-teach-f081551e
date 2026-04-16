

## Plan: Proper 8x8 JaaS Setup for Auto-Join Video Meetings

### Why it's broken now
The screenshot shows the 8x8.vc **prejoin page** appearing with a manual "Join meeting" button. This happens because `8x8.vc` is the JaaS (Jitsi-as-a-Service) platform, and without a valid **AppID** and **JWT token**, it ignores `prejoinPageEnabled: false` and forces the prejoin screen. Both users get stuck there.

### What's needed

**Step 1: You create a free JaaS account**
1. Go to [https://jaas.8x8.vc](https://jaas.8x8.vc) and sign up (free tier: 25 users/month)
2. In the JaaS dashboard, copy your **AppID** (looks like `vpaas-magic-cookie-abc123...`)
3. Generate an **API Key** — download the **Private Key** file (.pk) and note the **Key ID** (kid)

**Step 2: Store secrets in Supabase**
- `JAAS_APP_ID` — your AppID string
- `JAAS_API_KEY_ID` — the kid from your API key
- `JAAS_PRIVATE_KEY` — the RSA private key contents

**Step 3: Create a `generate-jitsi-jwt` Edge Function**
- Accepts: `roomName`, `userName`, `userEmail`, `isModerator`
- Signs a JWT with RS256 using the private key
- Returns a short-lived JWT (1 hour expiry) with proper JaaS claims (`aud: "jitsi"`, `sub: AppID`, `room: "*"`, `context.user`)

**Step 4: Update `VideoMeeting.tsx`**
- Before initializing Jitsi, call the edge function to get a JWT
- Pass `roomName` in format `<AppID>/<room>` (e.g., `vpaas-magic-cookie-abc123/StudySync-booking-id`)
- Pass the JWT in the `jwt` option
- Load the script from `https://8x8.vc/<AppID>/external_api.js`
- Keep `prejoinPageEnabled: false` — with a valid JWT, 8x8 will respect it and auto-join

### Files changed
1. `supabase/functions/generate-jitsi-jwt/index.ts` — new Edge Function for JWT generation
2. `src/components/VideoMeeting.tsx` — call edge function for JWT, update domain/roomName format

### Result
Both tutor and learner will auto-join the same room without seeing the prejoin screen. The JWT authenticates both participants and 8x8 respects the `prejoinPageEnabled: false` config.

