const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JAAS_APP_ID = (Deno.env.get("JAAS_APP_ID") || "").trim();
const RAW_JAAS_API_KEY_ID = (Deno.env.get("JAAS_API_KEY_ID") || "").trim();
// Accept either the bare key id ("6d7cc9") or the full kid ("appId/6d7cc9")
const JAAS_API_KEY_ID = RAW_JAAS_API_KEY_ID.includes("/")
  ? RAW_JAAS_API_KEY_ID.split("/").pop()!.trim()
  : RAW_JAAS_API_KEY_ID;
const JAAS_PRIVATE_KEY = Deno.env.get("JAAS_PRIVATE_KEY") || "";

function base64urlFromBytes(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlFromString(s: string): string {
  return base64urlFromBytes(new TextEncoder().encode(s));
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  // Normalize escaped newlines and trim
  let p = pem.replace(/\\n/g, "\n").trim();
  // Strip ALL PEM header/footer lines and any whitespace
  p = p.replace(/-----BEGIN[^-]+-----/g, "");
  p = p.replace(/-----END[^-]+-----/g, "");
  p = p.replace(/\s+/g, "");
  // Keep only valid base64 chars
  p = p.replace(/[^A-Za-z0-9+/=]/g, "");
  if (!p) throw new Error("JAAS_PRIVATE_KEY is empty after normalization");
  const bin = atob(p);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) {
    throw new Error("JAAS_PRIVATE_KEY is PKCS#1 (BEGIN RSA PRIVATE KEY). Convert to PKCS#8 (BEGIN PRIVATE KEY) and re-save the secret.");
  }
  const keyBytes = pemToPkcs8Bytes(pem);
  return await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signJaasJwt(opts: { room: string; userName: string; userEmail: string; moderator: boolean; userId: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: `${JAAS_APP_ID}/${JAAS_API_KEY_ID}`,
  };
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: JAAS_APP_ID,
    room: opts.room || "*",
    iat: now,
    nbf: now - 10,
    exp: now + 60 * 60 * 2,
    context: {
      user: {
        id: opts.userId,
        name: opts.userName || "Participant",
        email: opts.userEmail || "",
        moderator: opts.moderator ? "true" : "false",
        avatar: "",
      },
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false",
        "sip-outbound-call": "false",
      },
    },
  };

  const headerB64 = base64urlFromString(JSON.stringify(header));
  const payloadB64 = base64urlFromString(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importPrivateKey(JAAS_PRIVATE_KEY);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const sigB64 = base64urlFromBytes(new Uint8Array(sigBuf));
  return `${signingInput}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!JAAS_APP_ID || !JAAS_API_KEY_ID || !JAAS_PRIVATE_KEY) {
      throw new Error("JaaS credentials not configured (JAAS_APP_ID / JAAS_API_KEY_ID / JAAS_PRIVATE_KEY)");
    }

    // ── AUTH: require valid Supabase JWT; identity & moderator role are
    // derived server-side from the booking, NOT taken from the request body.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const room: string = body.room || body.roomName || "";
    if (!room) {
      return new Response(JSON.stringify({ error: "room is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller participates in the booking matching `room` and derive
    // moderator status (tutor = moderator).
    const { data: booking } = await supabase
      .from("bookings")
      .select("tutor_id, learner_id")
      .eq("room_name", room)
      .maybeSingle();
    if (!booking || (booking.tutor_id !== user.id && booking.learner_id !== user.id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identity comes from the verified user, never the request body.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const userName: string = profile?.full_name || user.email || "Participant";
    const userEmail: string = profile?.email || user.email || "";
    const moderator: boolean = booking.tutor_id === user.id;
    const userId: string = user.id;

    const token = await signJaasJwt({ room, userName, userEmail, moderator, userId });

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
