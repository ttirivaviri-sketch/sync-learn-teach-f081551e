CREATE OR REPLACE FUNCTION public.get_study_memory_context(
  p_user_id    uuid,
  p_subject    text,
  p_topic      text    DEFAULT NULL,
  p_days_back  int     DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result      text := '';
  v_daily       text := '';
  v_topic_rows  RECORD;
  v_day_rows    RECORD;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND
     NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN '';
  END IF;

  FOR v_day_rows IN
    SELECT study_date, topics_studied, quiz_count, quiz_correct,
           flashcard_count, exam_count, avg_score_pct
    FROM   public.study_memory_daily
    WHERE  user_id = p_user_id AND subject_name = p_subject
      AND  study_date >= CURRENT_DATE - p_days_back
    ORDER  BY study_date DESC LIMIT 7
  LOOP
    v_daily := v_daily ||
      format('• %s: studied %s | quizzes %s/%s | flashcards %s | exams %s | avg %s%%'||chr(10),
        v_day_rows.study_date,
        array_to_string(v_day_rows.topics_studied, ', '),
        v_day_rows.quiz_correct, v_day_rows.quiz_count,
        v_day_rows.flashcard_count, v_day_rows.exam_count,
        COALESCE(v_day_rows.avg_score_pct::text, '—'));
  END LOOP;

  IF v_daily <> '' THEN
    v_result := v_result || '=== RECENT DAILY ACTIVITY (' || p_days_back || ' days) ===' || chr(10) || v_daily || chr(10);
  END IF;

  FOR v_topic_rows IN
    SELECT topic_name, subtopics_covered, concepts_covered,
           concepts_weak, concepts_mastered, questions_seen, command_words_used,
           quiz_attempts, quiz_correct, avg_score_pct, best_score_pct, last_score_pct,
           needs_reinforcement, topic_complete, last_activity_at
    FROM   public.study_memory_summary
    WHERE  user_id = p_user_id AND subject_name = p_subject
      AND  (p_topic IS NULL OR topic_name = p_topic)
    ORDER  BY last_activity_at DESC LIMIT 20
  LOOP
    v_result := v_result || format('=== TOPIC: %s ===' || chr(10), v_topic_rows.topic_name);
    IF array_length(v_topic_rows.subtopics_covered, 1) > 0 THEN
      v_result := v_result || 'Subtopics covered: ' || array_to_string(v_topic_rows.subtopics_covered, ', ') || chr(10);
    END IF;
    IF array_length(v_topic_rows.concepts_covered, 1) > 0 THEN
      v_result := v_result || 'Concepts seen: ' || array_to_string(v_topic_rows.concepts_covered[1:15], ', ') || chr(10);
    END IF;
    IF array_length(v_topic_rows.concepts_weak, 1) > 0 THEN
      v_result := v_result || '⚠ Weak concepts (needs reinforcement): ' || array_to_string(v_topic_rows.concepts_weak, ', ') || chr(10);
    END IF;
    IF array_length(v_topic_rows.concepts_mastered, 1) > 0 THEN
      v_result := v_result || '✓ Mastered concepts: ' || array_to_string(v_topic_rows.concepts_mastered[1:10], ', ') || chr(10);
    END IF;
    IF v_topic_rows.quiz_attempts > 0 THEN
      v_result := v_result || format('Quiz performance: %s/%s correct (avg %s%%, best %s%%)' || chr(10),
        v_topic_rows.quiz_correct, v_topic_rows.quiz_attempts,
        COALESCE(v_topic_rows.avg_score_pct::text, '—'),
        COALESCE(v_topic_rows.best_score_pct::text, '—'));
    END IF;
    IF array_length(v_topic_rows.questions_seen, 1) > 0 THEN
      v_result := v_result || 'Questions already seen (DO NOT repeat): ' ||
        array_to_string(v_topic_rows.questions_seen[1:10], ' | ') || chr(10);
    END IF;
    IF array_length(v_topic_rows.command_words_used, 1) > 0 THEN
      v_result := v_result || 'Command words used recently: ' || array_to_string(v_topic_rows.command_words_used, ', ') || chr(10);
    END IF;
    IF v_topic_rows.needs_reinforcement THEN
      v_result := v_result || '⚠ THIS TOPIC NEEDS REINFORCEMENT — prioritise it.' || chr(10);
    END IF;
    IF v_topic_rows.topic_complete THEN
      v_result := v_result || '✓ Topic coverage appears complete — move to next topic.' || chr(10);
    END IF;
    v_result := v_result || chr(10);
  END LOOP;

  IF v_result = '' THEN
    v_result := 'No prior study memory for this subject yet — this is a fresh start.';
  ELSE
    v_result := 'STUDENT STUDY MEMORY (use this to avoid repetition and guide new content):' || chr(10) || v_result;
  END IF;

  RETURN v_result;
END;
$$;