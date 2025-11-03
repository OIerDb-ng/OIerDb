/**
 * Fix contest name formatting
 * Adds space between contest name and category (e.g., "NOI2017D类" → "NOI2017 D类")
 * @param contestName - Raw contest name
 * @returns Formatted contest name
 */
export function fixContestName(contestName: string): string {
  // Add space before capital letter followed by "类" if not already present
  return contestName.replace(/([A-Z0-9])([A-Z]类)/, '$1 $2');
}

/**
 * Add spaces between Chinese characters and Latin characters/numbers
 * Improves readability of mixed text
 * @param text - Text with mixed Chinese and Latin characters
 * @returns Formatted text with proper spacing
 */
export function fixChineseSpace(text: string): string {
  // Add space between Chinese and Latin/numbers
  let result = text.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
  // Add space between Latin/numbers and Chinese
  result = result.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
  return result;
}
