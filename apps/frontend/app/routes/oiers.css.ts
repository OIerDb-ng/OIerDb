import { style } from '@vanilla-extract/css';

export const container = style({
  paddingTop: '1.5rem',
  paddingBottom: '2rem',
});

export const heading = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
});

export const headingText = style({
  fontSize: '1.25rem',
  fontWeight: 600,
});
