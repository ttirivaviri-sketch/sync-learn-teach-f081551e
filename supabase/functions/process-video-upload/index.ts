/**
 * process-video-upload — Video Upload & Copyright-Safe Handling Edge Function
 *
 * Validates original uploads and YouTube embeds; requires tutor ownership
 * confirmation; extracts title/topic/difficulty/duration; tags content;
 * categorizes by subject/topic/level; enforces no storage of copyrighted material.
 *
 * Output: strict JSON { video_id, type, status, title, topic, difficulty,
 *         visibility, embed_url }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAIConfig,
  callAI,
  safeJsonParse,
  jsonResponse,
  errorResponse,
} from "../_shared/ai-config.ts";

// ─── System Prompt (structured, secure, actionable) ───────────────────────────

const VIDEO_SYSTEM_PROMPT = `You are the StudySync Video Content Processor — an AI assistant that validates, classifies, and tags educational video content for the StudySync platform.

ROLE & IDENTITY:
You process video submissions from tutors. You classify content by subject, topic, difficulty, and grade level. You enforce copyright safety and content ownership rules.

CORE RULES — ABSOLUTE REQUIREMENTS:
1. VALIDATE the video source:
   - Original uploads: file must be a valid video format (mp4, webm, mov, avi).
   - YouTube embeds: extract the video ID, validate the URL format, and confirm it is a valid educational embed.
   - Loom/Vimeo links: validate URL format and convert to embed format.
2. REQUIRE TUTOR OWNERSHIP CONFIRMATION:
   - The tutor must confirm they are the original creator of the content or have explicit permission.
   - Set ownership_confirmed flag based on the request.
   - If not confirmed, set status to "pending_confirmation".
3. EXTRACT & CLASSIFY content metadata using AI:
   - Title: extract or use the provided title.
   - Topic: classify into the most relevant academic topic.
   - Subject: match to StudySync curriculum subjects.
   - Difficulty: classify as "beginner", "intermediate", or "advanced".
   - Duration: parse from metadata or estimate.
   - Tags: generate 3-8 relevant educational tags.
   - Grade level: map to curriculum grade levels.
4. COPYRIGHT ENFORCEMENT — CRITICAL:
   - NEVER store or host copyrighted material that the tutor does not own.
   - For YouTube embeds: only embed (iframe), NEVER download or re-host.
   - Reject any content that appears to be commercial educational material (textbook recordings, paid course rips, etc.).
   - Flag suspicious content for manual review.
5. CATEGORIZE by:
   - Subject (Mathematics, Physics, Chemistry, Biology, English, etc.)
   - Topic (specific syllabus topic)
   - Level (O Level, A Level, Grade 10, 11, 12, etc.)
   - Curriculum (ZIMSEC, Cambridge, IEB, NSC, IGCSE)

INPUT: { video_url, title?, description?, subject?, topic?, grade?, curriculum?, ownership_confirmed, tutor_id }
OUTPUT — STRICT JSON (no extra text):
{
  "video_id": "<generated uuid>",
  "type": "original_upload" | "youtube_embed" | "loom_embed" | "vimeo_embed" | "external_link",
  "status": "approved" | "pending_confirmation" | "pending_review" | "rejected",
  "title": "<string>",
  "description": "<string>",
  "topic": "<string>",
  "subject": "<string>",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "grade": "<string>",
  "curriculum": "<string>",
  "duration_estimate": "<string>",
  "tags": ["<string>", ...],
  "visibility": "public" | "unlisted" | "private",
  "embed_url": "<string or null>",
  "original_url": "<string>",
  "ownership_confirmed": <boolean>,
  "copyright_flags": ["<string>", ...],
  "rejection_reason": "<string or null>"
}

SAFETY:
- Stateless: all data is stored in the Supabase database.
- Never expose API keys or internal paths.
- Log all submissions for audit compliance.`;

// ─── Video URL validation & type detection ────────────────────────────────────

interface VideoInfo {
  type: "original_upload" | "youtube_embed" | "loom_embed" | "vimeo_embed" | "external_link";
  embedUrl: string | null;
  videoId: string | null;
}

function detectVideoType(url: string): VideoInfo {
  if (!url || typeof url !== "string") {
    return { type: "external_link", embedUrl: null, videoId: null };
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    // YouTube
    if (host.includes("youtube.com") || host === "youtu.be") {
      let videoId: string | null = null;

      if (host === "youtu.be") {
        videoId = parsed.pathname.split("/").filter(Boolean).pop() || null;
      } else if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2];
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2];
      }

      return {
        type: "youtube_embed",
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
        videoId,
      };
    }

    // Loom
    if (host.includes("loom.com")) {
      const loomId = parsed.pathname.split("/").filter(Boolean).pop();
      return {
        type: "loom_embed",
        embedUrl: loomId ? `https://www.loom.com/embed/${loomId}` : null,
        videoId: loomId || null,
      };
    }

    // Vimeo
    if (host.includes("vimeo.com")) {
      const vimeoId = parsed.pathname.split("/").filter(Boolean).pop();
      return {
        type: "vimeo_embed",
        embedUrl: vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : null,
        videoId: vimeoId || null,
      };
    }

    // Direct file upload (mp4, webm, mov)
    const ext = parsed.pathname.split(".").pop()?.toLowerCase();
    if (ext && ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
      return { type: "original_upload", embedUrl: null, videoId: null };
    }

    return { type: "external_link", embedUrl: null, videoId: null };
  } catch {
    return { type: "external_link", embedUrl: null, videoId: null };
  }
}

// ─── Copyright flag detection ─────────────────────────────────────────────────

function detectCopyrightFlags(
  title: string,
  description: string,
  url: string
): string[] {
  const flags: string[] = [];
  const combined = `${title} ${description} ${url}`.toLowerCase();

  const suspiciousPatterns = [
    { pattern: /textbook/i, flag: "Possibly contains textbook content" },
    { pattern: /full.?course/i, flag: "May be a ripped full course" },
    { pattern: /udemy|coursera|khan.*academy|edx/i, flag: "References commercial education platform" },
    { pattern: /copyright|©|\(c\)/i, flag: "Contains copyright notice" },
    { pattern: /all.?rights.?reserved/i, flag: "Contains rights reservation" },
    { pattern: /paid.?content|premium.?content/i, flag: "References paid/premium content" },
    { pattern: /recording.?of.?class|lecture.?recording/i, flag: "May be unauthorized lecture recording" },
  ];

  for (const { pattern, flag } of suspiciousPatterns) {
    if (pattern.test(combined)) {
      flags.push(flag);
    }
  }

  return flags;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(new Error("Authorization required"), 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(new Error("Invalid authentication"), 401);
    }

    const body = await req.json();
    const {
      video_url,
      title: providedTitle,
      description: providedDescription,
      subject: providedSubject,
      topic: providedTopic,
      grade: providedGrade,
      curriculum: providedCurriculum,
      ownership_confirmed = false,
      tutor_id,
    } = body;

    if (!video_url) {
      return jsonResponse(
        {
          video_id: null,
          type: null,
          status: "rejected",
          title: null,
          topic: null,
          difficulty: null,
          visibility: "private",
          embed_url: null,
          rejection_reason: "Missing required field: video_url",
        },
        400
      );
    }

    const effectiveTutorId = tutor_id || user.id;

    // ── Step 1: Detect video type & generate embed URL ────────────────────────
    const videoInfo = detectVideoType(video_url);

    // ── Step 2: Check copyright flags ─────────────────────────────────────────
    const copyrightFlags = detectCopyrightFlags(
      providedTitle || "",
      providedDescription || "",
      video_url
    );

    const hasCriticalFlags = copyrightFlags.length >= 3;

    // ── Step 3: Determine initial status ──────────────────────────────────────
    let status: "approved" | "pending_confirmation" | "pending_review" | "rejected";
    let rejectionReason: string | null = null;

    if (hasCriticalFlags) {
      status = "rejected";
      rejectionReason = `Content flagged for copyright concerns: ${copyrightFlags.join("; ")}`;
    } else if (!ownership_confirmed) {
      status = "pending_confirmation";
    } else if (copyrightFlags.length > 0) {
      status = "pending_review";
    } else {
      status = "approved";
    }

    // ── Step 4: AI classification (subject, topic, difficulty, tags) ──────────
    let aiClassification = {
      title: providedTitle || "Untitled Tutorial",
      description: providedDescription || "",
      topic: providedTopic || "General",
      subject: providedSubject || "General",
      difficulty: "intermediate" as "beginner" | "intermediate" | "advanced",
      tags: [] as string[],
      duration_estimate: "Unknown",
      grade: providedGrade || "",
      curriculum: providedCurriculum || "ZIMSEC",
    };

    // Use AI to classify if we have enough input data
    if (providedTitle || providedDescription || providedTopic) {
      try {
        const ai = getAIConfig();
        const userPrompt = `Classify this educational video for StudySync:
Title: ${providedTitle || "Not provided"}
Description: ${providedDescription || "Not provided"}
Subject: ${providedSubject || "Not specified"}
Topic: ${providedTopic || "Not specified"}
Grade: ${providedGrade || "Not specified"}
Curriculum: ${providedCurriculum || "Not specified"}
Video URL: ${video_url}
Video Type: ${videoInfo.type}

Respond with ONLY valid JSON:
{
  "title": "<cleaned/improved title>",
  "description": "<brief educational description>",
  "topic": "<specific topic name>",
  "subject": "<subject name from: Mathematics, Physics, Chemistry, Biology, English, History, Geography, Business Studies, Accounting, Computer Science, Economics, Other>",
  "difficulty": "<beginner|intermediate|advanced>",
  "tags": ["tag1", "tag2", ...],
  "duration_estimate": "<estimated duration string>",
  "grade": "<grade level>",
  "curriculum": "<ZIMSEC|CAMB|IEB|NSC|IGCSE|OTHER>"
}`;

        const aiResponse = await callAI(ai, VIDEO_SYSTEM_PROMPT, userPrompt, {
          usage: { userId: user.id, bucket: "misc" },
          temperature: 0.3,
          jsonMode: true,
        });

        const parsed = safeJsonParse<typeof aiClassification>(aiResponse);
        aiClassification = { ...aiClassification, ...parsed };
      } catch (aiErr) {
        console.warn("[video] AI classification failed, using defaults:", aiErr);
      }
    }

    // ── Step 5: Generate video_id and save to database ────────────────────────
    const videoRecord = {
      tutor_id: effectiveTutorId,
      video_url,
      embed_url: videoInfo.embedUrl,
      video_type: videoInfo.type,
      platform_video_id: videoInfo.videoId,
      title: aiClassification.title,
      description: aiClassification.description,
      subject: aiClassification.subject,
      topic: aiClassification.topic,
      difficulty: aiClassification.difficulty,
      grade: aiClassification.grade || null,
      curriculum: aiClassification.curriculum,
      tags: aiClassification.tags,
      duration_estimate: aiClassification.duration_estimate,
      ownership_confirmed,
      copyright_flags: copyrightFlags,
      status,
      rejection_reason: rejectionReason,
      visibility: status === "approved" ? "public" : "private",
    };

    const { data: insertedVideo, error: insertError } = await supabase
      .from("video_content")
      .insert(videoRecord)
      .select("id")
      .single();

    if (insertError) {
      console.error("[video] Insert failed:", insertError);
      throw new Error("Failed to save video content record");
    }

    // ── Step 6: Create audit log ──────────────────────────────────────────────
    await supabase
      .from("video_audit_log")
      .insert({
        video_id: insertedVideo.id,
        tutor_id: effectiveTutorId,
        action: "video_submitted",
        details: {
          video_type: videoInfo.type,
          status,
          copyright_flags: copyrightFlags,
          ownership_confirmed,
          ai_classified: !!(providedTitle || providedDescription || providedTopic),
        },
      })
      .then(
        () => console.log(`[video] Audit logged for video=${insertedVideo.id}`),
        (err) => console.warn("[video] Audit log failed (non-critical):", err)
      );

    console.log(
      `[video] Processed: video=${insertedVideo.id}, type=${videoInfo.type}, status=${status}, subject=${aiClassification.subject}`
    );

    return jsonResponse({
      video_id: insertedVideo.id,
      type: videoInfo.type,
      status,
      title: aiClassification.title,
      description: aiClassification.description,
      topic: aiClassification.topic,
      subject: aiClassification.subject,
      difficulty: aiClassification.difficulty,
      grade: aiClassification.grade,
      curriculum: aiClassification.curriculum,
      duration_estimate: aiClassification.duration_estimate,
      tags: aiClassification.tags,
      visibility: status === "approved" ? "public" : "private",
      embed_url: videoInfo.embedUrl,
      original_url: video_url,
      ownership_confirmed,
      copyright_flags: copyrightFlags,
      rejection_reason: rejectionReason,
    });
  } catch (error) {
    console.error("[video] Error:", error);
    return errorResponse(error);
  }
});
