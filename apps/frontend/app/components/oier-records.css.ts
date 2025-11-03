import { style } from '@vanilla-extract/css';

export const container = style({
  marginBottom: '1.5rem',
});

export const heading = style({
  marginBottom: '1rem',
  fontSize: '1.2rem',
  fontWeight: 600,
});

export const contestName = style({
  textDecoration: 'none',
  color: 'inherit',
  ':hover': {
    textDecoration: 'underline',
  },
  '::after': {
    content: '"|"',
    marginLeft: '5px',
    marginRight: '5px',
    display: 'inline-block',
    opacity: 0.3,
  },
});

export const contestLevel = style({
  fontWeight: 'bold',
});

export const recordTotal = style({
  opacity: 0.6,
  fontSize: '0.9em',
});

export const gradeInconsistent = style({
  cursor: 'help',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
});
