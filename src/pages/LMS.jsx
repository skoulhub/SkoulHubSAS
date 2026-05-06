import { useState } from 'react';

/* ─────────────────────────────────────────────────────────
   NCDC Uganda A-Level LMS
   Senior 5 (S5) & Senior 6 (S6) — Term-based curriculum
   Source: https://drive.google.com/drive/folders/1xBemMDyW-hpFTaMeh9a7GNJA8VxutNmO
───────────────────────────────────────────────────────── */

const DRIVE_BASE = 'https://drive.google.com/file/d';
const DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1xBemMDyW-hpFTaMeh9a7GNJA8VxutNmO';

/* ── All A-Level subjects with drive file IDs ── */
/* Sorted alphabetically by subject name */
const SUBJECTS = [
  { id: 'agriculture',  name: 'Agriculture',              code: 'AGR', category: 'Sciences',    color: '#16a34a', bg: '#dcfce7', fileId: '1hVYzI-E1ZlY7rLNiSBUgqT8ygHxdrf1T',  icon: '🌾', pages: 64 },
  { id: 'arabic',       name: 'Arabic',                   code: 'ARA', category: 'Languages',   color: '#92400e', bg: '#fef3c7', fileId: '1SLFV2cYx7NGrqxZU3VJ4L-k1skqt7HZy',  icon: '🕌', pages: 98 },
  { id: 'artdesign',    name: 'Art & Design',             code: 'ART', category: 'Arts',        color: '#db2777', bg: '#fce7f3', fileId: '1pw-5Z07ihn0u7-GfmmH4OtJnbg4qPlnw',  icon: '🎨', pages: 62 },
  { id: 'biology',      name: 'Biology',                  code: 'BIO', category: 'Sciences',    color: '#059669', bg: '#d1fae5', fileId: '19wqbCtcHW6WzxmJj-A814LMkNQbfNSYa',  icon: '🧬', pages: 44 },
  { id: 'chemistry',    name: 'Chemistry',                code: 'CHE', category: 'Sciences',    color: '#0891b2', bg: '#e0f2fe', fileId: '1d7J-hM1cYWdfFJytn34csGLKJwMbwFY0',  icon: '⚗️', pages: 70 },
  { id: 'chinese',      name: 'Chinese',                  code: 'CHI', category: 'Languages',   color: '#dc2626', bg: '#fee2e2', fileId: '11iCevQ8KcmOE9HyvClQhOgr0LolLTUMS',  icon: '🀄', pages: 112 },
  { id: 'cre',          name: 'Christian Religious Education', code: 'CRE', category: 'Religious', color: '#7e22ce', bg: '#f3e8ff', fileId: '1g0rp9zGB0ejq_Wmw1ZdQcVoDnzncPKRa', icon: '✝️', pages: null },
  { id: 'clothing',     name: 'Clothing & Textile',       code: 'CLT', category: 'Arts',        color: '#ec4899', bg: '#fce7f3', fileId: '1CCcFuQjDronw5gh746eMDXl1H41m1Oew',  icon: '🧵', pages: 58 },
  { id: 'economics',    name: 'Economics',                code: 'ECO', category: 'Humanities',  color: '#d97706', bg: '#fef3c7', fileId: '1dn7bo4m3EwfS9JyADaHiHEALbHXJr-Ia',  icon: '📈', pages: null },
  { id: 'entrepren',    name: 'Entrepreneurship',         code: 'ENT', category: 'Humanities',  color: '#dc2626', bg: '#fee2e2', fileId: '1BeJ5je6SOstAvGIvqhvzS0YCsZam-wg1',  icon: '💼', pages: null },
  { id: 'foods',        name: 'Foods & Nutrition',        code: 'FNT', category: 'Arts',        color: '#f97316', bg: '#ffedd5', fileId: '1N-nB8khk67LeFnWduIib5hUMZRa5nfTT',  icon: '🍽️', pages: null },
  { id: 'french',       name: 'French',                   code: 'FRE', category: 'Languages',   color: '#2563eb', bg: '#dbeafe', fileId: '1SCKkKFhJRgQjlBUC5cW4COukjHZuAxz2',  icon: '🇫🇷', pages: null },
  { id: 'genpaper',     name: 'General Paper',            code: 'GP',  category: 'General',     color: '#64748b', bg: '#f1f5f9', fileId: '1FGKs3kJGatO9VOHGHmZs44ouOj_PnmIP',  icon: '📝', pages: 38 },
  { id: 'geography',    name: 'Geography',                code: 'GEO', category: 'Humanities',  color: '#0f766e', bg: '#ccfbf1', fileId: '10l_ExejKvoJmb4gVK3hUulYyfrPxPqZW',  icon: '🌍', pages: 86 },
  { id: 'german',       name: 'German Language',          code: 'GER', category: 'Languages',   color: '#374151', bg: '#f3f4f6', fileId: '10QW3R1_fHCqO56V53pn521BGHx1UAIdY',  icon: '🇩🇪', pages: null },
  { id: 'history',      name: 'History',                  code: 'HIS', category: 'Humanities',  color: '#b45309', bg: '#fef9c3', fileId: '1F__uyC74ajJK8B-KP6IL6HUXF44EgMwY',  icon: '📜', pages: null },
  { id: 'ire',          name: 'Islamic Religious Education', code: 'IRE', category: 'Religious', color: '#065f46', bg: '#dcfce7', fileId: '1tET7Bkg5YW3nroCTYdxImPZF6tBpNA7E', icon: '☪️', pages: null },
  { id: 'kiswahili',    name: 'Kiswahili',                code: 'KIS', category: 'Languages',   color: '#15803d', bg: '#dcfce7', fileId: '1IkdCGyzUOpt0nuHXD9EBILBk2Fx9Dvf7',  icon: '🗣️', pages: null },
  { id: 'latin',        name: 'Latin Language',           code: 'LAT', category: 'Languages',   color: '#6b21a8', bg: '#f3e8ff', fileId: '1acOzCG9Y8CBrv0r3N6dA8mzwQuMMoY2T',  icon: '🏛️', pages: 78 },
  { id: 'englishlit',   name: 'Literature in English',    code: 'LIT', category: 'Languages',   color: '#9333ea', bg: '#f3e8ff', fileId: '14RjQKY61ssbL-SiDnMO9GHFsAJEz8G6N',  icon: '📚', pages: 78 },
  { id: 'locallangs',   name: 'Local Languages',          code: 'LOC', category: 'Languages',   color: '#065f46', bg: '#d1fae5', fileId: '1P50O2oG_GAU4aatIgPI2TuHjMnO5lKT4',  icon: '🗺️', pages: 64 },
  { id: 'metalwork',    name: 'Metal Work',               code: 'MET', category: 'Technical',   color: '#78716c', bg: '#f5f5f4', fileId: '1cX0vQgiwWLH9uzVkmugJhlK6X2Jafwuy',  icon: '⚙️', pages: 38 },
  { id: 'prinmaths',    name: 'Principal Mathematics',    code: 'MTH', category: 'Mathematics', color: '#1E45FC', bg: '#e8ecff', fileId: '1fk1nx35qqO0PJJ0-C-LlUa-T98qSssRc',  icon: '📐', pages: 90 },
  { id: 'music',        name: 'Music',                    code: 'MUS', category: 'Arts',        color: '#9333ea', bg: '#f3e8ff', fileId: '1XdWgfA24Ohdy-ChrLxWXjSvCV664dDJD',  icon: '🎵', pages: 54 },
  { id: 'physics',      name: 'Physics',                  code: 'PHY', category: 'Sciences',    color: '#7c3aed', bg: '#f5f3ff', fileId: '1OUBIaSCcw7rey4_b_FcQj6w1UnKG5E2c',  icon: '⚛️', pages: 84 },
  { id: 'subict',       name: 'Subsidiary ICT',           code: 'ICT', category: 'Technical',   color: '#0369a1', bg: '#e0f2fe', fileId: '1T71NIYGycvEi5D7Qcs5Qfh_GG7K2Kk7e',  icon: '💻', pages: 50 },
  { id: 'submaths',     name: 'Subsidiary Mathematics',   code: 'SMT', category: 'Mathematics', color: '#3b82f6', bg: '#dbeafe', fileId: '17Iv1mx9cVBSxAqOjVcM9GaNtW653Tz57',  icon: '🔢', pages: 54 },
  { id: 'techdrw',      name: 'Technical Drawing',        code: 'TEC', category: 'Technical',   color: '#374151', bg: '#f3f4f6', fileId: '1Ajyb9_BAf0iG72XhRJSk_FsH4sEadVkk',  icon: '📏', pages: 52 },
  { id: 'woodwork',     name: 'Woodwork',                 code: 'WOD', category: 'Technical',   color: '#92400e', bg: '#fef3c7', fileId: '1y3Ch3PIH0_5FW0Xs0DtkchQjhxKk3y6J',  icon: '🪵', pages: 40 },
];

const CATEGORIES = ['All', 'Sciences', 'Mathematics', 'Humanities', 'Languages', 'Religious', 'Technical', 'Arts', 'General'];

/* ── Term structure (3 terms per year, S5 and S6) ── */
const TERMS = {
  S5: [
    {
      term: 'Term 1', weeks: 13, period: 'Feb – May',
      focus: 'Foundation & Introduction to A-Level concepts',
      desc: 'Introduces learners to A-Level depth of study. Emphasis on core theory, foundational concepts, and linking to O-Level knowledge.',
      activities: ['Orientation & subject introduction', 'Baseline assessment', 'Theory lectures & guided notes', 'Practical lab introductions (sciences)', 'End-of-term exam (25%)'],
    },
    {
      term: 'Term 2', weeks: 13, period: 'Jun – Sep',
      focus: 'Development & Application',
      desc: 'Deepens understanding through problem-solving, experiments, and cross-subject connections. Prepares for mid-level assessments.',
      activities: ['Topic practicals & fieldwork', 'Group projects & presentations', 'Mock continuous assessment tests', 'Revision & remediation', 'End-of-term exam (35%)'],
    },
    {
      term: 'Term 3', weeks: 10, period: 'Oct – Dec',
      focus: 'Consolidation & Mock Examinations',
      desc: 'Intensive revision, mock exams, and subject clinics. S5 promotion assessment determines readiness for S6.',
      activities: ['Past paper practice', 'Subject clinics & tutorials', 'S5 Promotional mock exams', 'UNEB paper format practice', 'End-of-term exam (40%)'],
    },
  ],
  S6: [
    {
      term: 'Term 1', weeks: 13, period: 'Feb – May',
      focus: 'Advanced Concepts & UNEB Prep Begins',
      desc: 'Completes the A-Level syllabus upper sections. Intensive engagement with UNEB past papers begins. Coursework submission for applicable subjects.',
      activities: ['Complete outstanding syllabus topics', 'UNEB past paper analysis', 'Coursework & project submissions', 'School internal mock exams', 'End-of-term exam (30%)'],
    },
    {
      term: 'Term 2', weeks: 13, period: 'Jun – Sep',
      focus: 'Full Revision & Pre-UNEB Mocks',
      desc: 'Comprehensive full-syllabus revision. School-run mocks mirror UNEB conditions. Personal study timetables created with teacher guidance.',
      activities: ['Full syllabus topic-by-topic revision', 'School mock examinations (UNEB format)', 'Individual student performance analysis', 'Extra coaching for struggling students', 'Pre-UNEB mock (Nov simulation)'],
    },
    {
      term: 'Term 3', weeks: 8, period: 'Oct – Nov',
      focus: 'UNEB Examination Period',
      desc: 'Final preparation and UNEB examination sitting. School provides supervised study, past paper clinics and mental wellness support.',
      activities: ['Final revision clinics', 'UNEB registration & timetable review', 'Past paper intensive (daily)', 'UNEB examinations (Nov)', 'Post-exam debrief & results preparation'],
    },
  ],
};

/* ── Official NCDC 2025 topic data per subject (sourced from official syllabuses) ── */
function generateTopics(subjectId, level, term) {
  const topicSets = {

    /* ── AGRICULTURE (64 pages) ── */
    agriculture: {
      S5T1: ['Topic 1: Agricultural Biology in Crops and Animals'],
      S5T2: ['Topic 2: Anatomy, Morphology and Physiology', 'Topic 3: Livestock Management and Rearing Practices'],
      S5T3: ['Topic 4: Harvesting Farm Animals and Animal Products', 'Topic 5: Value Addition to Farm Animals and Animal Products', 'Topic 6: Animal Product Marketing'],
      S6T1: ['Topic 1: Land Policy', 'Topic 2: Soil Systems'],
      S6T2: ['Topic 3: Crop Production and Husbandry', 'Topic 4: Crop Harvesting and Handling'],
      S6T3: ['Topic 5: Crop and Crop Product Marketing', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── ARABIC LANGUAGE (98 pages) ── */
    arabic: {
      S5T1: ['Topic 1: Grammar (النحو)'],
      S5T2: ['Topic 2: Morphology (الصرف)', 'Topic 3: Comprehension (المطالعة)', 'Topic 4: Composition (الإنشاء)', 'Topic 5: Arabic Literature — Pre-Islamic Prose', 'Topic 6: Literature — Pre-Islamic Era (الأدب العربي)', 'Topic 7: Poetry I (الشعر)'],
      S5T3: ['Topic 8: Summary (التلخيص)', 'Topic 9: Translation (الترجمة)', 'Topic 10: Poetry II (الشعر)'],
      S6T1: ['Topic 11: Grammar II', 'Topic 12: Islamic Era (العصر الإسلامي)', 'Topic 13: Arabic Literature — The Abbasid Era (العصر العباسي)'],
      S6T2: ['Topic 14: Translation', 'Topic 15: Arabic Literature — The Modern Era (العصر الحديث)', 'Topic 16: Morphology II', 'Topic 17: The Play (المسرحية)'],
      S6T3: ['S6 Term 3 Revision', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── ART & DESIGN (62 pages) ── */
    artdesign: {
      S5T1: ['Theme 1: Drawing & Painting II — Objective Study of Nature', 'Theme 1: Drawing & Painting II — Living Person Body Structure', 'Theme 1: Drawing & Painting II — Drawing from Imagination', 'Theme 2: Graphic Design — Graphic Design Concepts', 'Theme 2: Graphic Design II — Identity Signs and Symbol Design', 'Theme 3: Crafts B II — Pottery', 'Theme 4: History & Appreciation of Art II — Classical Antiquity'],
      S5T2: ['Theme 1: Drawing & Painting II — Drawing from a Living Person', 'Theme 1: Drawing & Painting II — Painting from Imagination', 'Theme 2: Graphic Design II — Editorial Design', 'Theme 2: Graphic Design II — Packaging Design', 'Theme 3: Crafts B II — Figurative Sculpture in the Round', 'Theme 3: Crafts B II — Fibre Arts', 'Theme 4: History & Appreciation of Art II — Gothic Art in Uganda', 'Theme 4: History & Appreciation of Art II — Italian Renaissance'],
      S5T3: ['Theme 1: Drawing & Painting II — Adaptations from Cultural Environment', 'Theme 1: Drawing & Painting II — Living Person II', 'Theme 2: Graphic Design II — Advertising Design', 'Theme 2: Graphic Design II — Graph Illustration', 'Theme 3: Crafts B II — Two & Three-Dimensional Crafts', 'Theme 4: History & Appreciation of Art II — 19th Century Art in France & England'],
      S6T1: ['Theme 1: Drawing & Painting II — The Material Environment', 'Theme 1: Drawing & Painting II — Living Person (Torso)', 'Theme 1: Drawing & Painting II — Imaginative Figurative Compositions', 'Theme 2: Graphic Design II — Advertising Design', 'Theme 2: Graphic Design II — Graph Illustration', 'Theme 3: Crafts B II — Two-Dimensional Crafts'],
      S6T2: ['Theme 1: Drawing & Painting II — Living Person II', 'Theme 3: Crafts B II — Two & Three-Dimensional Crafts', 'Theme 4: History & Appreciation of Art II — Contemporary Art in Uganda'],
      S6T3: ['Final Portfolio Preparation', 'UNEB Past Papers', 'Final Practical & Theory Examinations'],
    },

    /* ── BIOLOGY (44 pages) ── */
    biology: {
      S5T1: ['Topic 1: Cell Biology'],
      S5T2: ['Topic 2: Nutrition', 'Topic 3: Transport'],
      S5T3: ['Topic 4: Respiration', 'Topic 5: Homeostasis'],
      S6T1: ['Topic 6: Coordination'],
      S6T2: ['Topic 7: Inheritance and Evolution', 'Topic 8: Growth and Development'],
      S6T3: ['Topic 9: Ecology', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── CHEMISTRY (70 pages) ── */
    chemistry: {
      S5T1: ['Topic 1: Moles and Equations (Atomic Masses, Mole Calculations, Chemical Formulae)', 'Topic 2: Atomic and Electronic Structure (Electron Configurations, Radioactivity)', 'Topic 3: Bonding and Structure (Ionic, Covalent and Metallic Bonds)', 'Topic 4: Periodicity I — The Periodic Table', 'Topic 5: Thermochemistry (Enthalpy, Hess\'s Law, Born-Haber Cycles)'],
      S5T2: ['Topic 6: Organic Chemistry I (Alkanes, Alkenes, Alkynes, Halogen Compounds, Benzene)', 'Topic 7: Equilibria I (Chemical Equilibrium, Ionic Equilibrium, Solubility)', 'Topic 8: Equilibria II (Physical & Colligative Properties)', 'Topic 9: Organic Chemistry II (Alcohols, Phenols, Aldehydes, Ketones, Carboxylic Acids)'],
      S5T3: ['Topic 10: Electrochemistry (Redox, Electrochemical Cells, Faraday\'s Laws)', 'Topic 11: Periodicity II (Group 14 and Group 17 Elements)', 'Topic 12: Organic Chemistry III (Amines, Polymers and Polymerisation)', 'Topic 13: Reaction Kinetics (Rate Equations, Factors Affecting Rates of Reaction)'],
      S6T1: ['S6 Term 1 — Advanced Organic Chemistry', 'Revision of S5 Core Topics', 'UNEB Past Paper Analysis', 'School Mock Examinations'],
      S6T2: ['S6 Term 2 — Full Syllabus Revision', 'UNEB Past Papers (Papers 1, 2 & 3)', 'Practical Skills Revision', 'Mock Examinations'],
      S6T3: ['Final Revision Clinics', 'UNEB Paper 1 (Multiple Choice)', 'UNEB Paper 2 (Theory)', 'UNEB Paper 3 (Practical)'],
    },

    /* ── CHINESE (112 pages) ── */
    chinese: {
      S5T1: ['Topic 1: Experiences at School (校园生活)'],
      S5T2: ['Topic 1: Experiences at School (校园生活) contd', 'Topic 2: Community Life and Social Responsibility (社区生活及社会责任)'],
      S5T3: ['Topic 2: Community Life and Social Responsibility (contd)', 'Topic 3: Culture (文化)'],
      S6T1: ['Topic 3: Culture (文化) contd', 'Topic 4: Media and Entertainment (媒体与娱乐活动)'],
      S6T2: ['Topic 4: Media and Entertainment (contd)', 'Topic 5: Tourism and Travel (旅游与观光)'],
      S6T3: ['Topic 6: Career (职业规划)', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── CLOTHING & TEXTILE (58 pages) ── */
    clothing: {
      S5T1: ['Topic 1: Fibre to Yarn', 'Topic 2: Fabric Construction and Decoration'],
      S5T2: ['Topic 3: Basic Sewing Processes'],
      S5T3: ['Topic 4: Pattern Making and Style Interpretation', 'Topic 5: Garment Construction — Part 1'],
      S6T1: ['Topic 6: Garment Construction — Part II'],
      S6T2: ['Topic 7: Soft Furnishings', 'Topic 8: Development of Textile, Clothing, and Fashion Industry'],
      S6T3: ['Topic 9: Marketing Quality Textile Products', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── PHYSICS (84 pages) ── */
    physics: {
      S5T1: ['Topic 1: Measurement & Dimensions of Physical Quantities', 'Topic 2: Statics', 'Topic 3: Linear Motion', 'Topic 4: Motion Under Gravity', 'Topic 5: Work, Energy and Power', 'Topic 6: Solid Friction'],
      S5T2: ['Topic 7: Fluid Mechanics', 'Topic 8: Mechanical Properties of Matter', 'Topic 9: Thermometry', 'Topic 10: Heat Quantities', 'Topic 11: Transfer of Heat', 'Topic 12: Behaviour of Gases', 'Topic 13: Thermodynamics'],
      S5T3: ['Topic 14: Reflection of Light', 'Topic 15: Refraction of Light', 'Topic 16: Optical Instruments', 'Topic 17: Electrostatics', 'Topic 18: Capacitors', 'Topic 19: Digital Electronics'],
      S6T1: ['Topic 20: Circular Motion', 'Topic 21: Simple Harmonic Motion', 'Topic 22: Gravitation', 'Topic 23: Progressive Waves', 'Topic 24: Stationary Waves', 'Topic 25: Sound Waves'],
      S6T2: ['Topic 26: Current Electricity', 'Topic 27: Magnetism in Matter', 'Topic 28: Magnetic Effect of an Electric Current', 'Topic 29: Electromagnetic Induction', 'Topic 30: A.C. Circuits'],
      S6T3: ['Topic 31: Atomic Particles', 'Topic 32: Quantum Theory', 'Topic 33: Nuclear Processes', 'UNEB Past Paper Practice', 'Final Mock Examinations'],
    },

    /* ── PRINCIPAL MATHEMATICS (90 pages) ── */
    prinmaths: {
      S5T1: ['Topic 1: Numerical Concepts', 'Topic 2: Equations and Inequalities', 'Topic 3: Coordinate Geometry 1', 'Topic 4: Partial Fractions', 'Topic 5: Trigonometry', 'Topic 6: Descriptive Statistics'],
      S5T2: ['Topic 7: Scatter Diagrams and Correlations', 'Topic 8: Dynamics 1', 'Topic 9: Probability Theory', 'Topic 10: Differentiation 1', 'Topic 11: Integration 1', 'Topic 12: Permutations and Combinations'],
      S5T3: ['Topic 13: Series', 'Topic 14: Random Variables', 'Topic 15: Probability Distributions', 'Topic 16: Error Analysis', 'Revision & Promotional Mock Exams'],
      S6T1: ['Topic 17: Vectors', 'Topic 18: Differentiation 2', 'Topic 19: Integration 2'],
      S6T2: ['Topic 20: Dynamics 2', 'Topic 21: Trapezium Rule', 'Topic 22: Sampling Distribution', 'Topic 23: Iterative Methods', 'Topic 24: Coordinate Geometry 2'],
      S6T3: ['Topic 25: Complex Numbers', 'Topic 26: Differential Equations', 'Topic 27: Flow Charts', 'UNEB Past Papers', 'Final Mock Examinations'],
    },

    /* ── GEOGRAPHY (86 pages) ── */
    geography: {
      S5T1: ['Topic 1: The Structure of the Earth', 'Topic 2: The Origin of Continents and Ocean Basins', 'Topic 3: World Development'],
      S5T2: ['Topic 4: Agriculture and Development', 'Topic 5: Soil Development and Management', 'Topic 6: Population and Development', 'Topic 7: Drainage and the Role of Rivers in Shaping the Landscape', 'Topic 8: Energy Production', 'Topic 9: Climatology and Meteorology', 'Topic 10: Settlement and Urban Growth', 'Topic 11: Slope Development', 'Topic 12: Problems of Food Supply', 'Topic 13: Lake and Sea Coasts', 'Topic 14: Utilisation and Conservation of Natural Resources'],
      S5T3: ['S5 Revision across all terms', 'Fieldwork & Practical Geography', 'Map Reading & Interpretation', 'Promotional Mock Examinations'],
      S6T1: ['S6 Physical Geography: Advanced Concepts', 'Environmental Geography', 'Geographical Information Systems (GIS)', 'Regional Geography of East Africa'],
      S6T2: ['S6 Human Geography (Advanced)', 'Economic Geography of Uganda & Africa', 'UNEB Past Paper Practice', 'School Mock Examinations'],
      S6T3: ['Full Syllabus Revision', 'UNEB Paper 1 (Physical Geography)', 'UNEB Paper 2 (Human & Regional Geography)', 'Post-Exam Debrief'],
    },

    /* ── GENERAL PAPER (38 pages) ── */
    genpaper: {
      S5T1: ['Topic 1: Communication — Reading, Listening, Writing & Speaking'],
      S5T2: ['Topic 2: Language and Literature', 'Topic 3: Extended Essay Writing'],
      S5T3: ['Topic 4: Data Collection and Analysis', 'Revision & Assessment'],
      S6T1: ['Topic 5: Individual Project (S6 coursework component)'],
      S6T2: ['S6 Project Presentation & Oral Defence', 'UNEB Past Papers & Essay Techniques'],
      S6T3: ['Final Revision', 'UNEB General Paper Examination', 'Post-Exam Debrief'],
    },

    /* ── LITERATURE IN ENGLISH (78 pages) ── */
    englishlit: {
      S5T1: ['Prose — Selected Prescribed Novels', 'Introduction to Literary Analysis', 'Prose Writing Techniques'],
      S5T2: ['Poetry — Selected Prescribed Poems', 'Poetic Devices & Interpretation', 'Poetry Composition'],
      S5T3: ['Drama/Plays — Selected Prescribed Plays', 'Dramatic Techniques & Staging', 'Revision & Mock Exams'],
      S6T1: ['The Novel and Short Story — Advanced Analysis', 'Comparative Literature Studies', 'Essay & Criticism Writing'],
      S6T2: ['Full Syllabus Revision (Prose, Poetry, Drama, Novel)', 'UNEB Past Papers', 'Mock Examinations'],
      S6T3: ['Final Revision Clinics', 'UNEB Paper 1', 'UNEB Paper 2', 'Post-Exam Debrief'],
    },

    /* ── LATIN LANGUAGE (78 pages) ── */
    latin: {
      S5T1: ['Topic 1: Latin Accidence and Syntax', 'Topic 2: Parts of Speech (Conjunctions and Verbs in Clauses)', 'Topic 3: Syntax in Writing Skills'],
      S5T2: ['Topic 3 (contd): Syntax in Writing Skills', 'Topic 4: Introduction to Prose'],
      S5T3: ['Topic 5: Introduction to Roman Plays'],
      S6T1: ['Topic 6: Introduction to Roman Verse (Poetry)', 'Topic 7: Seen Prose Passages (Prescribed Literature)'],
      S6T2: ['Topic 8: City Life in Roman Italy', 'Topic 9: Virgil and the World of the Hero', 'Topic 10: Virgil\'s Relationship to the Regime of Augustus'],
      S6T3: ['Topic 11: The Use and Abuse of Power in Roman History', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── LOCAL LANGUAGES FRAMEWORK (64 pages) ── */
    locallangs: {
      S5T1: ['Topic 1: The Local Language Orthography', 'Topic 2: Grammar', 'Topic 3: Finding Information', 'Topic 4: Prose'],
      S5T2: ['Topic 5: Prose (contd)', 'Topic 6: Poetry', 'Topic 7: The Novel'],
      S5T3: ['Topic 8: Drama and Theatre', 'Topic 9: Poetry (Advanced)'],
      S6T1: ['Topic 1: Drama', 'Topic 2: The Novel', 'Topic 3: Information Transfer'],
      S6T2: ['Topic 4: Socio-Cultural Expressions', 'Topic 5: Prominent Contributors'],
      S6T3: ['Topic 6: Functional Writing', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── METAL WORK (38 pages) ── */
    metalwork: {
      S5T1: ['Topic 1: Engineering Materials', 'Topic 2: Metal Fabrication Processes (Designing, Measuring and Cutting)'],
      S5T2: ['Topic 3: Metal Fabrication Process (Arc Welding and Fasteners)', 'Topic 4: Metal Fabrication Process (Gas Welding, Brazing and Soldering)'],
      S5T3: ['Topic 5: Foundry Technology', 'Topic 6: Foundry Technology (Fettling Process)', 'Revision & Assessment'],
      S6T1: ['Advanced Metal Fabrication Techniques', 'Workshop Safety & Management', 'Project Design and Planning'],
      S6T2: ['Project Construction & Fabrication', 'Quality Control & Finishing', 'UNEB Past Papers'],
      S6T3: ['Project Completion & Presentation', 'UNEB Practical Examination', 'Theory Revision & Final Exam'],
    },

    /* ── MUSIC (54 pages) ── */
    music: {
      S5T1: ['Topic 1: Technical Accuracy in Music Performance', 'Topic 2: Melody Composition', 'Topic 3: Ugandan Ethnic Music Characteristics and Influences'],
      S5T2: ['Topic 1: Expressive Skills in Music Performance', 'Topic 2: Melody Creation and Stylistic Adaptation', 'Topic 3: Music Writing and Reading in Staff Notation'],
      S5T3: ['Topic 1: Building Stage Presence for Music Performance', 'Topic 2: Create Harmonic Lines using Major Chords', 'Topic 3: Set Work Analysis and Listening'],
      S6T1: ['Topic 1: Creative Approaches to Music Performance', 'Topic 2: Lyrics and Melodic Relationship', 'Topic 3: Legal and Ethical Music Industry Practices'],
      S6T2: ['Topic 1: Improvisation and Creative Expression in Music Performance', 'Topic 2: Thematic Song Composition', 'Topic 3: Exploring Careers and Commercial Success'],
      S6T3: ['Topic 1: Exhibition of Integrated Performance Artworks', 'Topic 2: Presentation of Composed Musical Artworks', 'Topic 3: Final Drills in Music Analysis and Notation'],
    },

    /* ── SUBSIDIARY ICT (50 pages) ── */
    subict: {
      S5T1: ['Topic 1: Introduction to ICTs', 'Topic 2: Electronic Presentation'],
      S5T2: ['Topic 3: Computer Hardware', 'Topic 4: Computer Software'],
      S5T3: ['Topic 5: Electronic Word Processing', 'Topic 6: Electronic Spreadsheet'],
      S6T1: ['Topic 7: The Internet and Digital Communications', 'Topic 8: Electronic Publication'],
      S6T2: ['Topic 9: Electronic Databases'],
      S6T3: ['Topic 10: Artificial Intelligence and Related Emerging Technologies', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── SUBSIDIARY MATHEMATICS (54 pages) ── */
    submaths: {
      S5T1: ['Topic 1: Matrices', 'Topic 2: Quadratics', 'Topic 3: Descriptive Statistics'],
      S5T2: ['Topic 4: Numerical Concepts', 'Topic 5: Series', 'Topic 6: Permutations and Combinations', 'Topic 7: Time Series Analysis'],
      S5T3: ['Topic 8: Scatter Diagrams and Correlations', 'Topic 9: Vectors', 'Topic 10: Trigonometry'],
      S6T1: ['Topic 11: Probability Theory', 'Topic 12: Differentiation'],
      S6T2: ['Topic 13: Integration', 'Topic 14: Random Variables'],
      S6T3: ['Topic 15: Probability Distributions', 'Topic 16: Differential Equations', 'UNEB Past Papers', 'Final Examinations'],
    },

    /* ── TECHNICAL DRAWING (52 pages) ── */
    techdrw: {
      S5T1: ['Topic 1: Projection of Solids', 'Topic 2: Foundations and Floors', 'Topic 3: Foundations and Floors (contd)', 'Topic 4: Surface Development', 'Topic 5: Walls'],
      S5T2: ['Topic 6: Vector Geometry', 'Topic 7: Intersection of Solids', 'Topic 8: Roofs', 'Topic 10: Building Drawing'],
      S5T3: ['Mechanical Construction Syllabus', 'Topic 1: Machine Drawing', 'Topic 2: Machine Drawing (Advanced)', 'Revision & Assessment'],
      S6T1: ['Topic 3: Power Transmission Systems', 'Topic 4: Power Transmission Systems (Advanced)', 'Topic 5: Surface Development'],
      S6T2: ['Topic 6: Surface Development (Advanced)', 'Topic 7: Intersection of Solids', 'Topic 8: Vector Geometry'],
      S6T3: ['Project Work & Portfolio', 'UNEB Past Papers', 'Final Practical & Theory Examinations'],
    },

    /* ── WOODWORK (40 pages) ── */
    woodwork: {
      S5T1: ['Topic 1: Workshop Lay Out and Safety', 'Topic 2: Timber Technology'],
      S5T2: ['Topic 3: Timber Technology (Advanced)', 'Topic 4: Design and Drawing', 'Topic 5: Carcase Construction'],
      S5T3: ['Topic 6: Carcase Construction (Advanced)', 'Topic 7: Domestic and Public Furniture'],
      S6T1: ['Topic 8: Fixtures and Fittings'],
      S6T2: ['Topic 9: Window and Door Construction'],
      S6T3: ['Topic 10: Window and Door Construction (Advanced)', 'UNEB Practical Examination', 'Theory Revision & Final Exam'],
    },

    /* ── BIOLOGY (Google Drive syllabus) ── */
    biology: {
      S5T1: ['Cell Biology & Biochemistry', 'Cell Structure & Organisation', 'Cell Division (Mitosis & Meiosis)', 'Ecology & Ecosystems', 'Nutrition in Plants & Animals'],
      S5T2: ['Gaseous Exchange', 'Transport in Plants & Animals', 'Excretion & Homeostasis', 'Reproduction in Plants'],
      S5T3: ['Reproduction in Animals', 'Support & Locomotion', 'Growth & Development', 'Revision & Promotional Mocks'],
      S6T1: ['Genetics & Heredity (Advanced)', 'Evolution & Natural Selection', 'Biotechnology & Genetic Engineering', 'Immunology & Disease'],
      S6T2: ['Full Syllabus Revision', 'UNEB Past Papers (Paper 1, 2 & 3)', 'Practicals Revision', 'Mock Examinations'],
      S6T3: ['Final Revision Clinics', 'UNEB Theory Papers (1 & 2)', 'UNEB Practical (Paper 3)', 'Post-Exam Debrief'],
    },

    /* ── CHEMISTRY (Google Drive syllabus) ── */
    chemistry: {
      S5T1: ['Atomic Structure & Bonding', 'The Mole Concept & Stoichiometry', 'Energetics & Thermochemistry', 'Chemical Equilibrium'],
      S5T2: ['Acids, Bases & Salts', 'Electrochemistry', 'Organic Chemistry: Hydrocarbons', 'Reaction Kinetics'],
      S5T3: ['Organic Functional Groups', 'Analytical Chemistry', 'Industrial Chemistry', 'Revision & Promotional Mocks'],
      S6T1: ['Aromatic Chemistry & Benzene', 'Polymers & Macromolecules', 'Transition Metals & Complexes', 'Nitrogen & Sulphur Chemistry'],
      S6T2: ['Full Syllabus Revision', 'UNEB Past Paper Practice', 'Practical Skills Revision', 'Mock Exams'],
      S6T3: ['Final Revision', 'UNEB Paper 1 (Multiple Choice)', 'UNEB Paper 2 (Theory)', 'UNEB Paper 3 (Practical)'],
    },

    /* ── ECONOMICS ── */
    economics: {
      S5T1: ['Introduction to Economics', 'Demand & Supply Analysis', 'Elasticity Concepts', 'Consumer Theory'],
      S5T2: ['Production Theory & Costs', 'Market Structures', 'National Income Accounting', 'Money & Banking'],
      S5T3: ['International Trade', 'Development Economics', "Uganda's Economic Policy", 'Revision & Promotional Mocks'],
      S6T1: ['Macroeconomics (Advanced)', 'Fiscal & Monetary Policy', 'Economic Growth Models', 'African Economic Development'],
      S6T2: ['Full Syllabus Revision', 'UNEB Past Papers', 'Essay Writing Techniques', 'Mock Examinations'],
      S6T3: ['Final Revision', 'UNEB Paper 1 (Short Answers)', 'UNEB Paper 2 (Essays)', 'Post-Exam Debrief'],
    },
  };

  const key = `${level}T${term}`;
  const subTopics = topicSets[subjectId]?.[key];
  if (subTopics) return subTopics;
  // Generic fallback for subjects without detailed topic data
  return [
    `${level} Term ${term} — Core Concepts & Theory`,
    `${level} Term ${term} — Applied Skills & Practicals`,
    `${level} Term ${term} — Projects & Assignments`,
    `${level} Term ${term} — Assessment & Revision`,
  ];
}

/* ═══════════════════════════════════════════════
   MAIN LMS EXPORT
═══════════════════════════════════════════════ */
export default function LMSPage({ currentUser }) {
  const [view, setView] = useState('dashboard'); // dashboard | subjects | subject-detail | curriculum | resources | progress | assignments
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('S5');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [catFilter, setCatFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'head_teacher' || currentUser?.role === 'school_admin';

  return (
    <div className="animate-fade-in min-h-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* LMS Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {view !== 'dashboard' && (
            <button onClick={() => { setView('dashboard'); setSelectedSubject(null); }}
              className="w-8 h-8 rounded-xl border flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              style={{ borderColor: '#eef0f6' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 2L4 7L9 12"/>
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: '#0B0F2A' }}>
              🎓 A-Level Learning Management System
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: '#1E45FC' }}>NCDC Uganda</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Senior 5 & Senior 6 · 3 Terms Per Year · {SUBJECTS.length} Subjects</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Level toggle */}
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
            {['S5', 'S6'].map(l => (
              <button key={l} onClick={() => setSelectedLevel(l)}
                className="px-4 py-2 text-xs font-bold transition-all"
                style={selectedLevel === l ? { background: '#1E45FC', color: '#fff' } : { background: '#fff', color: '#64748b' }}>
                {l}
              </button>
            ))}
          </div>
          {/* Nav tabs */}
          {['dashboard','subjects','curriculum','resources','progress'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className="hidden md:block text-xs font-semibold px-3 py-2 rounded-xl transition-all capitalize"
              style={view === v ? { background: '#0B0F2A', color: '#fff' } : { background: '#f5f7fb', color: '#64748b' }}>
              {v === 'dashboard' ? '🏠 Home' : v === 'subjects' ? '📚 Subjects' : v === 'curriculum' ? '📋 Curriculum' : v === 'resources' ? '📁 Resources' : '📊 Progress'}
            </button>
          ))}
        </div>
      </div>

      {/* View Router */}
      {view === 'dashboard'    && <LMSDashboard setView={setView} selectedLevel={selectedLevel} setSelectedSubject={setSelectedSubject} currentUser={currentUser} isTeacher={isTeacher} />}
      {view === 'subjects'     && <SubjectsView catFilter={catFilter} setCatFilter={setCatFilter} searchQ={searchQ} setSearchQ={setSearchQ} setSelectedSubject={setSelectedSubject} setView={setView} selectedLevel={selectedLevel} />}
      {view === 'subject-detail' && selectedSubject && <SubjectDetailView subject={selectedSubject} level={selectedLevel} selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm} isTeacher={isTeacher} />}
      {view === 'curriculum'   && <CurriculumView selectedLevel={selectedLevel} setSelectedLevel={setSelectedLevel} selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm} />}
      {view === 'resources'    && <ResourcesView />}
      {view === 'progress'     && <ProgressView selectedLevel={selectedLevel} isTeacher={isTeacher} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LMS DASHBOARD
═══════════════════════════════════════════════ */
function LMSDashboard({ setView, selectedLevel, setSelectedSubject, currentUser, isTeacher }) {
  const coreSubs = SUBJECTS.filter(s => ['Sciences','Mathematics','Humanities'].includes(s.category)).slice(0, 6);
  const recentActivity = [
    { icon: '📝', text: 'Biology S5 Term 1 — Topic 3 uploaded', time: '1h ago', color: '#059669' },
    { icon: '✅', text: 'Chemistry assignment marked (32 students)', time: '3h ago', color: '#1E45FC' },
    { icon: '📋', text: 'S6 Term 2 timetable published', time: '5h ago', color: '#d97706' },
    { icon: '🎯', text: 'Principal Maths mock results posted', time: '1d ago', color: '#7c3aed' },
    { icon: '📁', text: 'Physics UNEB past papers (2019–2023) added', time: '2d ago', color: '#0891b2' },
  ];

  const stats = [
    { label: 'Subjects Available', value: SUBJECTS.length, icon: '📚', color: '#1E45FC', bg: '#e8ecff' },
    { label: `${selectedLevel} Term Progress`, value: '68%', icon: '📊', color: '#059669', bg: '#d1fae5' },
    { label: 'UNEB Days Remaining', value: '142', icon: '⏳', color: '#d97706', bg: '#fef3c7' },
    { label: 'Resources Uploaded', value: '247', icon: '📁', color: '#7c3aed', bg: '#f5f3ff' },
  ];

  const upcoming = [
    { title: 'Biology Practical Exam', date: 'May 12, 2026', subject: 'Biology', level: 'S5', type: 'Exam' },
    { title: 'Economics Essay Submission', date: 'May 14, 2026', subject: 'Economics', level: 'S6', type: 'Assignment' },
    { title: 'Chemistry Lab Report', date: 'May 16, 2026', subject: 'Chemistry', level: 'S5', type: 'Assignment' },
    { title: 'S6 Full Mock Examination', date: 'May 20, 2026', subject: 'All Subjects', level: 'S6', type: 'Mock' },
  ];
  const typeColor = { Exam: '#dc2626', Assignment: '#1E45FC', Mock: '#7c3aed', Test: '#d97706' };
  const typeBg = { Exam: '#fee2e2', Assignment: '#e8ecff', Mock: '#f5f3ff', Test: '#fef3c7' };

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B0F2A 0%, #1E45FC 60%, #A3CF2E 100%)' }}>
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-white font-extrabold text-lg mb-1">
              Welcome to the A-Level LMS 🎓
            </div>
            <p className="text-white/70 text-sm max-w-md">
              NCDC Uganda curriculum · {selectedLevel} · 3 Terms · {SUBJECTS.length} subjects with official syllabi linked
            </p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setView('subjects')}
                className="text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
                📚 Browse Subjects
              </button>
              <button onClick={() => setView('curriculum')}
                className="text-xs font-bold px-4 py-2 rounded-xl transition-all"
                style={{ background: '#A3CF2E', color: '#0B0F2A' }}>
                📋 View Term Plan
              </button>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1 text-right">
            <div className="text-white/50 text-xs">Current Level</div>
            <div className="text-white font-extrabold text-4xl">{selectedLevel}</div>
            <div className="text-white/60 text-xs">Term 2 · 2026</div>
          </div>
        </div>
        {/* Term progress bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
            <span>Term 2 Progress</span><span>68% · Week 9 of 13</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-1.5 rounded-full" style={{ width: '68%', background: '#A3CF2E' }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4" style={{ borderColor: '#eef0f6' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3" style={{ background: s.bg }}>{s.icon}</div>
            <div className="text-2xl font-extrabold mb-0.5" style={{ color: '#0B0F2A' }}>{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Core Subjects Quick Access + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Subjects Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Core Subjects — {selectedLevel}</h3>
            <button onClick={() => setView('subjects')} className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View All {SUBJECTS.length} →</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {coreSubs.map(s => (
              <button key={s.id} onClick={() => { setSelectedSubject(s); setView('subject-detail'); }}
                className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:shadow-md"
                style={{ borderColor: s.color + '30', background: s.bg }}>
                <span className="text-2xl">{s.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate" style={{ color: '#0B0F2A' }}>{s.name}</div>
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color: s.color }}>{s.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border flex flex-col" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h3 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Recent Activity</h3>
          </div>
          <div className="flex-1 divide-y" style={{ borderColor: '#f5f7fb' }}>
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: a.color + '15' }}>{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{a.text}</p>
                  <span className="text-[10px] text-gray-400">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines + Term Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="bg-white rounded-2xl border" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h3 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Upcoming Deadlines & Events</h3>
            <button onClick={() => setView('assignments')} className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View All →</button>
          </div>
          <div className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {upcoming.map((u, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-extrabold" style={{ background: typeBg[u.type], color: typeColor[u.type] }}>
                  {u.date.split(' ')[1].replace(',', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#0B0F2A' }}>{u.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">{u.subject}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e8ecff', color: '#1E45FC' }}>{u.level}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: typeBg[u.type], color: typeColor[u.type] }}>{u.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Term Overview */}
        <div className="bg-white rounded-2xl border" style={{ borderColor: '#eef0f6' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h3 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>{selectedLevel} Term Structure</h3>
            <p className="text-xs text-gray-400 mt-0.5">3 Terms · Academic Year 2026</p>
          </div>
          <div className="p-5 space-y-3">
            {TERMS[selectedLevel].map((t, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: i === 1 ? '#e8ecff' : '#f8faff', border: i === 1 ? '1px solid #1E45FC40' : '1px solid #eef0f6' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0"
                  style={{ background: i === 1 ? '#1E45FC' : '#eef0f6', color: i === 1 ? '#fff' : '#64748b' }}>
                  T{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold" style={{ color: '#0B0F2A' }}>{t.term}</span>
                    {i === 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#A3CF2E', color: '#0B0F2A' }}>CURRENT</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">{t.period} · {t.weeks} weeks</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 truncate">{t.focus}</div>
                </div>
                <div className="h-10 w-1.5 rounded-full flex-shrink-0" style={{ background: i === 0 ? '#A3CF2E' : i === 1 ? '#1E45FC' : '#eef0f6' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUBJECTS VIEW
═══════════════════════════════════════════════ */
function SubjectsView({ catFilter, setCatFilter, searchQ, setSearchQ, setSelectedSubject, setView, selectedLevel }) {
  const filtered = SUBJECTS.filter(s =>
    (catFilter === 'All' || s.category === catFilter) &&
    (s.name.toLowerCase().includes(searchQ.toLowerCase()) || s.code.toLowerCase().includes(searchQ.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3" style={{ borderColor: '#eef0f6' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: '#e2e8f0', background: '#f8faff' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search subjects…" className="outline-none bg-transparent text-sm w-36" />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={catFilter === c ? { borderColor: '#1E45FC', background: '#e8ecff', color: '#1E45FC' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-400 font-semibold">{filtered.length} subjects</div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(s => (
          <button key={s.id} onClick={() => { setSelectedSubject(s); setView('subject-detail'); }}
            className="bg-white rounded-2xl border p-5 text-left hover:shadow-lg transition-all group"
            style={{ borderColor: '#eef0f6' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: s.bg }}>{s.icon}</div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.code}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>{s.name}</h4>
              {s.pages && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#d1fae5', color: '#059669' }}>PDF ✓</span>}
            </div>
            <p className="text-[10px] font-semibold mb-3" style={{ color: s.color }}>{s.category}</p>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-2" style={{ background: '#eef0f6' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${Math.floor(Math.random() * 40 + 45)}%`, background: s.color }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{selectedLevel} · Term 2</span>
              <a href={`${DRIVE_BASE}/${s.fileId}/view`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                style={{ background: '#e8ecff', color: '#1E45FC' }}>
                📄 Syllabus
              </a>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUBJECT DETAIL VIEW
═══════════════════════════════════════════════ */
function SubjectDetailView({ subject: s, level, selectedTerm, setSelectedTerm, isTeacher }) {
  const [activeTab, setActiveTab] = useState('overview');
  const topics = generateTopics(s.id, level, selectedTerm);
  const [topicStatus, setTopicStatus] = useState(topics.map((_, i) => i < 2 ? 'done' : i === 2 ? 'active' : 'pending'));
  const toggleTopic = (i) => {
    setTopicStatus(prev => {
      const n = [...prev];
      n[i] = n[i] === 'done' ? 'pending' : 'done';
      return n;
    });
  };

  const mockResources = [
    { type: 'PDF', name: `${s.name} — Official NCDC Syllabus`, size: '4.2 MB', drive: true, fileId: s.fileId },
    { type: 'PDF', name: `${s.name} — UNEB Past Papers 2019–2023`, size: '8.1 MB', drive: false },
    { type: 'DOC', name: `${s.name} — ${level} Term ${selectedTerm} Notes`, size: '1.8 MB', drive: false },
    { type: 'PPT', name: `${s.name} — Revision Slides`, size: '3.2 MB', drive: false },
  ];

  const assignments = [
    { title: `${s.name} CAT 1`, due: 'May 12, 2026', score: isTeacher ? '28/30 avg' : '27/30', status: 'Submitted' },
    { title: `${s.name} Assignment 2`, due: 'May 20, 2026', score: '--', status: 'Pending' },
    { title: `${s.name} Term 2 Mock`, due: 'Jun 5, 2026', score: '--', status: 'Upcoming' },
  ];
  const aStatusColor = { Submitted: '#059669', Pending: '#d97706', Upcoming: '#1E45FC' };
  const aStatusBg = { Submitted: '#d1fae5', Pending: '#fef3c7', Upcoming: '#e8ecff' };

  return (
    <div className="space-y-5">
      {/* Subject Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${s.color}15 0%, ${s.color}05 100%)`, border: `1px solid ${s.color}30` }}>
        <div className="p-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-extrabold" style={{ color: '#0B0F2A' }}>{s.name}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.code}</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: s.color }}>{s.category} · {level} · NCDC Uganda 2025</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">Official syllabus · 3-term delivery</p>
                {s.pages && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#059669' }}>
                    ✓ {s.pages}pg PDF loaded
                  </span>
                )}
              </div>
            </div>
          </div>
          <a href={`${DRIVE_BASE}/${s.fileId}/view`} target="_blank" rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
            style={{ background: s.color }}>
            📄 View Official Syllabus
          </a>
        </div>
        {/* Term tabs */}
        <div className="px-5 pb-0 flex gap-1">
          {[1, 2, 3].map(t => (
            <button key={t} onClick={() => setSelectedTerm(t)}
              className="px-4 py-2 text-xs font-bold rounded-t-lg transition-all"
              style={selectedTerm === t ? { background: '#fff', color: s.color, borderTop: `2px solid ${s.color}` } : { background: 'transparent', color: '#94a3b8' }}>
              Term {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2">
        {['overview', 'topics', 'resources', 'assignments', 'performance'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="text-xs font-bold px-4 py-2 rounded-xl capitalize transition-all"
            style={activeTab === tab ? { background: s.color, color: '#fff' } : { background: '#f5f7fb', color: '#64748b' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Term details */}
          <div className="lg:col-span-2 bg-white rounded-2xl border p-5" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm mb-3" style={{ color: '#0B0F2A' }}>{level} — Term {selectedTerm} Overview</h4>
            <div className="p-4 rounded-xl mb-4" style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
              <div className="text-xs font-extrabold mb-1" style={{ color: s.color }}>
                {TERMS[level][selectedTerm - 1].focus}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{TERMS[level][selectedTerm - 1].desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl" style={{ background: '#f8faff' }}>
                <div className="text-xs text-gray-400 mb-1">Duration</div>
                <div className="text-sm font-extrabold" style={{ color: '#0B0F2A' }}>{TERMS[level][selectedTerm - 1].weeks} Weeks</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: '#f8faff' }}>
                <div className="text-xs text-gray-400 mb-1">Period</div>
                <div className="text-sm font-extrabold" style={{ color: '#0B0F2A' }}>{TERMS[level][selectedTerm - 1].period}</div>
              </div>
            </div>
            <h5 className="text-xs font-extrabold text-gray-500 mb-2 uppercase tracking-wider">Term Activities</h5>
            <div className="space-y-2">
              {TERMS[level][selectedTerm - 1].activities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: s.bg, color: s.color }}>{i + 1}</div>
                  {a}
                </div>
              ))}
            </div>
          </div>
          {/* Quick stats */}
          <div className="space-y-3">
            {[
              { label: 'Topics Covered', value: `${topicStatus.filter(s => s === 'done').length}/${topics.length}`, icon: '📋', color: s.color, bg: s.bg },
              { label: 'Class Average', value: '72%', icon: '📊', color: '#059669', bg: '#d1fae5' },
              { label: 'Assignments Due', value: '2', icon: '📝', color: '#d97706', bg: '#fef3c7' },
              { label: 'Resources', value: mockResources.length, icon: '📁', color: '#7c3aed', bg: '#f5f3ff' },
            ].map((st, i) => (
              <div key={i} className="bg-white rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: '#eef0f6' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: st.bg }}>{st.icon}</div>
                <div>
                  <div className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>{st.value}</div>
                  <div className="text-xs text-gray-400">{st.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="bg-white rounded-2xl border" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Term {selectedTerm} Topics — {s.name}</h4>
            {isTeacher && <button className="text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background: s.color }}>+ Add Topic</button>}
          </div>
          <div className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {topics.map((topic, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                  topicStatus[i] === 'done' ? 'bg-green-50 text-green-700' :
                  topicStatus[i] === 'active' ? '' : 'bg-gray-100 text-gray-400'
                }`} style={topicStatus[i] === 'active' ? { background: s.bg, color: s.color } : {}}>
                  {topicStatus[i] === 'done' ? '✓' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{topic}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">Week {i * 3 + 1}–{i * 3 + 3}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      topicStatus[i] === 'done' ? 'bg-green-50 text-green-700' :
                      topicStatus[i] === 'active' ? '' : 'bg-gray-100 text-gray-400'
                    }`} style={topicStatus[i] === 'active' ? { background: s.bg, color: s.color } : {}}>
                      {topicStatus[i] === 'done' ? 'Completed' : topicStatus[i] === 'active' ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs font-semibold" style={{ color: s.color }}>Notes</button>
                  <button className="text-xs font-semibold text-gray-400 hover:text-gray-600">Quiz</button>
                  {isTeacher && (
                    <button onClick={() => toggleTopic(i)} className="text-[10px] font-bold px-2 py-1 rounded-lg border" style={{ borderColor: s.color + '40', color: s.color }}>
                      {topicStatus[i] === 'done' ? '↩ Undo' : '✓ Mark Done'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Learning Resources — {s.name}</h4>
            {isTeacher && <button className="text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background: s.color }}>+ Upload Resource</button>}
          </div>
          {mockResources.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border flex items-center gap-4 p-4" style={{ borderColor: '#eef0f6' }}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                r.type === 'PDF' ? 'bg-red-50 text-red-600' : r.type === 'DOC' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
              }`}>{r.type}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{r.name}</div>
                <div className="text-xs text-gray-400">{r.size} · {r.drive ? 'Google Drive (NCDC Official)' : 'School Upload'}</div>
              </div>
              {r.drive ? (
                <a href={`${DRIVE_BASE}/${r.fileId}/view`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold px-3 py-2 rounded-xl text-white" style={{ background: s.color }}>
                  Open PDF
                </a>
              ) : (
                <button className="text-xs font-bold px-3 py-2 rounded-xl border" style={{ borderColor: s.color, color: s.color }}>Download</button>
              )}
            </div>
          ))}
          {/* Link to full drive folder */}
          <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed text-sm font-semibold justify-center transition-all hover:bg-gray-50"
            style={{ borderColor: s.color + '50', color: s.color }}>
            📁 View All NCDC Syllabi on Google Drive →
          </a>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-white rounded-2xl border" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Assignments & Assessments</h4>
            {isTeacher && <button className="text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background: s.color }}>+ Create Assignment</button>}
          </div>
          <div className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {assignments.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: aStatusBg[a.status], color: aStatusColor[a.status] }}>
                  {a.status === 'Submitted' ? '✓' : a.status === 'Pending' ? '📝' : '📅'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{a.title}</div>
                  <div className="text-xs text-gray-400">Due: {a.due}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-extrabold" style={{ color: a.status === 'Submitted' ? '#059669' : '#94a3b8' }}>{a.score}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: aStatusBg[a.status], color: aStatusColor[a.status] }}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm mb-4" style={{ color: '#0B0F2A' }}>Class Performance — {s.name}</h4>
            {['80–100 (Distinction)', '65–79 (Credit)', '50–64 (Pass)', 'Below 50 (Fail)'].map((range, i) => {
              const pct = [22, 38, 28, 12][i];
              const cols = ['#059669', '#1E45FC', '#d97706', '#dc2626'];
              return (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{range}</span>
                    <span className="font-bold" style={{ color: cols[i] }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#eef0f6' }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: cols[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm mb-4" style={{ color: '#0B0F2A' }}>Term {selectedTerm} Assessment Breakdown</h4>
            {[['CAT 1', 28, 30], ['Assignment 1', 18, 20], ['CAT 2', 0, 30], ['End of Term Exam', 0, 100]].map(([name, score, max], i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <div className="w-24 text-xs font-semibold text-gray-500 flex-shrink-0">{name}</div>
                <div className="flex-1 h-2 rounded-full" style={{ background: '#eef0f6' }}>
                  {score > 0 && <div className="h-2 rounded-full" style={{ width: `${(score / max) * 100}%`, background: s.color }} />}
                </div>
                <div className="text-xs font-bold w-12 text-right flex-shrink-0" style={{ color: score > 0 ? s.color : '#94a3b8' }}>
                  {score > 0 ? `${score}/${max}` : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CURRICULUM VIEW
═══════════════════════════════════════════════ */
function CurriculumView({ selectedLevel, setSelectedLevel, selectedTerm, setSelectedTerm }) {
  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-4" style={{ borderColor: '#eef0f6' }}>
        <div>
          <div className="text-xs text-gray-400 mb-1">Level</div>
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
            {['S5', 'S6'].map(l => (
              <button key={l} onClick={() => setSelectedLevel(l)}
                className="px-5 py-2 text-sm font-bold transition-all"
                style={selectedLevel === l ? { background: '#1E45FC', color: '#fff' } : { background: '#fff', color: '#64748b' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Term</div>
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
            {[1, 2, 3].map(t => (
              <button key={t} onClick={() => setSelectedTerm(t)}
                className="px-5 py-2 text-sm font-bold transition-all"
                style={selectedTerm === t ? { background: '#A3CF2E', color: '#0B0F2A' } : { background: '#fff', color: '#64748b' }}>
                Term {t}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-gray-400">Academic Year</div>
          <div className="text-sm font-extrabold" style={{ color: '#0B0F2A' }}>2025–2026</div>
        </div>
      </div>

      {/* Term Detail */}
      {(() => {
        const t = TERMS[selectedLevel][selectedTerm - 1];
        return (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
            <div className="p-5 border-b" style={{ borderColor: '#eef0f6', background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>{selectedLevel} — {t.term}</h3>
                    {selectedTerm === 2 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#A3CF2E', color: '#0B0F2A' }}>CURRENT</span>}
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#1E45FC' }}>{t.focus}</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl">{t.desc}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-extrabold" style={{ color: '#1E45FC' }}>{t.weeks}</div>
                  <div className="text-xs text-gray-400">Weeks</div>
                  <div className="text-xs font-semibold text-gray-500 mt-0.5">{t.period}</div>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="p-5 border-b" style={{ borderColor: '#eef0f6' }}>
              <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Key Activities</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {t.activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8faff' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#e8ecff', color: '#1E45FC' }}>{i + 1}</div>
                    <span className="text-xs text-gray-600">{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All subjects for this term */}
            <div className="p-5">
              <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Subject Topics — {selectedLevel} Term {selectedTerm}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUBJECTS.slice(0, 8).map(sub => (
                  <div key={sub.id} className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: sub.color + '20', background: sub.bg + '80' }}>
                    <span className="text-lg flex-shrink-0">{sub.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold" style={{ color: '#0B0F2A' }}>{sub.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {generateTopics(sub.id, selectedLevel, selectedTerm).slice(0, 2).join(' · ')}
                      </div>
                    </div>
                    <a href={`${DRIVE_BASE}/${sub.fileId}/view`} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-bold px-1.5 py-1 rounded flex-shrink-0"
                      style={{ background: sub.bg, color: sub.color }}>
                      PDF
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* All 3 terms overview */}
      <div>
        <h4 className="font-extrabold text-sm mb-3" style={{ color: '#0B0F2A' }}>Full Year Overview — {selectedLevel}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TERMS[selectedLevel].map((t, i) => (
            <button key={i} onClick={() => setSelectedTerm(i + 1)}
              className="bg-white rounded-2xl border p-5 text-left transition-all hover:shadow-md"
              style={{ borderColor: selectedTerm === i + 1 ? '#1E45FC' : '#eef0f6', boxShadow: selectedTerm === i + 1 ? '0 0 0 2px #1E45FC30' : '' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
                  style={{ background: selectedTerm === i + 1 ? '#1E45FC' : '#f5f7fb', color: selectedTerm === i + 1 ? '#fff' : '#64748b' }}>
                  T{i + 1}
                </div>
                <span className="text-xs font-semibold text-gray-400">{t.period}</span>
              </div>
              <div className="font-extrabold text-sm mb-1" style={{ color: '#0B0F2A' }}>{t.term}</div>
              <div className="text-xs font-semibold mb-2" style={{ color: '#1E45FC' }}>{t.focus}</div>
              <div className="text-xs text-gray-400">{t.weeks} weeks · {t.activities.length} key activities</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RESOURCES VIEW
═══════════════════════════════════════════════ */
function ResourcesView() {
  const [search, setSearch] = useState('');
  const filtered = SUBJECTS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: '#eef0f6' }}>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border flex-1" style={{ borderColor: '#e2e8f0', background: '#f8faff' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search syllabus…" className="outline-none bg-transparent text-sm flex-1" />
        </div>
        <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
          className="text-xs font-bold px-4 py-2.5 rounded-xl text-white flex items-center gap-2 flex-shrink-0"
          style={{ background: '#1E45FC' }}>
          📁 Open Full Drive Folder
        </a>
      </div>

      {/* Banner */}
      <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #0B0F2A, #1E45FC)' }}>
        <div className="text-3xl">📚</div>
        <div>
          <div className="text-white font-extrabold text-sm">NCDC Official A-Level Syllabi</div>
          <p className="text-white/60 text-xs mt-0.5">All {SUBJECTS.length} subject syllabi from the National Curriculum Development Centre, Uganda. Click any subject to open the official PDF.</p>
        </div>
      </div>

      {/* Subject syllabi table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#eef0f6' }}>
          <h3 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Subject Syllabi — Official PDFs</h3>
          <span className="text-xs text-gray-400">{filtered.length} subjects</span>
        </div>
        <div className="divide-y" style={{ borderColor: '#f5f7fb' }}>
          {filtered.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: s.bg }}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{s.name}</div>
                <div className="text-xs text-gray-400">{s.category} · NCDC Uganda · Feb 2025</div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.code}</span>
              <a href={`${DRIVE_BASE}/${s.fileId}/view`} target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-all"
                style={{ background: '#e8ecff', color: '#1E45FC' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1E45FC'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#e8ecff'; e.currentTarget.style.color = '#1E45FC'; }}>
                📄 Open PDF
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PROGRESS VIEW
═══════════════════════════════════════════════ */
function ProgressView({ selectedLevel, isTeacher }) {
  const mockStudents = [
    { name: 'Aisha Nakato',   class: `${selectedLevel}A`, biology: 78, chemistry: 65, physics: 71, maths: 82, economics: 74, avg: 74 },
    { name: 'Kabuye Peter',   class: `${selectedLevel}A`, biology: 85, chemistry: 79, physics: 88, maths: 91, economics: 68, avg: 82 },
    { name: 'Grace Namutebi', class: `${selectedLevel}B`, biology: 62, chemistry: 58, physics: 55, maths: 70, economics: 80, avg: 65 },
    { name: 'David Opiyo',    class: `${selectedLevel}B`, biology: 91, chemistry: 88, physics: 85, maths: 76, economics: 83, avg: 85 },
    { name: 'Fatuma Nakigozi',class: `${selectedLevel}A`, biology: 69, chemistry: 72, physics: 68, maths: 64, economics: 77, avg: 70 },
  ];
  const grade = a => a >= 80 ? 'D1' : a >= 70 ? 'D2' : a >= 65 ? 'C3' : a >= 55 ? 'C5' : 'F9';
  const gcol  = a => a >= 70 ? '#059669' : a >= 55 ? '#d97706' : '#dc2626';

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: `${selectedLevel} Students`, value: '186', icon: '👥', color: '#1E45FC', bg: '#e8ecff' },
          { label: 'Class Average', value: '73%', icon: '📊', color: '#059669', bg: '#d1fae5' },
          { label: 'At Risk (< 55%)', value: '14', icon: '⚠️', color: '#dc2626', bg: '#fee2e2' },
          { label: 'Distinction (≥ 80%)', value: '31', icon: '🏆', color: '#d97706', bg: '#fef3c7' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4" style={{ borderColor: '#eef0f6' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: s.bg }}>{s.icon}</div>
            <div className="text-2xl font-extrabold mb-0.5" style={{ color: '#0B0F2A' }}>{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subject performance bars */}
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#eef0f6' }}>
        <h4 className="font-extrabold text-sm mb-4" style={{ color: '#0B0F2A' }}>Subject Performance — {selectedLevel} Average</h4>
        <div className="space-y-3">
          {SUBJECTS.slice(0, 8).map(s => {
            const avg = Math.floor(Math.random() * 30 + 60);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-base w-6 flex-shrink-0">{s.icon}</span>
                <span className="text-xs font-semibold w-36 truncate flex-shrink-0" style={{ color: '#0B0F2A' }}>{s.name}</span>
                <div className="flex-1 h-2.5 rounded-full" style={{ background: '#eef0f6' }}>
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${avg}%`, background: s.color }} />
                </div>
                <span className="text-xs font-bold w-10 text-right flex-shrink-0" style={{ color: gcol(avg) }}>{avg}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student table */}
      {isTeacher && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#eef0f6' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h4 className="font-extrabold text-sm" style={{ color: '#0B0F2A' }}>Student Performance — {selectedLevel}</h4>
            <button className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: '#e8ecff', color: '#1E45FC' }}>Export Report</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
                  {['Student', 'Class', 'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Economics', 'Average', 'Grade'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#f5f7fb' }}>
                {mockStudents.map((st, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#e8ecff', color: '#1E45FC' }}>
                          {st.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{st.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{st.class}</td>
                    {[st.biology, st.chemistry, st.physics, st.maths, st.economics].map((sc, j) => (
                      <td key={j} className="px-4 py-3 text-sm font-bold text-center" style={{ color: gcol(sc) }}>{sc}</td>
                    ))}
                    <td className="px-4 py-3 text-sm font-extrabold text-center" style={{ color: gcol(st.avg) }}>{st.avg}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: gcol(st.avg) + '20', color: gcol(st.avg) }}>{grade(st.avg)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
