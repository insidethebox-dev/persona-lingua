/**
 * Enhanced scoring utilities for material recommendations
 * Provides semantic matching and advanced scoring algorithms
 *
 * SCORING SYSTEM (Total: 100 points)
 * ===================================
 * Language Match:      REQUIRED (hard filter - must match exactly)
 * Topic Match:         30 points (or 9 for related topics)
 * Level Match:         25 points (SOFT - always scores based on proximity)
 *                      - Perfect match: 25 points (100%)
 *                      - 1 level away: 17.5 points (70%)
 *                      - 2 levels away: 12.5 points (50%)
 *                      - 3+ levels away: 7.5 points (30%)
 *                      - Mixed Levels: 15 points (60%)
 * Semantic Match:      20 points (scaled by similarity 0-1)
 * Skill Match:         15 points
 * Accessibility:       8 points (if barriers present and material supports)
 * Type Match:          REMOVED (no longer scored)
 * Tag Match:           2 points (1 per matching tag, max 2)
 *
 * LEVEL SYSTEMS SUPPORTED:
 * - Standard: Preschool, Kindergarten, Elementary (1-3), etc.
 * - Language Proficiency (CEFR): A1.1, A1.2, A2.1, A2.2, B1.1, B1.2, B2.1, B2.2, C1.1, C1.2, C2
 *
 * IMPORTANT:
 * - Materials that don't match the student's language are automatically filtered out (score -1000)
 * - Level matching is SOFT - all materials get some level score based on distance
 * - Type matching has been removed - material format is no longer considered
 *
 * EXPECTED SCORE RANGES (for same-language materials):
 * - 80-100: Excellent match (topic, close level, strong semantic)
 * - 60-79:  Good match (topic or semantic match, reasonable level)
 * - 40-59:  Fair match (some criteria match, level somewhat distant)
 * - 20-39:  Marginal match (weak alignment but usable)
 * - <20:    Poor match (very weak alignment)
 */ export interface ScoringWeights {
  languageMatch: number;
  topicMatch: number;
  levelMatch: number;
  typeMatch: number;
  skillMatch: number;
  tagMatch: number;
  accessibilityMatch: number;
  semanticMatch: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  languageMatch: 0, // Language is now a FILTER (pass/fail), not scored
  topicMatch: 28, // 28% - Core subject alignment
  levelMatch: 40, // 40% - Age/grade appropriateness (HIGHEST PRIORITY - never go above student level)
  semanticMatch: 15, // 15% - Content relevance
  skillMatch: 10, // 10% - Skill targeting
  accessibilityMatch: 5, // 5% - Learning barrier accommodations (important but secondary to level)
  typeMatch: 0, // 0% - REMOVED (material format no longer scored)
  tagMatch: 2, // 2% - Keyword matching
  // Total: 100 points for perfect match (excluding language filter and type)
};

/**
 * Calculate semantic similarity between two texts using keyword overlap
 * Enhanced for language learning context
 */
export function calculateSemanticSimilarity(
  text1: string,
  text2: string
): number {
  const normalize = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2) // Changed from 3 to 2 to include "use", "is", etc.
    );
  };

  const words1 = normalize(text1);
  const words2 = normalize(text2);

  if (words1.size === 0 || words2.size === 0) return 0;

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  const jaccardSimilarity = intersection.size / union.size;

  // Boost score for language learning keywords
  const languageLearningKeywords = [
    "grammar",
    "vocabulary",
    "verb",
    "tense",
    "past",
    "present",
    "future",
    "conjugation",
    "practice",
    "exercise",
    "pretérito",
    "imperfecto",
    "perfecto",
    "indefinido",
    "gender",
    "noun",
    "adjective",
    "pronunciation",
    "speaking",
    "listening",
    "reading",
    "writing",
    "comprehension",
  ];

  const text1Lower = text1.toLowerCase();
  const text2Lower = text2.toLowerCase();

  let keywordBoost = 0;
  languageLearningKeywords.forEach((keyword) => {
    if (text1Lower.includes(keyword) && text2Lower.includes(keyword)) {
      keywordBoost += 0.05; // Add 5% for each matching keyword
    }
  });

  // Combine Jaccard similarity with keyword boost (max 1.0)
  return Math.min(1.0, jaccardSimilarity + keywordBoost);
}

/**
 * Extract key concepts from student reports for semantic matching
 * Enhanced to capture more learning context
 */
export function extractKeyConceptsFromReports(reports: string[]): string {
  // Combine all reports
  const combined = reports.join(" ");

  // Extract sentences that indicate learning needs (expanded list)
  const needsIndicators = [
    "needs",
    "should",
    "improve",
    "struggle",
    "difficulty",
    "challenge",
    "focus on",
    "work on",
    "practice",
    "develop",
    "strengthen",
    "learn",
    "study",
    "master",
    "understand",
    "review",
    "reinforce",
    "struggling with",
    "working on",
    "practicing",
  ];

  const sentences = combined.split(/[.!?]+/);
  const relevantSentences = sentences.filter((sentence) =>
    needsIndicators.some((indicator) =>
      sentence.toLowerCase().includes(indicator)
    )
  );

  // If we didn't extract enough, include the full report (up to 500 words)
  if (relevantSentences.length < 2) {
    const words = combined.split(/\s+/).slice(0, 500);
    return words.join(" ");
  }

  return relevantSentences.join(". ").trim();
}

/**
 * Score a material against student needs with enhanced semantic matching
 */
export function scoreEnhancedMaterialMatch(params: {
  material: {
    topic: string | null;
    level: string;
    type: string;
    skill: string;
    tags: string[];
    language: string | null;
    description: string | null;
    aiSummary: string | null;
  };
  studentNeeds: {
    topic: string[];
    level: string[];
    type: string[];
    skill: string[];
    tags: string[];
    reasoning: string;
  };
  studentContext: {
    language: string;
    learningBarriers: string[];
  };
  studentReportsConcepts: string;
  weights?: Partial<ScoringWeights>;
}): {
  score: number;
  breakdown: ScoringWeights;
  rationale: string[];
} {
  const {
    material,
    studentNeeds,
    studentContext,
    studentReportsConcepts,
    weights = {},
  } = params;

  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const breakdown: ScoringWeights = {
    languageMatch: 0,
    topicMatch: 0,
    levelMatch: 0,
    typeMatch: 0,
    skillMatch: 0,
    tagMatch: 0,
    accessibilityMatch: 0,
    semanticMatch: 0,
  };
  const rationale: string[] = [];

  // 1. Language match - HARD REQUIREMENT (must match or score = -1000 to filter out)
  if (material.language === studentContext.language) {
    breakdown.languageMatch = 0; // Language is now a filter, not a score
    rationale.push(`Language match: ${studentContext.language}`);
  } else if (
    material.language &&
    material.language !== studentContext.language
  ) {
    // Language mismatch - return extremely negative score to filter out
    breakdown.languageMatch = -1000;
    rationale.push(
      `FILTERED OUT: Language mismatch (Material: ${material.language}, Student: ${studentContext.language})`
    );

    // Return immediately with failing score
    return {
      score: -1000,
      breakdown,
      rationale,
    };
  }

  // 2. Topic match (30% weight)
  if (material.topic && studentNeeds.topic.includes(material.topic)) {
    breakdown.topicMatch = finalWeights.topicMatch;
    rationale.push(`Topic match: ${material.topic}`);
  } else if (material.topic && studentNeeds.topic.length > 0) {
    // Partial credit for related topics (language learning context)
    const relatedTopics: { [key: string]: string[] } = {
      "Daily Life": ["Shopping", "Relationships", "Food & Drink"],
      Travel: ["Culture & Traditions", "Shopping", "Daily Life"],
      "Food & Drink": ["Daily Life", "Shopping", "Health & Wellness"],
      "Work & Professions": ["Education", "Technology"],
      Education: ["Work & Professions"],
      "Health & Wellness": ["Food & Drink", "Daily Life"],
      "Culture & Traditions": ["Travel", "Holidays & Celebrations"],
      "Sports & Hobbies": ["Health & Wellness", "Daily Life"],
      Shopping: ["Daily Life", "Travel", "Food & Drink"],
      Relationships: ["Daily Life"],
      "Holidays & Celebrations": ["Culture & Traditions", "Travel"],
      Technology: ["Work & Professions", "Education"],
      "News & Current Events": ["Education"],
      Environment: ["News & Current Events"],
    };
    const related = relatedTopics[material.topic] || [];
    if (studentNeeds.topic.some((t) => related.includes(t))) {
      breakdown.topicMatch = finalWeights.topicMatch * 0.3;
      rationale.push(`Related topic: ${material.topic}`);
    }
  }

  // 3. Level match (25% weight) - SOFT MATCH (always gives some score based on distance)
  const levelOrder = [
    "Preschool",
    "Kindergarten",
    "Elementary (1-3)",
    "Elementary (4-5)",
    "Middle School (6-8)",
    "High School (9-12)",
    "Adult Education",
    "Mixed Levels",
  ];

  // Language proficiency levels (CEFR-style)
  const proficiencyLevelOrder = [
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
  ];

  // Try standard levels first, then proficiency levels
  let materialLevelIndex = levelOrder.indexOf(material.level);
  let usingProficiencyLevels = false;

  if (materialLevelIndex === -1) {
    // Not found in standard levels, try proficiency levels
    materialLevelIndex = proficiencyLevelOrder.indexOf(material.level);
    usingProficiencyLevels = true;
  }

  if (studentNeeds.level.includes(material.level)) {
    // Perfect match
    breakdown.levelMatch = finalWeights.levelMatch;
    rationale.push(`Perfect level match: ${material.level}`);
  } else if (materialLevelIndex !== -1 && studentNeeds.level.length > 0) {
    // Calculate distance-based score for any other level
    let minDistance = Infinity;
    let closestLevel = "";
    let closestLevelIndex = -1;

    // Use the appropriate level array based on what we found
    const activeLevelOrder = usingProficiencyLevels
      ? proficiencyLevelOrder
      : levelOrder;

    studentNeeds.level.forEach((level) => {
      const needIndex = activeLevelOrder.indexOf(level);
      if (needIndex !== -1) {
        const distance = Math.abs(materialLevelIndex - needIndex);
        if (distance < minDistance) {
          minDistance = distance;
          closestLevel = level;
          closestLevelIndex = needIndex;
        }
      }
    });

    if (minDistance !== Infinity) {
      // CRITICAL: Penalize materials ABOVE student level more heavily than below
      const isAboveLevel = materialLevelIndex > closestLevelIndex;
      
      // Score decreases with distance, with heavier penalty for above-level materials
      let scoreMultiplier = 0.3; // Default for 3+ levels away
      if (minDistance === 1) {
        scoreMultiplier = isAboveLevel ? 0.4 : 0.7; // Below: 70%, Above: 40%
      } else if (minDistance === 2) {
        scoreMultiplier = isAboveLevel ? 0.2 : 0.5; // Below: 50%, Above: 20%
      } else if (minDistance >= 3 && isAboveLevel) {
        scoreMultiplier = 0.1; // Heavy penalty for materials 3+ levels too high
      }

      breakdown.levelMatch = finalWeights.levelMatch * scoreMultiplier;
      const direction = isAboveLevel ? "above" : "below";
      rationale.push(
        `Level proximity: ${material.level} (${minDistance} level${
          minDistance > 1 ? "s" : ""
        } ${direction} ${closestLevel}${isAboveLevel ? " - PENALTY" : ""})`
      );
    }
  } else if (material.level === "Mixed Levels") {
    // Mixed levels gets moderate score as it could work for any student
    breakdown.levelMatch = finalWeights.levelMatch * 0.6;
    rationale.push(`Mixed level material (universal)`);
  }

  // 4. Type match - REMOVED (no longer scored)
  // Type matching has been eliminated from scoring

  // 5. Skill match (15% weight)
  if (studentNeeds.skill.includes(material.skill)) {
    breakdown.skillMatch = finalWeights.skillMatch;
    rationale.push(`Skill match: ${material.skill}`);
  }

  // 6. Tag match (2% weight, distributed)
  const matchingTags = studentNeeds.tags.filter((needTag) =>
    material.tags.some(
      (materialTag) =>
        materialTag.toLowerCase().includes(needTag.toLowerCase()) ||
        needTag.toLowerCase().includes(materialTag.toLowerCase())
    )
  );
  if (matchingTags.length > 0) {
    breakdown.tagMatch = Math.min(
      finalWeights.tagMatch,
      matchingTags.length * 1 // 1 point per matching tag, max 2
    );
    rationale.push(`Tag matches: ${matchingTags.join(", ")}`);
  }

  // 7. Accessibility match (10% weight)
  if (studentContext.learningBarriers.length > 0) {
    const accessibilityKeywords = [
      "visual",
      "audio",
      "dyslexia",
      "adhd",
      "autism",
      "hearing",
      "mobility",
      "cognitive",
      "accessible",
      "accommodation",
      "support",
    ];
    const materialText = `${material.description || ""} ${
      material.aiSummary || ""
    } ${material.tags.join(" ")}`.toLowerCase();

    const hasAccessibilityFeatures = accessibilityKeywords.some((keyword) =>
      materialText.includes(keyword)
    );

    if (hasAccessibilityFeatures) {
      breakdown.accessibilityMatch = finalWeights.accessibilityMatch;
      rationale.push("Contains accessibility accommodations");
    }
  }

  // 8. Semantic similarity match (20% weight)
  if (studentReportsConcepts && (material.description || material.aiSummary)) {
    // Include AI reasoning + material content for better matching
    const studentContext = `${studentReportsConcepts} ${studentNeeds.reasoning}`;
    const materialContent = `${material.description || ""} ${
      material.aiSummary || ""
    }`.trim();

    const similarity = calculateSemanticSimilarity(
      studentContext,
      materialContent
    );

    if (similarity > 0.05) {
      // Lowered threshold from 0.1 to 0.05 (5% overlap minimum)
      breakdown.semanticMatch = finalWeights.semanticMatch * similarity;
      rationale.push(
        `Semantic match: ${(similarity * 100).toFixed(1)}% concept overlap`
      );
    }
  }

  const totalScore = Object.values(breakdown).reduce(
    (sum, score) => sum + score,
    0
  );

  return {
    score: totalScore,
    breakdown,
    rationale,
  };
}

/**
 * Helper function to determine if a material level is too far above student level
 * Returns true if material should be filtered out (more than 1 level above)
 */
export function isMaterialTooAdvanced(
  materialLevel: string,
  studentLevels: string[]
): boolean {
  if (studentLevels.length === 0) return false;
  if (materialLevel === "Mixed Levels") return false;

  const levelOrder = [
    "Preschool",
    "Kindergarten",
    "Elementary (1-3)",
    "Elementary (4-5)",
    "Middle School (6-8)",
    "High School (9-12)",
    "Adult Education",
    "Mixed Levels",
  ];

  const proficiencyLevelOrder = [
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
  ];

  // Try to find material level in both systems
  let materialLevelIndex = levelOrder.indexOf(materialLevel);
  let activeLevelOrder = levelOrder;

  if (materialLevelIndex === -1) {
    materialLevelIndex = proficiencyLevelOrder.indexOf(materialLevel);
    activeLevelOrder = proficiencyLevelOrder;
  }

  if (materialLevelIndex === -1) return false; // Unknown level, don't filter

  // Find highest student level
  let maxStudentLevelIndex = -1;
  studentLevels.forEach((level) => {
    const idx = activeLevelOrder.indexOf(level);
    if (idx !== -1 && idx > maxStudentLevelIndex) {
      maxStudentLevelIndex = idx;
    }
  });

  if (maxStudentLevelIndex === -1) return false;

  // Filter out materials more than 1 level above student's highest level
  const levelsAbove = materialLevelIndex - maxStudentLevelIndex;
  return levelsAbove > 1;
}
