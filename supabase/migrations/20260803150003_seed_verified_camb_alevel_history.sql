-- Seed verified curriculum template: Cambridge International AS & A Level History
-- Option-agnostic where possible: strands describe the skills and the most
-- widely taught option areas. AS/A2 labels reflect the staged structure.
-- Content policy: strand structure and approximate weightings reflect publicly
-- documented syllabus organisation (factual information). All exemplar
-- question stems are original paraphrases written for this project; no exam-board
-- text is reproduced.
-- Idempotent: ON CONFLICT upsert only overwrites rows previously sourced from
-- 'ai' or 'hybrid'; human-verified rows are never clobbered.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES (
  'CAMB',
  'A-Level',
  'History',
  $topics$[
    {
      "name": "AS: Document Analysis and Source Skills",
      "subtopics": ["Comprehension and inference from primary sources", "Evaluating reliability, utility and provenance", "Cross-referencing sources for agreement and difference", "Using contextual knowledge to test sources", "Answering how-far-do-the-sources-agree questions", "Constructing source-based arguments"],
      "learning_objectives": ["Interpret primary sources within their historical context", "Evaluate sources using provenance, tone, purpose and audience", "Compare sources systematically for agreement and disagreement", "Integrate own knowledge with source evaluation in extended answers"],
      "key_concepts": ["Provenance: nature, origin, purpose", "Reliability vs utility distinction", "Corroboration and contradiction", "Bias as perspective to analyse, not a reason to dismiss", "Source-led vs knowledge-led balance"],
      "assessment_objectives": ["Comprehend, analyse and evaluate historical sources", "Deploy contextual knowledge to interpret evidence"],
      "typical_question_styles": ["Compare and contrast the views in the two sources on the issue", "How far do the sources support the stated view", "Evaluate the usefulness of the source as evidence about the event"],
      "exam_weight": 25,
      "prerequisites": ["IGCSE/O Level History source skills"],
      "common_misconceptions": ["Dismissing sources as biased without analysing what the bias reveals", "Describing source content instead of using it as evidence", "Ignoring provenance when judging reliability", "Treating all official documents as automatically trustworthy"],
      "exemplar_question_stems": ["Compare the two accounts of the crisis and explain their differences using provenance", "How far do these four sources support the view that the policy failed? Use the sources and your knowledge"]
    },
    {
      "name": "AS: Outline Study — International Relations and National Histories",
      "subtopics": ["Causes and course of major international crises in the studied period", "Domestic political development of the studied states", "Economic and social change as historical drivers", "Key individuals and their significance", "Structured essay writing: causation and significance", "Balancing narrative knowledge with analytical argument"],
      "learning_objectives": ["Explain causes, course and consequences of major developments in the option period", "Analyse the interplay of political, economic and social factors", "Assess the significance of individuals against structural forces", "Write essays with sustained argument and precise supporting detail"],
      "key_concepts": ["Long-term vs short-term causation", "Change and continuity across the period", "Significance criteria: depth, breadth, durability", "Historical interpretation as argument", "Periodisation choices shaping analysis"],
      "assessment_objectives": ["Recall, select and deploy accurate historical knowledge", "Explain and analyse past events and developments", "Construct substantiated essay arguments"],
      "typical_question_styles": ["Why did the crisis of the given year occur", "How far was the named factor responsible for the development described", "Assess the consequences of the policy for the state concerned"],
      "exam_weight": 25,
      "prerequisites": ["AS source skills strand supports this strand"],
      "common_misconceptions": ["Narrating events chronologically instead of answering the question", "Attributing complex developments to a single cause", "Ignoring counter-arguments in how-far questions", "Using vague generalisations instead of precise evidence"],
      "exemplar_question_stems": ["How far was economic weakness the main cause of the regime's collapse", "Assess the importance of the named leader in the development of the state to the end of the period"]
    },
    {
      "name": "A2: Depth Study — Analysis of a Focused Period",
      "subtopics": ["Intensive study of a short, pivotal period in the chosen option", "Interconnection of events within the depth period", "Debate-driven questions on turning points", "Evaluating the relative weight of factors in depth", "Deploying detailed evidence at depth-study standard", "Essay technique for evaluative depth questions"],
      "learning_objectives": ["Demonstrate command of detailed narrative and analysis within the depth period", "Evaluate turning points and counterfactual significance", "Weigh competing factors with precise supporting evidence", "Sustain evaluative argument across a full essay"],
      "key_concepts": ["Depth vs outline analytical standards", "Turning point evaluation", "Contingency vs inevitability debates", "Interlocking political, military, economic and social causation", "Criteria-based judgement"],
      "assessment_objectives": ["Deploy detailed knowledge of the depth period", "Analyse and evaluate historical problems with sustained argument"],
      "typical_question_styles": ["To what extent was the outcome decided by the named factor", "How accurate is it to describe the event as a turning point", "Assess the reasons why the policy changed in the given years"],
      "exam_weight": 25,
      "prerequisites": ["AS strands"],
      "common_misconceptions": ["Answering with outline-level generality where depth detail is required", "Asserting a turning point without comparing before and after", "Treating evaluation as listing factors without weighing them", "Neglecting chronology within the depth period, causing confusion of sequence"],
      "exemplar_question_stems": ["To what extent were divisions among opponents the main reason the regime survived the crisis years", "How accurate is it to say the given year marked the decisive shift in the conflict"]
    },
    {
      "name": "A2: Themes and Historical Interpretations",
      "subtopics": ["Thematic study across a long period", "Patterns of change and continuity over time", "Engaging with historians' interpretations", "Schools of historiography relevant to the theme", "Evaluating an extract from a historian's work", "Synthesising theme knowledge with interpretation analysis"],
      "learning_objectives": ["Analyse developments thematically across an extended period", "Identify and explain a historian's argument from an extract", "Evaluate interpretations using contextual and historiographical knowledge", "Construct essays tracing change and continuity over the whole theme"],
      "key_concepts": ["Thematic threads: economy, state power, society, ideology as applicable", "Interpretation as contestable argument", "Historiographical context shaping historians' views", "Extract analysis: identifying the argument, testing it against evidence", "Synthesis across sub-periods"],
      "assessment_objectives": ["Analyse developments over a long period thematically", "Understand and evaluate historians' interpretations"],
      "typical_question_styles": ["Evaluate the interpretation in the extract, using your knowledge of the theme", "How far do you agree that the period saw more continuity than change in the theme", "Assess the view expressed in the extract about the causes of the long-term development"],
      "exam_weight": 25,
      "prerequisites": ["A2 depth strand", "AS strands"],
      "common_misconceptions": ["Summarising the extract instead of identifying and evaluating its argument", "Treating the historian's view as fact to be repeated", "Answering thematically framed questions with narrow period detail only", "Ignoring continuity when questions emphasise change"],
      "exemplar_question_stems": ["The extract argues that state power expanded primarily through war; evaluate this interpretation across the period you have studied", "How far do you agree that living standards changed more in the last third of the period than in the rest combined"]
    }
  ]$topics$::jsonb,
  'verified',
  now()
)
ON CONFLICT (curriculum, grade, subject) DO UPDATE
SET topics = EXCLUDED.topics,
    source = 'verified',
    verified_at = now(),
    updated_at = now()
WHERE curriculum_topic_templates.source IN ('ai', 'hybrid');
