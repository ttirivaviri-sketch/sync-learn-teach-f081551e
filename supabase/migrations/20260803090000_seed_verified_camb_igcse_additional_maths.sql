-- Seed verified curriculum template: Cambridge IGCSE Additional Mathematics
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
  'Additional Mathematics',
  $topics$[
    {
      "name": "Functions, Quadratics and Equations",
      "subtopics": ["Domain, range and inverse functions", "Composite functions", "Quadratic functions: completing the square, discriminant", "Simultaneous equations (one linear, one quadratic)", "Modulus functions and equations", "Intersection of graphs"],
      "learning_objectives": ["Find and use inverse and composite functions", "Analyse quadratics using completed-square form and the discriminant", "Solve simultaneous equations mixing linear and quadratic forms", "Sketch and solve modulus functions and equations"],
      "key_concepts": ["One-one functions and invertibility", "Discriminant conditions for roots and tangency", "Vertex form and turning points", "Graphical interpretation of |f(x)|", "Conditions for a line to intersect, touch or miss a curve"],
      "assessment_objectives": ["Use and apply standard techniques accurately", "Reason mathematically to establish conditions on parameters", "Solve unstructured multi-step problems"],
      "typical_question_styles": ["Find the range of values of k for which the line and curve do not intersect", "Express the quadratic in completed-square form and state the turning point", "Solve the equation involving a modulus expression", "Find the inverse function and state its domain"],
      "exam_weight": 15,
      "prerequisites": ["IGCSE Mathematics algebra (extended)"],
      "common_misconceptions": ["Confusing the discriminant conditions for two roots vs no roots", "Assuming every function has an inverse without checking it is one-one", "Squaring both sides of a modulus equation without checking for extraneous solutions", "Sign errors when completing the square with a negative leading coefficient"],
      "exemplar_question_stems": ["Find the values of k for which kx - 3 is a tangent to the given quadratic curve", "The function f is defined on a restricted domain; find f inverse and sketch both graphs", "Solve |2x - 5| = x + 1 and verify your solutions"]
    },
    {
      "name": "Indices, Surds, Polynomials and Partial Fractions",
      "subtopics": ["Laws of indices with rational exponents", "Simplifying and rationalising surds", "Polynomial division", "Factor and remainder theorems", "Solving cubic equations", "Simple partial fractions"],
      "learning_objectives": ["Manipulate expressions with rational indices and surds fluently", "Apply the factor and remainder theorems to find factors and remainders", "Solve cubic equations by finding a linear factor first", "Decompose rational expressions into partial fractions"],
      "key_concepts": ["Rationalising denominators with conjugates", "Remainder theorem: f(a) gives remainder on division by (x - a)", "Factor theorem as remainder zero", "Comparing coefficients", "Distinct linear and repeated factors in partial fractions"],
      "assessment_objectives": ["Perform algebraic manipulation accurately", "Apply theorems to structured factorisation problems", "Combine techniques in multi-step problems"],
      "typical_question_styles": ["Show that (x - 2) is a factor and hence solve the cubic equation", "Find the values of a and b given two remainder conditions", "Express the improper fraction in partial fractions", "Simplify the surd expression, rationalising the denominator"],
      "exam_weight": 12,
      "prerequisites": ["IGCSE Mathematics indices and algebraic manipulation"],
      "common_misconceptions": ["Adding indices when multiplying different bases", "Using f(-a) instead of f(a) for division by (x - a)", "Forgetting the extra term needed when the fraction is improper", "Leaving answers with surds in the denominator"],
      "exemplar_question_stems": ["The polynomial leaves remainder 5 when divided by (x - 1) and is divisible by (x + 2); find the unknown coefficients", "Express (7x + 4)/((x - 1)(x + 2)) in partial fractions", "Simplify (3 + root 2)/(3 - root 2), giving your answer in the form a + b root 2"]
    },
    {
      "name": "Logarithmic, Exponential and Straight-Line Graphs",
      "subtopics": ["Laws of logarithms", "Solving exponential and logarithmic equations", "Graphs of exponential and log functions", "Change of base", "Linearising relationships using logarithms", "Determining unknown constants from straight-line forms"],
      "learning_objectives": ["Apply logarithm laws to simplify and solve equations", "Convert between exponential and logarithmic statements", "Transform non-linear relationships to straight-line form", "Interpret gradients and intercepts to find constants of a model"],
      "key_concepts": ["log rules: product, quotient, power", "Natural logarithm and base e", "y = ab^x and y = ax^n linearisation", "Gradient and intercept correspondence to model constants", "Inverse relationship between exponentials and logarithms"],
      "assessment_objectives": ["Solve equations using logarithm laws accurately", "Convert experimental data relationships to linear form", "Interpret graphs to estimate constants"],
      "typical_question_styles": ["Solve the exponential equation, giving your answer to three significant figures", "Given the straight line obtained by plotting ln y against x, find a and b", "Express the equation in a form suitable for plotting a straight line", "Use logarithm laws to write the expression as a single logarithm"],
      "exam_weight": 12,
      "prerequisites": ["Functions and indices strands"],
      "common_misconceptions": ["Writing log(a + b) as log a + log b", "Confusing which variable to plot when linearising y = ab^x", "Dropping solutions or introducing invalid ones when logs of negative numbers arise", "Mixing base 10 and base e logarithms mid-calculation"],
      "exemplar_question_stems": ["Solve 3^(2x+1) = 5^(x+2), giving x to three significant figures", "The variables satisfy y = ax^n; the graph of lg y against lg x has gradient 1.5 and intercept 0.3; find a and n", "Express 2 log 3 + log 4 - log 6 as a single logarithm"]
    },
    {
      "name": "Coordinate Geometry and Circular Measure",
      "subtopics": ["Straight lines: gradient, midpoint, distance", "Parallel and perpendicular lines", "Equation of a circle", "Intersection of lines and circles", "Radian measure", "Arc length and sector area"],
      "learning_objectives": ["Solve problems involving straight-line geometry in the plane", "Use the equation of a circle including finding centre and radius", "Convert between degrees and radians fluently", "Calculate arc lengths, sector and segment areas in radians"],
      "key_concepts": ["Perpendicular gradients multiply to -1", "Completed-square form of the circle equation", "Tangent perpendicular to radius", "s = r theta and A = half r squared theta", "Segment area as sector minus triangle"],
      "assessment_objectives": ["Apply coordinate geometry formulas accurately", "Solve combined line-circle problems", "Use radian measure in mensuration problems"],
      "typical_question_styles": ["Find the equation of the perpendicular bisector of the line segment", "Find the centre and radius of the circle and determine whether the line is a tangent", "The sector has the given radius and angle in radians; find the perimeter of the shaded segment", "Show that the triangle with the given vertices is right-angled"],
      "exam_weight": 12,
      "prerequisites": ["IGCSE Mathematics coordinate geometry and mensuration"],
      "common_misconceptions": ["Using degree formulas with an angle in radians or vice versa", "Sign errors extracting the centre from the circle equation", "Confusing arc length with chord length", "Forgetting to subtract the triangle when finding a segment area"],
      "exemplar_question_stems": ["A circle has equation x^2 + y^2 - 6x + 4y - 12 = 0; find its centre and radius", "Find the exact area of the segment cut off by a chord subtending 1.2 radians at the centre of a circle of radius 5 cm", "Determine the equation of the line through the given point perpendicular to the given line"]
    },
    {
      "name": "Trigonometry",
      "subtopics": ["The six trigonometric ratios and their graphs", "Exact values for special angles", "Trigonometric identities including sec, cosec, cot", "Solving trigonometric equations over given intervals", "Amplitude and period of transformed trig functions", "Proving identities"],
      "learning_objectives": ["Sketch and interpret transformed trigonometric graphs", "Use Pythagorean identities to simplify and prove statements", "Solve trigonometric equations finding all solutions in an interval", "Work with reciprocal trigonometric functions"],
      "key_concepts": ["Periodicity and symmetry of trig graphs", "sin^2 + cos^2 = 1 and derived identities with sec and cosec", "General solution strategy: principal value then symmetry", "a sin bx + c transformations", "Quadrant (CAST) reasoning"],
      "assessment_objectives": ["Manipulate trigonometric expressions accurately", "Solve equations systematically over stated domains", "Construct clear identity proofs"],
      "typical_question_styles": ["Solve the trigonometric equation for angles between 0 and 360 degrees", "Prove the given trigonometric identity", "State the amplitude and period of the transformed function and sketch it", "Express the equation in terms of one trig ratio and hence solve it"],
      "exam_weight": 13,
      "prerequisites": ["IGCSE Mathematics trigonometry", "Circular measure strand"],
      "common_misconceptions": ["Dividing both sides by cos x and losing solutions", "Finding only the principal solution and omitting others in the interval", "Treating identities as equations to be solved rather than statements to be proven", "Confusing period changes from y = sin bx with amplitude changes"],
      "exemplar_question_stems": ["Solve 2 cos^2 x + sin x = 1 for x between 0 and 360 degrees", "Prove that sec^2 x + cosec^2 x = sec^2 x cosec^2 x", "The curve y = 3 sin 2x + 1 is sketched for one period; state its amplitude, period and maximum value"]
    },
    {
      "name": "Series: Binomial Expansion and Arithmetic/Geometric Progressions",
      "subtopics": ["Binomial expansion of (a + b)^n for positive integer n", "General term and specific coefficients", "Arithmetic progressions: nth term and sum", "Geometric progressions: nth term and sum", "Sum to infinity of a convergent GP", "Problems combining APs and GPs"],
      "learning_objectives": ["Expand binomial expressions and extract specific terms", "Apply AP and GP formulas to structured and contextual problems", "Determine conditions for convergence and find sums to infinity", "Solve problems where AP and GP conditions interlink"],
      "key_concepts": ["nCr coefficients and Pascal structure", "Term independent of x", "Common difference vs common ratio", "|r| < 1 convergence condition", "Simultaneous equations from given term conditions"],
      "assessment_objectives": ["Compute expansions and progression values accurately", "Model contextual sequences with AP/GP structures", "Justify convergence before using sum to infinity"],
      "typical_question_styles": ["Find the coefficient of the stated power of x in the expansion", "Find the term independent of x in the expansion of the given product", "The second and fifth terms of a GP are given; find the first term and common ratio", "Determine whether the series converges and if so find its sum to infinity"],
      "exam_weight": 12,
      "prerequisites": ["Indices strand", "IGCSE Mathematics sequences"],
      "common_misconceptions": ["Forgetting to raise the coefficient inside the bracket to the appropriate power", "Using the AP sum formula for a GP or vice versa", "Applying sum to infinity without checking |r| < 1", "Off-by-one errors in identifying the nth term"],
      "exemplar_question_stems": ["Find the coefficient of x^3 in the expansion of (2 - x/2)^7", "An AP has first term 5 and its tenth term is 32; find the sum of the first twenty terms", "The first term of a GP is 12 and its sum to infinity is 18; find the common ratio"]
    },
    {
      "name": "Differentiation and Its Applications",
      "subtopics": ["Derivatives of polynomials, trig, exponential and log functions", "Chain, product and quotient rules", "Tangents and normals", "Stationary points and their nature", "Connected rates of change", "Small increments and approximations"],
      "learning_objectives": ["Differentiate standard functions and combinations using the rules", "Find equations of tangents and normals at given points", "Locate and classify stationary points to solve optimisation problems", "Apply derivatives to connected rates of change"],
      "key_concepts": ["Derivative as gradient function and rate of change", "Second derivative test for maxima and minima", "Chain rule in dy/dt = dy/dx times dx/dt form", "Normal gradient as negative reciprocal", "Increasing and decreasing functions"],
      "assessment_objectives": ["Differentiate accurately using appropriate rules", "Apply calculus to geometric and contextual optimisation", "Interpret rates of change in context"],
      "typical_question_styles": ["Find the equation of the normal to the curve at the given point", "Find the coordinates of the stationary points and determine their nature", "The radius increases at the given rate; find the rate of increase of the volume", "Find the range of values of x for which the function is decreasing"],
      "exam_weight": 13,
      "prerequisites": ["Functions, trigonometry and logarithm strands"],
      "common_misconceptions": ["Omitting the chain-rule factor when differentiating composite functions", "Confusing the gradients of tangent and normal", "Classifying stationary points by y-value rather than second derivative or gradient change", "Mixing radians and degrees when differentiating trig functions"],
      "exemplar_question_stems": ["Find dy/dx for y = x^2 e^(3x) and hence find the x-coordinates of the stationary points", "Water is poured into the container at a constant rate; find how fast the depth is rising when the depth is 4 cm", "Find the equation of the tangent to y = ln(2x + 1) at the point where x = 1"]
    },
    {
      "name": "Integration, Kinematics and Vectors",
      "subtopics": ["Integration as reverse differentiation", "Integrating polynomials, trig, exponential and 1/x forms", "Definite integrals and areas under curves", "Kinematics: displacement, velocity, acceleration by calculus", "Vectors in two dimensions: magnitude, unit vectors", "Position vectors and velocity vectors of moving particles"],
      "learning_objectives": ["Integrate standard functions including with constants of integration", "Evaluate definite integrals and areas between curves and lines", "Move between displacement, velocity and acceleration using calculus", "Solve problems with position and velocity vectors including interception"],
      "key_concepts": ["Constant of integration determined by a point", "Area below the axis counted as negative by integration", "v = ds/dt, a = dv/dt and their integral reversals", "Magnitude and direction of vectors", "Relative position and constant-velocity models"],
      "assessment_objectives": ["Integrate accurately and evaluate definite integrals", "Apply calculus to straight-line motion problems", "Use vector methods for magnitude, direction and motion"],
      "typical_question_styles": ["Find the area enclosed between the curve and the line", "The velocity of a particle is given; find the displacement in the first four seconds", "Find the constant of integration given that the curve passes through the stated point", "Two particles move with the given position vectors; determine whether they collide"],
      "exam_weight": 11,
      "prerequisites": ["Differentiation strand"],
      "common_misconceptions": ["Forgetting the constant of integration in indefinite integrals", "Treating distance travelled as identical to displacement when velocity changes sign", "Integrating a product term by term as if integration distributed over multiplication", "Adding vector magnitudes instead of adding vectors componentwise"],
      "exemplar_question_stems": ["A particle moves so that v = 6t^2 - 4t + 1; given s = 2 when t = 0, find s when t = 3", "Find the total area of the region enclosed by the curve y = x(x - 2)(x + 1) and the x-axis", "Particle A starts at the given position with the given velocity vector; find its distance from the origin after 5 seconds"]
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
