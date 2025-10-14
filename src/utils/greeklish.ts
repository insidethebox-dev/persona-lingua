/**
 * Greek to Greeklish (ASCII) conversion utility
 * Converts Greek characters to their Latin alphabet equivalents
 */

// Greek character mappings to Latin equivalents
const GREEK_TO_LATIN: Record<string, string> = {
  // Uppercase Greek letters
  Α: "A",
  Β: "V",
  Γ: "G",
  Δ: "D",
  Ε: "E",
  Ζ: "Z",
  Η: "I",
  Θ: "Th",
  Ι: "I",
  Κ: "K",
  Λ: "L",
  Μ: "M",
  Ν: "N",
  Ξ: "X",
  Ο: "O",
  Π: "P",
  Ρ: "R",
  Σ: "S",
  Τ: "T",
  Υ: "Y",
  Φ: "F",
  Χ: "X",
  Ψ: "Ps",
  Ω: "O",

  // Lowercase Greek letters
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "x",
  ψ: "ps",
  ω: "o",

  // Greek letters with diacritics (accented)
  Ά: "A",
  Έ: "E",
  Ή: "I",
  Ί: "I",
  Ό: "O",
  Ύ: "Y",
  Ώ: "O",
  ά: "a",
  έ: "e",
  ή: "i",
  ί: "i",
  ό: "o",
  ύ: "y",
  ώ: "o",

  // Diaeresis (ϊ, ϋ)
  Ϊ: "I",
  Ϋ: "Y",
  ϊ: "i",
  ϋ: "y",

  // Combined diacritics
  ΐ: "i",
  ΰ: "y",

  // Common digraphs - order matters, longer ones first
  ου: "ou",
  ΟΥ: "OU",
  Ου: "Ou",
  αι: "ai",
  ΑΙ: "AI",
  Αι: "Ai",
  ει: "ei",
  ΕΙ: "EI",
  Ει: "Ei",
  οι: "oi",
  ΟΙ: "OI",
  Οι: "Oi",
  υι: "yi",
  ΥΙ: "YI",
  Υι: "Yi",
  αυ: "av",
  ΑΥ: "AV",
  Αυ: "Av",
  ευ: "ev",
  ΕΥ: "EV",
  Ευ: "Ev",
  ηυ: "iv",
  ΗΥ: "IV",
  Ηυ: "Iv",
};

/**
 * Convert Greek text to Greeklish (Latin characters)
 */
export function convertToGreeklish(text: string): string {
  let result = text;

  // First pass: handle digraphs (must be done before individual characters)
  const digraphs = [
    "ου",
    "ΟΥ",
    "Ου",
    "αι",
    "ΑΙ",
    "Αι",
    "ει",
    "ΕΙ",
    "Ει",
    "οι",
    "ΟΙ",
    "Οι",
    "υι",
    "ΥΙ",
    "Υι",
    "αυ",
    "ΑΥ",
    "Αυ",
    "ευ",
    "ΕΥ",
    "Ευ",
    "ηυ",
    "ΗΥ",
    "Ηυ",
  ];

  for (const digraph of digraphs) {
    const replacement = GREEK_TO_LATIN[digraph];
    if (replacement) {
      result = result.replaceAll(digraph, replacement);
    }
  }

  // Second pass: handle individual characters
  for (const [greek, latin] of Object.entries(GREEK_TO_LATIN)) {
    if (greek.length === 1) {
      // Skip digraphs already handled
      result = result.replaceAll(greek, latin);
    }
  }

  return result;
}

/**
 * Check if text contains non-ASCII characters
 */
export function hasNonAsciiChars(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

/**
 * Check if text contains Greek characters
 */
export function hasGreekChars(text: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(text);
}

/**
 * Convert filename to ASCII-safe version
 * - Converts Greek to Greeklish
 * - Removes or replaces other non-ASCII characters
 * - Preserves file extension
 */
export function convertFilenameToAscii(filename: string): {
  convertedName: string;
  hasChanges: boolean;
  originalHadGreek: boolean;
} {
  const originalHadGreek = hasGreekChars(filename);

  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const name =
    lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

  // Convert to Greeklish
  let convertedName = convertToGreeklish(name);

  // Handle any remaining non-ASCII characters (not Greek)
  convertedName = convertedName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^\x00-\x7F]/g, "") // remove any remaining non-ASCII
    .replace(/[<>:"/\\|?*]/g, "_") // replace invalid filename chars
    .replace(/\s+/g, " ") // normalize spaces
    .trim();

  // Ensure we have a valid name
  if (!convertedName) {
    convertedName = "material";
  }

  const finalFilename = convertedName + extension;
  const hasChanges = finalFilename !== filename;

  return {
    convertedName: finalFilename,
    hasChanges,
    originalHadGreek,
  };
}

/**
 * Examples and test cases
 */
export const GREEKLISH_EXAMPLES = [
  {
    greek: "Άμεσο και Έμμεσο Αντικείμενο.pdf",
    greeklish: "Ameso kai Emeso Antikeimeno.pdf",
  },
  { greek: "ΓΛΥΚΑ.png", greeklish: "GLYKA.png" },
  {
    greek: "Επιβεβαιωμένο Ραντεβού.pdf",
    greeklish: "Epivevaiomeno Randevou.pdf",
  },
  {
    greek: "poster Ρωτάω I ask (1).docx",
    greeklish: "poster Rotao I ask (1).docx",
  },
  { greek: "Αθήνα - Athens.jpg", greeklish: "Athina - Athens.jpg" },
  { greek: "Φωτογραφίες διακοπών.zip", greeklish: "Fotografies diakopon.zip" },
];
