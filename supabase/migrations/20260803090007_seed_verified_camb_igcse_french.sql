-- Seed verified curriculum template: Cambridge IGCSE French (Foreign Language)
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
  'French',
  $topics$[
    {
      "name": "Listening Comprehension (Comprehension orale)",
      "subtopics": ["Short announcements and dialogues", "Longer conversations and interviews", "Multiple choice with visual and text options", "Matching and gap-fill listening tasks", "Identifying opinions and feelings of speakers", "Numbers, times, dates and prices in speech"],
      "learning_objectives": ["Extract key details from short spoken French", "Follow the gist and detail of longer conversations", "Recognise opinion, attitude and justification in speech", "Cope with different registers and speeds of delivery"],
      "key_concepts": ["Prediction from question stems", "Distractors and speaker self-correction", "Positive vs negative opinion markers", "Liaison and elision affecting recognition", "Synonym and paraphrase between audio and questions"],
      "assessment_objectives": ["Identify and select relevant information from spoken French", "Understand opinions and explanations in spoken texts"],
      "typical_question_styles": ["Ecoutez l'annonce et choisissez la bonne reponse", "Match each speaker to the statement that matches their opinion", "Complete the sentences in French with words from the recording", "Answer the questions in English about the interview"],
      "exam_weight": 25,
      "prerequisites": ["Core vocabulary of the defined topic areas"],
      "common_misconceptions": ["Expecting word-for-word matches between audio and questions", "Missing negatives (ne...pas, ne...jamais) that reverse meaning", "Confusing similar numbers (quinze/cinquante, deux/douze)", "Panicking at unknown words instead of using context"],
      "exemplar_question_stems": ["Listen to the conversation about weekend plans and answer the multiple-choice questions", "Listen to five young people talking about school; match each to the correct opinion"]
    },
    {
      "name": "Reading Comprehension (Comprehension ecrite)",
      "subtopics": ["Signs, adverts and short messages", "Emails, letters and articles", "Multiple choice, matching and true/false with correction", "Questions in French on longer texts", "Identifying opinions and reasons in texts", "Cognates and inferring unknown vocabulary"],
      "learning_objectives": ["Understand short practical texts and public notices", "Extract detail and opinion from longer narrative and journalistic texts", "Answer French questions on French texts using correct forms", "Use context and cognates to infer unfamiliar words"],
      "key_concepts": ["Skimming for gist, scanning for detail", "Tense recognition shaping meaning", "Faux amis (false friends)", "Pronoun reference tracking", "Question word comprehension (qui, ou, quand, pourquoi, comment)"],
      "assessment_objectives": ["Identify and select relevant information from written French", "Understand ideas, opinions and justifications in texts"],
      "typical_question_styles": ["Read the advert and answer the questions in English", "Choose the four true statements about the article", "Answer the questions in French in full sentences", "Match each paragraph with the correct heading"],
      "exam_weight": 25,
      "prerequisites": ["Core vocabulary and grammar recognition"],
      "common_misconceptions": ["Relying on faux amis (e.g. assuming journee means journey)", "Answering in the wrong language for the question type", "Copying whole sentences when a specific detail is required", "Ignoring verb tenses and misplacing events in time"],
      "exemplar_question_stems": ["Read the email about the exchange visit and answer the questions in English", "Read the article about eating habits; complete the French sentences using words from the box"]
    },
    {
      "name": "Writing (Expression ecrite)",
      "subtopics": ["Form-filling and short list tasks", "Short messages and emails (about 80-90 words)", "Longer composition with past, present and future reference (about 130-140 words)", "Narrating events and giving opinions with reasons", "Register: tu vs vous in written tasks", "Accuracy: agreements, tenses, word order"],
      "learning_objectives": ["Complete short communicative writing covering all bullet points", "Write extended pieces using at least three time frames", "Express and justify opinions in written French", "Apply core grammar accurately: agreement, negation, common irregular verbs"],
      "key_concepts": ["Task fulfilment: all bullets addressed and developed", "Perfect vs imperfect distinction in narration", "Near future and simple future forms", "Connectives: d'abord, ensuite, cependant, donc", "Adjective agreement and position"],
      "assessment_objectives": ["Communicate information and opinions in writing for given tasks", "Use grammatical structures with accuracy across time frames"],
      "typical_question_styles": ["Ecrivez un email a votre ami(e) francais(e); mentionnez les quatre points donnes", "Write about 130 words on the topic, covering the given bullet points", "Describe what happened last weekend, what you usually do, and your plans"],
      "exam_weight": 25,
      "prerequisites": ["Core grammar: present, perfect, imperfect, future"],
      "common_misconceptions": ["Using avoir as auxiliary for all verbs in the perfect tense", "Ignoring adjective agreement with feminine and plural nouns", "Translating word-for-word from English producing wrong word order", "Covering bullets in one clause each without development"],
      "exemplar_question_stems": ["Vous avez passe des vacances en France; ecrivez un email decrivant le voyage, le logement, une activite et vos projets pour l'ete prochain", "Write an article about your school life covering the four required points"]
    },
    {
      "name": "Speaking (Expression orale)",
      "subtopics": ["Role plays with prescribed tasks", "Topic presentation and follow-up conversation", "General conversation across topic areas", "Asking questions as required in role plays", "Using three time frames in conversation", "Pronunciation and intonation essentials"],
      "learning_objectives": ["Complete role-play tasks including unexpected elements", "Sustain conversation across the defined topic areas", "Narrate past events and describe future plans orally", "Ask well-formed questions when the task requires"],
      "key_concepts": ["Task completion vs perfection: communicating effectively", "Coping strategies: paraphrase and fillers (alors, eh bien)", "Question formation with est-ce que and inversion", "Opinion phrases: a mon avis, je pense que, je trouve que", "Consistent sound-spelling patterns for pronunciation"],
      "assessment_objectives": ["Communicate effectively in spoken interaction for tasks and conversation", "Use a range of structures and vocabulary with acceptable accuracy"],
      "typical_question_styles": ["Role play: you are at the train station; carry out the five tasks on the card", "Answer follow-up questions on your presentation topic", "Conversation questions move across school, family, free time, holidays and future plans"],
      "exam_weight": 25,
      "prerequisites": ["Core vocabulary and question forms"],
      "common_misconceptions": ["Memorising long answers that ignore the actual question asked", "Forgetting to ask the required question in role plays", "Sticking to the present tense for all answers", "Believing accent quality matters more than communication and range"],
      "exemplar_question_stems": ["Role play: at the restaurant — greet the waiter, order for two, ask about a dish, request the bill", "Conversation: Qu'est-ce que tu as fait le weekend dernier? Quels sont tes projets pour l'annee prochaine?"]
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
