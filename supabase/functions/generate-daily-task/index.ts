// generate-daily-task: Syllabus-grounded structured daily task generator.
// Returns a single bundle with 4 mandatory blocks, syllabus-locked, coverage-validated.

import { buildProvenance, hashPrompt, attachMeta } from '../_shared/provenance.ts';
import { getUserIdFromRequest, reportTokenUsage, type UsageAttribution } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

type Difficulty = 'easy' | 'medium' | 'hard';
type QType = 'mcq' | 'short' | 'structured';

interface PracticeQuestion {
  question: string;
  concept: string;
  difficulty: Difficulty;
  type: QType;
  answer: string;
  marks: number;
}

interface ExamQuestion {
  question: string;
  concepts: string[];
  marks: number;
  expected_steps: string[];
}

interface FlashcardItem {
  front: string;
  back: string;
  concept?: string;
  hint?: string;
}

interface TaskBundle {
  topic: string;
  subtopic: string;
  concepts: string[];
  blocks: {
    concept_learning: string;
    quick_review: string;
    practice_questions: PracticeQuestion[];
    exam_question: ExamQuestion;
    flashcards: FlashcardItem[];
  };
}

interface RequestBody {
  subject: string;
  curriculum?: string;
  topic: string;
  subtopics?: string[];
  available_concepts?: string[];
  concept_mastery?: Record<string, number>;
  completed_concepts?: string[];
  past_paper_patterns?: Array<Record<string, unknown>>;
  weak_concepts?: string[];
}

const TASK_TOOL = {
  type: 'function',
  function: {
    name: 'emit_daily_task',
    description: 'Emit a structured, syllabus-grounded daily task bundle.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topic: { type: 'string' },
        subtopic: { type: 'string' },
        concepts: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
        blocks: {
          type: 'object',
          additionalProperties: false,
          properties: {
            concept_learning: { type: 'string', description: 'Markdown explanation + step-by-step example, focused only on selected concepts.' },
            quick_review: { type: 'string', description: 'Bullet list (markdown): key rules, formulas, common mistakes.' },
            practice_questions: {
              type: 'array',
              minItems: 3,
              maxItems: 8,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  question: { type: 'string' },
                  concept: { type: 'string' },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                  type: { type: 'string', enum: ['mcq', 'short', 'structured'] },
                  answer: { type: 'string' },
                  marks: { type: 'integer', minimum: 1, maximum: 10 },
                },
                required: ['question', 'concept', 'difficulty', 'type', 'answer', 'marks'],
              },
            },
            exam_question: {
              type: 'object',
              additionalProperties: false,
              properties: {
                question: { type: 'string' },
                concepts: { type: 'array', items: { type: 'string' }, minItems: 2 },
                marks: { type: 'integer', minimum: 4, maximum: 20 },
                expected_steps: { type: 'array', items: { type: 'string' }, minItems: 2 },
              },
              required: ['question', 'concepts', 'marks', 'expected_steps'],
            },
            flashcards: {
              type: 'array',
              minItems: 4,
              maxItems: 6,
              description: 'Self-testable atomic recall cards covering the SELECTED CONCEPTS. Front = a question/cue, back = a concise answer.',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  front: { type: 'string' },
                  back: { type: 'string' },
                  concept: { type: 'string' },
                  hint: { type: 'string' },
                },
                required: ['front', 'back', 'concept'],
              },
            },
          },
          required: ['concept_learning', 'quick_review', 'practice_questions', 'exam_question', 'flashcards'],
        },
      },
      required: ['topic', 'subtopic', 'concepts', 'blocks'],
    },
  },
};

function selectTargets(body: RequestBody): {
  selected: string[];
  reason: 'uncovered' | 'weak' | 'syllabus-order';
} {
  const available = (body.available_concepts ?? []).filter(Boolean);
  const completed = new Set((body.completed_concepts ?? []).map((c) => c.toLowerCase()));
  const mastery = body.concept_mastery ?? {};
  const weak = new Set((body.weak_concepts ?? []).map((c) => c.toLowerCase()));

  // 1. Uncovered concepts win
  const uncovered = available.filter((c) => !completed.has(c.toLowerCase()));
  if (uncovered.length > 0) {
    return { selected: uncovered.slice(0, 5), reason: 'uncovered' };
  }

  // 2. Weak concepts (lowest mastery first)
  const weakList = available
    .filter((c) => weak.has(c.toLowerCase()) || (mastery[c] ?? 100) < 60)
    .sort((a, b) => (mastery[a] ?? 100) - (mastery[b] ?? 100));
  if (weakList.length > 0) {
    return { selected: weakList.slice(0, 5), reason: 'weak' };
  }

  // 3. Syllabus order fallback (subtopics)
  const fallback = available.length > 0 ? available.slice(0, 5) : (body.subtopics ?? []).slice(0, 5);
  return { selected: fallback, reason: 'syllabus-order' };
}

function buildSystemPrompt(): string {
  return `You are an AI Daily Task Generator for a syllabus-based learning platform.

CORE RULES (NON-NEGOTIABLE):
- The provided syllabus is the ONLY source of truth.
- Do NOT invent topics, subtopics, or concepts outside the provided list.
- Do NOT skip any of the selected concepts — every selected concept MUST appear in at least one practice question's "concept" field.
- Do NOT merge unrelated topics.
- Do NOT over-explain theory; keep concept_learning focused on the selected concepts only.
- Use exam wording, realistic phrasing, and proper command words.

OUTPUT RULES:
- Practice questions MUST cover EVERY selected concept (≥1 question per concept).
- Practice questions MUST include AT LEAST 2 distinct difficulty levels.
- Exam question MUST combine ≥2 of the selected concepts and be multi-step.
- expected_steps MUST be the actual mark-scheme steps a student should show.
- Answers must be concise but complete.

You MUST call the emit_daily_task tool. Do not return free text.`;
}

function buildUserPrompt(body: RequestBody, selected: string[], reason: string): string {
  return `Generate a structured daily task.

Subject: ${body.subject}
Curriculum: ${body.curriculum ?? 'ZIMSEC'}
Topic: ${body.topic}
Available subtopics: ${(body.subtopics ?? []).join(' | ') || '(none provided — use topic only)'}
Available concepts in syllabus: ${(body.available_concepts ?? []).join(' | ') || '(infer from topic/subtopics, but stay within them)'}

Selection reason: ${reason}
SELECTED CONCEPTS (MUST cover all of these): ${selected.join(' | ')}

Mastery snapshot (lower = weaker): ${JSON.stringify(body.concept_mastery ?? {})}
Weak concepts to prioritise harder questions on: ${(body.weak_concepts ?? []).join(', ') || 'none'}
Already-covered concepts (avoid repeating focus): ${(body.completed_concepts ?? []).join(', ') || 'none'}

Past-paper patterns to mirror (if any):
${JSON.stringify((body.past_paper_patterns ?? []).slice(0, 5))}

Lock scope to 1–2 subtopics and the selected concepts only. Emit the bundle via emit_daily_task.`;
}

interface ValidationResult {
  warnings: string[];
  missingConcepts: string[];
  needsDifficultyDiversity: boolean;
  examNeedsMoreConcepts: boolean;
}

function validate(bundle: TaskBundle, selected: string[]): ValidationResult {
  const warnings: string[] = [];
  const usedConcepts = new Set(bundle.blocks.practice_questions.map((q) => q.concept.toLowerCase()));
  const missing = selected.filter((c) => !usedConcepts.has(c.toLowerCase()));
  if (missing.length > 0) warnings.push(`Missing concepts in practice: ${missing.join(', ')}`);

  const difficulties = new Set(bundle.blocks.practice_questions.map((q) => q.difficulty));
  const needsDiversity = difficulties.size < 2;
  if (needsDiversity) warnings.push('Practice questions lack difficulty diversity');

  const examConceptCount = (bundle.blocks.exam_question.concepts || []).filter((c) =>
    selected.some((s) => s.toLowerCase() === c.toLowerCase()),
  ).length;
  const examNeeds = examConceptCount < 2;
  if (examNeeds) warnings.push('Exam question covers fewer than 2 selected concepts');

  return {
    warnings,
    missingConcepts: missing,
    needsDifficultyDiversity: needsDiversity,
    examNeedsMoreConcepts: examNeeds,
  };
}

async function callAI(
  messages: any[],
  apiKey: string,
  usage?: UsageAttribution
): Promise<TaskBundle | null> {
  const resp = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: [TASK_TOOL],
      tool_choice: { type: 'function', function: { name: 'emit_daily_task' } },
    }),
  });

  if (resp.status === 429) throw new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (resp.status === 402) throw new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('AI gateway error', resp.status, txt);
    return null;
  }

  const data = await resp.json();

  // Record real token usage (fire-and-forget) when attribution is supplied.
  if (usage && data?.usage) {
    reportTokenUsage({
      userId: usage.userId,
      bucket: usage.bucket,
      schoolId: usage.schoolId ?? null,
      tokensIn: Number(data.usage.prompt_tokens ?? 0),
      tokensOut: Number(data.usage.completion_tokens ?? 0),
    });
  }

  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error('No tool_call in response', JSON.stringify(data).slice(0, 500));
    return null;
  }
  try {
    const args = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;
    return args as TaskBundle;
  } catch (e) {
    console.error('Failed to parse tool args', e);
    return null;
  }
}

function normalize(bundle: TaskBundle): TaskBundle {
  return {
    topic: bundle.topic ?? '',
    subtopic: bundle.subtopic ?? '',
    concepts: Array.isArray(bundle.concepts) ? bundle.concepts.filter(Boolean) : [],
    blocks: {
      concept_learning: bundle.blocks?.concept_learning ?? '',
      quick_review: bundle.blocks?.quick_review ?? '',
      practice_questions: Array.isArray(bundle.blocks?.practice_questions) ? bundle.blocks.practice_questions : [],
      exam_question: bundle.blocks?.exam_question ?? {
        question: '', concepts: [], marks: 0, expected_steps: [],
      },
      flashcards: Array.isArray(bundle.blocks?.flashcards) ? bundle.blocks.flashcards : [],
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.subject || !body?.topic) {
      return new Response(JSON.stringify({ error: 'subject and topic are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { selected, reason } = selectTargets(body);
    if (selected.length === 0) {
      return new Response(JSON.stringify({ error: 'No concepts available for selection' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(body, selected, reason) },
    ];

    const usageAttrib = { userId: getUserIdFromRequest(req), bucket: 'daily_task' };

    let bundle = await callAI(messages, apiKey, usageAttrib);
    if (!bundle) {
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    bundle = normalize(bundle);

    let validation = validate(bundle, selected);

    // Single retry to fix coverage gaps
    if (validation.warnings.length > 0) {
      const fixInstructions: string[] = [];
      if (validation.missingConcepts.length > 0) {
        fixInstructions.push(`Add at least one practice question for each missing concept: ${validation.missingConcepts.join(', ')}.`);
      }
      if (validation.needsDifficultyDiversity) {
        fixInstructions.push('Ensure practice_questions includes at least 2 distinct difficulty levels (mix easy/medium/hard).');
      }
      if (validation.examNeedsMoreConcepts) {
        fixInstructions.push(`Update exam_question to combine at least 2 of: ${selected.join(', ')}.`);
      }

      const retryMessages = [
        ...messages,
        {
          role: 'assistant',
          content: `Previous attempt:\n${JSON.stringify(bundle).slice(0, 4000)}`,
        },
        {
          role: 'user',
          content: `Coverage validation failed. Fix the following and re-emit the FULL bundle via emit_daily_task:\n${fixInstructions.join('\n')}`,
        },
      ];
      const retried = await callAI(retryMessages, apiKey, usageAttrib);
      if (retried) {
        bundle = normalize(retried);
        validation = validate(bundle, selected);
      }
    }

    const promptHash = await hashPrompt(JSON.stringify(messages));
    const meta = buildProvenance({
      fn_name: 'generate-daily-task',
      fn_version: '2',
      model: MODEL,
      prompt_hash: promptHash,
      curriculum: (body as any)?.curriculum,
      subject: (body as any)?.subject,
      topic: (body as any)?.topic,
      concept_labels: selected,
      weak_area_triggers: Array.isArray((body as any)?.weak_concepts) ? (body as any).weak_concepts : [],
      validator_warnings: validation.warnings,
      novelty_reason: 'unverified',
      selection_reason: reason,
    });
    const taskWithMeta = attachMeta(bundle as Record<string, unknown>, meta);

    return new Response(
      JSON.stringify({
        task: taskWithMeta,
        selection_reason: reason,
        selected_concepts: selected,
        coverage_warnings: validation.warnings,
        generation_meta: meta,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('generate-daily-task error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
