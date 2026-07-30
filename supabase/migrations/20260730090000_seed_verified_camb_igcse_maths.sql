-- ═══════════════════════════════════════════════════════════════════════════
-- Seed verified curriculum grounding — Cambridge IGCSE Mathematics (0580)
--
-- Companion to 20260718090000 (ZIMSEC Form 4 Mathematics). Extends verified
-- coverage to the CAMB curriculum so IGCSE learners get exam-accurate topic
-- trees instead of AI-guessed structure.
--
-- Content policy: strand structure, assessment objectives and question-style
-- descriptions reflect the published 0580 syllabus (public factual
-- information). All exemplar question stems are ORIGINAL compositions in
-- exam style — no Cambridge paper text is reproduced.
--
-- Grade label 'IGCSE' matches GRADE_LEVELS_BY_CURRICULUM.CAMB in
-- src/types/academicProfile.ts.
--
-- Idempotent: ON CONFLICT upgrades rows whose source is 'ai'/'hybrid' but
-- never clobbers a template a human already marked 'verified'.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES ('CAMB', 'IGCSE', 'Mathematics', $topics$[
{
  "name": "Number",
  "subtopics": ["Types of number (natural, integer, prime, rational, irrational)", "HCF and LCM", "Powers and roots", "Fractions, decimals and percentages", "Ordering and inequality symbols", "Standard form", "Estimation and bounds", "Ratio and proportion", "Percentages including reverse percentage", "Simple and compound interest, exponential growth and decay", "Time and money calculations"],
  "learning_objectives": ["Identify and use natural numbers, integers, primes, squares, cubes, rationals and irrationals", "Find HCF and LCM using prime factorisation", "Calculate with fractions, decimals and percentages, including recurring decimals", "Write numbers in standard form A×10^n with 1≤A<10 and calculate with them", "Round to a given number of decimal places or significant figures and find upper and lower bounds", "Divide a quantity in a given ratio and solve direct and inverse proportion problems", "Calculate percentage change and reverse percentages", "Use simple and compound interest formulas and model exponential growth and decay"],
  "key_concepts": ["prime factor decomposition", "HCF/LCM from Venn or ladder method", "recurring decimal to fraction conversion", "standard form arithmetic", "upper bound = value + half unit of accuracy", "ratio sharing", "inverse proportion", "reverse percentage (finding the original value)", "compound interest P(1+r/100)^n", "exponential decay multiplier"],
  "assessment_objectives": ["AO1: demonstrate knowledge and understanding of mathematical techniques", "AO2: reason, interpret and communicate mathematically when solving problems"],
  "typical_question_styles": ["Short non-calculator style arithmetic (Core Paper 1 / Extended Paper 2, 1-3 marks)", "Bounds question: calculate the upper bound of a compound measure (2-3 marks)", "Reverse percentage: find the price before the increase (3 marks)", "Compound interest / depreciation over n years (3-4 marks)"],
  "exam_weight": 18,
  "prerequisites": [],
  "common_misconceptions": ["Treating 1 as a prime number", "Rounding intermediate values and losing accuracy marks", "Finding a percentage OF the new amount in reverse percentage problems instead of dividing by the multiplier", "Adding the powers of 10 incorrectly when adding numbers in standard form", "Using simple interest when the question says compound"],
  "exemplar_question_stems": ["Write 360 as a product of its prime factors, and hence find the LCM of 360 and 150.", "A rod measures 45 cm correct to the nearest centimetre. Write down the lower bound of its length.", "After a 15% price increase, a jacket costs $69. Calculate the original price.", "$2000 is invested at 3% per year compound interest. Calculate the value of the investment at the end of 4 years."]
},
{
  "name": "Algebra and Graphs",
  "subtopics": ["Algebraic manipulation and expansion", "Factorisation (common factor, difference of two squares, quadratic trinomials)", "Algebraic fractions", "Indices including fractional and negative", "Linear equations and simultaneous equations", "Quadratic equations (factorising, formula, completing the square)", "Inequalities", "Sequences and the nth term", "Direct and inverse variation", "Functions, composite and inverse functions", "Graphs of functions and graphical solution of equations", "Differentiation of polynomials, gradients and turning points"],
  "learning_objectives": ["Expand products of two or more brackets and factorise fully", "Simplify algebraic fractions including factorising first", "Apply the rules of indices with negative and fractional powers", "Solve linear and simultaneous linear equations algebraically", "Solve quadratics by factorising, completing the square and the quadratic formula", "Find the nth term of linear, quadratic, cubic and exponential sequences", "Express direct and inverse variation algebraically and find constants of proportionality", "Use function notation, find composite functions f(g(x)) and inverse functions f⁻¹(x)", "Sketch and interpret graphs of polynomial, reciprocal and exponential functions", "Differentiate ax^n, find gradients and locate turning points, distinguishing maxima and minima"],
  "key_concepts": ["difference of two squares", "completing the square a(x+p)²+q", "discriminant and number of roots", "nth term of quadratic sequence via second differences", "y = k/x inverse variation", "composite function order (fg means g first)", "inverse function by rearranging", "dy/dx = 0 at turning points", "second derivative or gradient test for max/min"],
  "assessment_objectives": ["AO1: use algebraic techniques accurately", "AO2: construct and use algebraic models of real situations"],
  "typical_question_styles": ["Multi-step factorise/simplify (2-4 marks)", "Solve a quadratic giving answers to 2 decimal places using the formula (4 marks)", "Simultaneous equations, one linear and one quadratic (5-6 marks, Extended)", "Find fg(x), f⁻¹(x) for given functions (3-5 marks)", "Differentiate and find coordinates of turning points, stating their nature (5-6 marks, Extended)"],
  "exam_weight": 22,
  "prerequisites": ["Number"],
  "common_misconceptions": ["Only taking out part of the common factor when factorising fully", "Sign errors when expanding (x−a)(x−b)", "Applying fg(x) as f first then g", "Cancelling terms instead of factors in algebraic fractions", "Forgetting ± when square-rooting during completing the square", "Dropping the coefficient when differentiating ax^n"],
  "exemplar_question_stems": ["Factorise fully: 3x² − 12.", "Solve 2x² + 5x − 4 = 0, giving your answers correct to 2 decimal places.", "y is inversely proportional to the square of x. When x = 2, y = 9. Find y when x = 6.", "f(x) = 2x − 1 and g(x) = x². Find fg(3) and an expression for f⁻¹(x).", "A curve has equation y = x³ − 6x² + 5. Find dy/dx and the coordinates of the two turning points."]
},
{
  "name": "Coordinate Geometry",
  "subtopics": ["Cartesian coordinates", "Gradient of a line segment", "Length and midpoint of a line segment", "Equation of a straight line y = mx + c", "Parallel and perpendicular lines"],
  "learning_objectives": ["Calculate the gradient of a line from two points", "Find the length of a segment using Pythagoras and the coordinates of its midpoint", "Find and interpret the equation of a straight line in the form y = mx + c", "Use the conditions m₁ = m₂ for parallel lines and m₁m₂ = −1 for perpendicular lines"],
  "key_concepts": ["gradient = rise/run = (y₂−y₁)/(x₂−x₁)", "distance formula", "midpoint formula", "y-intercept", "negative reciprocal gradient for perpendicularity", "equation of a line through a given point"],
  "assessment_objectives": ["AO1: apply coordinate formulas accurately", "AO2: link algebraic and geometric representations of lines"],
  "typical_question_styles": ["Find the equation of the line through two given points (3 marks)", "Find the equation of the perpendicular bisector of a segment (4-5 marks, Extended)", "Determine whether two lines are parallel or perpendicular (2-3 marks)"],
  "exam_weight": 6,
  "prerequisites": ["Algebra and Graphs"],
  "common_misconceptions": ["Inverting the gradient formula (running rise over run upside-down)", "Using the same gradient instead of the negative reciprocal for a perpendicular line", "Halving only one coordinate when finding a midpoint"],
  "exemplar_question_stems": ["A is (1, 3) and B is (7, −5). Find the coordinates of the midpoint of AB and the length AB.", "Find the equation of the line that is perpendicular to y = 2x + 3 and passes through the point (4, 1)."]
},
{
  "name": "Geometry",
  "subtopics": ["Geometrical terms and notation", "Angle properties (lines, triangles, quadrilaterals, polygons)", "Circle theorems", "Similarity and congruence", "Constructions with ruler and compasses", "Symmetry in two and three dimensions", "Scale drawings and bearings basics"],
  "learning_objectives": ["Use angle facts on parallel lines, in triangles and in polygons (interior/exterior angles)", "Apply circle theorems: angle in a semicircle, angles in the same segment, cyclic quadrilaterals, tangent-radius, alternate segment", "Prove triangles congruent using SSS, SAS, ASA and RHS", "Use similarity to find missing lengths, and relate ratios of lengths, areas and volumes of similar shapes", "Carry out standard ruler-and-compass constructions including bisectors"],
  "key_concepts": ["alternate, corresponding and co-interior angles", "sum of interior angles (n−2)×180°", "angle at centre = twice angle at circumference", "opposite angles of a cyclic quadrilateral sum to 180°", "alternate segment theorem", "congruence conditions", "length ratio k, area ratio k², volume ratio k³"],
  "assessment_objectives": ["AO1: recall and apply geometric facts", "AO2: construct multi-step geometric arguments with reasons"],
  "typical_question_styles": ["Find the marked angle, giving a reason for each step (3-5 marks)", "Circle theorem chain: find two or three angles with reasons (4-6 marks)", "Similar triangles: show similarity then calculate a length (4-5 marks)", "Similar solids: given the ratio of heights, find the ratio of volumes (2-3 marks, Extended)"],
  "exam_weight": 11,
  "prerequisites": [],
  "common_misconceptions": ["Quoting the wrong reason even when the angle value is correct (losing reasoning marks)", "Assuming a quadrilateral is cyclic without justification", "Squaring the length ratio for volumes instead of cubing it", "Confusing the alternate segment theorem with alternate angles on parallel lines"],
  "exemplar_question_stems": ["A, B, C and D lie on a circle. AC is a diameter and angle BAC = 34°. Find angle BCA, giving a reason.", "Two similar bottles have heights 12 cm and 18 cm. The smaller bottle holds 400 ml. Calculate the capacity of the larger bottle.", "PT is a tangent to the circle at T. Given angle PTA = 52°, use the alternate segment theorem to find the angle in the alternate segment."]
},
{
  "name": "Mensuration",
  "subtopics": ["Units and compound measures (speed, density, rates)", "Perimeter and area of rectilinear shapes and circles", "Arc length and sector area", "Surface area and volume of prisms, cylinders, pyramids, cones and spheres", "Areas and volumes of compound shapes"],
  "learning_objectives": ["Convert between metric units including area and volume units", "Calculate perimeters and areas of triangles, quadrilaterals, circles and compound shapes", "Calculate arc length and sector area as fractions of a circle", "Calculate surface areas and volumes of prisms, cylinders, cones, pyramids and spheres using given formulas where appropriate", "Solve problems involving compound solids and units of speed, density and pressure"],
  "key_concepts": ["area of a trapezium ½(a+b)h", "circumference 2πr and area πr²", "arc length = (θ/360)×2πr", "sector area = (θ/360)×πr²", "volume of prism = cross-section × length", "volume of cone ⅓πr²h and sphere (4/3)πr³", "1 m² = 10 000 cm²", "density = mass/volume"],
  "assessment_objectives": ["AO1: substitute correctly into mensuration formulas", "AO2: decompose compound shapes and solids into standard parts"],
  "typical_question_styles": ["Sector question: find arc length or area, or the angle given the arc (3-4 marks)", "Compound solid: hemisphere on a cylinder, find total volume in terms of π (4-5 marks)", "Convert a volume flow-rate problem into time to fill a tank (4-6 marks)"],
  "exam_weight": 9,
  "prerequisites": ["Number"],
  "common_misconceptions": ["Using the diameter in πr² without halving", "Multiplying by 100 instead of 10 000 when converting m² to cm²", "Forgetting the base circle when finding the total surface area of a cone or cylinder", "Using the full circle formula for a sector without the θ/360 fraction"],
  "exemplar_question_stems": ["A sector has radius 8 cm and angle 135°. Calculate the arc length, giving your answer in terms of π.", "A solid consists of a cylinder of radius 3 cm and height 10 cm with a hemisphere of the same radius on top. Calculate the total volume.", "Water flows through a pipe of cross-sectional area 12 cm² at 50 cm/s. How long does it take to fill a 90-litre tank?"]
},
{
  "name": "Trigonometry",
  "subtopics": ["Pythagoras' theorem in 2D and 3D", "Right-angled trigonometry (sine, cosine, tangent)", "Angles of elevation and depression", "Bearings", "Sine rule and cosine rule", "Area of a triangle ½ab sin C", "Trigonometric graphs and exact values", "Solving simple trigonometric equations"],
  "learning_objectives": ["Use Pythagoras' theorem and SOHCAHTOA to find sides and angles in right-angled triangles", "Solve 3D problems by identifying right-angled triangles inside solids", "Use three-figure bearings and back-bearings", "Apply the sine rule (including the ambiguous case) and cosine rule in non-right-angled triangles", "Use area = ½ab sin C", "Sketch y = sin x, y = cos x, y = tan x and solve equations like sin x = k for 0° ≤ x ≤ 360°"],
  "key_concepts": ["hypotenuse identification", "SOHCAHTOA", "angle of elevation vs depression", "bearings measured clockwise from north", "sine rule a/sinA = b/sinB", "cosine rule a² = b² + c² − 2bc cosA", "obtuse angle solutions 180° − θ", "exact values for 30°, 45°, 60°"],
  "assessment_objectives": ["AO1: apply trigonometric ratios and rules accurately", "AO2: model navigation, surveying and 3D problems"],
  "typical_question_styles": ["Bearings journey with sine/cosine rule to find a distance or bearing (5-7 marks, Extended)", "3D box or pyramid: find the angle between a line and a plane (4-6 marks)", "Solve sin x = 0.5 for 0° ≤ x ≤ 360° (2-3 marks)", "Right-angled triangle side or angle (2-3 marks, Core and Extended)"],
  "exam_weight": 11,
  "prerequisites": ["Geometry", "Mensuration"],
  "common_misconceptions": ["Using the cosine rule with the angle not enclosed between the two given sides", "Giving only the acute solution of sin x = k and missing 180° − x", "Measuring bearings anticlockwise or omitting the three-figure format", "Mixing up opposite and adjacent when the triangle is rotated"],
  "exemplar_question_stems": ["A ship sails 12 km on a bearing of 070°, then 9 km on a bearing of 150°. Calculate the distance of the ship from its starting point.", "In triangle ABC, AB = 8 cm, AC = 11 cm and angle BAC = 52°. Calculate the area of the triangle and the length of BC.", "Solve cos x = −0.4 for 0° ≤ x ≤ 360°."]
},
{
  "name": "Transformations and Vectors",
  "subtopics": ["Reflection, rotation, translation and enlargement", "Describing single transformations fully", "Negative and fractional scale factors", "Vector notation and column vectors", "Vector arithmetic and magnitude", "Position vectors and vector geometry proofs"],
  "learning_objectives": ["Perform and fully describe reflections, rotations, translations and enlargements", "Enlarge shapes with fractional and negative scale factors from a given centre", "Add, subtract and scalar-multiply column vectors and find magnitudes", "Express vectors in terms of given base vectors and prove collinearity or parallelism"],
  "key_concepts": ["mirror line equation", "centre and angle of rotation", "column vector for translation", "centre and scale factor of enlargement", "|v| = √(x² + y²)", "parallel vectors are scalar multiples", "collinear points share a common vector direction through a common point", "midpoint and ratio points on a line segment"],
  "assessment_objectives": ["AO1: carry out transformations and vector calculations", "AO2: construct vector arguments to prove geometric facts"],
  "typical_question_styles": ["Describe fully the single transformation mapping A to B (2-3 marks)", "Enlargement with scale factor −½ about a marked centre (2-3 marks, Extended)", "Vector geometry: express MN in terms of a and b, then show MN is parallel to OC (5-7 marks, Extended)"],
  "exam_weight": 7,
  "prerequisites": ["Coordinate Geometry"],
  "common_misconceptions": ["Describing a combined transformation when the question demands a single one", "Forgetting that a negative scale factor places the image on the opposite side of the centre", "Writing coordinates instead of column vectors (or vice versa)", "Concluding parallel implies collinear without a shared point"],
  "exemplar_question_stems": ["Describe fully the single transformation that maps triangle T onto triangle U (shown on the grid).", "a = (3, −1) and b = (−2, 4) as column vectors. Find 2a − b and |2a − b|.", "OABC is a parallelogram with OA = a and OC = c. M is the midpoint of AB. Express OM in terms of a and c."]
},
{
  "name": "Probability",
  "subtopics": ["Probability scale and notation", "Relative frequency and expected frequency", "Sample space diagrams", "Venn diagrams and set notation in probability", "Tree diagrams with and without replacement", "Combined and conditional probability"],
  "learning_objectives": ["Calculate probabilities of single events and use P(not A) = 1 − P(A)", "Use relative frequency as an estimate of probability and calculate expected frequencies", "Construct sample space diagrams and Venn diagrams to find probabilities", "Draw and use tree diagrams, distinguishing with and without replacement", "Calculate conditional probabilities from tables, Venn diagrams and tree diagrams"],
  "key_concepts": ["P(A) between 0 and 1", "expected frequency = n × P", "multiplication of probabilities along tree branches", "addition of end-branch probabilities across outcomes", "denominators reduce without replacement", "P(A|B) restricted sample space", "P(at least one) = 1 − P(none)"],
  "assessment_objectives": ["AO1: compute probabilities accurately", "AO2: model multi-stage random experiments"],
  "typical_question_styles": ["Complete a tree diagram and find P(exactly one) or P(at least one) (5-7 marks)", "Venn diagram probability including conditional probability (4-6 marks, Extended)", "Expected number of successes from n trials (2 marks)"],
  "exam_weight": 7,
  "prerequisites": ["Number"],
  "common_misconceptions": ["Adding along branches instead of multiplying", "Keeping the same denominator after drawing without replacement", "Using the whole sample space instead of the restricted one for conditional probability", "Listing outcomes instead of computing 1 − P(none) for at-least-one questions"],
  "exemplar_question_stems": ["A box contains 4 red and 6 green counters. Two counters are taken at random without replacement. Find the probability that they are the same colour.", "In a group of 50 students, 28 study French, 19 study Spanish and 8 study both. A student is chosen at random. Given the student studies French, find the probability they also study Spanish."]
},
{
  "name": "Statistics",
  "subtopics": ["Collecting and classifying data", "Frequency tables and grouped data", "Bar charts, pie charts, pictograms and stem-and-leaf", "Mean, median, mode and range (including from grouped data)", "Scatter diagrams, correlation and lines of best fit", "Cumulative frequency, quartiles and box plots", "Histograms with unequal class widths"],
  "learning_objectives": ["Construct and interpret standard statistical charts", "Calculate mean, median, mode and range from lists and frequency tables, and estimate the mean of grouped data", "Draw scatter diagrams, describe correlation and use a line of best fit to estimate values", "Construct cumulative frequency curves and read off the median, quartiles, interquartile range and percentiles", "Construct and interpret box-and-whisker plots and compare distributions", "Draw and interpret histograms using frequency density for unequal intervals"],
  "key_concepts": ["midpoint × frequency for grouped mean estimate", "median position (n+1)/2", "positive/negative/no correlation", "interpolation vs extrapolation on a line of best fit", "quartiles from a cumulative frequency curve", "IQR = UQ − LQ", "frequency density = frequency ÷ class width", "comparing medians and spreads of two data sets"],
  "assessment_objectives": ["AO1: process and present data accurately", "AO2: interpret and compare distributions in context"],
  "typical_question_styles": ["Estimate the mean of a grouped frequency table (3-4 marks)", "Cumulative frequency curve: find the median and IQR, then estimate how many exceed a value (5-7 marks)", "Histogram with unequal widths: complete the histogram or the table (3-4 marks, Extended)", "Compare two box plots in context, mentioning median and spread (2-3 marks)"],
  "exam_weight": 9,
  "prerequisites": ["Number"],
  "common_misconceptions": ["Using class width endpoints instead of midpoints when estimating a grouped mean", "Plotting cumulative frequency at midpoints instead of upper class boundaries", "Reading frequency directly from a histogram bar height instead of using frequency density × width", "Describing correlation as causation in interpretation answers"],
  "exemplar_question_stems": ["The table shows the masses of 80 parcels in grouped intervals. Calculate an estimate of the mean mass.", "The cumulative frequency diagram shows the times taken by 120 runners. Use it to estimate the median and the interquartile range.", "The histogram shows journey times, with one bar missing. Given the 20–30 minute class has frequency 24, complete the histogram for the 30–50 minute class with frequency 18."]
}
]$topics$::jsonb, 'verified', now())
ON CONFLICT (curriculum, grade, subject)
DO UPDATE SET topics = EXCLUDED.topics, source = 'verified', verified_at = now(), updated_at = now()
WHERE curriculum_topic_templates.source IN ('ai', 'hybrid');
