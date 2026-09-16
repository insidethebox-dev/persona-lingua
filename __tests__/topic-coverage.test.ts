import {
  evaluateTopicCoverage,
  RELATED_TOPICS,
} from "@/lib/recommendation-scoring";

describe("evaluateTopicCoverage", () => {
  const materials = [
    { topic: "Travel", language: "Spanish" },
    { topic: "Travel", language: "Spanish" },
    { topic: "Food & Drink", language: "English" }, // wrong language
    { topic: "Shopping", language: "Spanish" }, // related to Travel & Daily Life
    { topic: null, language: "Spanish" },
    { topic: "Technology", language: null }, // untagged language counts
  ];

  it("counts exact and related same-language matches per topic", () => {
    const result = evaluateTopicCoverage({
      recommendedTopics: ["Travel", "Daily Life", "Food & Drink"],
      materials,
      studentLanguage: "Spanish",
    });

    expect(result.language).toBe("Spanish");
    expect(result.candidateCount).toBe(5);
    expect(result.coverage).toEqual([
      { topic: "Travel", exactMatches: 2, relatedMatches: 1 },
      { topic: "Daily Life", exactMatches: 0, relatedMatches: 3 }, // 2x Travel + Shopping
      { topic: "Food & Drink", exactMatches: 0, relatedMatches: 1 },
    ]);
    expect(result.uncoveredTopics).toEqual(["Daily Life", "Food & Drink"]);
    expect(new Date(result.checkedAt).getTime()).not.toBeNaN();
  });

  it("flags every topic when the library has nothing in the student's language", () => {
    const result = evaluateTopicCoverage({
      recommendedTopics: ["Travel", "Environment"],
      materials: [{ topic: "Travel", language: "English" }],
      studentLanguage: "Greek",
    });

    expect(result.candidateCount).toBe(0);
    expect(result.uncoveredTopics).toEqual(["Travel", "Environment"]);
  });

  it("returns no uncovered topics when every topic has an exact match", () => {
    const result = evaluateTopicCoverage({
      recommendedTopics: ["Travel"],
      materials: [{ topic: "Travel", language: "Spanish" }],
      studentLanguage: "Spanish",
    });

    expect(result.uncoveredTopics).toEqual([]);
  });

  it("uses the shared related-topics map", () => {
    expect(RELATED_TOPICS["Shopping"]).toContain("Travel");
  });
});
