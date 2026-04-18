/**
 * parse-document Edge Function (v3)
 *
 * Parses uploaded documents (syllabus, past papers, notes) and extracts
 * structured concepts for use in AI content generation.
 *
 * v3 changes:
 *   - Accepts pre-extracted text and optional chunks[] from the client
 *     (PDFs are now extracted with pdfjs in the browser, not raw bytes)
 *   - Multi-pass extraction with deep-merge for large syllabi
 *   - Captures exam-board metadata: command words, assessment objectives,
 *     paper structure, practical skills, mathematical requirements
 *   - Persists exam_board_meta on the subjects row so the AI tutor can
 *     teach with proper exam strategy
 *
 * POST body:
 * {
 *   documentId: string,
 *   content: string,                       // full extracted text
 *   chunks?: string[],                     // optional pre-split chunks
 *   totalChunks?: number,
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
    description:
      "Extract the COMPLETE structured syllabus, including all topics AND exam-board metadata (command words, assessment objectives, paper structure, practical skills, mathematical requirements).",
    parameters: {
      type: "object",
      properties: {
        subject_name: { type: "string" },
        syllabus_code: { type: "string" },
        exam_board: { type: "string", description: "e.g. Cambridge, AQA, ZIMSEC, Edexcel" },
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "syllabus section number, e.g. '1', '2.3'" },
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
        command_words: {
          type: "array",
          description:
            "Every command word defined in the syllabus (state, describe, explain, suggest, calculate, compare, etc.) with its examiner-defined meaning.",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              definition: { type: "string" },
            },
            required: ["word", "definition"],
          },
        },
        assessment_objectives: {
          type: "array",
          description: "AO1, AO2, AO3 etc. with description and percentage weight if given.",
          items: {
            type: "object",
            properties: {
              code: { type: "string", description: "e.g. AO1" },
              name: { type: "string" },
              description: { type: "string" },
              weight_percent: { type: "number" },
            },
            required: ["code", "description"],
          },
        },
        paper_structure: {
          type: "array",
          description: "Each paper in the assessment: name, duration, marks, type, weight.",
          items: {
            type: "object",
            properties: {
              paper: { type: "string", description: "e.g. Paper 1, Paper 2" },
              name: { type: "string" },
              duration_minutes: { type: "number" },
              total_marks: { type: "number" },
              question_types: { type: "array", items: { type: "string" } },
              weight_percent: { type: "number" },
            },
            required: ["paper"],
          },
        },
        practical_skills: {
          type: "array",
          items: { type: "string" },
          description: "Practical/lab skills assessed (if any).",
        },
        mathematical_requirements: {
          type: "array",
          items: { type: "string" },
          description: "Maths skills students must use (if listed).",
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
    name: "extract_mark_scheme",
    description:
      "Extract a structured mark scheme: paper identifiers + per-question model answers, marking points, command words and topics. This will be linked back to its matching past paper so each question carries its official answer.",
    parameters: {
      type: "object",
      properties: {
        paper_year: { type: "string", description: "e.g. '2025'" },
        paper_variant: { type: "string", description: "e.g. '22', '42'" },
        paper_code: {
          type: "string",
          description: "e.g. 'Paper 2', 'Paper 4', 'P2', 'P4'",
        },
        topics_covered: { type: "array", items: { type: "string" } },
        answers: {
          type: "array",
          description:
            "One entry per question. Include sub-parts (e.g. 1(a), 1(b)(i)) as separate entries.",
          items: {
            type: "object",
            properties: {
              question_number: { type: "string" },
              topic: { type: "string" },
              command_word: { type: "string" },
              marks: { type: "number" },
              model_answer: { type: "string" },
              marking_points: {
                type: "array",
                items: { type: "string" },
                description: "Mark-by-mark scheme points (e.g. '1 mark for ...').",
              },
              accept: { type: "array", items: { type: "string" } },
              reject: { type: "array", items: { type: "string" } },
            },
            required: ["question_number", "model_answer", "marks"],
          },
        },
        common_mistakes: { type: "array", items: { type: "string" } },
      },
      required: ["answers"],
    },
  },
};

// ─── Syllabus chunk merging ─────────────────────────────────────────────────

function mergeSyllabus(into: any, from: any): any {
  if (!into || Object.keys(into).length === 0) return from;
  if (!from) return into;

  const out: any = { ...into };

  // Scalars: prefer non-empty values from `into`, fall back to `from`
  for (const k of ["subject_name", "syllabus_code", "exam_board"]) {
    if (!out[k] && from[k]) out[k] = from[k];
  }

  // Topics: union by id (or by lowercase name as fallback)
  const topicMap = new Map<string, any>();
  for (const t of (out.topics || [])) {
    const key = String(t.id || t.name || "").toLowerCase();
    if (key) topicMap.set(key, t);
  }
  for (const t of (from.topics || [])) {
    const key = String(t.id || t.name || "").toLowerCase();
    if (!key) continue;
    const existing = topicMap.get(key);
    if (!existing) {
      topicMap.set(key, t);
    } else {
      topicMap.set(key, {
        ...existing,
        subtopics: Array.from(new Set([...(existing.subtopics || []), ...(t.subtopics || [])])),
        learningObjectives: Array.from(
          new Set([...(existing.learningObjectives || []), ...(t.learningObjectives || [])])
        ),
        concepts: Array.from(new Set([...(existing.concepts || []), ...(t.concepts || [])])),
        prerequisites: Array.from(
          new Set([...(existing.prerequisites || []), ...(t.prerequisites || [])])
        ),
        examWeight: existing.examWeight || t.examWeight || 0,
      });
    }
  }
  out.topics = Array.from(topicMap.values());

  // Arrays of objects keyed by a primary field — union
  const unionBy = (a: any[], b: any[], keyField: string) => {
    const m = new Map<string, any>();
    for (const x of [...(a || []), ...(b || [])]) {
      const k = String(x?.[keyField] || "").toLowerCase();
      if (!k) continue;
      if (!m.has(k)) m.set(k, x);
    }
    return Array.from(m.values());
  };

  out.command_words = unionBy(out.command_words, from.command_words, "word");
  out.assessment_objectives = unionBy(out.assessment_objectives, from.assessment_objectives, "code");
  out.paper_structure = unionBy(out.paper_structure, from.paper_structure, "paper");

  // Plain string arrays — union
  const unionStr = (a: string[], b: string[]) =>
    Array.from(new Set([...(a || []), ...(b || [])]));
  out.practical_skills = unionStr(out.practical_skills, from.practical_skills);
  out.mathematical_requirements = unionStr(
    out.mathematical_requirements,
    from.mathematical_requirements
  );

  return out;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      documentId,
      content,
      chunks: clientChunks,
      documentType,
      subject,
    } = await req.json();

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

You are an expert exam-board curriculum analyst. You are given the FULL TEXT of an official syllabus PDF (e.g. Cambridge IGCSE / O-Level / A-Level / ZIMSEC / AQA / Edexcel).

Your job is to extract a COMPLETE, EXAM-BOARD-AWARE structured syllabus. Walk through the document section by section. Do not skip anything.

EXTRACTION CHECKLIST — you MUST fill every applicable field:

1. SUBJECT CONTENT (topics)
   - Find the section commonly titled "Subject content", "Syllabus content", "Course content" or similar.
   - Extract EVERY numbered topic (e.g. "1 Characteristics and classification of living organisms", "2 Cells", … "21 Human influences on ecosystems"). Missing topics is the #1 failure mode — re-check the document for any numbered section you may have skipped.
   - For each topic capture: id (the section number as a string), name, subtopics (the numbered sub-sections like 1.1, 1.2), learningObjectives (the bullet-pointed "candidates should be able to…" statements — verbatim if possible), key concepts, prerequisites if cross-referenced.

2. ASSESSMENT OVERVIEW (paper_structure)
   - Find the "Assessment overview" or "Scheme of assessment" table.
   - For each paper extract: paper code/number, name, duration in minutes, total marks, question types (multiple choice, structured, free response, practical, etc.), and weight percent of the qualification.

3. ASSESSMENT OBJECTIVES (assessment_objectives)
   - Extract AO1, AO2, AO3 (etc.) with their official descriptions and percentage weights.

4. COMMAND WORDS (command_words)
   - Find the "Command words" appendix (usually near the end).
   - Extract EVERY command word with the examiner-defined meaning. These are the words students must respond to correctly to earn marks.

5. PRACTICAL SKILLS & MATHEMATICAL REQUIREMENTS
   - If the syllabus lists practical skills assessed (e.g. ATPs) or mathematical requirements, extract them as plain strings.

6. METADATA
   - subject_name (e.g. "Biology"), syllabus_code (e.g. "0610"), exam_board (e.g. "Cambridge").

Do NOT invent content. If a section is not present, return an empty array for it. Do NOT summarise or paraphrase learning objectives — keep them faithful to the syllabus.`;
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

    // ── Determine chunks to process ───────────────────────────────────────
    // For syllabus: multi-pass merge across chunks for completeness.
    // For other types: single pass on the full content (capped) is enough.
    let chunks: string[];
    if (documentType === "syllabus") {
      if (Array.isArray(clientChunks) && clientChunks.length > 0) {
        chunks = clientChunks.slice(0, 4);
      } else {
        // server-side fallback chunking
        const txt = String(content);
        if (txt.length <= 80_000) chunks = [txt];
        else {
          chunks = [];
          for (let i = 0; i < Math.min(txt.length, 320_000); i += 80_000) {
            chunks.push(txt.slice(i, i + 80_000));
          }
        }
      }
    } else {
      chunks = [String(content).slice(0, 120_000)];
    }

    // ── Call AI per chunk and merge ───────────────────────────────────────
    let parsedContent: any = null;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkLabel =
        chunks.length > 1
          ? `(Chunk ${i + 1} of ${chunks.length} — extract everything you can find in THIS portion. Other chunks are processed separately and will be merged.)\n\n`
          : "";
      const userMsg = `Subject: ${subject || "Unknown"}\n\n${chunkLabel}Document content:\n${chunk}`;

      try {
        const rawResult = await callAI(ai, systemPrompt, userMsg, {
          tools: [toolDef],
          toolChoice: { type: "function", function: { name: toolDef.function.name } },
        });
        const parsed = safeJsonParse<any>(rawResult);
        if (documentType === "syllabus") {
          parsedContent = mergeSyllabus(parsedContent, parsed);
        } else {
          parsedContent = parsed;
        }
      } catch (chunkErr) {
        console.warn(`parse-document chunk ${i + 1} failed:`, chunkErr);
      }
    }

    if (!parsedContent) {
      return errorResponse("Failed to parse document content");
    }

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

      const examBoardMeta = {
        exam_board: parsedContent.exam_board || null,
        command_words: parsedContent.command_words || [],
        assessment_objectives: parsedContent.assessment_objectives || [],
        paper_structure: parsedContent.paper_structure || [],
        practical_skills: parsedContent.practical_skills || [],
        mathematical_requirements: parsedContent.mathematical_requirements || [],
      };

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
              exam_board_meta: examBoardMeta,
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
                  is_locked: topic.id !== "topic-1" && topic.id !== "1",
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
              exam_board_meta: examBoardMeta,
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
                is_locked: topic.id !== "topic-1" && topic.id !== "1",
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
