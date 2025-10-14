import {
  applyDyslexicFormatting,
  DEFAULT_DYSLEXIC_CONFIG,
  DYSLEXIC_PRESETS,
  getDyslexicPreset,
  validateDyslexicConfig,
  isDyslexicFriendlyFont,
} from "./dyslexic-formatting";

/**
 * Test utilities for dyslexic formatting
 * These functions can be used to validate the formatting works correctly
 */

export function testDyslexicFormattingConfig() {
  console.log("🧪 Testing Dyslexic Formatting Configuration");

  // Test default config
  console.log("Default Config:", DEFAULT_DYSLEXIC_CONFIG);

  // Test presets
  console.log("Available Presets:", Object.keys(DYSLEXIC_PRESETS));
  console.log("Moderate Preset:", getDyslexicPreset("moderate"));

  // Test font validation
  console.log("Arial is dyslexic-friendly:", isDyslexicFriendlyFont("Arial"));
  console.log(
    "Times New Roman is dyslexic-friendly:",
    isDyslexicFriendlyFont("Times New Roman")
  );

  // Test configuration validation
  const validConfig = { fontSize: 14, lineSpacing: 1.5 };
  const invalidConfig = { fontSize: 50, lineSpacing: 0.5 };

  console.log("Valid config errors:", validateDyslexicConfig(validConfig));
  console.log("Invalid config errors:", validateDyslexicConfig(invalidConfig));
}

/**
 * Generates a test DOCX blob for testing formatting
 * Note: This is a minimal DOCX structure for testing purposes
 */
export function createTestDocxBlob(): Blob {
  // This is a minimal DOCX structure with basic document.xml content
  const testContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>This is a test document for dyslexic formatting.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>It contains multiple paragraphs to test the formatting functionality.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  // Note: This creates a simplified structure for testing
  // In a real DOCX file, you'd need proper ZIP structure with multiple files
  return new Blob([testContent], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Tests the formatting functionality end-to-end
 */
export async function testDyslexicFormatting() {
  console.log("🧪 Testing Dyslexic Formatting Pipeline");

  try {
    // Create a test blob
    const testBlob = createTestDocxBlob();
    console.log("Created test blob, size:", testBlob.size, "bytes");

    // Test with default configuration
    const formattedBlob = await applyDyslexicFormatting(testBlob);
    console.log("Formatted blob, size:", formattedBlob.size, "bytes");

    // Test with custom configuration
    const customConfig = getDyslexicPreset("strong");
    const customFormattedBlob = await applyDyslexicFormatting(
      testBlob,
      customConfig
    );
    console.log(
      "Custom formatted blob, size:",
      customFormattedBlob.size,
      "bytes"
    );

    console.log("✅ Dyslexic formatting test completed successfully");
  } catch (error) {
    console.error("❌ Dyslexic formatting test failed:", error);
  }
}

/**
 * Helper function to log formatting details
 */
export function logFormattingDetails(config = DEFAULT_DYSLEXIC_CONFIG) {
  console.log("📋 Dyslexic Formatting Details:");
  console.log(`Font Family: ${config.fontFamily}`);
  console.log(`Font Size: ${config.fontSize}pt`);
  console.log(`Line Spacing: ${config.lineSpacing}x`);
  if (config.letterSpacing) {
    console.log(`Letter Spacing: ${config.letterSpacing}pt`);
  }
}
