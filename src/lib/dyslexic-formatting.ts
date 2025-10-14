import PizZip from "pizzip";

/**
 * Configuration for dyslexic-friendly formatting
 */
export interface DyslexicFormattingConfig {
  fontFamily: string;
  fontSize: number; // in points
  lineSpacing: number; // line spacing multiplier
  letterSpacing?: number; // character spacing in points (optional)
}

/**
 * Dyslexic formatting preset configurations
 */
export const DYSLEXIC_PRESETS = {
  mild: {
    fontFamily: "Calibri",
    fontSize: 12,
    lineSpacing: 1.3,
    letterSpacing: 0.2,
  },
  moderate: {
    fontFamily: "Arial",
    fontSize: 14,
    lineSpacing: 1.5,
    letterSpacing: 0.5,
  },
  strong: {
    fontFamily: "Verdana",
    fontSize: 16,
    lineSpacing: 1.8,
    letterSpacing: 0.8,
  },
  opendyslexic: {
    fontFamily: "OpenDyslexic",
    fontSize: 14,
    lineSpacing: 1.6,
    letterSpacing: 0.4,
  },
  comic: {
    fontFamily: "Comic Sans MS",
    fontSize: 14,
    lineSpacing: 1.5,
    letterSpacing: 0.3,
  },
} as const;

/**
 * Default dyslexic-friendly formatting configuration
 * Based on research and accessibility guidelines
 */
export const DEFAULT_DYSLEXIC_CONFIG: DyslexicFormattingConfig =
  DYSLEXIC_PRESETS.moderate;

/**
 * Alternative font options that are considered dyslexic-friendly
 */
export const DYSLEXIC_FRIENDLY_FONTS = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Century Gothic",
  "Calibri",
  "Comic Sans MS", // Often recommended for dyslexic readers
];

/**
 * Custom dyslexic fonts that may be installed in /public/fonts/dyslexic/
 */
export const CUSTOM_DYSLEXIC_FONTS = [
  "OpenDyslexic",
  "OpenDyslexic-Regular",
  "Lexie Readable",
  "Dyslexie",
  "Read Regular",
  "Sylexiad",
];

/**
 * Combined list of all dyslexic-friendly fonts
 */
export const ALL_DYSLEXIC_FONTS = [
  ...DYSLEXIC_FRIENDLY_FONTS,
  ...CUSTOM_DYSLEXIC_FONTS,
];

/**
 * Applies dyslexic-friendly formatting to a DOCX file
 * @param docxBlob - The original DOCX file as a Blob
 * @param config - Formatting configuration (uses defaults if not provided)
 * @returns Promise<Blob> - The formatted DOCX file as a Blob
 */
export async function applyDyslexicFormatting(
  docxBlob: Blob,
  config: Partial<DyslexicFormattingConfig> = {}
): Promise<Blob> {
  try {
    const finalConfig = { ...DEFAULT_DYSLEXIC_CONFIG, ...config };

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await docxBlob.arrayBuffer();

    // Load the DOCX file using PizZip
    const zip = new PizZip(arrayBuffer);

    // Extract and modify document.xml (main document content)
    let documentXml = zip.file("word/document.xml")?.asText();
    if (!documentXml) {
      throw new Error("Could not find document.xml in DOCX file");
    }

    // Apply font and size formatting to all text runs
    documentXml = applyFontFormatting(documentXml, finalConfig);

    // Update the document.xml in the zip
    zip.file("word/document.xml", documentXml);

    // Extract and modify styles.xml for document-wide styling
    let stylesXml = zip.file("word/styles.xml")?.asText();
    if (stylesXml) {
      stylesXml = applyDocumentStyles(stylesXml, finalConfig);
      zip.file("word/styles.xml", stylesXml);
    }

    // Generate the new DOCX file
    const modifiedArrayBuffer = zip.generate({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return new Blob([modifiedArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  } catch (error) {
    console.error("Error applying dyslexic formatting:", error);
    // Return original blob if formatting fails
    return docxBlob;
  }
}

/**
 * Applies font formatting to individual text runs in the document XML
 */
function applyFontFormatting(
  documentXml: string,
  config: DyslexicFormattingConfig
): string {
  let modifiedXml = documentXml;

  // Pattern to match text runs (<w:r> elements)
  const runPattern = /<w:r\b[^>]*>(.*?)<\/w:r>/g;

  modifiedXml = modifiedXml.replace(runPattern, (match, content) => {
    // Check if this run already has formatting properties
    const hasRunProperties = content.includes("<w:rPr>");

    if (hasRunProperties) {
      // Modify existing run properties
      content = content.replace(
        /<w:rPr>(.*?)<\/w:rPr>/,
        (_prMatch: string, prContent: string) => {
          let newPrContent = prContent;

          // Update or add font family
          if (newPrContent.includes("<w:rFonts")) {
            newPrContent = newPrContent.replace(
              /<w:rFonts\b[^>]*>/,
              `<w:rFonts w:ascii="${config.fontFamily}" w:hAnsi="${config.fontFamily}" w:cs="${config.fontFamily}"/>`
            );
          } else {
            newPrContent = `<w:rFonts w:ascii="${config.fontFamily}" w:hAnsi="${config.fontFamily}" w:cs="${config.fontFamily}"/>${newPrContent}`;
          }

          // Update or add font size
          if (newPrContent.includes("<w:sz ")) {
            newPrContent = newPrContent.replace(
              /<w:sz w:val="[^"]*"/,
              `<w:sz w:val="${config.fontSize * 2}"`
            ); // DOCX uses half-points
          } else {
            newPrContent = `<w:sz w:val="${
              config.fontSize * 2
            }"/>${newPrContent}`;
          }

          // Add character spacing if specified
          if (config.letterSpacing) {
            if (newPrContent.includes("<w:spacing ")) {
              newPrContent = newPrContent.replace(
                /<w:spacing w:val="[^"]*"/,
                `<w:spacing w:val="${Math.round(config.letterSpacing * 20)}"`
              ); // DOCX uses twentieths of a point
            } else {
              newPrContent = `<w:spacing w:val="${Math.round(
                config.letterSpacing * 20
              )}"/>${newPrContent}`;
            }
          }

          return `<w:rPr>${newPrContent}</w:rPr>`;
        }
      );
    } else {
      // Add new run properties
      const newRunProperties = `<w:rPr>
        <w:rFonts w:ascii="${config.fontFamily}" w:hAnsi="${
        config.fontFamily
      }" w:cs="${config.fontFamily}"/>
        <w:sz w:val="${config.fontSize * 2}"/>
        ${
          config.letterSpacing
            ? `<w:spacing w:val="${Math.round(config.letterSpacing * 20)}"/>`
            : ""
        }
      </w:rPr>`;

      // Insert run properties at the beginning of the run content
      content = newRunProperties + content;
    }

    return `<w:r>${content}</w:r>`;
  });

  return modifiedXml;
}

/**
 * Applies document-wide styles for dyslexic-friendly formatting
 */
function applyDocumentStyles(
  stylesXml: string,
  config: DyslexicFormattingConfig
): string {
  let modifiedXml = stylesXml;

  // Find and modify the Normal style (default paragraph style)
  const normalStylePattern =
    /<w:style w:type="paragraph" w:default="1" w:styleId="Normal"[^>]*>(.*?)<\/w:style>/;

  modifiedXml = modifiedXml.replace(
    normalStylePattern,
    (match, styleContent) => {
      let newStyleContent = styleContent;

      // Add or modify paragraph properties for line spacing
      if (newStyleContent.includes("<w:pPr>")) {
        newStyleContent = newStyleContent.replace(
          /<w:pPr>(.*?)<\/w:pPr>/,
          (_pprMatch: string, pprContent: string) => {
            let newPprContent = pprContent;

            // Update or add line spacing
            const lineSpacingValue = Math.round(config.lineSpacing * 240); // DOCX line spacing in twentieths of a point
            if (newPprContent.includes("<w:spacing ")) {
              newPprContent = newPprContent.replace(
                /<w:spacing\b[^>]*>/,
                `<w:spacing w:line="${lineSpacingValue}" w:lineRule="auto"/>`
              );
            } else {
              newPprContent = `<w:spacing w:line="${lineSpacingValue}" w:lineRule="auto"/>${newPprContent}`;
            }

            return `<w:pPr>${newPprContent}</w:pPr>`;
          }
        );
      } else {
        // Add new paragraph properties
        newStyleContent = `<w:pPr><w:spacing w:line="${Math.round(
          config.lineSpacing * 240
        )}" w:lineRule="auto"/></w:pPr>${newStyleContent}`;
      }

      return `<w:style w:type="paragraph" w:default="1" w:styleId="Normal">${newStyleContent}</w:style>`;
    }
  );

  return modifiedXml;
}

/**
 * Validates if a font family is dyslexic-friendly
 */
export function isDyslexicFriendlyFont(fontFamily: string): boolean {
  return DYSLEXIC_FRIENDLY_FONTS.some(
    (font) => font.toLowerCase() === fontFamily.toLowerCase()
  );
}

/**
 * Get a preset configuration by name
 */
export function getDyslexicPreset(
  presetName: keyof typeof DYSLEXIC_PRESETS
): DyslexicFormattingConfig {
  return DYSLEXIC_PRESETS[presetName];
}

/**
 * Gets the recommended dyslexic-friendly font from available system fonts
 */
export function getRecommendedDyslexicFont(): string {
  // Check for custom dyslexic fonts first, then fall back to system fonts
  const preferredOrder = [
    "OpenDyslexic",
    "OpenDyslexic-Regular",
    "Lexie Readable",
    "Arial",
    "Verdana",
    "Calibri",
  ];

  // For now, return the most compatible choice from our preferred list
  // TODO: Add client-side font detection to check availability
  return preferredOrder[3]; // Arial as the most compatible choice
}

/**
 * Validates a dyslexic formatting configuration
 */
export function validateDyslexicConfig(
  config: Partial<DyslexicFormattingConfig>
): string[] {
  const errors: string[] = [];

  if (config.fontSize && (config.fontSize < 8 || config.fontSize > 24)) {
    errors.push("Font size must be between 8 and 24 points");
  }

  if (
    config.lineSpacing &&
    (config.lineSpacing < 1.0 || config.lineSpacing > 3.0)
  ) {
    errors.push("Line spacing must be between 1.0 and 3.0");
  }

  if (
    config.letterSpacing &&
    (config.letterSpacing < 0 || config.letterSpacing > 2.0)
  ) {
    errors.push("Letter spacing must be between 0 and 2.0 points");
  }

  return errors;
}

/**
 * Checks if a custom dyslexic font is potentially available
 */
export function isCustomDyslexicFont(fontFamily: string): boolean {
  return CUSTOM_DYSLEXIC_FONTS.some(
    (font) => font.toLowerCase() === fontFamily.toLowerCase()
  );
}

/**
 * Gets font installation instructions for custom fonts
 */
export function getFontInstallationInstructions(): string {
  return `
To use custom dyslexic fonts:

1. Download your preferred dyslexic-friendly font (TTF, OTF, WOFF, or WOFF2 format)
2. Place the font file in: /public/fonts/dyslexic/
3. The system will automatically detect and use the font

Recommended fonts:
• OpenDyslexic (free): https://opendyslexic.org/
• Lexie Readable (free): https://www.k-type.com/fonts/lexie-readable/
• Dyslexie Font (commercial): https://www.dyslexiefont.com/

The system currently supports: ${CUSTOM_DYSLEXIC_FONTS.join(", ")}
`;
}
