/**
 * parse-document Edge Function (v2)
 *
 * Parses uploaded documents (syllabus, past papers, notes) and extracts
 * structured concepts for use in AI content generation.
 *
 * Now also handles:
 *   - "notes" type: extracts key concepts and creates aligned questions
 *   - Better error handling and structured output
 *
 * POST body:
 * {
 *   documentId: string,
 *   content: string,
 *   documentType: "syllabus" | "past_paper" | "notes" | "mark_scheme",
 *   subject?: string
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  safeJsonParse,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";

// ─── Subject icon mapping ────────────────────────────────────────────────────

function getSubjectVisuals(
  subjectName: string
): { icon_emoji: string; icon_gradient: string } {
  const key = subjectName.trim().toLowerCase();
  const map: Record<string, { icon_emoji: string; icon_gradient: string }> = {
    mathematics: { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    maths: { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    math: { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    physics: { icon_emoji: "⚛️", icon_gradient: "from-blue-500 to-indigo-600" },
    chemistry: { icon_emoji: "🧪", icon_gradient: "from-green-500 to-emerald-600" },
    biology: { icon_emoji: "🧬", icon_gradient: "from-pink-500 to-rose-600" },
    english: { icon_emoji: "📖", icon_gradient: "from-orange-500 to-amber-600" },
    "english language": { icon_emoji: "📖", icon_gradient: "from-orange-500 to-amber-600" },
    literature: { icon_emoji: "🪶", icon_gradient: "from-red-500 to-rose-600" },
    geography: { icon_emoji: "🌍", icon_gradient: "from-lime-500 to-green-600" },
    history: { icon_emoji: "🏛️", icon_gradient: "from-stone-500 to-amber-700" },
    "computer science": { icon_emoji: "💻", icon_gradient: "from-cyan-500 to-sky-600" },
    ict: { icon_emoji: "💻", icon_gradient: "from-cyan-500 to-sky-600" },
    economics: { icon_emoji: "📢", icon_gradient: "from-teal-500 to-cyan-600" },
    accounting: { icon_emoji: "🧮", icon_gradient: "from-blue-500 to-indigo-600" },
    "business studies": { icon_emoji: "💼", icon_gradient: "from-teal-500 to-cyan-600" },
    agriculture: { icon_emoji: "🚜", icon_gradient: "from-green-500 to-lime-600" },
    "foreign languages": { icon_emoji: "🗣️", icon_gradient: "from-yellow-500 to-amber-600" },
    "design & technology": { icon_emoji: "🛠️", icon_gradient: "from-purple-500 to-indigo-600" },
    sociology: { icon_emoji: "👥", icon_gradient: "from-fuchsia-500 to-pink-600" },
    psychology: { icon_emoji: "🧠", icon_gradient: "from-violet-500 to-purple-700" },
    "religious studies": { icon_emoji: "✝️", icon_gradient: "from-yellow-500 to-amber-600" },
    law: { icon_emoji: "⚖️", icon_gradient: "from-slate-500 to-gray-700" },
    music: { icon_emoji: "🎵", icon_gradient: "from-indigo-500 to-violet-600" },
    health: { icon_emoji: "🩺", icon_gradient: "from-cyan-400 to-teal-500" },
    "environmental science": { icon_emoji: "🌱", icon_gradient: "from-emerald-400 to-teal-500" },
    "physical education": { icon_emoji: "⚽", icon_gradient: "from-green-500 to-lime-600" },
    art: { icon_emoji: "🎨", icon_gradient: "from-yellow-500 to-amber-600" },
  };
  return map[key] || { icon_emoji: "📚", icon_gradient: "from-gray-500 to-slate-600" };
}

// ─── Tool definitions for structured extraction ──────────────────────────────

const SYLLABUS_TOOL = {
  type: "function",
  function: {
    name: "extract_syllabus",
    description: "Extract structured syllabus data from a document",
    parameters: {
      type: "object",
      properties: {
        subject_name: { type: "string" },
        syllabus_code: { type: "string" },
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              subtopics: { type: "array", items: { type: "string" } },
              learningObjectives: { type: "array", items: { type: "string" } },
              examWeight: { type: "number" },
              prerequisites: { type: "array", items: { type: "string" } },
              concepts: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "subtopics", "learningObjectives"],
          },
        },
      },
      required: ["subject_name", "topics"],
    },
  },
};

const PAST_PAPER_TOOL = {
  type: "function",
  function: {
    name: "extract_exam_patterns",
    description: "Extract exam patterns from a past paper",
    parameters: {
      type: "object",
      properties: {
        paper_year: { type: "string" },
        paper_variant: { type: "string" },
        total_marks: { type: "number" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_number: { type: "string" },
              topic: { type: "string" },
              subtopic: { type: "string" },
              marks: { type: "number" },
              question_type: { type: "string" },
              difficulty: { type: "string" },
              command_words: { type: "array", items: { type: "string" } },
              concepts_tested: { type: "array", items: { type: "string" } },
            },
            required: ["question_number", "topic", "marks", "question_type", "difficulty"],
          },
        },
        topic_frequency: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              total_marks: { type: "number" },
              question_count: { type: "number" },
              percentage_of_paper: { type: "number" },
            },
            required: ["topic", "total_marks", "question_count", "percentage_of_paper"],
          },
        },
      },
      required: ["questions", "topic_frequency"],
    },
  },
};

const NOTES_TOOL = {
  type: "function",
  function: {
    name: "extract_notes_concepts",
    description: "Extract concepts from student notes and create aligned questions",
    parameters: {
      type: "object",
      properties: {
        topics_covered: { type: "array", items: { type: "string" } },
        key_concepts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              concept: { type: "string" },
              definition: { type: "string" },
              topic: { type: "string" },
              importance: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["concept", "definition", "topic"],
          },
        },
        formulas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              formula: { type: "string" },
              description: { type: "string" },
              topic: { type: "string" },
            },
            required: ["formula", "description"],
          },
        },
        aligned_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              concept: { type: "string" },
              difficulty: { type: "string" },
              marks: { type: "number" },
            },
            required: ["question", "answer", "concept"],
          },
        },
        summary: { type: "string" },
      },
      required: ["topics_covered", "key_concepts", "aligned_questions"],
    },
  },
};

const MARK_SCHEME_TOOL = {
  type: "function",
  function: {
    name: "extract_document_info",
    description: "Extract key information from a mark scheme or study document",
    parameters: {
      type: "object",
      properties: {
        topics_covered: { type: "array", items: { type: "string" } },
        key_points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              points: { type: "array", items: { type: "string" } },
              common_mistakes: { type: "array", items: { type: "string" } },
            },
            required: ["topic", "points"],
          },
        },
      },
      required: ["topics_covered", "key_points"],
    },
  },
};

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { documentId, content, documentType, subject } = await req.json();

    if (!documentId || !content) {
      return jsonResponse(
        { error: "documentId and content are required" },
        400
      );
    }

    // ── Select prompt and tool based on document type ────────────────────
    let systemPrompt: string;
    let toolDef: any;

    switch (documentType) {
      case "syllabus":
        systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are an expert curriculum analyst. Extract the COMPLETE syllabus structure from the provided document.

Rules:
- Extract ALL topics, subtopics, learning objectives, and curriculum structure.
- Create a hierarchical map: Subject → Topic → Subtopic → Concepts → Learning outcomes.
- Identify exam weight hints if mentioned.
- Identify prerequisites between topics.
- Be thorough — every topic in the syllabus must be captured.`;
        toolDef = SYLLABUS_TOOL;
        break;

      case "past_paper":
        systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are an expert exam pattern analyst. Analyze this past exam paper to extract question patterns, topic coverage, mark allocation, and difficulty levels.

Rules:
- Identify every question and map it to a topic.
- Note mark allocation for each question.
- Identify question types (multiple choice, structured, essay, calculation, etc.).
- Detect difficulty level (easy, medium, hard).
- Look for recurring patterns and examiner preferences.
- Note command words used (explain, describe, calculate, evaluate, etc.).`;
        toolDef = PAST_PAPER_TOOL;
        break;

      case "notes":
        systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are an expert study material analyst. Parse these student notes/uploaded documents to:

1. Identify all key concepts, definitions, and formulas.
2. Map concepts to likely exam topics.
3. Create aligned exam-style questions based on the content.
4. Rate concept importance (high/medium/low) based on typical exam relevance.
5. Generate 5-10 practice questions with answers from the material.

Be thorough — extract every testable concept.`;
        toolDef = NOTES_TOOL;
        break;

      default: // mark_scheme and others
        systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are an expert exam analyst. Extract key information from this mark scheme or study document. Identify topics, key points, marking criteria, and common mistakes.`;
        toolDef = MARK_SCHEME_TOOL;
        break;
    }

    // ── Call AI ──────────────────────────────────────────────────────────────
    const rawResult = await callAI(
      ai,
      systemPrompt,
      `Subject: ${subject || "Unknown"}\n\nDocument content:\n${content}`,
      {
        tools: [toolDef],
        toolChoice: {
          type: "function",
          function: { name: toolDef.function.name },
        },
      }
    );

    const parsedContent = safeJsonParse<any>(rawResult);

    // ── Update document as processed ────────────────────────────────────
    await supabase
      .from("documents")
      .update({
        is_processed: true,
        parsed_content: parsedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // ── Handle syllabus: create/update subjects ─────────────────────────
    if (documentType === "syllabus") {
      const subjectName = parsedContent.subject_name || subject;
      const visuals = getSubjectVisuals(subjectName);

      const { data: docOwner } = await supabase
        .from("documents")
        .select("user_id")
        .eq("id", documentId)
        .single();

      if (docOwner) {
        const userId = docOwner.user_id;

        const { data: existingSub } = await supabase
          .from("subjects")
          .select("id")
          .eq("user_id", userId)
          .ilike("name", subjectName)
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from("subjects")
            .update({
              topics: parsedContent.topics,
              syllabus_code: parsedContent.syllabus_code || null,
              icon_emoji: visuals.icon_emoji,
              icon_gradient: visuals.icon_gradient,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id);

          for (const topic of parsedContent.topics || []) {
            await supabase
              .from("topic_mastery")
              .upsert(
                {
                  user_id: userId,
                  subject_id: existingSub.id,
                  topic_name: topic.name,
                  mastery_percentage: 0,
                  is_locked: topic.id !== "topic-1",
                },
                { onConflict: "user_id,subject_id,topic_name" }
              );
          }
        } else {
          const { data: newSubject } = await supabase
            .from("subjects")
            .insert({
              user_id: userId,
              name: subjectName,
              syllabus_code: parsedContent.syllabus_code || null,
              topics: parsedContent.topics,
              icon_emoji: visuals.icon_emoji,
              icon_gradient: visuals.icon_gradient,
            })
            .select("id")
            .single();

          if (newSubject) {
            for (const topic of parsedContent.topics || []) {
              await supabase.from("topic_mastery").insert({
                user_id: userId,
                subject_id: newSubject.id,
                topic_name: topic.name,
                mastery_percentage: 0,
                is_locked: topic.id !== "topic-1",
              });
            }
          }
        }
      }
    }

    // ── Handle past paper: store exam patterns ──────────────────────────
    if (documentType === "past_paper" && parsedContent.topic_frequency) {
      const { data: doc } = await supabase
        .from("documents")
        .select("user_id")
        .eq("id", documentId)
        .single();

      if (doc) {
        const { data: matchingSubject } = await supabase
          .from("subjects")
          .select("id")
          .eq("user_id", doc.user_id)
          .ilike("name", `%${subject}%`)
          .maybeSingle();

        if (matchingSubject) {
          for (const tf of parsedContent.topic_frequency) {
            await supabase.from("exam_patterns").insert({
              user_id: doc.user_id,
              subject_id: matchingSubject.id,
              document_id: documentId,
              topic_name: tf.topic,
              frequency_score: tf.percentage_of_paper,
              avg_marks: tf.total_marks,
              question_types:
                parsedContent.questions
                  ?.filter((q: any) => q.topic === tf.topic)
                  ?.map((q: any) => q.question_type) || [],
              year: parsedContent.paper_year || null,
            });
          }

          // Update subject exam weights
          const { data: allPatterns } = await supabase
            .from("exam_patterns")
            .select("topic_name, frequency_score")
            .eq("subject_id", matchingSubject.id);

          if (allPatterns) {
            const topicScores: Record<string, number[]> = {};
            for (const p of allPatterns) {
              if (!topicScores[p.topic_name]) topicScores[p.topic_name] = [];
              topicScores[p.topic_name].push(Number(p.frequency_score));
            }

            const examPatternsAgg: Record<string, number> = {};
            for (const [topic, scores] of Object.entries(topicScores)) {
              examPatternsAgg[topic] = Math.round(
                scores.reduce((a, b) => a + b, 0) / scores.length
              );
            }

            await supabase
              .from("subjects")
              .update({ exam_patterns: examPatternsAgg })
              .eq("id", matchingSubject.id);

            const { data: subjectData } = await supabase
              .from("subjects")
              .select("topics")
              .eq("id", matchingSubject.id)
              .single();

            if (subjectData?.topics) {
              const topics = subjectData.topics as any[];
              const updatedTopics = topics.map((t: any) => ({
                ...t,
                examWeight: examPatternsAgg[t.name] ?? t.examWeight ?? 0,
              }));

              await supabase
                .from("subjects")
                .update({ topics: updatedTopics })
                .eq("id", matchingSubject.id);
            }
          }
        }
      }
    }

    return jsonResponse({ success: true, parsed: parsedContent });
  } catch (e) {
    console.error("parse-document error:", e);
    return errorResponse(e);
  }
});
