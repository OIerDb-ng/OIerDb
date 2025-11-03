/**
 * Award level emoji mappings
 */
export const AWARD_EMOJI_MAPPINGS = [
  { keywords: ['金'], emoji: '🥇' },
  { keywords: ['银'], emoji: '🥈' },
  { keywords: ['铜'], emoji: '🥉' },
] as const;

/**
 * Score color palette (0-10 scale)
 */
export const SCORE_COLORS = {
  light: [
    '#ff0000', // 0 - red
    '#f53100',
    '#eb5e00',
    '#e08700',
    '#d6ab00',
    '#cccc00', // 5 - yellow
    '#a3cc00',
    '#7acc00',
    '#52cc00',
    '#29cc00',
    '#00cc00', // 10 - green
  ],
  dark: [
    '#ff4545', // 0 - red
    '#ff694f',
    '#f8603a',
    '#fc8354',
    '#fa9231',
    '#f7bb3b', // 5 - yellow
    '#ecdb44',
    '#e2ec52',
    '#b0d628',
    '#a9b42a',
    '#37da58', // 10 - green
  ],
} as const;
