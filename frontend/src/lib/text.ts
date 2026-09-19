/**
 * Titles are stored lowercase — case is a display decision, not data, so
 * "Write spec" and "write spec" are one task. Reading is where the capital
 * belongs.
 *
 * Only the first letter: "write the spec" becomes "Write the spec", not
 * "Write The Spec", which would fight anyone who typed a proper noun mid-title.
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}
