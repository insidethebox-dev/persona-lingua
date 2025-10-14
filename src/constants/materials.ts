// Material upload options
export const MATERIAL_TOPICS = [
  "Daily Life",
  "Travel",
  "Food & Drink",
  "Work & Professions",
  "Education",
  "Health & Wellness",
  "Environment",
  "Technology",
  "Culture & Traditions",
  "Sports & Hobbies",
  "Shopping",
  "Relationships",
  "Holidays & Celebrations",
  "News & Current Events",
] as const;

export const MATERIAL_LEVELS = [
  "A1.1 (Beginner Low)",
  "A1.2 (Beginner High)",
  "A2.1 (Elementary Low)",
  "A2.2 (Elementary High)",
  "B1.1 (Intermediate Low)",
  "B1.2 (Intermediate High)",
  "B2.1 (Upper-Intermediate Low)",
  "B2.2 (Upper-Intermediate High)",
  "C1.1 (Advanced Low)",
  "C1.2 (Advanced High)",
  "C2 (Proficient/Mastery)",
] as const;

export const MATERIAL_TYPES = [
  "Worksheet",
  "Quiz",
  "Test",
  "Multiple Choice",
  "True/False",
  "Fill in the Blank",
  "Essay Questions",
  "Summary",
  "Reading Passage",
  "Exercise",
  "Activity",
  "Project",
  "Assessment",
  "Homework",
  "Study Guide",
  "Reference Material",
  "Presentation",
  "Interactive Content",
] as const;

export const MATERIAL_SKILLS = [
  "Speaking",
  "Listening",
  "Reading",
  "Writing",
  "Grammar",
  "Vocabulary",
  "Pronunciation",
  "Intercultural Communication",
] as const;

export const MATERIAL_LANGUAGES = ["English", "Greek", "Spanish"] as const;

export type MaterialTopic = (typeof MATERIAL_TOPICS)[number];
export type MaterialLevel = (typeof MATERIAL_LEVELS)[number];
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type MaterialSkill = (typeof MATERIAL_SKILLS)[number];
export type MaterialLanguage = (typeof MATERIAL_LANGUAGES)[number];

// Learning barriers and accessibility needs
export const LEARNING_BARRIERS = [
  "Dyslexia",
  "ADHD/ADD",
  "Autism Spectrum Disorder",
  "Migratory Background/ESL",
  "Low Literacy",
  "Limited Working Memory",
  "Hearing Impairment",
  "Visual Impairment",
  "Performance Anxiety",
] as const;

export type LearningBarrier = (typeof LEARNING_BARRIERS)[number];

// Detailed information about learning barriers and adaptations
export const LEARNING_BARRIER_INFO: Record<
  LearningBarrier,
  {
    characteristics: string[];
    adaptations: string[];
  }
> = {
  Dyslexia: {
    characteristics: [
      "Difficulty reading and spelling",
      "Trouble decoding sounds",
      "Slow reading pace",
      "Difficulty with word recognition",
    ],
    adaptations: [
      "Use clear, larger fonts (Arial, Verdana, or dyslexia-friendly fonts)",
      "Include plenty of white space, short lines and paragraphs",
      "Avoid fully justified text",
      "Add color or icons to highlight key words or instructions",
      "Provide audio support alongside texts (listen-and-read)",
      "Limit new vocabulary per text and include repetition",
      "Use syllable separation or color coding to break down words",
    ],
  },
  "ADHD/ADD": {
    characteristics: [
      "Attention difficulties",
      "Impulsivity",
      "Need for variation and structure",
      "Difficulty with sustained focus",
    ],
    adaptations: [
      "Short texts with headings and bullet points",
      "Instructions broken into clear, numbered steps",
      "Use visual structure: boxes, tables, checklists",
      "Include visual cues (icons, diagrams)",
      "Minimize distractions (no busy backgrounds or excessive color)",
      "Break tasks down into micro-activities",
      "Allow self-paced learning",
    ],
  },
  "Autism Spectrum Disorder": {
    characteristics: [
      "Preference for predictability",
      "Difficulties with figurative language",
      "Challenges with social nuance",
      "Need for clear structure and expectations",
    ],
    adaptations: [
      "Use literal, clear language (avoid irony or ambiguous phrases)",
      "Provide realistic, concrete example sentences",
      "Avoid overly open-ended tasks",
      "Always provide clear overview: goals, steps, and expected outcome",
      "Use visual markers or icons for clarity",
      "Include model answers or examples",
      "Avoid decorative or metaphorical language in instructions",
    ],
  },
  "Migratory Background/ESL": {
    characteristics: [
      "Varied exposure to education",
      "Influence of native language",
      "Limited vocabulary in target language",
      "Cultural and linguistic differences",
    ],
    adaptations: [
      "Provide key words with translations when possible",
      "Use visual dictionaries or image-supported vocabulary lists",
      "Write in simple, active sentences",
      "Give vocabulary in context, not in isolation",
      "Build gradually: listen first, then read, then write",
      "Use multimodal materials (text + images + audio)",
    ],
  },
  "Low Literacy": {
    characteristics: [
      "Struggles with reading comprehension",
      "Limited text interpretation skills",
      "Difficulty with complex written instructions",
      "Limited reading experience",
    ],
    adaptations: [
      "Use very simple, direct language",
      "Introduce a limited number of new words",
      "Provide strong context and repetition",
      "Include visuals, photos, icons",
      "Use fill-in-the-gap or multiple-choice tasks rather than open writing",
      "Start with familiar topics and vocabulary",
    ],
  },
  "Limited Working Memory": {
    characteristics: [
      "Struggles with multi-step tasks",
      "Easily distracted",
      "Difficulty holding information in mind",
      "Challenges with complex instructions",
    ],
    adaptations: [
      "Keep instructions and texts short and clear",
      "Use visual aids like flow charts or step-by-step guides",
      "Add preview questions or topic titles to activate prior knowledge",
      "Use predictable formats and frequent repetition",
      "Break complex tasks into smaller steps",
      "Provide memory aids and reference materials",
    ],
  },
  "Hearing Impairment": {
    characteristics: [
      "Reduced or absent auditory input",
      "May rely on visual information",
      "Possible delays in language development",
      "Need for alternative communication methods",
    ],
    adaptations: [
      "Ensure all key instructions are available in writing",
      "Use visual materials and subtitles with videos",
      "Avoid audio-only tasks without alternatives",
      "Supplement with icons or signed videos when possible",
      "Provide visual cues and gestures",
      "Use written feedback and communication",
    ],
  },
  "Visual Impairment": {
    characteristics: [
      "Difficulty reading standard fonts",
      "Challenges interpreting visuals",
      "May use screen readers or magnification",
      "Need for alternative text formats",
    ],
    adaptations: [
      "Use larger fonts (minimum 14–16 pt)",
      "Provide high contrast text (black on white or white on navy)",
      "Add alt-text descriptions for images in digital materials",
      "Offer audio versions or braille when possible",
      "Ensure materials are screen reader compatible",
      "Use clear, simple layouts",
    ],
  },
  "Performance Anxiety": {
    characteristics: [
      "Fear of failure",
      "Reluctance to speak or write",
      "Avoidance of difficult tasks",
      "Low confidence in abilities",
    ],
    adaptations: [
      "Use positive, encouraging language in tasks",
      "Choose self-correcting formats (multiple choice, fill-in-the-blank)",
      "Offer step-by-step instructions with clear goals",
      "Normalize mistakes: include 'model errors' in examples",
      "Give choice in tasks (e.g. select 3 out of 5)",
      "Provide supportive feedback and progress tracking",
    ],
  },
} as const;
