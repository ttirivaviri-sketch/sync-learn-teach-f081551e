-- Seed verified curriculum template: Cambridge O Level Geography
-- Adapted from the Cambridge IGCSE seed: O Level assesses the same Cambridge
-- curriculum content through an untiered, examination-only assessment model.
-- Content policy: strand structure and approximate weightings reflect publicly
-- documented syllabus organisation (factual information). All exemplar
-- question stems are original paraphrases written for this project; no exam-board
-- text is reproduced.
-- Idempotent: ON CONFLICT upsert only overwrites rows previously sourced from
-- 'ai' or 'hybrid'; human-verified rows are never clobbered.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES (
  'CAMB',
  'O-Level',
  'Geography',
  $topics$
[
  {
    "name": "Population Dynamics",
    "subtopics": [
      "World population growth and distribution",
      "Over-population and under-population",
      "Causes and rates of population change: birth rate, death rate, natural increase",
      "The demographic transition model",
      "Population policies: pro-natalist and anti-natalist",
      "Population structure and population pyramids",
      "Dependency ratios and ageing populations"
    ],
    "learning_objectives": [
      "Describe and explain the global pattern of population distribution and density",
      "Explain the causes and consequences of over-population and under-population",
      "Interpret birth rates, death rates and rates of natural increase",
      "Apply the demographic transition model to countries at different development stages",
      "Interpret and compare population pyramids for contrasting countries",
      "Evaluate population policies using named examples"
    ],
    "key_concepts": [
      "Distribution vs density",
      "Natural increase",
      "Demographic transition model",
      "Population pyramids",
      "Dependency ratio",
      "Population policy"
    ],
    "assessment_objectives": [
      "Demonstrate knowledge and understanding of population processes",
      "Interpret demographic data and evaluate responses to population change",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Population pyramid interpretation with data response",
      "Explain the causes of population change using a named example",
      "Structured question building from definitions to extended explanation with a case study",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Lower secondary geography foundations"
    ],
    "common_misconceptions": [
      "Confusing population distribution with density",
      "Believing over-population depends only on total numbers rather than resources",
      "Reading a wide pyramid base as an ageing population",
      "Assuming anti-natalist policies work instantly",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Study the two population pyramids provided. Compare the population structures of country A and country B.",
      "For a named country you have studied, explain the causes of its rapid population growth.",
      "Explain how an ageing population may create problems for a country's government.",
      "Describe the main changes in birth rate and death rate that occur between stages 2 and 4 of the demographic transition model."
    ]
  },
  {
    "name": "Migration and Settlement",
    "subtopics": [
      "Types of migration: internal, international, voluntary, forced",
      "Push and pull factors",
      "Impacts of migration on origin and destination areas",
      "Settlement patterns, site and situation",
      "Settlement hierarchies and services",
      "Rural settlements and rural change",
      "Land use models of urban areas"
    ],
    "learning_objectives": [
      "Classify migration flows and explain push and pull factors with examples",
      "Evaluate the positive and negative impacts of migration on source and host regions",
      "Explain the factors influencing the site, situation and growth of settlements",
      "Describe settlement hierarchies in terms of population size, services and sphere of influence",
      "Describe and explain urban land use zones: CBD, residential, industrial",
      "Use a named example to illustrate a migration study"
    ],
    "key_concepts": [
      "Push-pull factors",
      "Voluntary vs forced migration",
      "Site and situation",
      "Settlement hierarchy",
      "Sphere of influence",
      "Urban land use zones"
    ],
    "assessment_objectives": [
      "Explain migration and settlement processes",
      "Apply concepts to named examples and map evidence",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Photograph or map interpretation of settlement site",
      "Case-study question on an international migration flow",
      "Short structured questions on settlement hierarchy terms",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Population Dynamics"
    ],
    "common_misconceptions": [
      "Treating all migration as permanent and international",
      "Confusing site (the land itself) with situation (position relative to surroundings)",
      "Assuming larger settlements always provide every service",
      "Believing migration harms only the source country",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "For a named international migration you have studied, explain the push and pull factors involved.",
      "Using the map extract, suggest reasons for the site of settlement X.",
      "Explain the impacts of rural-urban migration on the rural areas left behind.",
      "Describe how the number and type of services change as settlement size increases."
    ]
  },
  {
    "name": "Urban Environments",
    "subtopics": [
      "Urbanisation: causes and global patterns",
      "Problems of urban growth in LEDCs: squatter settlements, service provision",
      "Problems in MEDC cities: congestion, housing, inner-city decline",
      "Urban sprawl and its effects",
      "Solutions: new towns, urban renewal, squatter settlement upgrading",
      "Impacts of urban growth on the environment",
      "Sustainable urban management"
    ],
    "learning_objectives": [
      "Explain the causes of urbanisation and the growth of megacities",
      "Describe the characteristics and problems of squatter settlements using a named example",
      "Analyse urban problems in cities of richer countries",
      "Evaluate strategies to manage urban growth including upgrading schemes",
      "Explain the environmental impacts of urban areas including air pollution and waste",
      "Discuss what makes urban living more sustainable"
    ],
    "key_concepts": [
      "Urbanisation",
      "Megacities",
      "Squatter settlements",
      "Urban sprawl",
      "Urban renewal",
      "Sustainable city management"
    ],
    "assessment_objectives": [
      "Analyse urban problems and evaluate management strategies",
      "Support answers with named case-study detail",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Case-study question on managing squatter settlements",
      "Photo interpretation of urban environments",
      "Evaluate a strategy for reducing urban traffic or pollution",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Migration and Settlement"
    ],
    "common_misconceptions": [
      "Using 'urbanisation' to mean any city growth rather than a rising urban percentage",
      "Assuming squatter settlements have no economic activity or community organisation",
      "Believing demolition is the standard solution to informal housing",
      "Treating urban problems as identical in rich and poor cities",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "For a named city in a developing country, describe the problems caused by rapid urban growth and evaluate one attempt to solve them.",
      "Explain why squatter settlements often develop on the edges of large cities.",
      "Suggest how city planners could reduce traffic congestion in a large city.",
      "Explain two ways in which a large urban area can affect its local environment."
    ]
  },
  {
    "name": "Earthquakes and Volcanoes",
    "subtopics": [
      "Structure of the Earth and plate tectonics",
      "Plate boundaries: constructive, destructive, conservative",
      "Distribution of earthquakes and volcanoes",
      "Causes and features of volcanic eruptions",
      "Causes and measurement of earthquakes",
      "Impacts of tectonic hazards on people",
      "Why people live in hazard zones and hazard management"
    ],
    "learning_objectives": [
      "Describe the global distribution of earthquakes and volcanoes in relation to plate boundaries",
      "Explain the processes operating at different plate boundaries",
      "Describe the main features of volcanoes and types of eruption",
      "Explain how earthquakes are caused and measured",
      "Analyse the primary and secondary impacts of a named earthquake or eruption",
      "Evaluate reasons for living in hazardous areas and strategies to reduce risk"
    ],
    "key_concepts": [
      "Plate tectonics",
      "Plate boundaries",
      "Focus and epicentre",
      "Volcano types",
      "Primary vs secondary impacts",
      "Hazard preparedness"
    ],
    "assessment_objectives": [
      "Explain tectonic processes and hazard distribution",
      "Evaluate hazard impacts and responses using named events",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Map question on hazard distribution",
      "Diagram-based explanation of a plate boundary",
      "Case-study question on the impacts of and responses to a tectonic event",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Lower secondary physical geography foundations"
    ],
    "common_misconceptions": [
      "Believing volcanoes and earthquakes occur randomly across the globe",
      "Confusing the focus with the epicentre of an earthquake",
      "Assuming all plate boundaries produce volcanoes",
      "Thinking hazard deaths depend only on the magnitude of the event",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Describe the global distribution of volcanoes shown on the map.",
      "With the aid of a diagram, explain what happens at a destructive plate boundary.",
      "For a named earthquake you have studied, describe its impacts on people and property.",
      "Suggest reasons why people continue to live close to an active volcano."
    ]
  },
  {
    "name": "Rivers and Coasts",
    "subtopics": [
      "The drainage basin system",
      "River processes: erosion, transportation, deposition",
      "River landforms: waterfalls, meanders, ox-bow lakes, deltas, flood plains",
      "Causes and impacts of river flooding, flood management",
      "Wave types and coastal processes",
      "Coastal landforms: cliffs, wave-cut platforms, spits, bars",
      "Coral reefs and mangroves",
      "Coastal management strategies"
    ],
    "learning_objectives": [
      "Describe the components and flows of a drainage basin",
      "Explain river erosion, transport and deposition processes",
      "Explain the formation of major river landforms with diagrams",
      "Analyse the causes and effects of flooding and evaluate management responses",
      "Explain marine processes and the formation of coastal landforms",
      "Describe the conditions needed for coral reefs and mangroves and evaluate coastal protection methods"
    ],
    "key_concepts": [
      "Drainage basin",
      "Erosion processes: hydraulic action, abrasion, attrition, solution",
      "River landforms",
      "Flood hydrographs",
      "Longshore drift",
      "Hard vs soft engineering"
    ],
    "assessment_objectives": [
      "Explain fluvial and marine processes and resulting landforms",
      "Interpret diagrams, maps and hydrographs and evaluate management options",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Annotated diagram question on landform formation",
      "Hydrograph or map interpretation",
      "Case-study question evaluating flood or coastal management",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Lower secondary physical geography foundations"
    ],
    "common_misconceptions": [
      "Confusing erosion with weathering",
      "Believing rivers only deposit at the mouth",
      "Reversing the direction of longshore drift relative to prevailing wind",
      "Assuming hard engineering permanently stops erosion",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "With the aid of labelled diagrams, explain the formation of an ox-bow lake.",
      "Explain how longshore drift moves material along a coastline.",
      "For a named river flood you have studied, describe its causes and evaluate the responses.",
      "Suggest why some coastal communities choose groynes while others prefer beach nourishment."
    ]
  },
  {
    "name": "Weather, Climate and Ecosystems",
    "subtopics": [
      "Measuring weather: instruments and the Stevenson screen",
      "Interpreting weather data and clouds",
      "Equatorial climate: characteristics and location",
      "Hot desert climate: characteristics and location",
      "Tropical rainforest ecosystem and deforestation",
      "Hot desert ecosystem and adaptation",
      "Interrelations of climate, vegetation and soil"
    ],
    "learning_objectives": [
      "Describe how the main weather elements are measured and recorded",
      "Interpret weather station data, graphs and cloud observations",
      "Describe and explain the characteristics of equatorial and hot desert climates",
      "Explain plant and animal adaptations in rainforest and desert ecosystems",
      "Analyse the causes and effects of tropical deforestation using a named area",
      "Explain the links between climate, natural vegetation and human activity"
    ],
    "key_concepts": [
      "Weather instruments",
      "Climate graphs",
      "Equatorial and desert climates",
      "Ecosystem adaptation",
      "Deforestation",
      "Climate-vegetation links"
    ],
    "assessment_objectives": [
      "Use and interpret meteorological data accurately",
      "Explain ecosystem characteristics and evaluate human impacts",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Instrument identification and reading questions",
      "Climate graph comparison",
      "Case-study question on deforestation causes and impacts",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Lower secondary physical geography foundations"
    ],
    "common_misconceptions": [
      "Confusing weather with climate",
      "Placing the maximum thermometer reading as the current temperature",
      "Believing deserts are always hot at night",
      "Assuming rainforest soils are fertile because vegetation is lush",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Explain why a Stevenson screen is painted white and raised above the ground.",
      "Compare the climate graphs of an equatorial location and a hot desert location.",
      "For a named area of tropical rainforest, explain the causes and effects of deforestation.",
      "Describe two ways in which desert plants are adapted to survive long periods without rain."
    ]
  },
  {
    "name": "Development, Industry and Tourism",
    "subtopics": [
      "Indicators of development and inequality",
      "Classifying production: primary, secondary, tertiary, quaternary",
      "Globalisation and transnational corporations",
      "Location and impact of manufacturing industry",
      "Growth of tourism and its physical and human attractions",
      "Benefits and disadvantages of tourism",
      "Sustainable tourism and management of destinations"
    ],
    "learning_objectives": [
      "Use development indicators including GNI per capita, HDI and literacy to compare countries",
      "Explain causes of inequality between and within countries",
      "Describe the changing importance of economic sectors as countries develop",
      "Analyse the factors influencing the location of a named industrial zone or factory",
      "Evaluate the benefits and problems of tourism for a named destination",
      "Discuss strategies for making tourism more sustainable"
    ],
    "key_concepts": [
      "Development indicators",
      "Employment structure",
      "Globalisation and TNCs",
      "Industrial location factors",
      "Multiplier effect of tourism",
      "Sustainable tourism"
    ],
    "assessment_objectives": [
      "Interpret development and employment data",
      "Evaluate economic activities and their management using named examples",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Data response using development indicator tables",
      "Case-study question on a named industrial area or TNC",
      "Evaluate tourism impacts for a named destination",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Urban Environments"
    ],
    "common_misconceptions": [
      "Relying on GNI per capita alone to judge development",
      "Believing employment structures are fixed as countries develop",
      "Assuming tourism benefits stay entirely within the destination country",
      "Treating TNCs as purely harmful or purely beneficial",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Using the table of development indicators, compare the levels of development of the three countries shown.",
      "For a named transnational corporation, describe the advantages and disadvantages it brings to one of its host countries.",
      "Explain why the proportion of workers in agriculture usually falls as a country develops.",
      "For a named tourist area, evaluate the extent to which tourism has brought more benefits than problems."
    ]
  },
  {
    "name": "Geographical and Fieldwork Skills",
    "subtopics": [
      "Topographic map reading: grid references, scale, distance, direction",
      "Contours, cross-sections and relief interpretation",
      "Interpreting photographs and satellite images",
      "Graphs and diagrams: line, bar, pie, scatter, flow",
      "Fieldwork question design and hypotheses",
      "Data collection methods: sampling, counts, surveys, measurements",
      "Data presentation, analysis, conclusions and evaluation"
    ],
    "learning_objectives": [
      "Give and read four- and six-figure grid references and measure distance and direction on maps",
      "Interpret relief from contour patterns and draw simple cross-sections",
      "Extract and describe geographical information from photographs and maps together",
      "Select and interpret appropriate graphical techniques for geographical data",
      "Design fieldwork investigations with clear hypotheses and justified sampling methods",
      "Analyse fieldwork data, draw conclusions and evaluate reliability and limitations"
    ],
    "key_concepts": [
      "Grid references",
      "Scale and distance",
      "Contour interpretation",
      "Graphical techniques",
      "Hypothesis and sampling",
      "Reliability and evaluation"
    ],
    "assessment_objectives": [
      "Apply map and graphical skills accurately",
      "Plan, present, analyse and evaluate fieldwork investigations",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Map extract questions on grid references, distance and relief",
      "Fieldwork scenario questions on methods and sampling",
      "Data presentation choice and criticism questions",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 18,
    "prerequisites": [
      "Basic map reading and data-handling skills"
    ],
    "common_misconceptions": [
      "Reversing eastings and northings in grid references",
      "Reading closely spaced contours as gentle slopes",
      "Choosing a graph type that does not match the data",
      "Believing a larger sample automatically removes all bias",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Give the six-figure grid reference of the school shown on the map extract.",
      "Describe the relief of the area shown in grid squares 2334 and 2434.",
      "A student wants to test whether pedestrian counts fall with distance from the CBD. Describe a suitable data collection method and sampling strategy.",
      "Suggest one strength and one weakness of using questionnaires to investigate shopping habits."
    ]
  }
]
$topics$::jsonb,
  'verified',
  now()
)
ON CONFLICT (curriculum, grade, subject) DO UPDATE
SET topics = EXCLUDED.topics,
    source = 'verified',
    verified_at = now(),
    updated_at = now()
WHERE curriculum_topic_templates.source IN ('ai', 'hybrid');
