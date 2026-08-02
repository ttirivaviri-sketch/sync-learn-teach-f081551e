-- Seed verified curriculum template: Cambridge International AS & A Level French
-- AS/A2 labels reflect the staged structure of the qualification.
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
  'French',
  $topics$[
    {
      "name": "AS: Reading and Translation Skills",
      "subtopics": ["Comprehension of authentic articles on contemporary themes", "Answering questions in French on French texts", "Vocabulary and structure manipulation exercises", "Translation from French into English", "Inferring meaning of unfamiliar language", "Summarising and synthesising written material"],
      "learning_objectives": ["Understand authentic written French on social and cultural topics", "Respond in accurate French to text-based questions without lifting", "Translate French passages into fluent, faithful English", "Rephrase and manipulate structures demonstrating grammatical control"],
      "key_concepts": ["Reformulation rather than lifting from texts", "Register recognition in journalistic French", "False friends and idiomatic pitfalls in translation", "Tense and mood recognition shaping comprehension", "Synonym networks around AS themes"],
      "assessment_objectives": ["Demonstrate understanding of written French", "Manipulate French structures accurately", "Transfer meaning faithfully between French and English"],
      "typical_question_styles": ["Repondez aux questions en francais, en utilisant vos propres mots", "Trouvez dans le texte un mot ou une expression qui signifie...", "Traduisez le passage en anglais", "Recrivez la phrase en commencant par les mots donnes"],
      "exam_weight": 20,
      "prerequisites": ["IGCSE/O Level French or equivalent B1 competence"],
      "common_misconceptions": ["Lifting text verbatim when questions require own words", "Translating word-for-word producing unnatural English", "Missing the meaning shift caused by the subjunctive or conditional", "Assuming cognates always share meaning (false friends)"],
      "exemplar_question_stems": ["Answer in French, using your own words, why the author considers the trend worrying", "Translate into English the paragraph beginning with the indicated sentence"]
    },
    {
      "name": "AS: Listening and Speaking",
      "subtopics": ["Understanding authentic recordings: interviews, reports, discussions", "Note-taking and gap-fill from audio", "Presentation of a prepared topic", "Topic conversation with follow-up questions", "General conversation across AS themes", "Pronunciation, intonation and fluency development"],
      "learning_objectives": ["Extract detail and opinion from authentic spoken French at natural speed", "Present a researched topic and defend viewpoints", "Sustain spontaneous conversation with accurate core grammar", "Deploy discussion strategies: agreeing, countering, exemplifying"],
      "key_concepts": ["Liaison and elision in fast speech", "Register variation in spoken French", "Opinion frameworks: je soutiens que, il me semble que", "Question anticipation in prepared topics", "Fillers and repair strategies (alors, en fait, c'est-a-dire)"],
      "assessment_objectives": ["Understand spoken French from a range of sources", "Communicate ideas fluently and accurately in speech", "Develop and justify points of view orally"],
      "typical_question_styles": ["Ecoutez l'enregistrement et completez les phrases", "Answer comprehension questions on the interview", "Present your chosen topic, then answer questions probing your views", "Discussion moves to related themes from the AS topic list"],
      "exam_weight": 20,
      "prerequisites": ["Core aural exposure and speaking practice"],
      "common_misconceptions": ["Trying to understand every word instead of listening for sense units", "Reciting memorised monologues that ignore the questions asked", "Believing perfect accent matters more than range and accuracy", "Avoiding complex structures out of caution, capping the mark"],
      "exemplar_question_stems": ["Listen to the report on youth employment and note the three measures proposed", "Present your topic on regional identity in the francophone world, then discuss the questions that follow"]
    },
    {
      "name": "AS: Essay Writing and Themes",
      "subtopics": ["Discursive essay in French on AS themes", "AS theme areas: family and relationships, media, education, environment, health, sport and leisure", "Paragraph and argument structuring in French", "Complex structures: subjunctive triggers, si clauses, relative pronouns", "Connectives and cohesion in formal French", "Register and formal essay conventions"],
      "learning_objectives": ["Write structured discursive essays within the word range", "Argue for and against positions with francophone examples", "Deploy complex grammar accurately for higher-range marks", "Maintain formal register and cohesive progression"],
      "key_concepts": ["Introduction-development-conclusion architecture", "Concession and refutation moves (certes... mais)", "Subjunctive after opinion/emotion/doubt triggers", "Nominalisation in formal style", "Topic vocabulary depth across AS themes"],
      "assessment_objectives": ["Communicate ideas in accurate written French", "Organise coherent argument on studied themes", "Use a range of complex structures correctly"],
      "typical_question_styles": ["Ecrivez une redaction sur le sujet donne (between the stated word limits)", "Les reseaux sociaux font plus de mal que de bien. Qu'en pensez-vous?", "Essay titles offer a statement to discuss with a required stance or balance"],
      "exam_weight": 20,
      "prerequisites": ["AS reading strand grammar foundations"],
      "common_misconceptions": ["Writing narrative when the title demands discursive argument", "Ignoring word limits in either direction", "Avoiding the subjunctive entirely and losing complexity credit", "Translating English idioms literally into French"],
      "exemplar_question_stems": ["La protection de l'environnement est la responsabilite de chacun. Discutez", "L'ecole prepare-t-elle vraiment les jeunes a la vie adulte? Donnez votre avis"]
    },
    {
      "name": "A2: Advanced Reading, Summary and Translation into French",
      "subtopics": ["Comprehension of two related texts on A2 themes", "Questions in French demanding inference and synthesis", "Summary in French of key points across texts", "Translation from English into French", "Advanced grammar accuracy under transfer pressure", "A2 themes: society, technology, culture and francophone world issues"],
      "learning_objectives": ["Synthesise and compare arguments across paired texts", "Summarise in precise French within tight word limits", "Translate English passages into accurate, idiomatic French", "Control advanced grammar: agreement chains, pronoun order, tense sequencing"],
      "key_concepts": ["Cross-text synthesis technique", "Word-limit discipline in summary", "Translation traps: tense mapping, prepositions, faux amis", "Object pronoun placement and agreement of the past participle", "Francophone cultural referents in A2 texts"],
      "assessment_objectives": ["Understand and synthesise complex written French", "Produce accurate French in summary and translation"],
      "typical_question_styles": ["Repondez aux questions sur les deux textes", "Resumez en francais les points principaux des deux textes (word limit given)", "Traduisez en francais le passage suivant", "Comparez les points de vue presentes dans les deux textes"],
      "exam_weight": 20,
      "prerequisites": ["AS strands"],
      "common_misconceptions": ["Summarising one text and neglecting the second", "Exceeding summary limits with illustration rather than points", "Mapping English continuous tenses mechanically onto French", "Forgetting past participle agreement with preceding direct objects"],
      "exemplar_question_stems": ["Summarise in French, within the word limit, the arguments both texts make about remote work", "Translate into French the passage about changing consumer habits"]
    },
    {
      "name": "A2: Texts, Culture and Extended Essay",
      "subtopics": ["Study of set literary texts or cultural topics", "Essay in French on studied texts/topics", "Character, theme and technique analysis in French", "Contextual and societal background of studied works", "Constructing literary argument with textual evidence", "Comparative points across works where relevant"],
      "learning_objectives": ["Analyse studied texts or cultural topics in accurate French", "Support literary argument with precise references", "Relate works to their social and cultural contexts", "Write extended critical essays with structured argumentation in French"],
      "key_concepts": ["Analysis vs plot summary distinction", "Literary present usage in French criticism", "Theme-evidence-comment paragraphing", "Cultural context as interpretive support", "Critical vocabulary: le recit, le personnage, la mise en scene, l'ironie"],
      "assessment_objectives": ["Demonstrate knowledge and understanding of studied works", "Construct critical argument in accurate written French"],
      "typical_question_styles": ["Analysez le role du personnage principal dans l'oeuvre etudiee", "Dans quelle mesure ce texte reflete-t-il la societe de son epoque?", "Essay titles invite argument on theme, character or technique in the studied work"],
      "exam_weight": 20,
      "prerequisites": ["A2 reading strand", "Study of the chosen texts/topics"],
      "common_misconceptions": ["Retelling the story instead of analysing it", "Quoting at length without commenting on the quotation", "Writing about the author's life instead of the text", "Neglecting French accuracy while concentrating on literary content"],
      "exemplar_question_stems": ["Analysez comment l'auteur presente le conflit entre tradition et modernite dans l'oeuvre etudiee", "Le denouement de l'oeuvre est-il satisfaisant? Justifiez votre reponse avec des references precises"]
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
