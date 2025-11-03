import { SCORE_COLORS } from '~/constants/awards';

/**
 * Calculate progress-based color for scores and ranks
 * Combines progress calculation and color mapping into a single function
 * @param value - The current value
 * @param total - The total/max value
 * @param colorScheme - Color scheme ('light' | 'dark')
 * @returns Color string based on the value/total ratio
 */
export function getProgressColor(
  value: number,
  total: number,
  colorScheme: 'light' | 'dark' = 'light',
): string {
  if (total <= 0) {
    return SCORE_COLORS[colorScheme][0]; // Return lowest color for invalid total
  }

  const ratio = value / total;
  const progress = Math.floor(ratio * 10);
  const index = Math.min(Math.max(progress, 0), 10);

  return SCORE_COLORS[colorScheme][index];
}
