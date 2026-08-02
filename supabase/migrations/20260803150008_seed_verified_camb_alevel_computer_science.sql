-- Seed verified curriculum template: Cambridge International AS & A Level Computer Science
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
  'Computer Science',
  $topics$[
    {
      "name": "AS: Information Representation and Multimedia",
      "subtopics": ["Binary, denary, hexadecimal and BCD", "Two's complement arithmetic", "Character sets: ASCII and Unicode", "Bitmap and vector graphics", "Sound representation and sampling", "Compression techniques and their selection", "File size estimation"],
      "learning_objectives": ["Convert between number bases and perform binary arithmetic including negatives", "Compare bitmap and vector representations for given uses", "Explain sampling rate and resolution trade-offs for sound", "Select and justify compression methods for media types"],
      "key_concepts": ["Overflow in fixed-width arithmetic", "BCD applications", "Colour depth and resolution effects", "Lossy vs lossless trade-offs", "Run-length encoding mechanics"],
      "assessment_objectives": ["Perform representation calculations accurately", "Explain media representation choices", "Justify compression decisions for scenarios"],
      "typical_question_styles": ["Perform the two's complement subtraction and comment on the result", "Calculate the bitmap file size from the given dimensions and depth", "Explain why vector graphics suit the logo described", "Justify a compression choice for archiving the medical images"],
      "exam_weight": 10,
      "prerequisites": ["IGCSE/O Level Computer Science helpful"],
      "common_misconceptions": ["Ignoring overflow when results exceed the register width", "Believing vector images are always smaller than bitmaps", "Confusing sample rate (frequency) with resolution (bits per sample)", "Assuming lossless compression cannot shrink files meaningfully"],
      "exemplar_question_stems": ["Convert the denary values to 8-bit two's complement and add them; explain the flag that results", "A 4-minute stereo recording uses the stated rate and resolution; estimate the uncompressed file size"]
    },
    {
      "name": "AS: Networking and Security Fundamentals",
      "subtopics": ["Network types, topologies and models: client-server, peer-to-peer", "LAN hardware: switches, routers, access points, NIC", "The internet: IP addressing (IPv4/IPv6), DNS, URLs", "Circuit vs packet switching", "Wired and wireless transmission media", "Security threats and protections: firewalls, encryption basics, authentication", "Data integrity vs data security distinction"],
      "learning_objectives": ["Compare network architectures and topologies for scenarios", "Explain IP addressing including public/private and static/dynamic", "Describe how DNS resolution and packet switching deliver data", "Recommend layered security measures for described systems"],
      "key_concepts": ["Subnetting awareness and address classes conceptually", "Router vs switch roles", "Bandwidth vs latency", "Symmetric vs asymmetric encryption use cases", "Validation vs verification of transmitted data"],
      "assessment_objectives": ["Explain networking infrastructure accurately", "Trace data journeys across networks", "Evaluate security arrangements"],
      "typical_question_styles": ["Describe how the packet travels from the client to the web server", "Compare client-server and peer-to-peer models for the office described", "Explain the roles of the private key and public key in the exchange", "Recommend measures to protect the described system from the stated threats"],
      "exam_weight": 10,
      "prerequisites": ["AS representation strand"],
      "common_misconceptions": ["Believing packets follow one fixed path in order", "Confusing the internet with the web", "Assuming encryption prevents interception rather than making interception useless", "Mixing up MAC (hardware) and IP (logical) addressing"],
      "exemplar_question_stems": ["Explain how DNS converts the typed address into a connection to the correct server", "The clinic must transmit patient data securely between sites; describe and justify a security design"]
    },
    {
      "name": "AS: Hardware, Logic and Processor Fundamentals",
      "subtopics": ["Logic gates and circuit design; truth tables", "Boolean algebra simplification basics", "Processor components: ALU, CU, registers, buses", "The fetch-execute cycle in register transfer detail", "Interrupts and their handling", "Assembly language: instruction groups, addressing modes", "Bit manipulation: shifts and masking"],
      "learning_objectives": ["Design and simplify logic circuits from specifications", "Describe the fetch-execute cycle using register transfer notation", "Trace assembly language programs including addressing modes", "Apply shifts and masks to manipulate binary data"],
      "key_concepts": ["Universal gates", "Program counter, MAR, MDR, CIR, index register roles", "Immediate, direct, indirect, indexed, relative addressing", "Logical vs arithmetic shifts", "Interrupt service routines and priorities"],
      "assessment_objectives": ["Construct and simplify logic solutions", "Trace low-level program execution accurately", "Explain processor operation with correct terminology"],
      "typical_question_styles": ["Complete the truth table and write the Boolean expression for the circuit", "Trace the assembly program showing register contents after each instruction", "Explain what happens when the interrupt is received during the cycle", "Show the register contents after the logical shift and the AND mask"],
      "exam_weight": 12,
      "prerequisites": ["AS representation strand"],
      "common_misconceptions": ["Confusing direct addressing (address given) with immediate (value given)", "Losing carry/sign behaviour differences between logical and arithmetic shifts", "Believing the fetch-execute cycle pauses permanently on interrupt rather than resuming", "Treating simplification as optional when circuits can be minimised"],
      "exemplar_question_stems": ["Write the Boolean expression for the alarm system and draw the minimised circuit", "Trace the given assembly code that uses indexed addressing over the array and state the final accumulator value"]
    },
    {
      "name": "AS: System Software and Software Development Tools",
      "subtopics": ["Operating system purposes and management tasks", "Utility software", "Language translators: assembler, compiler, interpreter", "Integrated development environments", "Modes of operation: batch, real-time awareness", "User interfaces"],
      "learning_objectives": ["Explain OS resource management functions", "Compare compilation and interpretation including partial compilation to bytecode", "Describe how IDE features support development and debugging", "Match utility software to maintenance tasks"],
      "key_concepts": ["Memory, process, file and I/O management", "Virtual machine/bytecode execution", "Syntax vs logic error detection support", "Defragmentation, backup, compression utilities", "Command line vs GUI trade-offs"],
      "assessment_objectives": ["Explain system software roles accurately", "Compare translation approaches for scenarios", "Select tools appropriate to development tasks"],
      "typical_question_styles": ["Explain two management tasks the OS performs when the program runs", "Compare using a compiler with an interpreter during development", "Describe how the IDE features assist in locating the fault described", "State a suitable utility program for the task and justify"],
      "exam_weight": 8,
      "prerequisites": ["AS hardware strand"],
      "common_misconceptions": ["Believing interpreted programs cannot be distributed", "Treating the OS as only the user interface", "Assuming compilers catch logic errors", "Confusing utilities with application software"],
      "exemplar_question_stems": ["The development team debugs a large program; explain how breakpoints and variable watch windows help", "Explain why bytecode with a virtual machine offers portability"]
    },
    {
      "name": "AS: Algorithm Design, Data Structures and Programming",
      "subtopics": ["Computational thinking: abstraction and decomposition", "Pseudocode conventions: selection, iteration, procedures, functions", "Arrays (1D and 2D) and records", "Text files processing", "Linear and binary search; bubble and insertion sorts", "Abstract data types introduction: stack, queue, linked list", "Structured programming and modularity", "Testing: test data selection, trace tables, error types"],
      "learning_objectives": ["Design algorithms using standard constructs and structures", "Implement and trace the standard searches and sorts", "Perform stack, queue and linked list operations manually", "Select test strategies and construct trace tables", "Write modular programs with parameters and return values"],
      "key_concepts": ["Binary search precondition of sorted data", "Best/worst case behaviour informally", "Pointers in linked structures at diagram level", "Stepwise refinement", "White-box vs black-box testing"],
      "assessment_objectives": ["Design and express algorithms clearly", "Trace and correct given algorithms", "Apply ADT operations accurately"],
      "typical_question_styles": ["Write pseudocode to process the file and produce the summary", "Trace the insertion sort on the given list showing each pass", "Show the state of the stack after the sequence of operations", "Choose test data to cover the boundary conditions of the validation rule"],
      "exam_weight": 20,
      "prerequisites": ["AS logic strand helpful"],
      "common_misconceptions": ["Applying binary search to unsorted data", "Confusing stack (LIFO) with queue (FIFO) behaviour", "Off-by-one boundary errors in loops over arrays", "Assuming one successful test proves correctness"],
      "exemplar_question_stems": ["Write a function that searches the sorted array using binary search and returns the index or -1", "The linked list stores values in order; show the pointer changes needed to insert the new value"]
    },
    {
      "name": "A2: Data Structures, Algorithms and Complexity",
      "subtopics": ["Binary trees: construction, traversal, searching", "Hash tables and collision handling", "Dictionaries and graphs introduction", "Recursion: design, tracing, vs iteration", "Sorting/searching efficiency and Big-O notation", "Queues variants: circular and priority", "Implementation of ADTs in code"],
      "learning_objectives": ["Construct and traverse binary search trees", "Explain hashing and resolve collisions with stated strategies", "Write and trace recursive algorithms and convert between recursion and iteration", "Compare algorithm efficiency using Big-O classes"],
      "key_concepts": ["In-order, pre-order, post-order traversals", "Load factor intuition", "Base case and general case in recursion", "O(1), O(log n), O(n), O(n^2) hierarchy", "Adjacency representations of graphs at concept level"],
      "assessment_objectives": ["Manipulate advanced data structures correctly", "Analyse and compare algorithmic efficiency", "Write recursive solutions where natural"],
      "typical_question_styles": ["Insert the values into a binary search tree and list the in-order traversal", "Show how the collision is handled using the stated method", "Trace the recursive function for the given argument showing the call stack", "State the Big-O time complexity of each algorithm and justify"],
      "exam_weight": 14,
      "prerequisites": ["AS algorithms strand"],
      "common_misconceptions": ["Confusing traversal orders", "Writing recursion without a reachable base case", "Believing Big-O describes exact running time rather than growth class", "Treating hash lookup as always O(1) regardless of collisions"],
      "exemplar_question_stems": ["Write a recursive function to compute the sum of values stored in the binary tree", "Explain why binary search is O(log n) while linear search is O(n)"]
    },
    {
      "name": "A2: Advanced Theory — Translation, Boolean Algebra, Architecture and AI Concepts",
      "subtopics": ["Compilation stages: lexical, syntax, code generation, optimisation", "Backus-Naur Form and syntax diagrams", "Reverse Polish Notation: conversion and evaluation", "Boolean algebra: laws, De Morgan, Karnaugh maps", "Flip-flops: SR and JK basics", "Processor performance: pipelining, RISC vs CISC, parallel processing", "Virtual machines awareness", "Artificial intelligence concepts: machine learning categories, neural network basics conceptually"],
      "learning_objectives": ["Describe compiler stages and what each produces", "Read and write simple BNF definitions and validate strings", "Convert expressions to RPN and evaluate with a stack", "Simplify Boolean expressions using laws and Karnaugh maps", "Compare processor architectures and parallelism models", "Explain machine learning types and shallow neural network intuition"],
      "key_concepts": ["Tokenisation and symbol tables", "Grammar recursion in BNF", "Stack evaluation of postfix", "K-map grouping rules", "Instruction-level vs processor-level parallelism", "Supervised, unsupervised and reinforcement learning distinctions"],
      "assessment_objectives": ["Apply theoretical models accurately", "Perform conversions and simplifications correctly", "Explain advanced architecture and AI concepts clearly"],
      "typical_question_styles": ["Write the BNF rule for the identifier format described", "Convert the infix expression to RPN and evaluate it using a stack trace", "Simplify the Boolean expression using a Karnaugh map", "Explain how pipelining improves throughput and what hazards limit it", "Describe the difference between supervised and unsupervised learning with an example"],
      "exam_weight": 14,
      "prerequisites": ["AS logic and hardware strands", "A2 data structures strand"],
      "common_misconceptions": ["Grouping K-map cells diagonally", "Evaluating RPN left to right without stack discipline", "Believing RISC means fewer capabilities rather than simpler instructions", "Treating machine learning as explicit rule programming"],
      "exemplar_question_stems": ["Convert (a + b) * (c - d) to reverse Polish notation and show the stack evaluation for given values", "Use a Karnaugh map to simplify the four-variable expression and draw the minimised circuit"]
    },
    {
      "name": "A2: Databases, Software Engineering and Advanced Programming",
      "subtopics": ["Relational databases: normalisation to 3NF", "SQL: DDL and DML including joins and aggregates", "Transaction processing: ACID awareness", "Program design: state diagrams, decision tables awareness", "Programming paradigms: procedural, object-oriented, declarative", "OOP in depth: classes, inheritance, polymorphism, encapsulation, containment", "Exception handling", "File organisation: serial, sequential, random; hashing for access"],
      "learning_objectives": ["Normalise data to third normal form with justification", "Write multi-table SQL queries with joins and aggregates", "Design and implement class hierarchies with inheritance and polymorphism", "Handle runtime errors with structured exception handling", "Choose file organisation strategies for access patterns"],
      "key_concepts": ["Partial and transitive dependency removal", "Primary/foreign key integrity", "Method overriding vs overloading", "Abstraction through encapsulation", "Declarative vs imperative thinking", "Hash-based direct access mechanics"],
      "assessment_objectives": ["Design normalised database schemas", "Write accurate SQL for specified outputs", "Implement object-oriented designs in code"],
      "typical_question_styles": ["Normalise the table to 3NF showing each stage", "Write the SQL query joining the two tables to produce the report", "Write the class definitions with the inheritance shown in the diagram", "Explain how the exception handler prevents the crash described", "Justify a file organisation for the access pattern described"],
      "exam_weight": 12,
      "prerequisites": ["AS programming strand", "A2 data structures strand"],
      "common_misconceptions": ["Stopping normalisation at 2NF while transitive dependencies remain", "Using WHERE for aggregate filtering instead of HAVING", "Confusing overloading (same name, different signatures) with overriding (subclass redefinition)", "Treating exceptions as replacements for input validation"],
      "exemplar_question_stems": ["The unnormalised booking data is shown; produce the 3NF tables and identify all keys", "Define a base class Vehicle and derived class ElectricVehicle overriding the cost method as specified"]
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
