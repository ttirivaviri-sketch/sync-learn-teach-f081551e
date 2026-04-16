import { corsHeaders } from '@supabase/supabase-js/cors'

const JAAS_APP_ID = Deno.env.get("JAAS_APP_ID") || "";
const JAAS_API_KEY_ID = Deno.env.get("JAAS_API_KEY_ID") || "";
const JAAS_PRIVATE_KEY = Deno.env.get("JAAS_PRIVATE_KEY") || "";

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function strToUint8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN .*-----/, "")
    .replace(/-----END .*-----/, "")
    .replace(/\s/g, "");
  const binary = atob(lines);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "RS256", typ: "JWT", kid: JAAS_API_KEY_ID };
  const headerB64 = base64url(strToUint8(JSON.stringify(header)));
  const payloadB64 = base64url(strToUint8(JSON.stringify(payload)));
  const data = strToUint8(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(JAAS_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data));
  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!JAAS_APP_ID || !JAAS_API_KEY_ID || !JAAS_PRIVATE_KEY) {
      throw new Error("JaaS credentials not configured");
    }

    const { roomName, userName, userEmail, isModerator } = await req.json();

    if (!roomName) throw new Error("roomName is required");

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: "chat",
      aud: "jitsi",
      sub: JAAS_APP_ID,
      room: "*",
      exp: now + 3600,
      nbf: now - 10,
      context: {
        user: {
          moderator: isModerator ? "true" : "false",
          name: userName || "Participant",
          email: userEmail || "",
          id: crypto.randomUUID(),
        },
        features: {
          livestreaming: "false",
          "outbound-call": "false",
          "sip-outbound-call": "false",
          transcription: "false",
          recording: "false",
        },
      },
    };

    const token = await signJwt(payload);

    return new Response(JSON.stringify({ token, appId: JAAS_APP_ID }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-jitsi-jwt] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
