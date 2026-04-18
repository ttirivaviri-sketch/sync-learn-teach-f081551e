
User provided the missing API Key ID. Now I have all 3 values:
- AppID: `vpaas-magic-cookie-59ba8b3500454351b203767fb676f0c3`
- API Key ID: `6d7cc9`
- Private key: provided

The full kid is `vpaas-magic-cookie-.../6d7cc9` — confirms the format the edge function builds (`${APP_ID}/${API_KEY_ID}`) is correct. Just need to update the 3 secrets and redeploy.

## Plan

### 1. Update Supabase secrets (3 values)
- `JAAS_APP_ID` → `vpaas-magic-cookie-59ba8b3500454351b203767fb676f0c3`
- `JAAS_API_KEY_ID` → `6d7cc9`
- `JAAS_PRIVATE_KEY` → full PEM the user provided (including `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines and newlines preserved)

### 2. Redeploy `generate-jitsi-jwt`
Force redeploy so the function picks up the new secrets. No code change needed — current signing logic already matches JaaS spec.

### 3. Test the JWT endpoint
Curl the function and confirm it returns `{ token, appId }` and that the token decodes with the expected header (`kid: vpaas-magic-cookie-.../6d7cc9`) and payload (`sub: vpaas-magic-cookie-...`, `aud: jitsi`, `iss: chat`).

### 4. Validate end-to-end
- Open a booking as tutor → join → no "Authentication failed" dialog, no demo banner.
- Open same booking as learner → both land in same JaaS room.
- Tutor has moderator controls.

### Files
- No code changes required — only secret updates + redeploy.
