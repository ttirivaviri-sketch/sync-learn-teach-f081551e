const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

function detectPemFormat(pem: string): "pkcs8" | "pkcs1" {
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) return "pkcs1";
  return "pkcs8";
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  let cleaned = normalizePem(pem);
  cleaned = cleaned.replace(/-----BEGIN [A-Za-z0-9 ]+-----/g, "");
  cleaned = cleaned.replace(/-----END [A-Za-z0-9 ]+-----/g, "");
  cleaned = cleaned.replace(/\s+/g, "");
  cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, "");

  if (!cleaned) {
    throw new Error("Private key is empty after parsing. Check JAAS_PRIVATE_KEY secret format.");
  }

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalizedPem = normalizePem(pem);
  const keyData = pemToArrayBuffer(normalizedPem);
  const format = detectPemFormat(normalizedPem);

  if (format === "pkcs8") {
    return crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }

  throw new Error("JAAS_PRIVATE_KEY is in PKCS#1 (RSA PRIVATE KEY) format. Please re-save it as PKCS#8 PEM (BEGIN PRIVATE KEY) in Supabase secrets.");
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  // JaaS requires kid in the format "{APP_ID}/{KEY_ID}"
  const header = { alg: "RS256", typ: "JWT", kid: `${JAAS_APP_ID}/${JAAS_API_KEY_ID}` };
  const headerB64 = base64url(strToUint8(JSON.stringify(header)));
  const payloadB64 = base64url(strToUint8(JSON.stringify(payload)));
  const data = strToUint8(`${headerB64}.${payloadB64}`);

  const key = await importPrivateKey(JAAS_PRIVATE_KEY);
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
