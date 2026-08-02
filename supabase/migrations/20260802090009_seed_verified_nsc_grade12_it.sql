-- Seed verified curriculum template: NSC Grade 12 Information Technology (CAPS)
-- Content policy: strand structure and approximate weightings reflect publicly
-- documented CAPS syllabus organisation (factual information). All exemplar
-- question stems are original paraphrases written for this project; no exam-board
-- text is reproduced.
-- Idempotent: ON CONFLICT upsert only overwrites rows previously sourced from
-- 'ai' or 'hybrid'; human-verified rows are never clobbered.

INSERT INTO public.curriculum_topic_templates (curriculum, grade, subject, topics, source, verified_at)
VALUES (
  'NSC',
  'Grade 12',
  'Information Technology',
  $topics$[
    {
      "name": "Solution Development: Programming Fundamentals",
      "subtopics": ["Variables, data types and operators", "Decision structures (if, case)", "Loop structures (for, while, repeat)", "Procedures and functions with parameters", "Scope of variables", "Debugging and trace tables", "Algorithm design and pseudocode"],
      "learning_objectives": ["Design algorithms to solve stated problems", "Implement selection and iteration structures correctly", "Decompose solutions into procedures and functions", "Trace code manually to predict output and locate logic errors"],
      "key_concepts": ["Sequence, selection, iteration", "Parameter passing (by value vs by reference)", "Local vs global scope", "Nested loops and nested conditions", "Boolean logic and compound conditions", "Syntax vs logic vs runtime errors"],
      "assessment_objectives": ["Write syntactically correct code fragments for given scenarios", "Complete trace tables for provided code", "Identify and correct errors in given code"],
      "typical_question_styles": ["Write a function/procedure to perform a described task", "Complete the trace table for the given loop", "Identify the error in the code and rewrite the corrected line", "Convert a description into an algorithm or code fragment"],
      "exam_weight": 15,
      "prerequisites": ["Grade 11 programming constructs", "Basic algebra and logic"],
      "common_misconceptions": ["Confusing = assignment with equality comparison", "Off-by-one errors in loop boundaries", "Assuming variables keep values between procedure calls without global scope", "Forgetting to initialise accumulator variables before loops"],
      "exemplar_question_stems": ["Write a function that receives an integer and returns TRUE if it is even", "Complete the trace table for the loop and state the final output", "The code contains a logic error that causes an infinite loop; identify and correct it"]
    },
    {
      "name": "Solution Development: Strings, Arrays and Text Files",
      "subtopics": ["String manipulation (length, copy, pos, case conversion)", "Character-by-character processing", "One-dimensional arrays: declaring, populating, traversing", "Searching and sorting arrays", "Parallel arrays", "Reading from and writing to text files", "Validation of input data"],
      "learning_objectives": ["Manipulate strings to extract, test and transform text", "Store and process collections of data in arrays", "Apply linear search and simple sorts to arrays", "Process text files line by line with appropriate error checking"],
      "key_concepts": ["Index positions in strings and arrays", "Delimiters and splitting strings", "Linear search vs bubble/selection sort", "EOF processing pattern for text files", "Data validation (presence, type, range, format)", "Aggregating totals and finding maxima/minima"],
      "assessment_objectives": ["Write code that processes strings character by character", "Populate and process arrays including parallel arrays", "Read a text file, extract fields and produce summary output"],
      "typical_question_styles": ["Write code to count occurrences of a character in a string", "Sort the array in descending order and display the top three values", "Read the text file, split each line at the delimiter and total a field", "Validate the input so that only values in a given range are accepted"],
      "exam_weight": 15,
      "prerequisites": ["Programming fundamentals", "Grade 11 string and array basics"],
      "common_misconceptions": ["Confusing zero-based and one-based indexing between languages", "Running loops past the last used element of a partially filled array", "Forgetting to close files or handle a missing file", "Sorting one parallel array without swapping the matching elements of the other"],
      "exemplar_question_stems": ["Write code that extracts the initials from a full name stored in a string", "The parallel arrays store names and scores; display the name of the learner with the highest score", "Read data.txt where each line contains a name and amount separated by a hash; calculate the total amount"]
    },
    {
      "name": "Solution Development: Object-Oriented Programming",
      "subtopics": ["Classes and objects", "Attributes (fields) and methods", "Constructors", "Accessor (get) and mutator (set) methods", "toString-type reporting methods", "Private vs public visibility", "Using objects in a main program", "Arrays of objects"],
      "learning_objectives": ["Define a class from a given specification or UML-style diagram", "Implement constructors, accessors, mutators and auxiliary methods", "Instantiate and use objects in a driver program", "Explain encapsulation and information hiding"],
      "key_concepts": ["Encapsulation", "Object state and behaviour", "Class diagram notation (attributes, methods, visibility)", "Instantiation and references", "Method signatures and return types", "Arrays or lists of objects"],
      "assessment_objectives": ["Write a complete class from a class diagram", "Write methods that apply business rules to object attributes", "Use objects and call methods correctly from the main program"],
      "typical_question_styles": ["Write the constructor for the class shown in the diagram", "Write a method that applies the stated rule and returns the result", "Write the toString method to return the object state in the given format", "In the main program, instantiate the object and display the report"],
      "exam_weight": 14,
      "prerequisites": ["Programming fundamentals", "Grade 11 introduction to OOP"],
      "common_misconceptions": ["Accessing private attributes directly from outside the class", "Confusing a class (blueprint) with an object (instance)", "Omitting the return statement in accessor methods", "Redeclaring attributes as local variables inside methods, shadowing the fields"],
      "exemplar_question_stems": ["Using the class diagram provided, write the code for the constructor and the two mutator methods", "Write a method calculateDiscount that returns the price reduced according to the stated rules", "Explain why the attributes of the class are declared private"]
    },
    {
      "name": "Databases and SQL",
      "subtopics": ["Relational database concepts: tables, records, fields", "Primary and foreign keys, relationships", "Data anomalies and basic normalisation ideas", "SQL SELECT with WHERE, ORDER BY", "Aggregate functions (COUNT, SUM, AVG, MAX, MIN) and GROUP BY", "Calculated fields and date functions", "INSERT, UPDATE, DELETE statements", "Accessing a database from a program"],
      "learning_objectives": ["Interpret a database design with related tables", "Write SQL queries to retrieve, filter, sort and summarise data", "Write SQL statements that modify data", "Explain how keys enforce relationships and integrity"],
      "key_concepts": ["One-to-many relationships", "Primary key uniqueness and foreign key referencing", "WHERE conditions with AND/OR and wildcards", "GROUP BY with aggregate functions", "Joining or relating two tables in a query", "Data integrity and redundancy"],
      "assessment_objectives": ["Write SQL for described retrieval and update tasks", "Predict the output of given SQL statements", "Evaluate a table design and identify key fields or anomalies"],
      "typical_question_styles": ["Write an SQL statement to display the listed fields for records meeting the condition, sorted as specified", "Write an SQL statement using an aggregate function to summarise the data per group", "Write an SQL statement to update/insert/delete the described record(s)", "Identify a suitable primary key for the table and justify your choice"],
      "exam_weight": 14,
      "prerequisites": ["Grade 11 database concepts and basic SQL"],
      "common_misconceptions": ["Using = with wildcard patterns instead of LIKE", "Selecting non-aggregated fields without including them in GROUP BY", "Confusing WHERE (filters rows) with ORDER BY (sorts results)", "Forgetting quotes around text values in conditions"],
      "exemplar_question_stems": ["Write SQL to display the names and totals of all customers whose total exceeds the given amount, from highest to lowest", "Write SQL to count how many bookings were made per month", "Write SQL to increase the price of all items in the stated category by ten percent"]
    },
    {
      "name": "Systems Technologies (Hardware and Software)",
      "subtopics": ["Computer components and the machine cycle", "CPU, cache, RAM, ROM and storage hierarchy", "Virtual memory and paging", "Operating system functions and utilities", "System software vs application software", "Virtualisation and cloud computing", "Factors affecting performance", "Caring for hardware; troubleshooting basics"],
      "learning_objectives": ["Explain how hardware components co-operate during processing", "Describe the role of virtual memory, caching and buffering", "Compare storage and memory technologies for given scenarios", "Recommend hardware/software specifications for a stated use case"],
      "key_concepts": ["Fetch-decode-execute cycle", "Memory hierarchy trade-offs (speed, cost, capacity)", "Multitasking and scheduling", "Device drivers and firmware", "SSD vs HDD vs cloud storage", "Thrashing when RAM is insufficient"],
      "assessment_objectives": ["Explain hardware and OS concepts in scenario contexts", "Justify recommended specifications for a described user", "Interpret advertisements or spec sheets for computing devices"],
      "typical_question_styles": ["Explain the purpose of virtual memory and one drawback of relying on it", "Recommend suitable specifications for the described user and motivate each choice", "Distinguish between the two given technologies and state when each is preferable", "Explain how caching improves performance in the given scenario"],
      "exam_weight": 14,
      "prerequisites": ["Grade 10-11 systems technologies"],
      "common_misconceptions": ["Believing virtual memory is as fast as RAM", "Confusing memory (RAM) with storage (disk)", "Thinking a faster clock speed alone guarantees better overall performance", "Confusing the operating system with the BIOS/firmware"],
      "exemplar_question_stems": ["The computer slows down when many applications are open; explain, with reference to virtual memory, why this happens", "Motivate TWO hardware specifications you would recommend for a video-editing workstation", "Explain the difference between system software and application software with an example of each"]
    },
    {
      "name": "Communication and Internet Technologies",
      "subtopics": ["Networks: LAN, WAN, PAN and topologies", "Network devices (switch, router, access point)", "Internet connection technologies and criteria (bandwidth, latency)", "Protocols (HTTP/HTTPS, FTP, TCP/IP concepts)", "DNS and URLs", "Cloud services and remote access", "Security: firewalls, encryption, VPN", "Internet of Things and mobile technologies"],
      "learning_objectives": ["Describe network components and their functions", "Compare connection options for given scenarios using appropriate criteria", "Explain how DNS, protocols and encryption support internet communication", "Discuss IoT applications and their implications"],
      "key_concepts": ["Client-server vs peer-to-peer", "Bandwidth vs data cap vs latency", "Public key encryption at a conceptual level", "HTTPS and digital certificates", "VPN tunnelling for secure remote access", "IoT sensors and real-time data"],
      "assessment_objectives": ["Explain networking concepts in scenario contexts", "Recommend and motivate connectivity solutions", "Discuss security measures for data in transit"],
      "typical_question_styles": ["Explain the role of the DNS when a user enters a web address", "Recommend a suitable internet connection for the described scenario and motivate", "Explain how encryption protects the data transmitted in the scenario", "State TWO benefits and TWO risks of the described IoT implementation"],
      "exam_weight": 14,
      "prerequisites": ["Grade 11 networking and internet technologies"],
      "common_misconceptions": ["Confusing bandwidth (speed) with a data cap (quantity)", "Believing HTTPS makes the entire computer secure rather than the connection", "Thinking a firewall removes viruses like an antivirus does", "Assuming Wi-Fi and internet access are the same thing"],
      "exemplar_question_stems": ["Explain, step by step, what happens when a URL is resolved by the DNS", "The clinic wants staff to work from home securely; explain how a VPN would assist", "Distinguish between a switch and a router in the office network shown"]
    },
    {
      "name": "Social Implications and Emerging Technologies",
      "subtopics": ["Computer crimes: malware, phishing, ransomware, identity theft", "Safeguards: authentication, backups, updates, user policies", "Ethical and legal issues: privacy, POPIA-style data protection principles, copyright", "Effects of technology on society and employment", "Digital divide", "Emerging technologies: AI, machine learning, big data, blockchain concepts", "Responsible and healthy computer use"],
      "learning_objectives": ["Identify threats and match appropriate safeguards", "Discuss ethical and legal responsibilities around data and software", "Evaluate social and economic effects of computing technologies", "Describe emerging technologies and their potential impact"],
      "key_concepts": ["Social engineering vs technical attacks", "Two-factor authentication", "Personal information protection principles", "Software licensing (proprietary, open source, freeware)", "Automation and the changing workplace", "AI training data and bias at a conceptual level"],
      "assessment_objectives": ["Discuss threats, safeguards and ethical issues in scenario contexts", "Evaluate the impact of a technology on stakeholders", "Explain emerging technology concepts in accessible terms"],
      "typical_question_styles": ["Identify the type of attack described and suggest TWO safeguards", "Discuss TWO ethical concerns raised by the scenario", "Explain how the emerging technology named could benefit the organisation", "Argue for or against the statement about technology and employment"],
      "exam_weight": 14,
      "prerequisites": ["Grade 10-11 social implications"],
      "common_misconceptions": ["Believing antivirus software guarantees complete protection", "Thinking free download means free of copyright restrictions", "Confusing phishing (deception) with hacking (technical intrusion)", "Assuming AI systems are objective and free of bias"],
      "exemplar_question_stems": ["An employee received an email asking them to confirm their banking PIN; identify the attack and recommend safeguards", "Discuss TWO ways the company should protect the personal information of its clients", "Explain ONE way machine learning could improve the service described in the scenario"]
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
