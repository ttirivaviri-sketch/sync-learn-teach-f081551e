-- Seed verified curriculum topic template: Cambridge IGCSE History
-- Strand structure reflects the factual 20th-century core-content
-- organisation (international relations 1919-c.2000) plus a depth study
-- and source-based historical skills. All exemplar question stems are
-- original compositions; no exam-board paper text is reproduced.
-- Idempotent: only overwrites rows whose source is 'ai' or 'hybrid'.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES ('CAMB', 'IGCSE', 'History', $topics$[
  {
    "name": "The Peace Treaties of 1919-1923",
    "subtopics": ["Aims of the Big Three at Versailles", "Terms of the Treaty of Versailles", "German reactions to the treaty", "The other settlements: St Germain, Trianon, Neuilly, Sevres and Lausanne", "Strengths and weaknesses of the settlement", "Justifications and criticisms of the peacemakers"],
    "learning_objectives": ["Compare the aims of Wilson, Clemenceau and Lloyd George at the Paris Peace Conference", "Describe the territorial, military and financial terms imposed on Germany", "Explain why Germans resented the treaty, including war guilt and reparations", "Outline the settlements imposed on Austria, Hungary, Bulgaria and Turkey", "Evaluate whether the treaties were fair given the circumstances of 1919", "Assess the extent to which the peacemakers could have done better"],
    "key_concepts": ["War guilt", "Reparations", "Self-determination", "Diktat", "Demilitarisation", "Territorial adjustment"],
    "assessment_objectives": ["Recall and explain key features of the peace settlement", "Evaluate interpretations and reach supported judgements"],
    "typical_question_styles": ["Describe questions on treaty terms", "Explain-why questions on reactions and motives", "How-far/assessment essay with balanced argument"],
    "exam_weight": 12,
    "prerequisites": [],
    "common_misconceptions": ["Believing Wilson wanted to punish Germany as harshly as Clemenceau did", "Assuming Germany attended the negotiations as an equal partner", "Confusing the Treaty of Versailles with the other 1919-23 settlements", "Thinking reparations were paid in full"],
    "exemplar_question_stems": ["Describe the main military restrictions placed on Germany by the Treaty of Versailles.", "Explain why Clemenceau and Wilson disagreed over how to treat Germany.", "'The Treaty of Versailles was a fair settlement.' How far do you agree with this statement? Explain your answer.", "Explain why many Germans called the Treaty of Versailles a 'diktat'."]
  },
  {
    "name": "The League of Nations",
    "subtopics": ["Aims and organisation of the League", "Membership problems: absence of the USA", "Successes and failures of the 1920s", "Humanitarian and administrative work", "The Manchurian Crisis 1931-1933", "The Abyssinian Crisis 1935-1936", "Reasons for the League's collapse"],
    "learning_objectives": ["Describe the structure and aims of the League of Nations", "Explain how the absence of major powers weakened the League", "Assess the League's border-dispute record in the 1920s", "Describe the League's work on refugees, health and working conditions", "Analyse the causes, events and consequences of the Manchurian and Abyssinian crises", "Evaluate the reasons why the League failed to prevent aggression in the 1930s"],
    "key_concepts": ["Collective security", "Sanctions", "Moral condemnation", "Great-power self-interest", "Appeasement context", "International cooperation"],
    "assessment_objectives": ["Explain the League's operation and record", "Evaluate the relative importance of reasons for its failure"],
    "typical_question_styles": ["Describe questions on League structure or agencies", "Explain-why questions on specific crises", "How-far essay weighing reasons for failure"],
    "exam_weight": 12,
    "prerequisites": ["The Peace Treaties of 1919-1923"],
    "common_misconceptions": ["Believing the USA was a member of the League", "Assuming the League had its own army", "Treating the 1920s successes as involving major powers", "Blaming the League's failure on a single cause"],
    "exemplar_question_stems": ["Describe the work of the League of Nations in helping refugees during the 1920s.", "Explain why economic sanctions failed to stop Italy in Abyssinia.", "'The Manchurian Crisis destroyed the credibility of the League of Nations.' How far do you agree?", "Explain why the absence of the USA weakened the League of Nations."]
  },
  {
    "name": "The Collapse of International Peace 1933-1939",
    "subtopics": ["Hitler's foreign policy aims", "Rearmament and the Saar", "Remilitarisation of the Rhineland 1936", "Anschluss with Austria 1938", "The Sudetenland and the Munich Agreement 1938", "The end of Czechoslovakia and the Polish guarantee", "The Nazi-Soviet Pact and outbreak of war", "Appeasement: reasons and criticisms"],
    "learning_objectives": ["Outline Hitler's foreign policy aims and their link to Versailles grievances", "Describe the steps by which Germany overturned the Versailles settlement", "Explain the reasons for British and French appeasement", "Analyse the significance of the Munich Agreement", "Explain why the Nazi-Soviet Pact made war more likely", "Evaluate the relative responsibility of different factors for the outbreak of war in 1939"],
    "key_concepts": ["Lebensraum", "Appeasement", "Remilitarisation", "Anschluss", "Munich Agreement", "Nazi-Soviet Pact"],
    "assessment_objectives": ["Explain the sequence and significance of crises in the 1930s", "Evaluate causation and reach balanced judgements"],
    "typical_question_styles": ["Describe questions on individual crises", "Explain-why questions on appeasement", "How-far essay on responsibility for the outbreak of war"],
    "exam_weight": 13,
    "prerequisites": ["The League of Nations"],
    "common_misconceptions": ["Believing appeasement began only at Munich", "Assuming the Nazi-Soviet Pact reflected genuine friendship between the two powers", "Thinking Britain and France were militarily ready for war in 1938", "Treating the outbreak of war as inevitable from 1933"],
    "exemplar_question_stems": ["Describe the events of the Anschluss between Germany and Austria in 1938.", "Explain why Chamberlain followed a policy of appeasement towards Germany.", "'The Munich Agreement was a sensible policy at the time.' How far do you agree? Explain your answer.", "Explain why Hitler and Stalin signed the Nazi-Soviet Pact in August 1939."]
  },
  {
    "name": "The Origins of the Cold War 1945-1949",
    "subtopics": ["The Yalta and Potsdam conferences", "Ideological differences between the superpowers", "Soviet expansion in Eastern Europe", "The Iron Curtain and the Truman Doctrine", "Marshall Aid and its purposes", "Cominform and Comecon", "The Berlin Blockade and Airlift 1948-1949", "Formation of NATO"],
    "learning_objectives": ["Compare the agreements and disagreements at Yalta and Potsdam", "Explain the ideological gulf between the USA and the USSR", "Describe how the USSR gained control over Eastern Europe", "Analyse the aims and impact of the Truman Doctrine and Marshall Plan", "Explain the causes, events and results of the Berlin Blockade", "Evaluate which side was more responsible for the start of the Cold War"],
    "key_concepts": ["Superpower rivalry", "Ideology: capitalism vs communism", "Spheres of influence", "Containment", "Blockade and airlift", "Alliance systems"],
    "assessment_objectives": ["Explain the breakdown of the wartime alliance", "Evaluate responsibility and significance using evidence"],
    "typical_question_styles": ["Describe questions on conferences or crises", "Explain-why questions on superpower actions", "How-far essay on responsibility for the Cold War"],
    "exam_weight": 13,
    "prerequisites": ["The Collapse of International Peace 1933-1939"],
    "common_misconceptions": ["Believing the Cold War involved direct fighting between the superpowers", "Confusing the Berlin Blockade of 1948 with the Berlin Wall of 1961", "Assuming Marshall Aid was offered without political purpose", "Treating the Eastern European takeovers as identical in every country"],
    "exemplar_question_stems": ["Describe the disagreements between the Allies at the Potsdam Conference.", "Explain why the USA introduced the Marshall Plan in 1947.", "'Stalin was more to blame than Truman for the start of the Cold War.' How far do you agree?", "Explain why the Western Allies responded to the Berlin Blockade with an airlift rather than force."]
  },
  {
    "name": "The Cold War Crises and Containment 1950-1975",
    "subtopics": ["The Korean War: causes, events, results", "The arms race and the space race", "The Cuban Missile Crisis 1962", "The Berlin Wall 1961", "The Vietnam War: US involvement and methods", "Opposition to the Vietnam War and US withdrawal", "Detente in the early 1970s"],
    "learning_objectives": ["Explain why the USA became involved in Korea and assess the outcome", "Describe the development of the nuclear arms race", "Analyse the causes, key decisions and results of the Cuban Missile Crisis", "Explain why the Berlin Wall was built and its consequences", "Analyse the reasons for and failure of US intervention in Vietnam", "Evaluate the success of containment as a policy between 1950 and 1975"],
    "key_concepts": ["Containment", "Domino theory", "Brinkmanship", "Mutually assured destruction", "Guerrilla warfare", "Detente"],
    "assessment_objectives": ["Explain the course and outcomes of Cold War confrontations", "Evaluate the success of superpower policies"],
    "typical_question_styles": ["Describe questions on crisis events", "Explain-why questions on superpower decisions", "How-far essay on the success of containment"],
    "exam_weight": 13,
    "prerequisites": ["The Origins of the Cold War 1945-1949"],
    "common_misconceptions": ["Believing the Korean War ended with a peace treaty rather than an armistice", "Assuming the Cuban Missile Crisis was resolved by public concessions only", "Thinking US forces lost every battle in Vietnam", "Confusing detente with the end of the Cold War"],
    "exemplar_question_stems": ["Describe the events of the Cuban Missile Crisis of October 1962.", "Explain why the USA found it difficult to defeat the Viet Cong.", "'Containment was a successful policy between 1950 and 1975.' How far do you agree? Explain your answer.", "Explain why the East German government built the Berlin Wall in 1961."]
  },
  {
    "name": "The End of the Cold War and the Gulf 1970-2000",
    "subtopics": ["Soviet invasion of Afghanistan 1979", "Reagan and the Second Cold War", "Gorbachev: glasnost and perestroika", "The collapse of Soviet control in Eastern Europe 1989", "The fall of the Berlin Wall and German reunification", "The break-up of the USSR", "Saddam Hussein and the Iran-Iraq War", "The invasion of Kuwait and the First Gulf War 1990-1991"],
    "learning_objectives": ["Explain the causes and consequences of the Soviet war in Afghanistan", "Describe the renewed tension of the early 1980s", "Analyse the impact of Gorbachev's reforms on the Soviet bloc", "Explain the events of 1989 in Eastern Europe and their causes", "Evaluate the reasons for the collapse of the USSR", "Explain the causes and outcomes of the Gulf conflicts involving Iraq"],
    "key_concepts": ["Glasnost and perestroika", "People power", "Sinatra doctrine", "Reunification", "Regional conflict", "Coalition warfare"],
    "assessment_objectives": ["Explain the processes that ended the Cold War", "Evaluate the relative importance of leaders, economics and popular movements"],
    "typical_question_styles": ["Describe questions on the events of 1989-1991", "Explain-why questions on Gorbachev's reforms", "How-far essay on why Soviet control collapsed"],
    "exam_weight": 12,
    "prerequisites": ["The Cold War Crises and Containment 1950-1975"],
    "common_misconceptions": ["Believing Gorbachev intended to dissolve the USSR", "Assuming the Berlin Wall fell as a result of a planned government decision", "Treating the collapse of communism as caused by one factor alone", "Confusing the Iran-Iraq War with the First Gulf War"],
    "exemplar_question_stems": ["Describe the events in Berlin in November 1989.", "Explain why Gorbachev's policies weakened Soviet control over Eastern Europe.", "'Economic weakness was the main reason for the collapse of the USSR.' How far do you agree?", "Explain why an international coalition went to war against Iraq in 1991."]
  },
  {
    "name": "Depth Study: Germany 1918-1945",
    "subtopics": ["The Weimar Republic: constitution and early crises", "The 1923 crises: Ruhr occupation and hyperinflation", "Stresemann and recovery 1924-1929", "The rise of the Nazi Party and Hitler's appointment", "Consolidation of power 1933-1934", "Life in Nazi Germany: control, propaganda, persecution", "Young people, women and workers under the Nazis", "Opposition and the impact of the Second World War on Germany"],
    "learning_objectives": ["Explain the strengths and weaknesses of the Weimar constitution", "Analyse how Germany survived the crises of 1923 and recovered under Stresemann", "Explain the factors behind the rise of the Nazis including the Depression", "Describe the steps by which Hitler established a dictatorship in 1933-34", "Analyse the methods of Nazi control including propaganda, police state and persecution", "Evaluate the extent of opposition and the effects of war on German civilians"],
    "key_concepts": ["Proportional representation", "Hyperinflation", "Depression politics", "Enabling Act", "Police state and propaganda", "Persecution", "Total war"],
    "assessment_objectives": ["Demonstrate detailed knowledge of the depth study period", "Analyse causation and evaluate interpretations within the period"],
    "typical_question_styles": ["Describe questions on specific events or policies", "Explain-why questions on the rise and consolidation of Nazi power", "How-far essay weighing causes or the extent of control"],
    "exam_weight": 13,
    "prerequisites": ["The Peace Treaties of 1919-1923"],
    "common_misconceptions": ["Believing Hitler seized power through a coup rather than legal appointment", "Assuming hyperinflation (1923) and the Depression (1929) were the same crisis", "Thinking all Germans supported the Nazi regime", "Confusing the Reichstag Fire with the Night of the Long Knives"],
    "exemplar_question_stems": ["Describe the effects of hyperinflation on the German people in 1923.", "Explain why support for the Nazi Party grew between 1929 and 1932.", "'Propaganda was the most important method of Nazi control over Germany.' How far do you agree?", "Explain how the Enabling Act helped Hitler to establish a dictatorship."]
  },
  {
    "name": "Source Skills and Historical Interpretation",
    "subtopics": ["Comprehension and inference from written sources", "Analysing cartoons, posters and photographs", "Evaluating reliability, purpose and audience", "Cross-referencing sources for agreement and disagreement", "Using contextual knowledge to test sources", "Reaching judgements on a source-based issue"],
    "learning_objectives": ["Extract explicit and implicit meaning from written and visual sources", "Interpret the message and purpose of cartoons and propaganda", "Assess the reliability and utility of sources using provenance and content", "Compare sources to identify agreement, disagreement and reasons for difference", "Deploy contextual knowledge to confirm or challenge source claims", "Construct a balanced judgement on an issue using a set of sources"],
    "key_concepts": ["Inference", "Provenance", "Purpose and audience", "Reliability vs utility", "Cross-referencing", "Corroboration"],
    "assessment_objectives": ["Comprehend, interpret and evaluate historical sources in context", "Use sources critically to reach a supported conclusion"],
    "typical_question_styles": ["What is the message of this cartoon questions", "How far do these sources agree questions", "How useful/reliable is this source questions", "Judgement question using all sources on an issue"],
    "exam_weight": 12,
    "prerequisites": [],
    "common_misconceptions": ["Dismissing a source as useless simply because it is biased", "Describing a source's content instead of analysing its message", "Judging reliability from tone alone without checking provenance and context", "Ignoring the date and audience of a source when interpreting it"],
    "exemplar_question_stems": ["Study the cartoon published in a British newspaper in 1936. What is the cartoonist's message? Use details of the cartoon and your knowledge to explain your answer.", "How far does Source A agree with Source B about the causes of the crisis? Explain your answer using the sources.", "How useful is this speech to a historian studying public opinion at the time? Use the source and your knowledge to explain your answer.", "'The sources show that the policy was a failure.' How far do the sources support this statement?"]
  }
]$topics$::jsonb, 'verified', now())
ON CONFLICT (curriculum, grade, subject)
DO UPDATE SET
  topics = EXCLUDED.topics,
  source = 'verified',
  verified_at = now(),
  updated_at = now()
WHERE curriculum_topic_templates.source IN ('ai', 'hybrid');
