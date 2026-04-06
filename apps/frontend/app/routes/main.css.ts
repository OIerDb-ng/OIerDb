import { style } from '@vanilla-extract/css';

export const container = style({
  paddingTop: '1.5rem',
  paddingBottom: '2rem',
});

export const searchBox = style({
  marginBottom: '2rem',
});

export const searchTitle = style({
  fontSize: '1.5rem',
  fontWeight: 600,
  marginBottom: '1rem',
});

export const advancedToggle = style({
  cursor: 'pointer',
  fontSize: '0.875rem',
  opacity: 0.6,
  userSelect: 'none',
  ':hover': {
    opacity: 1,
  },
});

export const advancedPanel = style({
  marginTop: '0.75rem',
});

export const resultHeading = style({
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
  opacity: 0.7,
});
