-- Seed verified curriculum template: Cambridge IGCSE English Literature
-- Set-text agnostic: strands describe genre skills so the template remains
-- valid across changing set-text lists.
-- Content policy: strand structure and approximate weightings reflect publicly
-- documented syllabus organisation (factual information). All exemplar
-- question stems are original paraphrases written for this project; no exam-board
-- text is reproduced.
-- Idempotent: ON CONFLICT upsert only overwrites rows previously sourced from
-- 'ai' or 'hybrid'; human-verified rows are never clobbered.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES (
  'CAMB',
  'IGCSE',
  'English Literature',
  $topics$[
    {
      "name": "Poetry: Set Poems and Poetic Method",
      "subtopics": ["Close reading of set anthology poems", "Imagery, sound effects and form", "Voice, tone and mood", "Structure and development within a poem", "Comparing attitudes across poems", "Personal response supported by text"],
      "learning_objectives": ["Analyse how poets use language, form and structure to create meaning", "Explore voice and shifting tone within poems", "Develop an informed personal response to poems", "Support interpretation with precise, integrated quotation"],
      "key_concepts": ["Metaphor, simile, personification and symbolism", "Rhythm, rhyme, enjambment and caesura", "Stanza form and structural turns", "Speaker vs poet distinction", "Ambiguity and multiple readings"],
      "assessment_objectives": ["Show detailed knowledge of the poem's content", "Understand meanings both surface and deeper", "Analyse the writer's use of language, structure and form", "Communicate a sensitive, informed personal response"],
      "typical_question_styles": ["Explore how the poet vividly conveys the experience in this poem", "How does the poet make this moment so moving/powerful/disturbing", "Passage-based question printing the whole poem for close analysis"],
      "exam_weight": 25,
      "prerequisites": ["Close reading skills", "Basic poetic terminology"],
      "common_misconceptions": ["Feature-spotting devices without analysing their effect", "Paraphrasing the poem line by line instead of analysing", "Assuming the speaker is always the poet", "Ignoring form and structure entirely in favour of imagery"],
      "exemplar_question_stems": ["Explore the ways the poet memorably conveys a sense of loss in this poem", "How does the poet make the ending of the poem so striking? Support your answer with detail from the whole poem"]
    },
    {
      "name": "Prose: Novel or Short Stories",
      "subtopics": ["Characterisation and character development", "Narrative voice and perspective", "Setting and atmosphere", "Themes and how they are developed", "Significant moments and their contexts", "The writer's stylistic choices in prose"],
      "learning_objectives": ["Analyse how the novelist creates and develops character", "Explore how narrative perspective shapes reader response", "Trace theme development across a whole text", "Analyse prose style in extract-based questions"],
      "key_concepts": ["First vs third person narration and reliability", "Direct and indirect characterisation", "Foreshadowing and structural patterning", "Symbol and motif", "Contextual placement of an extract within the whole"],
      "assessment_objectives": ["Show detailed knowledge of the text", "Understand deeper implications of character, theme and setting", "Analyse the writer's craft in language and structure", "Communicate an informed personal response"],
      "typical_question_styles": ["Passage-based: how does the writer make this extract so tense/revealing/significant", "Essay: how far does the writer make you sympathise with the named character", "Explore how the writer memorably presents the relationship between two characters"],
      "exam_weight": 25,
      "prerequisites": ["Reading of the set prose text", "Close reading skills"],
      "common_misconceptions": ["Retelling plot instead of analysing presentation", "Treating characters as real people rather than authorial constructs", "Analysing an extract with no awareness of its place in the whole text", "Ignoring the question's key word (tense, moving, surprising) and writing generally"],
      "exemplar_question_stems": ["How does the writer make this moment in the novel so dramatic? Refer closely to the printed extract", "To what extent does the writer persuade you to admire the central character? Support your view with detail from the whole novel"]
    },
    {
      "name": "Drama: Play Study",
      "subtopics": ["Dramatic characterisation through speech and action", "Stagecraft: entrances, exits, props, staging directions", "Dramatic irony and tension", "Conflict and its development", "Themes realised through performance", "Audience response across time"],
      "learning_objectives": ["Analyse how dramatists reveal character through dialogue and action", "Explore the effects of stagecraft and dramatic structure", "Analyse how tension is built and released in scenes", "Consider the play as performance, not just text"],
      "key_concepts": ["Dramatic irony", "Soliloquy, aside and monologue", "Stage directions as authorial signals", "Act and scene structure", "The audience as active interpreter"],
      "assessment_objectives": ["Show detailed knowledge of the play", "Understand implications of character, relationships and themes", "Analyse the dramatist's craft and stage effects", "Communicate an informed personal response to drama"],
      "typical_question_styles": ["Passage-based: explore how the dramatist makes this extract so entertaining/shocking/tense for an audience", "Essay: how does the dramatist memorably portray the named relationship", "How far does the dramatist encourage the audience to sympathise with the character"],
      "exam_weight": 25,
      "prerequisites": ["Reading/viewing of the set play"],
      "common_misconceptions": ["Writing about the play as if it were a novel, ignoring audience and staging", "Quoting stage directions without analysing their dramatic effect", "Overlooking dramatic irony that shapes audience response", "Describing what happens in a scene rather than how it is made effective"],
      "exemplar_question_stems": ["Explore how the dramatist makes this moment so tense for the audience; refer closely to the printed extract", "How does the dramatist strikingly convey the change in the central character during the play?"]
    },
    {
      "name": "Unseen Poetry and Prose Criticism",
      "subtopics": ["First reading strategies for unseen texts", "Establishing subject, voice and tone", "Selecting rich material for analysis", "Structuring an unseen response quickly", "Comparing initial and developing impressions", "Handling ambiguity with tentative language"],
      "learning_objectives": ["Read and interpret an unseen poem or prose extract independently", "Build an argument about meaning and method without secondary support", "Analyse language, structure and form at first encounter", "Use tentative critical language for plausible alternative readings"],
      "key_concepts": ["Guided bullet prompts in unseen questions", "Annotation strategy under time pressure", "Tone identification", "Tentative modality: perhaps, suggests, may imply", "Coherent line of argument from first response"],
      "assessment_objectives": ["Understand surface and deeper meanings of unseen writing", "Analyse how the writer achieves effects", "Communicate a considered personal response to unfamiliar texts"],
      "typical_question_styles": ["Read the poem and explore how the poet vividly conveys the speaker's feelings", "How does the writer of this extract create a powerful sense of place", "Guided bullets suggest areas: language, structure, and the development of ideas"],
      "exam_weight": 25,
      "prerequisites": ["Poetry and prose analysis strands"],
      "common_misconceptions": ["Panicking and summarising instead of analysing when the text is unfamiliar", "Forcing a memorised technique checklist onto an unsuitable text", "Asserting a single fixed meaning where the text is ambiguous", "Spending too long annotating and leaving too little time to write"],
      "exemplar_question_stems": ["Explore how the poet strikingly conveys the relationship between people and nature in this unseen poem", "How does the writer make this description of the journey so memorable? Consider language, structure and form"]
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
