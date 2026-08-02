-- Seed verified curriculum template: Cambridge O Level Computer Science
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
  'Computer Science',
  $topics$
[
  {
    "name": "Data Representation",
    "subtopics": [
      "Binary and denary conversion",
      "Hexadecimal and its uses",
      "Binary addition and overflow",
      "Two's complement for negative numbers",
      "Text representation: ASCII and Unicode",
      "Sound and image representation",
      "Data storage units and file size calculations",
      "Compression: lossy and lossless"
    ],
    "learning_objectives": [
      "Convert between binary, denary and hexadecimal",
      "Perform binary addition and identify overflow",
      "Represent negative numbers using two's complement",
      "Calculate file sizes and explain compression choices"
    ],
    "key_concepts": [
      "Place value in bases 2, 10 and 16",
      "Bit, byte and the KiB/MiB progression",
      "Colour depth and resolution affecting image size",
      "Sample rate and resolution affecting sound size",
      "Run-length encoding as lossless example"
    ],
    "assessment_objectives": [
      "Perform accurate conversions and calculations",
      "Explain how different data types are represented in binary",
      "Justify compression choices for scenarios",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Convert the denary number to 8-bit binary and to hexadecimal",
      "Add the two binary numbers and explain the problem that occurs",
      "Calculate the file size of the image with the given dimensions and colour depth",
      "Explain why lossless compression must be used for the file described",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Basic arithmetic"
    ],
    "common_misconceptions": [
      "Reading binary place values left to right as 1, 2, 4...",
      "Ignoring overflow when the result needs more bits than available",
      "Confusing lossy (data discarded) with lossless (data preserved) compression",
      "Mixing up bits and bytes in size calculations",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Convert the hexadecimal value A7 to binary and to denary",
      "A sound clip is sampled at the given rate and resolution for 30 seconds; calculate the file size in MB",
      "Explain one benefit and one drawback of using lossy compression for the photograph"
    ]
  },
  {
    "name": "Data Transmission and the Internet",
    "subtopics": [
      "Serial and parallel transmission; simplex, half-duplex, duplex",
      "Packet switching and packet structure",
      "USB as an interface",
      "Error detection: parity, checksum, check digit, echo check",
      "Encryption: symmetric and asymmetric basics",
      "The internet vs the World Wide Web",
      "IP and MAC addresses; routers",
      "Digital currency and blockchain awareness"
    ],
    "learning_objectives": [
      "Compare transmission methods for given scenarios",
      "Describe how packets are structured and routed",
      "Apply error-detection methods to example data",
      "Explain the roles of encryption, IP/MAC addressing and routers"
    ],
    "key_concepts": [
      "Packet header contents",
      "Parity as single-bit error detection",
      "Public and private keys conceptually",
      "Unique hardware MAC vs assigned IP",
      "URL structure and DNS resolution"
    ],
    "assessment_objectives": [
      "Explain transmission and addressing concepts accurately",
      "Apply error-detection techniques to data",
      "Describe security of data during transmission",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "State whether the parity byte reveals an error in the transmitted block",
      "Describe how packet switching delivers the file across the internet",
      "Explain the difference between an IP address and a MAC address",
      "Describe how the browser retrieves the web page after the URL is typed",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Data representation strand"
    ],
    "common_misconceptions": [
      "Believing parity checks detect all errors including two-bit flips",
      "Treating the internet and the web as the same thing",
      "Assuming packets travel the same route in order",
      "Confusing encryption (scrambling) with error detection (verifying)",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "The 8-bit values use even parity; identify which byte contains an error",
      "Explain how asymmetric encryption allows the customer to send card details securely"
    ]
  },
  {
    "name": "Hardware: CPU, Memory and Devices",
    "subtopics": [
      "Von Neumann architecture and registers (PC, MAR, MDR, ACC, CIR)",
      "The fetch-decode-execute cycle",
      "Factors affecting CPU performance: clock, cores, cache",
      "Instruction sets and embedded systems",
      "Input and output devices",
      "Sensors and their applications",
      "Primary storage: RAM and ROM",
      "Secondary storage: magnetic, optical, solid state",
      "Virtual memory and cloud storage"
    ],
    "learning_objectives": [
      "Describe the fetch-decode-execute cycle using registers and buses",
      "Analyse how clock speed, cores and cache affect performance",
      "Match input, output and storage devices to scenarios",
      "Compare storage technologies by speed, capacity, cost and durability"
    ],
    "key_concepts": [
      "Stored program concept",
      "Address bus, data bus, control bus",
      "Embedded system characteristics",
      "Sensor-microprocessor feedback loops",
      "Volatility of RAM vs ROM",
      "Trade-offs among HDD, SSD and optical media"
    ],
    "assessment_objectives": [
      "Describe architecture and cycle accurately",
      "Justify device and storage choices for scenarios",
      "Explain automated systems using sensors",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Describe the role of each named register during the cycle",
      "Explain how the sensor and microprocessor keep the greenhouse temperature constant",
      "Recommend a storage medium for the scenario and justify",
      "Explain two ways the CPU described could be made faster",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 14,
    "prerequisites": [
      "Data representation strand"
    ],
    "common_misconceptions": [
      "Believing more cores always doubles performance",
      "Confusing RAM (volatile working memory) with storage",
      "Thinking ROM contents can be routinely rewritten by the user",
      "Describing sensors as making decisions rather than sending data to the processor",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Put the steps of the fetch-decode-execute cycle in the correct order and name the registers used",
      "An automated irrigation system uses a moisture sensor; describe how the system decides when to water"
    ]
  },
  {
    "name": "Software, Operating Systems and Logic",
    "subtopics": [
      "System vs application software",
      "Operating system functions",
      "Interrupts and their handling",
      "High-level vs low-level languages",
      "Compilers, interpreters and assemblers",
      "IDE features",
      "Logic gates: AND, OR, NOT, NAND, NOR, XOR",
      "Logic circuits and truth tables from problem statements"
    ],
    "learning_objectives": [
      "Explain operating system management functions and interrupts",
      "Compare translation methods for high-level code",
      "Construct logic circuits from written statements",
      "Complete and interpret truth tables for multi-gate circuits"
    ],
    "key_concepts": [
      "Memory, file, process and hardware management by the OS",
      "Interrupt priority and the interrupt service routine",
      "Compiler (whole program) vs interpreter (line by line)",
      "Gate symbols and truth tables",
      "Combining gates to express compound conditions"
    ],
    "assessment_objectives": [
      "Explain software roles and translation accurately",
      "Design logic circuits matching specifications",
      "Complete truth tables correctly for circuits",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Draw the logic circuit for the statement given",
      "Complete the truth table for the circuit shown",
      "Explain what happens when the interrupt occurs during printing",
      "State two differences between a compiler and an interpreter",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 13,
    "prerequisites": [
      "Hardware strand"
    ],
    "common_misconceptions": [
      "Confusing NAND (NOT of AND) outputs with AND",
      "Enumerating truth table rows in a non-systematic order and missing combinations",
      "Believing interpreters produce a saved executable file",
      "Thinking the OS is only the desktop interface",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "An alarm sounds if the door opens while the system is armed, or if the window sensor triggers; draw the logic circuit",
      "Complete the eight-row truth table for the three-input circuit shown"
    ]
  },
  {
    "name": "Security, Ethics and Emerging Technologies",
    "subtopics": [
      "Cyber threats: brute force, DDoS, hacking, malware types, phishing, pharming, social engineering",
      "Keeping data safe: access levels, anti-malware, authentication, two-step verification, firewalls, proxy servers, SSL/TLS",
      "Ethics and intellectual property; free/open-source vs proprietary software",
      "Automated decision systems: benefits and risks",
      "Artificial intelligence at a conceptual level",
      "Privacy and data protection awareness"
    ],
    "learning_objectives": [
      "Identify threats and match countermeasures appropriately",
      "Describe how authentication and secure protocols protect systems",
      "Discuss ethical and legal issues around software and data",
      "Explain benefits and drawbacks of automated and AI systems conceptually"
    ],
    "key_concepts": [
      "Malware taxonomy: virus, worm, trojan, spyware, adware, ransomware",
      "Defence in depth",
      "HTTPS indicators and certificates",
      "Copyright and licensing categories",
      "Machine learning as pattern learning from data at concept level"
    ],
    "assessment_objectives": [
      "Explain threats and protections in scenario contexts",
      "Evaluate security arrangements for described systems",
      "Discuss ethical implications of computing developments",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Identify the attack described and recommend two protections",
      "Explain how two-step verification improves account security",
      "Discuss one benefit and one risk of the automated system described",
      "State the difference between free software and freeware",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 12,
    "prerequisites": [
      "Data transmission strand"
    ],
    "common_misconceptions": [
      "Using virus as a blanket term for all malware",
      "Believing a firewall inspects files for infection like antivirus",
      "Confusing pharming (redirection) with phishing (deceptive messages)",
      "Assuming AI systems understand rather than statistically process data",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Customers were redirected to a fake site despite typing the correct address; name the attack and describe a protection",
      "Discuss whether the fully automated loan-approval system described is fair to applicants"
    ]
  },
  {
    "name": "Algorithm Design and Problem Solving",
    "subtopics": [
      "Decomposition and abstraction",
      "The program development life cycle",
      "Structure diagrams, flowcharts and pseudocode",
      "Standard algorithms: linear search, bubble sort, totalling, counting, max/min",
      "Validation and verification checks",
      "Test data: normal, abnormal, extreme and boundary",
      "Trace tables and dry runs",
      "Identifying and correcting logic errors"
    ],
    "learning_objectives": [
      "Decompose problems into component parts",
      "Express algorithms as flowcharts and pseudocode",
      "Trace algorithms accurately with trace tables",
      "Design validation checks and select appropriate test data"
    ],
    "key_concepts": [
      "Inputs, processes, outputs and storage in problem analysis",
      "Range, length, type, presence, format and check-digit validation",
      "Verification: double entry and visual check",
      "Bubble sort pass behaviour",
      "Boundary data at validation limits"
    ],
    "assessment_objectives": [
      "Design and represent algorithms clearly",
      "Trace and debug given algorithms",
      "Select and justify test data and validation",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Complete the trace table for the algorithm with the given input",
      "Draw a flowchart to solve the described problem",
      "Identify the error in the pseudocode and write the corrected line",
      "State suitable normal, extreme and abnormal test data for the input",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 18,
    "prerequisites": [
      "Logic strand helpful"
    ],
    "common_misconceptions": [
      "Confusing validation (automatic checks) with verification (confirming entry)",
      "Off-by-one loop boundary errors in searches and sorts",
      "Filling trace tables with expected values instead of following the code exactly",
      "Treating extreme data (valid at limits) as the same as abnormal data (invalid)",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Complete the trace table to show how the algorithm processes the input list and state its purpose",
      "Write pseudocode to input 30 marks, validate each as 0 to 100, and output the average of valid marks"
    ]
  },
  {
    "name": "Programming and Databases",
    "subtopics": [
      "Variables, constants and data types",
      "Input, output and assignment",
      "Selection: IF and CASE",
      "Iteration: count-controlled, pre- and post-condition loops",
      "Procedures, functions and parameters",
      "String handling operations",
      "Arrays: one and two dimensional",
      "File handling basics",
      "Single-table databases: fields, records, primary keys",
      "SQL: SELECT, WHERE, ORDER BY, COUNT and SUM"
    ],
    "learning_objectives": [
      "Write programs using the constructs of the syllabus pseudocode",
      "Manipulate one- and two-dimensional arrays with loops",
      "Use procedures and functions with parameters and return values",
      "Query single-table databases with SQL including aggregates"
    ],
    "key_concepts": [
      "Nested iteration for 2D arrays",
      "Scope of local variables",
      "Concatenation, substring and length operations",
      "Reading from and writing to text files",
      "Field data types and primary key uniqueness",
      "SELECT clause ordering"
    ],
    "assessment_objectives": [
      "Write accurate code for specified tasks",
      "Apply arrays, procedures and file handling in scenario programs",
      "Write SQL statements producing required outputs",
      "Demonstrate full-syllabus mastery under the O Level assessment model, where all weight rests on untiered written examinations"
    ],
    "typical_question_styles": [
      "Write a procedure that takes the array and outputs values meeting the condition",
      "Write pseudocode using a post-condition loop to repeat until valid input",
      "Write an SQL statement to display the fields for records matching the criteria, sorted as required",
      "State an appropriate data type for each field in the table",
      "Structured multi-part written questions under the untiered O Level examination model, covering the full syllabus depth"
    ],
    "exam_weight": 18,
    "prerequisites": [
      "Algorithm design strand"
    ],
    "common_misconceptions": [
      "Confusing pre-condition (may run zero times) with post-condition (runs at least once) loops",
      "Ignoring array bounds in nested loops over 2D arrays",
      "Using = for both assignment and comparison inconsistently",
      "Placing aggregate functions in the WHERE clause instead of the SELECT",
      "Assuming O Level offers tiered core/extended papers like IGCSE — all O Level candidates sit the same untiered papers covering the full syllabus"
    ],
    "exemplar_question_stems": [
      "Declare a 2D array for 5 teams over 10 rounds and write code to total each team's score",
      "Write a function that receives a string and returns the number of vowels it contains",
      "Write SQL to count how many records in the table have a value above the stated threshold"
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
