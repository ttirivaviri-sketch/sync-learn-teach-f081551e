-- Seed verified curriculum template: IEB Grade 12 Business Studies
-- Adapted from the NSC CAPS-aligned seed: IEB assesses the same national
-- curriculum with its own examination style (greater emphasis on higher-order
-- unseen application, integrated scenarios and extended discursive responses).
-- Content policy: strand structure and approximate weightings reflect publicly
-- documented syllabus organisation (factual information). All exemplar
-- question stems are original paraphrases written for this project; no exam-board
-- text is reproduced.
-- Idempotent: ON CONFLICT upsert only overwrites rows previously sourced from
-- 'ai' or 'hybrid'; human-verified rows are never clobbered.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES (
  'IEB',
  'Grade 12',
  'Business Studies',
  $topics$
[
  {
    "name": "Impact of Recent Legislation on Business",
    "subtopics": [
      "Labour Relations Act",
      "Basic Conditions of Employment Act",
      "Employment Equity Act",
      "Skills Development Act",
      "Broad-Based Black Economic Empowerment Act",
      "Consumer Protection Act",
      "National Credit Act",
      "Compensation for Occupational Injuries and Diseases Act"
    ],
    "learning_objectives": [
      "Outline the purpose of each major piece of business legislation",
      "Analyse the impact of each Act on businesses and employees",
      "Discuss actions regarded as non-compliance and their penalties",
      "Evaluate the advantages and disadvantages of each Act for businesses",
      "Recommend ways businesses can comply with legislation",
      "Apply the Acts to given business scenarios"
    ],
    "key_concepts": [
      "Labour relations",
      "Employment equity",
      "Skills development",
      "BBBEE pillars",
      "Consumer rights",
      "Responsible credit",
      "Compliance"
    ],
    "assessment_objectives": [
      "Demonstrate knowledge of legislation and its purposes",
      "Apply, analyse and evaluate legislation in business contexts",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Scenario-based questions identifying the applicable Act",
      "Discuss the impact of an Act on businesses",
      "Essay evaluating compliance strategies",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Grade 11 Business Studies foundations"
    ],
    "common_misconceptions": [
      "Confusing the purposes of the Employment Equity Act and the BBBEE Act",
      "Believing the Basic Conditions of Employment Act sets actual wage levels for all sectors",
      "Assuming the Consumer Protection Act removes all consumer responsibility",
      "Treating compliance as optional for small businesses",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Quote from the scenario to identify the Act that Thabo's employer has contravened, and motivate your answer.",
      "Discuss the impact of the Skills Development Act on businesses.",
      "Evaluate the effectiveness of the National Credit Act in protecting consumers against reckless lending.",
      "Advise businesses on ways to comply with the Employment Equity Act."
    ]
  },
  {
    "name": "Macro Environment: Business Strategies",
    "subtopics": [
      "The relationship between business environments and control",
      "Steps in strategy formulation and evaluation",
      "Industrial analysis tools: PESTLE and Porter's Five Forces",
      "SWOT analysis",
      "Types of business strategies: integration, intensive, diversification, defensive",
      "Applying strategies to challenges from the macro environment"
    ],
    "learning_objectives": [
      "Explain the extent of control businesses have over the three business environments",
      "Apply the steps in strategy formulation to a scenario",
      "Use PESTLE and Porter's Five Forces to analyse a business's position",
      "Conduct a SWOT analysis from case-study information",
      "Classify and explain integration, intensive, diversification and defensive strategies",
      "Recommend appropriate strategies for given macro-environment challenges"
    ],
    "key_concepts": [
      "Micro, market and macro environments",
      "Strategy formulation",
      "PESTLE",
      "Porter's Five Forces",
      "SWOT",
      "Strategy types"
    ],
    "assessment_objectives": [
      "Apply strategic tools to business scenarios",
      "Evaluate and recommend strategic responses",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Case-study analysis using Porter's Five Forces",
      "Identify-and-classify questions on strategies from a scenario",
      "Essay recommending strategies for a struggling business",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Impact of Recent Legislation on Business"
    ],
    "common_misconceptions": [
      "Confusing forward with backward vertical integration",
      "Treating SWOT strengths and opportunities as interchangeable",
      "Believing divestiture and liquidation are the same defensive strategy",
      "Assuming businesses can control the macro environment",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Identify the type of strategy applied by Neo Traders in each case from the scenario, and motivate your answers.",
      "Explain how a supermarket chain could use Porter's Five Forces model to analyse its competitive position.",
      "Distinguish between market penetration and market development as intensive strategies, using examples.",
      "Suggest a defensive strategy for a business facing sustained losses in one of its divisions, and justify your choice."
    ]
  },
  {
    "name": "Human Resources Function",
    "subtopics": [
      "Recruitment: internal and external sources",
      "Selection procedure and interviews",
      "Employment contracts and legal requirements",
      "Induction and placement",
      "Salary determination: piecemeal and time-related",
      "Employee benefits and fringe benefits",
      "Skills development and training",
      "Implications of labour legislation for human resources"
    ],
    "learning_objectives": [
      "Outline the recruitment procedure and compare internal and external recruitment",
      "Describe the selection procedure including screening and interviewing",
      "Explain the legal requirements of an employment contract",
      "Discuss the purpose and benefits of induction",
      "Distinguish piecemeal from time-related salary determination",
      "Explain employee benefits and their implications for businesses",
      "Link the human resources function to relevant labour legislation"
    ],
    "key_concepts": [
      "Recruitment and selection",
      "Employment contract",
      "Induction",
      "Remuneration methods",
      "Fringe benefits",
      "Training and development"
    ],
    "assessment_objectives": [
      "Demonstrate knowledge of human resources activities",
      "Apply and evaluate HR practices in business scenarios",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Scenario question identifying HR activities",
      "Discuss the advantages of internal recruitment",
      "Essay on the role of the HR function in maintaining a productive workforce",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Impact of Recent Legislation on Business"
    ],
    "common_misconceptions": [
      "Confusing recruitment (attracting) with selection (choosing)",
      "Believing an employment contract can waive statutory rights",
      "Treating induction and training as the same process",
      "Assuming fringe benefits are legally required in all cases",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Name the salary determination method used by Duma Manufacturers in the scenario and motivate your answer.",
      "Discuss the advantages of external recruitment for a growing business.",
      "Explain the aspects that must be included in an employment contract to comply with the law.",
      "Advise a business on the benefits of a well-planned induction programme for new employees."
    ]
  },
  {
    "name": "Professionalism, Ethics and Creative Thinking",
    "subtopics": [
      "Professionalism vs ethics",
      "Principles of professional, responsible and ethical business practice",
      "Unethical practices: unfair advertising, pricing, taxation evasion, abuse of work time",
      "Dealing with unethical business practices",
      "Creative thinking and problem-solving in the workplace",
      "Problem-solving techniques: Delphi, force-field analysis, brainstorming, nominal group technique"
    ],
    "learning_objectives": [
      "Distinguish professionalism from ethics with examples",
      "Apply the principles of ethical behaviour to business situations",
      "Identify unethical practices and suggest ways to address them",
      "Explain the benefits of creative thinking in the workplace",
      "Apply problem-solving techniques including the Delphi technique and force-field analysis",
      "Distinguish problem-solving from decision-making"
    ],
    "key_concepts": [
      "Professionalism",
      "Business ethics",
      "Unethical practices",
      "Creative thinking",
      "Delphi technique",
      "Force-field analysis"
    ],
    "assessment_objectives": [
      "Apply ethical principles and creative techniques to scenarios",
      "Evaluate responses to ethical challenges",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Scenario question identifying unethical practices",
      "Explain how a business could apply the Delphi technique",
      "Essay on the role of creative thinking in solving business problems",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Grade 11 Business Studies foundations"
    ],
    "common_misconceptions": [
      "Treating professionalism and ethics as identical",
      "Believing tax avoidance and tax evasion are both illegal",
      "Confusing brainstorming rules by allowing early criticism of ideas",
      "Assuming the Delphi technique requires a face-to-face meeting",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Identify the unethical practice evident in the scenario at Zola Suppliers, and recommend how it should be addressed.",
      "Explain how force-field analysis can help a business decide whether to relocate its factory.",
      "Distinguish between professionalism and ethics, giving one workplace example of each.",
      "Discuss the advantages of using the nominal group technique when generating solutions to a workplace problem."
    ]
  },
  {
    "name": "Corporate Social Responsibility and Social Issues",
    "subtopics": [
      "Corporate social responsibility vs corporate social investment",
      "Components of CSR",
      "The triple bottom line",
      "Ways businesses can contribute to communities",
      "Socio-economic issues: unemployment, inequality, HIV/AIDS in the workplace, piracy, gambling",
      "Benefits and challenges of CSR/CSI for businesses and communities"
    ],
    "learning_objectives": [
      "Distinguish corporate social responsibility from corporate social investment",
      "Explain the triple bottom line: people, planet, profit",
      "Discuss ways businesses can address socio-economic issues",
      "Analyse the impact of socio-economic issues on business operations",
      "Evaluate the benefits and drawbacks of CSI projects for businesses and communities",
      "Recommend workplace programmes that address social challenges responsibly"
    ],
    "key_concepts": [
      "CSR vs CSI",
      "Triple bottom line",
      "Stakeholder wellbeing",
      "Socio-economic issues",
      "Community upliftment",
      "Sustainability"
    ],
    "assessment_objectives": [
      "Demonstrate understanding of business's social role",
      "Evaluate CSR initiatives and their impact",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Distinguish CSR from CSI using a scenario",
      "Discuss the impact of a socio-economic issue on businesses",
      "Essay evaluating a company's CSI project",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Professionalism, Ethics and Creative Thinking"
    ],
    "common_misconceptions": [
      "Using CSR and CSI interchangeably without distinction",
      "Believing CSI is legally compulsory in all cases",
      "Treating CSR as pure charity with no business benefit",
      "Assuming social programmes have no measurable outcomes",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Identify whether the initiative by Kganya Ltd in the scenario is CSR or CSI, and motivate your answer.",
      "Discuss the impact of unemployment on businesses and communities.",
      "Evaluate the benefits of corporate social investment for a company's public image and for the receiving community.",
      "Recommend ways in which a business can support employees affected by chronic illness while maintaining productivity."
    ]
  },
  {
    "name": "Forms of Ownership and Investment: Securities and Insurance",
    "subtopics": [
      "Forms of ownership: sole proprietorship to public company, revision in Grade 12 context",
      "Success factors of ownership forms in relation to taxation, capital, management and legislation",
      "The Johannesburg Securities Exchange and its functions",
      "Types of shares: ordinary, preference and debentures",
      "Investment concepts: risk, return, liquidity",
      "Simple vs compound interest calculations",
      "Compulsory and non-compulsory insurance",
      "Insurance concepts: insurable interest, indemnification, over- and under-insurance"
    ],
    "learning_objectives": [
      "Evaluate forms of ownership against criteria of taxation, management, capital and continuity",
      "Explain the functions of the JSE in the economy",
      "Compare types of shares and debentures as investment options",
      "Assess investment opportunities in terms of risk, return and liquidity",
      "Calculate returns using simple and compound interest",
      "Distinguish compulsory from non-compulsory insurance",
      "Apply insurance principles including indemnification and insurable interest to scenarios"
    ],
    "key_concepts": [
      "Forms of ownership",
      "JSE functions",
      "Shares and debentures",
      "Risk-return trade-off",
      "Compound interest",
      "Insurance principles"
    ],
    "assessment_objectives": [
      "Apply investment and insurance concepts including calculations",
      "Evaluate ownership and investment decisions",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Calculation questions on simple and compound interest",
      "Scenario question recommending an investment option",
      "Discuss the functions of the JSE",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Grade 11 Business Studies foundations"
    ],
    "common_misconceptions": [
      "Believing preference shareholders always have voting rights",
      "Confusing debentures (loans) with shares (ownership)",
      "Applying simple interest when compounding is specified",
      "Thinking indemnification allows profit from an insurance claim",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the value of an investment of R50 000 after three years at 9% per annum compound interest, showing all working.",
      "Advise an investor who requires low risk and a steady income on whether to choose ordinary shares, preference shares or debentures.",
      "Explain the principle of insurable interest, using an example from the scenario.",
      "Discuss the functions of the Johannesburg Securities Exchange in the South African economy."
    ]
  },
  {
    "name": "Presentation of Information and Data Response",
    "subtopics": [
      "Preparing a presentation: factors to consider",
      "Visual aids and their effective use",
      "Handling feedback and questions professionally",
      "Interpreting graphs, tables and business data",
      "Written business reports and their structure",
      "Responding to data in business contexts"
    ],
    "learning_objectives": [
      "Identify factors to consider when preparing and delivering a presentation",
      "Select appropriate visual aids for different audiences and information types",
      "Explain how to respond professionally to questions and feedback",
      "Interpret business information presented in graphs and tables",
      "Structure a short business report with findings and recommendations",
      "Draw conclusions and make recommendations from given data"
    ],
    "key_concepts": [
      "Presentation planning",
      "Visual aids",
      "Professional feedback handling",
      "Data interpretation",
      "Report structure",
      "Recommendations"
    ],
    "assessment_objectives": [
      "Demonstrate knowledge of effective communication of business information",
      "Interpret data and communicate conclusions appropriately",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Advise on factors to consider before a presentation",
      "Interpret the graph and answer data-response questions",
      "Recommend improvements to an ineffective presentation",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Macro Environment: Business Strategies"
    ],
    "common_misconceptions": [
      "Believing more slides always improve a presentation",
      "Reading data points without considering trends or context",
      "Responding defensively to audience criticism",
      "Confusing a summary with a recommendation in a report",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Advise the marketing manager on factors to consider when preparing a presentation for potential investors.",
      "Study the graph showing quarterly sales and identify two trends, suggesting a possible reason for each.",
      "Explain how a presenter should handle difficult questions from the audience after a presentation.",
      "Recommend two visual aids suitable for presenting financial results to shareholders, and motivate each choice."
    ]
  },
  {
    "name": "Quality of Performance and Business Functions",
    "subtopics": [
      "Quality concepts: quality control, assurance, management",
      "Total Quality Management (TQM) elements",
      "The role of each business function in quality performance",
      "Quality indicators for each business function",
      "Impact of TQM elements on large businesses",
      "Benefits and costs of quality management systems",
      "Continuous improvement processes: PDCA cycle"
    ],
    "learning_objectives": [
      "Define quality and distinguish control, assurance and management",
      "Explain the elements of Total Quality Management",
      "Describe quality indicators for the eight business functions",
      "Analyse how TQM elements reduce the cost of quality when properly applied",
      "Evaluate the impact of poor quality management on a business",
      "Apply the PDCA cycle to continuous improvement scenarios"
    ],
    "key_concepts": [
      "Quality control vs assurance vs management",
      "TQM elements",
      "Business function indicators",
      "Cost of quality",
      "Continuous improvement",
      "PDCA cycle"
    ],
    "assessment_objectives": [
      "Demonstrate knowledge of quality concepts across business functions",
      "Evaluate quality management practices in scenarios",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Identify the business function and its quality indicators from a scenario",
      "Discuss the impact of TQM elements on large businesses",
      "Essay evaluating a business's quality performance",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Human Resources Function"
    ],
    "common_misconceptions": [
      "Using quality control and quality assurance interchangeably",
      "Believing quality is the responsibility of one department only",
      "Assuming TQM benefits appear immediately without investment",
      "Ignoring the cost implications of poor quality",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Identify the quality indicators of the purchasing function evident in the scenario at Bokamoso Ltd.",
      "Discuss how total client satisfaction as a TQM element can improve the performance of a large business.",
      "Explain the difference between quality control and quality assurance, using a manufacturing example.",
      "Apply the PDCA cycle to advise a bakery on reducing the number of customer complaints about late deliveries."
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
