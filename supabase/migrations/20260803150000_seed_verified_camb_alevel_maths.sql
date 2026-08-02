-- Seed verified curriculum template: Cambridge International AS & A Level Mathematics
-- Strands are labelled AS (first year) and A2 (second year) reflecting the
-- staged structure of the Cambridge International AS & A Level qualification.
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
  'Mathematics',
  $topics$[
    {
      "name": "AS Pure Mathematics: Algebra, Functions and Coordinate Geometry",
      "subtopics": ["Quadratics: completed square, discriminant, inequalities", "Functions: domain, range, composition, inverse", "Coordinate geometry of lines and circles", "Transformations of graphs", "Simultaneous equations and intersections", "Binomial expansion for positive integer index"],
      "learning_objectives": ["Manipulate quadratic expressions and solve related equations and inequalities", "Work fluently with function notation, composition and inverses", "Solve line and circle problems in the plane", "Expand binomial expressions and extract required terms"],
      "key_concepts": ["Discriminant conditions for roots and tangency", "One-one condition for invertibility", "Perpendicularity and circle geometry via completed square", "Graph transformation order and combination", "General binomial term"],
      "assessment_objectives": ["Apply algebraic techniques accurately in structured and unstructured problems", "Construct and use mathematical models", "Present clear multi-step reasoning"],
      "typical_question_styles": ["Find the set of values of k for which the equation has no real roots", "Find the equation of the circle and the tangent at the given point", "Determine the coefficient of the stated term in the expansion", "Solve the quadratic inequality and represent the answer in set notation"],
      "exam_weight": 15,
      "prerequisites": ["IGCSE/O Level Mathematics (extended) or Additional Mathematics"],
      "common_misconceptions": ["Confusing the conditions for distinct roots, repeated roots and no roots", "Reversing the effect of horizontal graph transformations", "Assuming every function has an inverse without restricting domain", "Sign errors in completed-square form"],
      "exemplar_question_stems": ["The line y = mx + 4 is a tangent to the circle; find the possible values of m", "Express f(x) in completed-square form and hence state the range of f"]
    },
    {
      "name": "AS Pure Mathematics: Sequences, Trigonometry and Circular Measure",
      "subtopics": ["Arithmetic and geometric progressions", "Sum to infinity and convergence", "Radian measure, arc length and sector area", "Trigonometric ratios, graphs and exact values", "Identities and equations in a given interval", "Inverse trigonometric functions basics"],
      "learning_objectives": ["Solve AP/GP problems including contextual modelling", "Apply radian measure to arcs, sectors and segments", "Solve trigonometric equations systematically over given intervals", "Use tan = sin/cos and Pythagorean identities in proofs and equations"],
      "key_concepts": ["Common difference vs common ratio", "|r| < 1 convergence", "Segment area as sector minus triangle", "CAST/quadrant reasoning for multiple solutions", "Principal values of inverse trig functions"],
      "assessment_objectives": ["Apply formulas accurately in multi-step problems", "Model contextual growth and decay with progressions", "Solve trigonometric equations completely over stated domains"],
      "typical_question_styles": ["The second and fourth terms of a GP are given; find the sum to infinity", "Find the exact perimeter and area of the shaded segment", "Solve the trigonometric equation for angles in the given interval in radians", "Prove the given trigonometric identity"],
      "exam_weight": 12,
      "prerequisites": ["AS algebra strand"],
      "common_misconceptions": ["Using degree formulas with radian inputs", "Applying sum to infinity without checking convergence", "Losing solutions by dividing through by a trig factor", "Confusing arithmetic mean questions with geometric mean structure"],
      "exemplar_question_stems": ["An investment pays amounts forming a GP; determine the total paid over ten years and the limiting total", "Solve 3 sin 2x = 2 cos 2x for x between 0 and pi"]
    },
    {
      "name": "AS Pure Mathematics: Differentiation and Integration",
      "subtopics": ["Derivatives of x^n and composite linear functions", "Tangents, normals and rates of change", "Stationary points and curve behaviour", "Integration as antiderivative; definite integrals", "Areas under and between curves", "Volumes of revolution about the x-axis (introduction)"],
      "learning_objectives": ["Differentiate power functions including composite linear arguments", "Apply differentiation to gradients, optima and rates", "Integrate power functions and evaluate definite integrals", "Compute areas bounded by curves and lines"],
      "key_concepts": ["Chain rule for (ax + b)^n", "Second derivative classification", "Constant of integration fixed by a point", "Signed area interpretation", "Increasing/decreasing intervals from f'"],
      "assessment_objectives": ["Differentiate and integrate accurately", "Apply calculus to geometric and contextual problems", "Interpret results in problem contexts"],
      "typical_question_styles": ["Find the coordinates and nature of the stationary points", "The curve passes through the given point with the given gradient function; find its equation", "Find the area enclosed between the curve and the line", "Find the rate of change of the quantity when the variable takes the stated value"],
      "exam_weight": 13,
      "prerequisites": ["AS algebra strand"],
      "common_misconceptions": ["Forgetting the chain-rule factor for composite linear functions", "Omitting the constant of integration", "Treating areas below the axis as automatically positive", "Confusing maximum value of a function with the x-coordinate of the maximum"],
      "exemplar_question_stems": ["A curve has dy/dx = 6x^2 - 8x and passes through (1, 3); find the equation of the curve and its stationary points", "Find the area of the region enclosed by y = 9 - x^2 and y = x + 3"]
    },
    {
      "name": "A2 Pure Mathematics: Further Algebra, Logarithms and Trigonometry",
      "subtopics": ["Modulus equations and inequalities", "Polynomial division, factor and remainder theorems", "Partial fractions", "Exponential and logarithmic functions and equations", "Secant, cosecant, cotangent and further identities", "Compound angle, double angle and R-form"],
      "learning_objectives": ["Solve modulus equations and inequalities graphically and algebraically", "Decompose rational functions into partial fractions including improper cases", "Solve exponential and logarithmic equations including modelling contexts", "Apply compound/double angle formulas and express a sin x + b cos x in R-form"],
      "key_concepts": ["Critical values method for modulus inequalities", "Cover-up and comparing coefficients", "ln and e as inverse pair", "R-form for amplitude and phase", "Identity selection strategy in multi-step trig problems"],
      "assessment_objectives": ["Manipulate advanced algebraic and trigonometric expressions", "Solve equations exactly where required", "Chain multiple techniques in extended problems"],
      "typical_question_styles": ["Express the function in partial fractions and hence integrate it", "Solve the equation involving e and ln, giving exact answers", "Express a sin x + b cos x in R-form and find the maximum value", "Solve the double-angle equation over the given interval"],
      "exam_weight": 13,
      "prerequisites": ["AS pure strands"],
      "common_misconceptions": ["Squaring modulus equations and keeping extraneous roots", "Wrong partial fraction form for repeated factors", "Treating ln(a + b) as ln a + ln b", "Using degrees when the interval is given in radians"],
      "exemplar_question_stems": ["Express 5 sin x + 12 cos x in the form R sin(x + a) and solve the equation equal to 6.5", "Solve |2x - 1| < |x + 3| using critical values"]
    },
    {
      "name": "A2 Pure Mathematics: Further Calculus, Numerical Methods and Vectors",
      "subtopics": ["Product, quotient and chain rules", "Derivatives of trig, exponential and logarithmic functions", "Implicit and parametric differentiation", "Integration by substitution and by parts; partial-fraction integration", "Differential equations with separable variables", "Numerical solution of equations (iteration) and numerical integration (trapezium rule)", "Vectors in three dimensions: lines and scalar product"],
      "learning_objectives": ["Differentiate products, quotients and composite functions of all standard types", "Handle implicit and parametric curves", "Integrate using substitution, parts and partial fractions", "Solve separable differential equations with initial conditions", "Locate roots by iteration and justify convergence graphically", "Solve 3D vector problems with lines and angles"],
      "key_concepts": ["Logarithmic differentiation opportunities", "Choice of u and dv in parts", "General vs particular solutions", "Change of sign root location", "Vector equation of a line and skew/intersecting classification", "Scalar product for angles and perpendicularity"],
      "assessment_objectives": ["Select and execute correct advanced calculus techniques", "Model with differential equations and interpret solutions", "Apply vector methods to geometric configurations"],
      "typical_question_styles": ["Use the substitution given to evaluate the definite integral", "Find dy/dx for the implicitly defined curve at the stated point", "Solve the differential equation and find the particular solution", "Determine whether the two lines intersect and find the angle between them", "Show the root lies between the given values and use the iteration to find it"],
      "exam_weight": 17,
      "prerequisites": ["AS calculus strand", "A2 algebra strand"],
      "common_misconceptions": ["Forgetting dy/dx factors when differentiating y-terms implicitly", "Choosing u and dv in parts so the integral becomes harder", "Losing the constant of integration in separable equations before applying conditions", "Equating position vectors of two lines with the same parameter symbol"],
      "exemplar_question_stems": ["The rate of growth of the population is proportional to its size; form and solve the differential equation given the initial data", "Find the exact value of the integral of x e^(2x) between 0 and 1", "Two lines are given in vector form; show they are skew and find the angle between their directions"]
    },
    {
      "name": "AS Probability and Statistics",
      "subtopics": ["Data representation: stem-and-leaf, box plots, histograms, cumulative frequency", "Measures of centre and spread including from grouped data", "Probability: mutually exclusive, independent, conditional", "Permutations and combinations", "Discrete random variables and expectation", "Binomial and geometric distributions", "The normal distribution"],
      "learning_objectives": ["Choose and interpret appropriate data displays and summary measures", "Calculate probabilities using structured methods including tree diagrams", "Count arrangements and selections with restrictions", "Work with discrete random variables and their expectation and variance", "Apply binomial, geometric and normal models with justification"],
      "key_concepts": ["Skewness from comparative statistics", "Conditional probability and independence testing", "Arrangement vs selection distinction", "Probability distribution tables summing to one", "Normal standardisation and use of tables", "Normal approximation conditions awareness"],
      "assessment_objectives": ["Represent and interpret data accurately", "Compute probabilities in structured scenarios", "Select and justify appropriate probability models"],
      "typical_question_styles": ["Find the probability that exactly/at least the stated number of trials succeed", "How many arrangements of the letters are possible if the vowels must be together", "Find the probability using the normal distribution with the given mean and standard deviation", "Find E(X) and Var(X) from the distribution table"],
      "exam_weight": 15,
      "prerequisites": ["AS pure algebra"],
      "common_misconceptions": ["Confusing permutations with combinations", "Assuming independence without justification", "Forgetting continuity between strict and non-strict inequalities for discrete distributions", "Standardising with variance instead of standard deviation"],
      "exemplar_question_stems": ["A biased coin shows heads with the given probability; find the probability of the first head on the fourth toss", "The masses are normally distributed; find the proportion of items above the stated mass and the value exceeded by 10 percent of items"]
    },
    {
      "name": "A2 Probability and Statistics: Inference",
      "subtopics": ["Poisson distribution and its use as a binomial approximation", "Linear combinations of random variables", "Continuous random variables and probability density functions", "Sampling and the distribution of the sample mean", "Unbiased estimates and the Central Limit Theorem", "Confidence intervals for means and proportions", "Hypothesis tests: binomial, Poisson and mean tests; Type I and II errors"],
      "learning_objectives": ["Model events with the Poisson distribution and justify its use", "Find means and variances of linear combinations of independent variables", "Work with pdfs: verify validity, compute probabilities, medians and expectations", "Construct confidence intervals and conduct hypothesis tests with clear conclusions", "Explain and calculate Type I and Type II error probabilities"],
      "key_concepts": ["Poisson conditions: singly, independently, constant mean rate", "Var(aX + bY) with independence", "CLT enabling normal-based inference for large n", "Significance level as rejection threshold", "One-tailed vs two-tailed test choice from wording"],
      "assessment_objectives": ["Apply distributions and inference procedures accurately", "State hypotheses, compute test statistics and conclude in context", "Interpret errors and confidence levels correctly"],
      "typical_question_styles": ["Test at the stated significance level whether the mean rate has increased", "Construct a 95 percent confidence interval for the population mean", "Find the probability of a Type I error for the given rejection rule", "Verify the function is a valid pdf and find the median of the distribution"],
      "exam_weight": 15,
      "prerequisites": ["AS statistics strand", "A2 calculus strand"],
      "common_misconceptions": ["Writing hypotheses about sample statistics instead of population parameters", "Doubling a one-tailed p-value or halving a two-tailed one incorrectly", "Adding standard deviations instead of variances", "Concluding proof rather than evidence in hypothesis test conclusions"],
      "exemplar_question_stems": ["Calls arrive at a mean rate per hour; test whether the rate has changed after the new system, at 5 percent significance", "A random sample of 50 items has the given mean and variance; construct a 90 percent confidence interval for the population mean"]
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
