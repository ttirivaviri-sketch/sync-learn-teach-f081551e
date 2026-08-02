-- Seed verified curriculum template: Cambridge IGCSE Art & Design
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
  'Art & Design',
  $topics$[
    {
      "name": "Recording from Observation and Experience",
      "subtopics": ["Observational drawing from primary sources", "Tonal studies and rendering form", "Proportion, perspective and measurement", "Mark-making variety", "Photographic recording as source gathering", "Annotating observations and intentions"],
      "learning_objectives": ["Record analytically from first-hand observation", "Control tone to describe form, light and texture", "Apply linear and atmospheric perspective conventions", "Support visual recording with purposeful annotation"],
      "key_concepts": ["Primary vs secondary sources", "Tonal range and directional light", "Sighting and comparative measurement", "Line quality and expressive mark-making", "Visual analysis vs copying"],
      "assessment_objectives": ["Record ideas, observations and insights relevant to intentions", "Demonstrate skill and control in recording media"],
      "typical_question_styles": ["Sustained observational studies of natural or made objects feeding the project theme", "Series of tonal and line studies exploring the chosen starting point", "Annotated pages explaining what was observed and why it matters to the development"],
      "exam_weight": 25,
      "prerequisites": ["Basic drawing experience"],
      "common_misconceptions": ["Copying photographs found online instead of working from primary observation", "Outlining shapes then shading flatly rather than building form with tone", "Treating annotation as decoration rather than analysis", "Believing neat, tight drawing always beats energetic, accurate observation"],
      "exemplar_question_stems": ["Produce a series of observational studies of reflective surfaces in different media", "Record the same subject under two lighting conditions and annotate the differences you observed"]
    },
    {
      "name": "Exploring Media, Techniques and Processes",
      "subtopics": ["Drawing and painting media experimentation", "Printmaking processes (mono, relief)", "Mixed media and collage", "Three-dimensional exploration where relevant", "Digital media possibilities", "Reviewing and selecting successful experiments"],
      "learning_objectives": ["Experiment purposefully with a range of media and processes", "Evaluate the qualities each medium contributes to intentions", "Refine technical control in chosen media", "Select and justify media choices for development and outcome"],
      "key_concepts": ["Experimentation with purpose vs random variety", "Media properties: opacity, transparency, texture, edge quality", "Process documentation in the sketchbook", "Risk-taking and learning from failures", "Fitness of medium to idea"],
      "assessment_objectives": ["Explore and select appropriate media, materials, techniques and processes", "Demonstrate growing technical competence"],
      "typical_question_styles": ["Media trials responding to the project theme with evaluative notes", "A sequence showing the same motif developed through different processes", "Refinement pages showing increasing control of the selected medium"],
      "exam_weight": 25,
      "prerequisites": ["Recording strand"],
      "common_misconceptions": ["Filling pages with unrelated media samples that never inform the project", "Abandoning a medium after one attempt rather than refining it", "Believing more media always means more marks, over depth of exploration", "Ignoring how a medium's qualities connect to the idea being expressed"],
      "exemplar_question_stems": ["Explore your theme through three contrasting processes and evaluate which best expresses your intention", "Develop a series of monoprints from your observational studies, refining the strongest result"]
    },
    {
      "name": "Developing Ideas and Contextual Understanding",
      "subtopics": ["Generating and refining ideas from a starting point", "Researching artists, designers and cultures", "Analysing artworks: composition, colour, technique, meaning", "Making meaningful connections to own work", "Compositional studies and design development", "Sustaining a coherent project journey"],
      "learning_objectives": ["Develop a personal response through a visible chain of decisions", "Analyse relevant artists' work beyond biography", "Apply lessons from contextual study to own development", "Refine composition through alternative studies before the outcome"],
      "key_concepts": ["Idea development as visible journey", "Formal elements analysis: line, tone, colour, shape, form, texture, pattern", "Influence vs imitation", "Thumbnails and compositional variants", "Cultural context shaping meaning"],
      "assessment_objectives": ["Develop ideas through investigation informed by contextual sources", "Make purposeful connections between own work and others' work"],
      "typical_question_styles": ["Artist research pages with visual transcription and analysis linked to own theme", "Development sheets showing the idea evolving across stages", "Compositional studies testing alternative arrangements before the final piece"],
      "exam_weight": 25,
      "prerequisites": ["Recording and media strands"],
      "common_misconceptions": ["Writing artist biographies instead of analysing their visual language", "Copying an artist's work without connecting it to own development", "Jumping from first idea to final piece with no visible development", "Choosing artists with no relevance to the project theme"],
      "exemplar_question_stems": ["Analyse how your chosen artist uses colour and composition, then apply one strategy to your own development", "Produce three compositional studies for your final piece and justify your selected arrangement"]
    },
    {
      "name": "Personal Response and the Final Outcome",
      "subtopics": ["Planning the outcome from developed ideas", "Managing the timed examination sitting", "Realising intentions with technical control", "Coherence between preparatory work and outcome", "Evaluating the finished work", "Presentation of the submission"],
      "learning_objectives": ["Produce a resolved personal outcome that realises stated intentions", "Manage time and materials in the supervised examination", "Ensure the outcome clearly grows from the preparatory journey", "Evaluate strengths and possible refinements of the outcome"],
      "key_concepts": ["Intentions and realisation", "Resolution vs unfinished ambition", "Consistency between supporting studies and outcome", "Time management across the timed sitting", "Selection and presentation of supporting sheets"],
      "assessment_objectives": ["Present a personal, informed and meaningful response realising intentions", "Demonstrate critical understanding of visual language in the outcome"],
      "typical_question_styles": ["Timed examination producing the final outcome from the prepared starting point", "Submission of preparatory sheets that led to the outcome", "The outcome must connect visibly to the preparatory investigation"],
      "exam_weight": 25,
      "prerequisites": ["All preceding strands"],
      "common_misconceptions": ["Attempting a final piece unrelated to the preparatory work", "Choosing an over-ambitious scale that cannot be resolved in the time", "Leaving composition decisions until the examination itself", "Believing the outcome alone determines the grade while preparation is ignored"],
      "exemplar_question_stems": ["Plan and produce your final outcome, ensuring it realises the intentions developed in your preparatory studies", "Write a short evaluation identifying one strength of your outcome and one refinement you would make with more time"]
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
