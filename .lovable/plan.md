
The screenshot confirms public Jitsi works but `meet.jit.si` is demo-only (5-min disconnect). The fix is to use Jitsi as a Service (JaaS) properly. We already have JaaS credentials configured (`JAAS_APP_ID`, `JAAS_PRIVATE_KEY`, `JAAS_API_KEY_ID`) and the `generate-jitsi-jwt` edge function exists — we just need to wire the client back to it and fix the JWT signing issues that blocked us before.

The earlier JaaS attempts failed for two reasons:
1. ASN.1 DER tag error → private key wasn't being parsed correctly (PKCS#8 PEM handling in Deno).
2. "kid does not match sub" error → header `kid` format was wrong.

Both are fixable in the edge function. The correct JaaS JWT spec is well documented.

## Plan

### 1. Fix `supabase/functions/generate-jitsi-jwt/index.ts`
Rewrite JWT generation to match JaaS spec exactly:
- **Header**: `{ alg: "RS256", typ: "JWT", kid: "<APP_ID>/<API_KEY_ID>" }` (kid is appID/keyID, NOT linked to sub).
- **Payload**:
  - `aud: "jitsi"`
  - `iss: "chat"`
  - `sub: <JAAS_APP_ID>` (the vpaas-magic-cookie-... value)
  - `room: "*"` (or specific room)
  - `iat`, `exp` (1 hour)
  - `context.user`: `{ id, name, email, moderator: "true"/"false" }`
  - `context.features`: `{ livestreaming: "false", recording: "false", transcription: "false", "outbound-call": "false" }`
- **Key parsing**: Strip PEM headers/footers and whitespace, base64-decode, import as `pkcs8` with `RSASSA-PKCS1-v1_5` + `SHA-256`. Use `crypto.subtle.importKey` directly — the ASN.1 error came from leftover PEM text in the base64 payload.
- Validate that `JAAS_PRIVATE_KEY` secret contains the full PEM including BEGIN/END lines.

### 2. Update `src/components/VideoMeeting.tsx`
- Call `supabase.functions.invoke("generate-jitsi-jwt", { body: { room, displayName, email, moderator } })` before init.
- Load script from `https://8x8.vc/<APP_ID>/external_api.js` (APP_ID returned by edge function).
- Init `new JitsiMeetExternalAPI("8x8.vc", { roomName: "<APP_ID>/<room>", jwt, ...rest })`.
- Tutor = moderator true, learner = false.
- On JWT failure, show clear error and stay on precall (no fallback to public meet.jit.si — avoids demo banner returning).

### 3. Files
- `supabase/functions/generate-jitsi-jwt/index.ts` — rewrite signing
- `src/components/VideoMeeting.tsx` — switch back to JaaS init
- No DB or config changes needed (secrets already set)

### 4. Validation
- Confirm no "demo / 5-minute" banner appears.
- Confirm both learner and tutor join the same JaaS room.
- Confirm tutor has moderator controls.
- Verify mobile join still works (pointer-events fix preserved).
