import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";


function getSubjectVisuals(subjectName: string) {
  const key = subjectName.trim().toLowerCase();
  const map: Record<string, { icon_emoji: string; icon_gradient: string }> = {
    "mathematics": { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    "maths": { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    "math": { icon_emoji: "📐", icon_gradient: "from-purple-500 to-violet-600" },
    "physics": { icon_emoji: "⚛️", icon_gradient: "from-blue-500 to-indigo-600" },
    "chemistry": { icon_emoji: "🧪", icon_gradient: "from-green-500 to-emerald-600" },
    "biology": { icon_emoji: "🧬", icon_gradient: "from-pink-500 to-rose-600" },
    "english": { icon_emoji: "📖", icon_gradient: "from-orange-500 to-amber-600" },
    "english language": { icon_emoji: "📖", icon_gradient: "from-orange-500 to-amber-600" },
    "literature": { icon_emoji: "🪶", icon_gradient: "from-red-500 to-rose-600" },
    "geography": { icon_emoji: "🌍", icon_gradient: "from-lime-500 to-green-600" },
    "history": { icon_emoji: "🏛️", icon_gradient: "from-stone-500 to-amber-700" },
    "computer science": { icon_emoji: "💻", icon_gradient: "from-cyan-500 to-sky-600" },
    "ict": { icon_emoji: "💻", icon_gradient: "from-cyan-500 to-sky-600" },
    "economics": { icon_emoji: "📢", icon_gradient: "from-teal-500 to-cyan-600" },
    "accounting": { icon_emoji: "🧮", icon_gradient: "from-blue-500 to-indigo-600" },
    "business studies": { icon_emoji: "💼", icon_gradient: "from-teal-500 to-cyan-600" },
    "agriculture": { icon_emoji: "🚜", icon_gradient: "from-green-500 to-lime-600" },
    "foreign languages": { icon_emoji: "🗣️", icon_gradient: "from-yellow-500 to-amber-600" },
    "design & technology": { icon_emoji: "🛠️", icon_gradient: "from-purple-500 to-indigo-600" },
    "engineering graphics": { icon_emoji: "📘", icon_gradient: "from-blue-600 to-indigo-800" },
    "sociology": { icon_emoji: "👥", icon_gradient: "from-fuchsia-500 to-pink-600" },
    "psychology": { icon_emoji: "🧠", icon_gradient: "from-violet-500 to-purple-700" },
    "religious studies": { icon_emoji: "✝️", icon_gradient: "from-yellow-500 to-amber-600" },
    "law": { icon_emoji: "⚖️", icon_gradient: "from-slate-500 to-gray-700" },
    "music": { icon_emoji: "🎵", icon_gradient: "from-indigo-500 to-violet-600" },
    "health": { icon_emoji: "🩺", icon_gradient: "from-cyan-400 to-teal-500" },
    "environmental science": { icon_emoji: "🌱", icon_gradient: "from-emerald-400 to-teal-500" },
    "physical education": { icon_emoji: "⚽", icon_gradient: "from-green-500 to-lime-600" },
    "first aid": { icon_emoji: "🛡️", icon_gradient: "from-red-500 to-rose-600" },
    "art": { icon_emoji: "🎨", icon_gradient: "from-yellow-500 to-amber-600" },
  };

  return map[key] || { icon_emoji: "📚", icon_gradient: "from-gray-500 to-slate-600" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { documentId, content, documentType, subject } = await req.json();

    if (!documentId || !content) {
      return new Response(JSON.stringify({ error: "documentId and content are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the appropriate prompt based on document type
    let systemPrompt = "";
    let toolDef: any = null;

    if (documentType === "syllabus") {
      systemPrompt = `You are an expert curriculum analyst. Extract the complete syllabus structure from the provided document.
      
Rules:
- Extract ALL topics, subtopics, learning objectives, and curriculum structure
- Create a hierarchical map: Subject → Topic → Subtopic → Concepts → Learning outcomes
- Identify exam weight hints if mentioned
- Identify prerequisites between topics
- Be thorough - every topic in the syllabus must be captured
- If the document is unclear, make educated inferences based on standard curricula`;

      toolDef = {
        type: "function",
        function: {
          name: "extract_syllabus",
          description: "Extract structured syllabus data from a document",
          parameters: {
            type: "object",
            properties: {
              subject_name: { type: "string", description: "The subject name" },
              syllabus_code: { type: "string", description: "Syllabus code if found (e.g. 0580, 9709)" },
              topics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "Unique topic ID like topic-1" },
                    name: { type: "string" },
                    subtopics: { type: "array", items: { type: "string" } },
                    learningObjectives: { type: "array", items: { type: "string" } },
                    examWeight: { type: "number", description: "Estimated exam weight percentage (0-100)" },
                    prerequisites: { type: "array", items: { type: "string" }, description: "IDs of prerequisite topics" },
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
    } else if (documentType === "past_paper") {
      systemPrompt = `You are an expert exam pattern analyst. Analyze this past exam paper to extract question patterns, topic coverage, mark allocation, and difficulty levels.

Rules:
- Identify every question and map it to a topic
- Note mark allocation for each question
- Identify question types (multiple choice, structured, essay, calculation, etc.)
- Detect difficulty level (easy, medium, hard)
- Look for recurring patterns and examiner preferences
- Note any command words used (explain, describe, calculate, evaluate, etc.)`;

      toolDef = {
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
                    question_type: { type: "string", enum: ["multiple_choice", "structured", "essay", "calculation", "diagram", "data_analysis"] },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
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
    } else {
      // mark_scheme or other
      systemPrompt = `You are an expert exam analyst. Extract key information from this mark scheme or study document. Identify topics, key points, marking criteria, and common mistakes.`;

      toolDef = {
        type: "function",
        function: {
          name: "extract_document_info",
          description: "Extract structured information from a study document",
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
    }

    // Call AI to parse
    const aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Subject: ${subject}\n\nDocument content:\n${content}` },
        ],
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: toolDef.function.name } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI parse error:", aiResponse.status, errText);
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const parsedContent = JSON.parse(toolCall.function.arguments);

    // Update document as processed
    await supabase
      .from("documents")
      .update({
        is_processed: true,
        parsed_content: parsedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // If syllabus, create/update the subject
    if (documentType === "syllabus") {
      const subjectName = parsedContent.subject_name || subject;
      const visuals = getSubjectVisuals(subjectName);

      // Check if subject exists
      const { data: existingSubjects } = await supabase
        .from("documents")
        .select("user_id")
        .eq("id", documentId)
        .single();

      if (existingSubjects) {
        const userId = existingSubjects.user_id;

        // Check for existing subject
        const { data: existingSub } = await supabase
          .from("subjects")
          .select("id")
          .eq("user_id", userId)
          .ilike("name", subjectName)
          .maybeSingle();

        if (existingSub) {
          // Update existing subject with new topics
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

          // Initialize topic mastery for new topics
          for (const topic of parsedContent.topics) {
            await supabase
              .from("topic_mastery")
              .upsert({
                user_id: userId,
                subject_id: existingSub.id,
                topic_name: topic.name,
                mastery_percentage: 0,
                is_locked: topic.id !== "topic-1",
              }, { onConflict: "user_id,subject_id,topic_name" });
          }
        } else {
          // Create new subject
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
            // Initialize topic mastery
            for (const topic of parsedContent.topics) {
              await supabase
                .from("topic_mastery")
                .insert({
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

    // If past paper, store exam patterns
    if (documentType === "past_paper" && parsedContent.topic_frequency) {
      const { data: doc } = await supabase
        .from("documents")
        .select("user_id")
        .eq("id", documentId)
        .single();

      if (doc) {
        // Find matching subject
        const { data: matchingSubject } = await supabase
          .from("subjects")
          .select("id")
          .eq("user_id", doc.user_id)
          .ilike("name", `%${subject}%`)
          .maybeSingle();

        if (matchingSubject) {
          // Insert exam pattern data
          for (const tf of parsedContent.topic_frequency) {
            await supabase.from("exam_patterns").insert({
              user_id: doc.user_id,
              subject_id: matchingSubject.id,
              document_id: documentId,
              topic_name: tf.topic,
              frequency_score: tf.percentage_of_paper,
              avg_marks: tf.total_marks,
              question_types: parsedContent.questions
                ?.filter((q: any) => q.topic === tf.topic)
                ?.map((q: any) => q.question_type) || [],
              year: parsedContent.paper_year || null,
            });
          }

          // Update subject exam_patterns aggregate
          const { data: allPatterns } = await supabase
            .from("exam_patterns")
            .select("topic_name, frequency_score")
            .eq("subject_id", matchingSubject.id);

          if (allPatterns) {
            // Aggregate by topic
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

            // Also update topic examWeight in subjects.topics
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

    return new Response(JSON.stringify({ success: true, parsed: parsedContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
