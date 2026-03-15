-- Dedicated backend context assembly for StudyMode

CREATE OR REPLACE FUNCTION public.get_subject_context(
  p_subject_id UUID,
  p_topic_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_subject_name TEXT;
  v_all_topics JSONB := '[]'::jsonb;
  v_topic JSONB := NULL;
  v_syllabus_topic JSONB := NULL;
  v_merged_topic JSONB := NULL;
  v_exam_patterns JSONB := '[]'::jsonb;
  v_past_questions JSONB := '[]'::jsonb;
  v_doc RECORD;
  v_q JSONB;
  v_t JSONB;
  v_mastered_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_syllabus_progress INTEGER := 0;
  v_exam_weight_from_papers INTEGER := 0;
  v_freq_sum NUMERIC := 0;
  v_freq_count INTEGER := 0;
  v_context TEXT := '';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.name, COALESCE(s.topics, '[]'::jsonb)
  INTO v_subject_name, v_all_topics
  FROM public.subjects s
  WHERE s.id = p_subject_id AND s.user_id = v_uid;

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  SELECT t
  INTO v_topic
  FROM jsonb_array_elements(v_all_topics) t
  WHERE
    lower(COALESCE(t->>'name', '')) = lower(p_topic_name)
    OR lower(COALESCE(t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
    OR lower(p_topic_name) LIKE '%' || lower(COALESCE(t->>'name', '')) || '%'
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'topic_name', ep.topic_name,
        'frequency_score', ep.frequency_score,
        'avg_marks', COALESCE(ep.avg_marks, 0),
        'question_types', COALESCE(ep.question_types, '[]'::jsonb),
        'year', ep.year
      )
    ),
    '[]'::jsonb
  )
  INTO v_exam_patterns
  FROM public.exam_patterns ep
  WHERE ep.subject_id = p_subject_id
    AND ep.user_id = v_uid;

  FOR v_doc IN
    SELECT d.parsed_content, d.type
    FROM public.documents d
    WHERE d.user_id = v_uid
      AND d.is_processed = true
      AND d.type IN ('past_paper', 'syllabus')
      AND lower(d.subject) = lower(v_subject_name)
  LOOP
    IF v_doc.type = 'past_paper' THEN
      FOR v_q IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'questions', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_q->>'topic', '')) LIKE '%' || lower(p_topic_name) || '%'
           OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_q->>'topic', '')) || '%'
        THEN
          v_past_questions := v_past_questions || jsonb_build_array(
            jsonb_build_object(
              'question_number', COALESCE(v_q->>'question_number', ''),
              'topic', COALESCE(v_q->>'topic', ''),
              'subtopic', v_q->>'subtopic',
              'marks', COALESCE((v_q->>'marks')::numeric, 1),
              'question_type', COALESCE(v_q->>'question_type', 'structured'),
              'difficulty', COALESCE(v_q->>'difficulty', 'medium'),
              'command_words', COALESCE(v_q->'command_words', '[]'::jsonb),
              'concepts_tested', COALESCE(v_q->'concepts_tested', '[]'::jsonb)
            )
          );
        END IF;
      END LOOP;
    ELSIF v_doc.type = 'syllabus' AND v_syllabus_topic IS NULL THEN
      FOR v_t IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'topics', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
           OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'name', '')) || '%'
        THEN
          v_syllabus_topic := jsonb_build_object(
            'id', COALESCE(v_t->>'id', ''),
            'name', COALESCE(v_t->>'name', p_topic_name),
            'subtopics', COALESCE(v_t->'subtopics', '[]'::jsonb),
            'learningObjectives', COALESCE(v_t->'learningObjectives', COALESCE(v_t->'learning_objectives', '[]'::jsonb)),
            'concepts', COALESCE(v_t->'concepts', COALESCE(v_t->'key_concepts', '[]'::jsonb)),
            'examWeight', COALESCE((v_t->>'examWeight')::numeric, COALESCE((v_t->>'exam_weight')::numeric, 0)),
            'prerequisites', COALESCE(v_t->'prerequisites', '[]'::jsonb)
          );
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_merged_topic := COALESCE(v_topic, v_syllabus_topic);

  IF v_topic IS NOT NULL AND v_syllabus_topic IS NOT NULL THEN
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'subtopics', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{subtopics}', v_syllabus_topic->'subtopics', true);
    END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'learningObjectives', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{learningObjectives}', v_syllabus_topic->'learningObjectives', true);
    END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'concepts', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{concepts}', v_syllabus_topic->'concepts', true);
    END IF;
  END IF;

  v_total_count := jsonb_array_length(v_all_topics);
  SELECT COUNT(*)
  INTO v_mastered_count
  FROM public.topic_mastery tm
  WHERE tm.subject_id = p_subject_id
    AND tm.user_id = v_uid
    AND COALESCE(tm.mastery_percentage, 0) >= 70;

  IF v_total_count > 0 THEN
    v_syllabus_progress := ROUND((v_mastered_count::numeric / v_total_count::numeric) * 100)::int;
  END IF;

  FOR v_t IN SELECT value FROM jsonb_array_elements(v_exam_patterns)
  LOOP
    IF lower(COALESCE(v_t->>'topic_name', '')) LIKE '%' || lower(p_topic_name) || '%'
       OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'topic_name', '')) || '%'
    THEN
      v_freq_sum := v_freq_sum + COALESCE((v_t->>'frequency_score')::numeric, 0);
      v_freq_count := v_freq_count + 1;
    END IF;
  END LOOP;

  IF v_freq_count > 0 THEN
    v_exam_weight_from_papers := ROUND(v_freq_sum / v_freq_count)::int;
  ELSE
    v_exam_weight_from_papers := COALESCE((v_merged_topic->>'examWeight')::numeric, 0)::int;
  END IF;

  -- Build backend curriculum context text
  IF v_merged_topic IS NOT NULL THEN
    v_context := v_context || '=== SYLLABUS DATA FOR: ' || p_topic_name || E' ===\n';
    IF jsonb_array_length(COALESCE(v_merged_topic->'subtopics', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Subtopics: ' || (
        SELECT string_agg(value::text, ' | ')
        FROM jsonb_array_elements_text(v_merged_topic->'subtopics')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'learningObjectives', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Learning Objectives:\n  • ' || (
        SELECT string_agg(value::text, E'\n  • ')
        FROM jsonb_array_elements_text(v_merged_topic->'learningObjectives')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'concepts', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Key Concepts: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(v_merged_topic->'concepts')
      ) || E'\n';
    END IF;
    IF v_exam_weight_from_papers > 0 THEN
      v_context := v_context || 'Exam Weight Estimate: ' || v_exam_weight_from_papers || '%' || E'\n';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'topic', v_merged_topic,
    'allTopics', v_all_topics,
    'examPatterns', v_exam_patterns,
    'pastPaperQuestions', v_past_questions,
    'examWeightFromPapers', v_exam_weight_from_papers,
    'masteredTopicCount', v_mastered_count,
    'totalTopicCount', v_total_count,
    'syllabusProgress', v_syllabus_progress,
    'curriculumContext', trim(v_context)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subject_context(UUID, TEXT) TO authenticated;
