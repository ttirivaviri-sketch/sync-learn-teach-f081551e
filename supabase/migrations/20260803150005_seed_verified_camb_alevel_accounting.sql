-- Seed verified curriculum template: Cambridge International AS & A Level Accounting
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
  'Accounting',
  $topics$[
    {
      "name": "AS: The Accounting System and Financial Statement Preparation",
      "subtopics": ["Double entry recap and books of prime entry", "Trial balance, suspense accounts and error correction", "Adjustments: accruals, prepayments, depreciation, provisions", "Financial statements of sole traders", "Bank reconciliations and control accounts", "Accounting concepts and their application"],
      "learning_objectives": ["Prepare financial statements incorporating full adjustment sets", "Correct errors through journal and suspense account with profit restatement", "Reconcile control accounts and bank records", "Justify accounting treatments using concepts"],
      "key_concepts": ["Accruals/matching driving adjustments", "Depreciation methods and their rationale", "Control accounts as arithmetic checks", "Suspense account clearance", "Concept hierarchy: prudence, consistency, materiality, going concern, substance"],
      "assessment_objectives": ["Prepare accounting records and statements accurately", "Analyse errors and their effects", "Explain treatments by reference to concepts"],
      "typical_question_styles": ["Prepare the income statement and statement of financial position with the adjustments listed", "Journalise the corrections and prepare a statement of corrected profit", "Prepare the sales ledger control account and reconcile it with the list of balances", "Explain which concept supports the treatment described"],
      "exam_weight": 15,
      "prerequisites": ["IGCSE/O Level Accounting or equivalent bookkeeping"],
      "common_misconceptions": ["Treating every error as requiring the suspense account", "Adjusting profit the wrong direction for expense understatements", "Confusing provision for depreciation with a cash fund", "Applying prudence to justify arbitrary understatement"],
      "exemplar_question_stems": ["The draft profit is given before the discovery of five errors; prepare the corrected profit statement", "Prepare the year-end financial statements from the trial balance and six adjustment notes"]
    },
    {
      "name": "AS: Partnership and Limited Company Accounting",
      "subtopics": ["Partnership appropriation, capital and current accounts", "Admission and retirement of partners; goodwill", "Revaluation of assets on partnership changes", "Company share capital: issues at par and premium", "Debentures and reserves", "Company financial statements including statement of changes in equity"],
      "learning_objectives": ["Prepare partnership accounts through structural changes", "Account for goodwill on admission and retirement without retaining it in the books", "Record share issues, rights issues and bonus issues", "Prepare company financial statements in required formats"],
      "key_concepts": ["Profit-sharing ratios old vs new", "Goodwill adjustment through capital accounts", "Revaluation surplus allocation", "Share premium account uses", "Capital vs revenue reserves distinction"],
      "assessment_objectives": ["Prepare accounts for changing ownership structures", "Apply company accounting regulations correctly", "Explain the reasoning behind equity structures"],
      "typical_question_styles": ["Prepare the revaluation account and partners' capital accounts on admission", "Prepare journal entries for the rights issue and the bonus issue", "Prepare the appropriation account after the partnership change part-way through the year", "Explain the difference between a rights issue and a bonus issue for shareholders"],
      "exam_weight": 14,
      "prerequisites": ["AS accounting system strand"],
      "common_misconceptions": ["Leaving goodwill in the books when it should be written back", "Splitting a whole year's profit in new ratios despite a mid-year change", "Treating share premium as distributable profit", "Confusing bonus issues (capitalising reserves) with rights issues (raising cash)"],
      "exemplar_question_stems": ["A new partner is admitted with goodwill valued at the stated amount but not to remain in the books; prepare the capital accounts", "Prepare the statement of changes in equity after the dividend, transfer and share issue"]
    },
    {
      "name": "AS: Ratio Analysis, Reconstruction and Non-Structured Entities",
      "subtopics": ["Profitability, liquidity and efficiency ratio sets", "Interpreting and commenting on ratio movements", "Incomplete records reconstruction", "Non-profit organisations: income and expenditure", "Inventory valuation issues", "Limitations of financial statements and ratios"],
      "learning_objectives": ["Calculate and interpret the AS ratio set", "Reconstruct accounts from incomplete information using ratios and control accounts", "Prepare statements for clubs and societies", "Discuss the limitations of ratio-based judgements"],
      "key_concepts": ["Margin vs mark-up relationships", "Working capital cycle", "Statement of affairs technique", "Subscriptions timing adjustments", "Window dressing awareness"],
      "assessment_objectives": ["Calculate ratios accurately and interpret them in context", "Reconstruct missing figures methodically", "Evaluate performance with awareness of limitations"],
      "typical_question_styles": ["Calculate the ratios and comment on the change in performance", "Calculate the sales figure using the mark-up and inventory data", "Prepare the income and expenditure account of the society", "Discuss two limitations of using these ratios to compare the two businesses"],
      "exam_weight": 13,
      "prerequisites": ["AS financial statements strand"],
      "common_misconceptions": ["Confusing margin with mark-up in reconstruction", "Interpreting every ratio rise as improvement regardless of type", "Treating a receipts and payments account as an income statement", "Ignoring non-financial factors in performance judgements"],
      "exemplar_question_stems": ["Using the gross margin and the inventory figures, calculate the missing purchases figure", "Calculate three profitability ratios and two liquidity ratios and assess the company's year"]
    },
    {
      "name": "AS: Costing Fundamentals",
      "subtopics": ["Cost classification and behaviour", "Absorption costing: overhead allocation, apportionment and absorption", "Marginal costing and contribution", "Cost-volume-profit analysis and break-even", "Job and unit costing", "Reconciling absorption and marginal profit"],
      "learning_objectives": ["Classify costs by behaviour and traceability", "Compute overhead absorption rates and apply them to jobs", "Apply contribution analysis to break-even and target profit problems", "Reconcile profits under absorption and marginal costing"],
      "key_concepts": ["Fixed, variable, semi-variable and stepped costs", "Over- and under-absorption of overheads", "Contribution per unit and per limiting factor", "Margin of safety", "Inventory valuation difference between the two systems"],
      "assessment_objectives": ["Perform costing calculations accurately", "Apply CVP analysis to decisions", "Explain differences between costing approaches"],
      "typical_question_styles": ["Calculate the overhead absorption rate and the cost of the job", "Calculate the break-even point and margin of safety", "Prepare profit statements under marginal and absorption costing and reconcile them", "Explain why the two costing systems report different profits"],
      "exam_weight": 14,
      "prerequisites": ["Basic arithmetic and AS financial accounting"],
      "common_misconceptions": ["Treating all overheads as fixed costs", "Using total cost per unit in contribution calculations", "Believing break-even analysis handles multi-product situations without assumptions", "Forgetting inventory movement direction determines which system shows higher profit"],
      "exemplar_question_stems": ["The department budgets the given overheads and machine hours; calculate the absorption rate and the over/under absorption", "Calculate how many units must be sold to achieve the target profit after the cost changes"]
    },
    {
      "name": "A2: Advanced Financial Reporting",
      "subtopics": ["Published company financial statements and IAS awareness", "Statement of cash flows preparation and interpretation", "Non-current asset accounting including revaluation and impairment", "Intangible assets and research vs development", "Business purchase and simple consolidation concepts", "Ethics and the role of the auditor and directors"],
      "learning_objectives": ["Prepare statements of cash flows and interpret liquidity movements", "Apply IAS-aligned treatments to tangible and intangible assets", "Account for the purchase of a business including goodwill", "Discuss stewardship, audit and ethical responsibilities"],
      "key_concepts": ["Operating, investing and financing classifications", "Profit vs cash flow divergence", "Revaluation reserve mechanics", "Capitalisation criteria for development costs", "True and fair view responsibility"],
      "assessment_objectives": ["Prepare advanced statements in required formats", "Apply reporting standards to scenarios", "Evaluate stewardship and ethical issues"],
      "typical_question_styles": ["Prepare the statement of cash flows from the two balance sheets and notes", "Calculate goodwill on the business purchase and prepare the opening entries", "Explain how the research and development expenditure should be treated", "Discuss the directors' responsibilities regarding the financial statements"],
      "exam_weight": 16,
      "prerequisites": ["AS strands"],
      "common_misconceptions": ["Treating depreciation as a cash outflow in the cash flow statement", "Reporting a profitable company as automatically cash-rich", "Capitalising all research and development spending", "Confusing the roles of auditors (opinion) and directors (preparation)"],
      "exemplar_question_stems": ["Prepare the statement of cash flows and comment on the company's liquidity management", "The company acquired the sole trader's business; calculate goodwill and explain its subsequent treatment"]
    },
    {
      "name": "A2: Financial Analysis, Investment Ratios and Sources of Finance",
      "subtopics": ["Investment ratios: EPS, P/E, dividend yield, dividend cover, gearing", "Interpreting statements for different stakeholder decisions", "Sources of finance: equity, debt, leasing and their evaluation", "Working capital management in depth", "Valuation considerations for shares", "Report writing with recommendations"],
      "learning_objectives": ["Calculate and interpret investment and gearing ratios", "Advise stakeholders using tailored analysis", "Evaluate financing options for described expansion scenarios", "Write structured reports with justified recommendations"],
      "key_concepts": ["Gearing and financial risk", "Earnings vs dividend perspectives", "Cost and control implications of debt vs equity", "Cash operating cycle optimisation", "Ratio interpretation tailored to lender vs shareholder needs"],
      "assessment_objectives": ["Compute advanced ratios accurately", "Evaluate financing and investment decisions", "Communicate recommendations with justification"],
      "typical_question_styles": ["Calculate the investment ratios and advise the potential shareholder", "Evaluate whether the company should finance the expansion by shares or debentures", "Assess the company's working capital management using the data", "Write a report recommending whether the bank should grant the loan"],
      "exam_weight": 14,
      "prerequisites": ["A2 reporting strand", "AS ratio strand"],
      "common_misconceptions": ["Treating high gearing as always bad regardless of interest cover and stability", "Comparing P/E ratios across industries without context", "Confusing dividend yield with dividend cover", "Recommending finance sources without linking to gearing and control effects"],
      "exemplar_question_stems": ["Using the ratios calculated, advise the investor choosing between the two companies", "The company needs the stated sum for expansion; evaluate the two financing options and recommend one"]
    },
    {
      "name": "A2: Advanced Management Accounting and Decision Making",
      "subtopics": ["Activity based costing", "Budgeting: functional budgets and the master budget", "Flexible budgets and variance introduction", "Standard costing: material, labour and overhead variances", "Investment appraisal: payback, ARR, NPV, IRR", "Relevant costing for decisions: make or buy, special orders, limiting factors"],
      "learning_objectives": ["Apply ABC and compare with traditional absorption", "Prepare functional budgets and flexed budgets", "Calculate and interpret cost variances with possible causes", "Appraise investments using discounted and non-discounted methods", "Apply relevant costing to short-term decisions"],
      "key_concepts": ["Cost drivers and activity pools", "Budget as plan, control and motivation tool", "Adverse vs favourable variance interpretation", "Time value of money and discount factors", "Sunk and committed costs excluded from decisions", "Contribution per unit of limiting factor ranking"],
      "assessment_objectives": ["Perform advanced management accounting computations", "Interpret results for planning and control", "Recommend decisions using relevant financial and non-financial factors"],
      "typical_question_styles": ["Calculate the product costs under ABC and compare with the current system", "Calculate the material and labour variances and suggest causes", "Appraise the project using NPV and payback and recommend", "Determine the production plan that maximises contribution given the limiting factor"],
      "exam_weight": 14,
      "prerequisites": ["AS costing strand"],
      "common_misconceptions": ["Including sunk costs in decision calculations", "Reading favourable variances as always good management, ignoring quality trade-offs", "Comparing NPV across projects while ignoring scale and lives", "Ranking products by profit per unit instead of contribution per limiting factor"],
      "exemplar_question_stems": ["The machine costs the stated amount with the given cash flows; calculate NPV at the company's cost of capital and advise", "Materials are restricted to the stated quantity; prepare the optimal production plan and the resulting profit"]
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
