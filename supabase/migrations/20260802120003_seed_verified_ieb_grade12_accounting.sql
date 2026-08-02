-- Seed verified curriculum template: IEB Grade 12 Accounting
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
  'Accounting',
  $topics$
[
  {
    "name": "Companies: Concepts, Ledger Accounts and Financial Statements",
    "subtopics": [
      "Company concepts: shares, dividends, directors, shareholders",
      "Unique company ledger accounts: share capital, retained income, SARS income tax, shareholders for dividends",
      "Issue of shares and buy-back of shares",
      "Income statement (statement of comprehensive income) with adjustments",
      "Balance sheet (statement of financial position) and notes",
      "Retained income note and dividends calculations",
      "Year-end adjustments including income tax"
    ],
    "learning_objectives": [
      "Explain company concepts including types of shares and the roles of directors and shareholders",
      "Record share issues, buy-backs and dividends in the ledger",
      "Prepare the income statement of a company with year-end adjustments",
      "Prepare the balance sheet and supporting notes of a company",
      "Calculate income tax, interim and final dividends and retained income",
      "Apply matching and prudence principles to adjustments"
    ],
    "key_concepts": [
      "Share capital",
      "Retained income",
      "Dividends",
      "Income tax",
      "Financial statements",
      "Year-end adjustments"
    ],
    "assessment_objectives": [
      "Prepare accurate company financial statements and notes",
      "Apply accounting principles to company transactions",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Prepare-the-statement questions with adjustments",
      "Ledger account completion for company accounts",
      "Short theory questions on company concepts",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 18,
    "prerequisites": [
      "Grade 11 Accounting foundations"
    ],
    "common_misconceptions": [
      "Treating dividends as an expense in the income statement",
      "Confusing interim dividends paid with final dividends declared",
      "Forgetting that income tax is calculated on net profit, not turnover",
      "Recording a share buy-back at issue price instead of buy-back price",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Prepare the Retained Income note for Zenzele Ltd on 28 February, taking the information provided into account.",
      "Calculate the final dividends payable to shareholders, given the number of shares in issue and the dividend declared per share.",
      "Prepare the Income Statement of Kusile Ltd for the year ended 30 June after accounting for the adjustments provided.",
      "Explain the difference between authorised and issued share capital."
    ]
  },
  {
    "name": "Analysis and Interpretation of Financial Statements",
    "subtopics": [
      "Profitability ratios: gross profit on sales, net profit on sales, return on equity",
      "Liquidity ratios: current, acid test, stock turnover rate, debtors collection, creditors payment periods",
      "Solvency and gearing: debt-equity ratio, return on capital employed",
      "Dividend pay-out rate and earnings per share",
      "Interpreting trends and comparing to benchmarks",
      "Commenting on financial decisions: loans, dividends, share price",
      "Audit reports: unqualified, qualified, disclaimer"
    ],
    "learning_objectives": [
      "Calculate the full range of prescribed financial indicators",
      "Interpret indicators to comment on profitability, liquidity, solvency and gearing",
      "Compare performance across years and against competitors",
      "Advise on decisions such as raising loans or changing dividend policy using indicators",
      "Evaluate share performance including net asset value and market price",
      "Interpret the meaning of different audit report opinions for stakeholders"
    ],
    "key_concepts": [
      "Profitability",
      "Liquidity",
      "Solvency",
      "Gearing",
      "Earnings and dividends per share",
      "Audit opinions"
    ],
    "assessment_objectives": [
      "Calculate financial indicators accurately",
      "Analyse and evaluate financial performance with supported comments",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Calculate-and-comment questions quoting figures and trends",
      "Advise-the-directors questions using indicators",
      "Theory questions on audit report types",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 16,
    "prerequisites": [
      "Companies: Concepts, Ledger Accounts and Financial Statements"
    ],
    "common_misconceptions": [
      "Quoting a ratio without the comparative figure or trend when commenting",
      "Believing high liquidity is always good regardless of idle funds",
      "Confusing return on equity with return on capital employed",
      "Assuming a qualified audit report means the company is bankrupt",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the debt-equity ratio on 28 February and comment on whether the company is making good use of loan capital. Quote figures.",
      "The directors want to increase the loan from R500 000 to R2 million. Quote and explain two financial indicators the bank would consider.",
      "Comment on the liquidity of the company. Quote three financial indicators with figures and trends to support your answer.",
      "Explain why shareholders should be concerned if the company receives a disclaimer of opinion from its auditors."
    ]
  },
  {
    "name": "Cash Flow Statements",
    "subtopics": [
      "Purpose and structure of the cash flow statement",
      "Cash effects of operating activities",
      "Adjustments for non-cash items: depreciation",
      "Changes in working capital",
      "Cash effects of investing activities: fixed assets and investments",
      "Cash effects of financing activities: shares and loans",
      "Interpreting the cash flow statement alongside financial statements"
    ],
    "learning_objectives": [
      "Explain the purpose of a cash flow statement and its three sections",
      "Calculate cash generated from operations with the required adjustments",
      "Calculate taxation and dividends paid",
      "Determine fixed assets purchased or sold and movements in loans and share capital",
      "Complete a cash flow statement and its notes",
      "Interpret cash flow information to comment on the quality of financial decisions"
    ],
    "key_concepts": [
      "Operating activities",
      "Investing activities",
      "Financing activities",
      "Non-cash adjustments",
      "Working capital changes",
      "Cash vs profit"
    ],
    "assessment_objectives": [
      "Prepare cash flow statements and supporting calculations",
      "Interpret cash flow patterns and evaluate decisions",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Complete sections of the cash flow statement",
      "Calculate taxation paid or dividends paid",
      "Comment on the company's cash management using the statement",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Companies: Concepts, Ledger Accounts and Financial Statements"
    ],
    "common_misconceptions": [
      "Treating depreciation as a cash outflow",
      "Confusing dividends declared with dividends paid",
      "Reading an increase in debtors as a cash inflow",
      "Believing a profitable company cannot have negative operating cash flow",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the income tax paid during the year, using the balances and the tax expense provided.",
      "Complete the note for cash generated from operations for the year ended 30 June.",
      "The company shows a large profit but a decrease in cash. Explain two reasons evident from the cash flow statement.",
      "Calculate the proceeds from the sale of fixed assets, given the carrying values and purchases for the year."
    ]
  },
  {
    "name": "Inventory Systems and Valuation",
    "subtopics": [
      "Perpetual vs periodic inventory systems",
      "Inventory valuation methods: FIFO, weighted average, specific identification",
      "Calculating closing stock values under each method",
      "Effect of valuation method on profit",
      "Stock holding period and stock turnover",
      "Detecting and addressing stock losses",
      "Choosing an appropriate system and method for a business"
    ],
    "learning_objectives": [
      "Distinguish the perpetual from the periodic inventory system with their ledger implications",
      "Value closing inventory using FIFO and weighted average methods",
      "Explain when specific identification is appropriate",
      "Analyse the effect of the chosen method on gross profit in changing price conditions",
      "Calculate stock turnover rates and holding periods and interpret them",
      "Identify possible stock losses and recommend control measures"
    ],
    "key_concepts": [
      "Perpetual vs periodic systems",
      "FIFO",
      "Weighted average",
      "Specific identification",
      "Stock turnover",
      "Stock losses"
    ],
    "assessment_objectives": [
      "Apply valuation methods with accurate calculations",
      "Evaluate inventory decisions and control measures",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Calculate closing stock using a specified method",
      "Compare profits under different valuation methods",
      "Advise on an appropriate inventory system for a given business",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Grade 11 Accounting foundations"
    ],
    "common_misconceptions": [
      "Believing FIFO values closing stock at the oldest prices",
      "Recalculating weighted average without including carriage on purchases",
      "Assuming the valuation method changes the physical flow of goods",
      "Ignoring drawings of stock when reconciling inventory",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the value of the closing stock of Ohlanga Traders on 28 February using the weighted-average method.",
      "The owner is considering switching from FIFO to weighted average in a period of rising prices. Explain the effect on gross profit.",
      "Calculate the number of days it takes the business to sell its average stock, and comment on whether this is acceptable for a fruit retailer.",
      "Identify two indicators of possible stock theft from the information provided, and suggest an internal control for each."
    ]
  },
  {
    "name": "Fixed Assets and Depreciation",
    "subtopics": [
      "Fixed asset note: cost, accumulated depreciation, carrying value",
      "Depreciation methods: cost price and diminishing balance",
      "Purchases and disposals of fixed assets during the year",
      "Profit or loss on disposal",
      "Asset registers and internal control over assets",
      "Interpreting fixed asset decisions: replacement and lifespan"
    ],
    "learning_objectives": [
      "Complete the fixed assets note including additions and disposals",
      "Calculate depreciation using the cost price and diminishing balance methods, including for part of a year",
      "Record the disposal of an asset and calculate profit or loss on sale",
      "Explain the purpose of an asset register",
      "Evaluate internal controls over fixed assets",
      "Comment on decisions about replacing or retaining ageing assets"
    ],
    "key_concepts": [
      "Carrying value",
      "Depreciation methods",
      "Asset disposal",
      "Profit/loss on sale",
      "Asset register",
      "Internal control"
    ],
    "assessment_objectives": [
      "Perform accurate fixed asset and depreciation calculations",
      "Evaluate asset management and controls",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Complete the fixed asset note",
      "Calculate depreciation for assets bought or sold during the year",
      "Comment on asset management decisions from a scenario",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 10,
    "prerequisites": [
      "Companies: Concepts, Ledger Accounts and Financial Statements"
    ],
    "common_misconceptions": [
      "Depreciating for a full year when the asset was bought mid-year",
      "Applying the diminishing balance rate to cost instead of carrying value",
      "Forgetting that land is generally not depreciated",
      "Confusing carrying value with market value",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the depreciation on the vehicle sold on 31 October, and the profit or loss on its disposal.",
      "Complete the fixed assets note for equipment for the year ended 28 February.",
      "Explain why the carrying value of an asset may differ significantly from the price it fetches when sold.",
      "Suggest two internal control measures over movable fixed assets, and explain how each prevents losses."
    ]
  },
  {
    "name": "Budgeting: Cash Budgets and Projected Income Statements",
    "subtopics": [
      "Purpose of budgeting and the budget period",
      "Cash budget: receipts from debtors, payments to creditors",
      "Debtors collection and creditors payment schedules",
      "Distinguishing cash from non-cash items in budgets",
      "Projected income statement",
      "Comparing budgeted to actual figures and taking action",
      "Evaluating spending decisions from a budget"
    ],
    "learning_objectives": [
      "Explain the purpose of a cash budget and a projected income statement",
      "Prepare debtors collection and creditors payment schedules",
      "Complete sections of a cash budget",
      "Distinguish which items appear in a cash budget versus a projected income statement",
      "Analyse variances between budgeted and actual figures",
      "Advise a business on decisions revealed by budget information"
    ],
    "key_concepts": [
      "Cash budget",
      "Debtors collection schedule",
      "Creditors payment schedule",
      "Projected income statement",
      "Variance analysis",
      "Cash vs accrual items"
    ],
    "assessment_objectives": [
      "Prepare budget schedules and figures accurately",
      "Interpret budget information and advise on decisions",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Complete the debtors collection schedule",
      "Calculate specific budgeted figures",
      "Comment on variances and the owner's spending decisions",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Cash Flow Statements"
    ],
    "common_misconceptions": [
      "Including depreciation in a cash budget",
      "Ignoring credit terms when scheduling debtor receipts",
      "Treating the projected income statement as a cash document",
      "Assuming an unfavourable variance always indicates poor management",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Complete the Debtors Collection Schedule for March and April, given that 30% of sales are for cash.",
      "Explain why depreciation appears in the projected income statement but not in the cash budget.",
      "The actual advertising expense was far below budget while sales dropped. Comment on this decision by the owner.",
      "Calculate the expected payments to creditors in May, given the credit terms of 60 days."
    ]
  },
  {
    "name": "Cost Accounting for Manufacturing",
    "subtopics": [
      "Cost concepts: direct/indirect materials and labour",
      "Cost categories: prime cost, factory overheads, administration and selling costs",
      "Production cost statement",
      "Notes: direct materials cost, direct labour cost, factory overhead cost",
      "Unit costs and break-even analysis",
      "Interpreting break-even point against production levels",
      "Ethical and control issues in manufacturing"
    ],
    "learning_objectives": [
      "Classify costs into direct materials, direct labour, overheads, administration and selling",
      "Prepare the production cost statement with supporting notes",
      "Calculate unit costs of production",
      "Calculate the break-even point and compare it to actual production",
      "Comment on cost trends and their effect on unit costs",
      "Identify control weaknesses over materials and labour in a factory"
    ],
    "key_concepts": [
      "Direct vs indirect costs",
      "Prime cost",
      "Factory overheads",
      "Production cost statement",
      "Unit cost",
      "Break-even point"
    ],
    "assessment_objectives": [
      "Prepare manufacturing statements and cost calculations",
      "Interpret cost and break-even information for decisions",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Complete the production cost statement",
      "Calculate and interpret the break-even point",
      "Comment on unit cost changes with reasons",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Inventory Systems and Valuation"
    ],
    "common_misconceptions": [
      "Classifying factory cleaners' wages as direct labour",
      "Including selling expenses in the production cost statement",
      "Reading production above break-even as automatic maximum profit",
      "Ignoring work-in-progress adjustments in the statement",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Prepare the Direct Materials Cost note for the year ended 28 February.",
      "Calculate the break-even point for Umlilo Manufacturers and comment on it in relation to the 12 000 units produced.",
      "The unit cost of direct labour increased sharply while production decreased. Give two possible reasons for this trend.",
      "Classify each of the given costs as direct materials, direct labour, factory overheads, administration or selling costs."
    ]
  },
  {
    "name": "Internal Control, Ethics and VAT",
    "subtopics": [
      "Internal control processes over cash, debtors, creditors and stock",
      "Division of duties and documentation",
      "Ethical responsibilities of accountants and directors",
      "Corporate governance basics including the role of audits",
      "VAT concepts: standard rate, zero-rated, exempt supplies",
      "VAT calculations: input and output VAT, amounts payable or receivable",
      "Ethical issues around VAT: fraud and evasion"
    ],
    "learning_objectives": [
      "Recommend internal controls for cash, stock, debtors and creditors",
      "Explain the importance of division of duties and documentation",
      "Apply ethical principles to accounting scenarios including director conduct",
      "Explain the role of internal and external audit in governance",
      "Calculate VAT payable to or receivable from the revenue service",
      "Identify VAT fraud and explain its consequences"
    ],
    "key_concepts": [
      "Internal control",
      "Division of duties",
      "Ethics and governance",
      "Input and output VAT",
      "Zero-rated vs exempt",
      "VAT fraud"
    ],
    "assessment_objectives": [
      "Apply control and ethical principles to scenarios",
      "Perform accurate VAT calculations",
      "Demonstrate higher-order analysis, evaluation and synthesis expected at IEB level, including integration across topics"
    ],
    "typical_question_styles": [
      "Identify control weaknesses and recommend improvements",
      "Calculate the VAT amount payable/receivable",
      "Comment on ethical conduct in a scenario",
      "Extended discursive/response questions requiring integrated argument across topics with independently structured answers (IEB style)"
    ],
    "exam_weight": 11,
    "prerequisites": [
      "Analysis and Interpretation of Financial Statements"
    ],
    "common_misconceptions": [
      "Confusing zero-rated supplies with exempt supplies",
      "Calculating VAT on VAT-inclusive amounts using the standard rate directly",
      "Believing internal control is only about preventing theft by employees",
      "Treating small VAT understatements as harmless",
      "Preparing only for structured recall questions and being caught out by IEB's emphasis on unseen application, integrated scenarios and independently structured extended responses"
    ],
    "exemplar_question_stems": [
      "Calculate the amount of VAT owed to SARS at the end of the period, using the figures provided.",
      "Identify two internal control weaknesses in the handling of cash at Siyaya Stores and recommend an improvement for each.",
      "Explain the difference between zero-rated and exempt supplies, giving one example of each.",
      "The bookkeeper recorded fictitious purchases to increase input VAT. Explain the consequences of this action for the business and the bookkeeper."
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
