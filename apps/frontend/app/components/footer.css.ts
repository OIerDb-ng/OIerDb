import { style } from '@vanilla-extract/css';

import { vars } from '~/theme';

export const footer = style({
  borderTopWidth: 1,
  borderTopStyle: 'solid',
  borderTopColor: vars.colors.gray[3],
  padding: '1.5rem 0',
  marginTop: '2rem',

  [vars.darkSelector]: {
    borderTopColor: vars.colors.dark[4],
  },
});

export const inner = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  textAlign: 'center',
  fontSize: vars.fontSizes.sm,
  color: vars.colors.gray[6],

  [vars.darkSelector]: {
    color: vars.colors.dark[2],
  },
});

export const link = style({
  color: 'inherit',
  textDecoration: 'none',

  ':hover': {
    textDecoration: 'underline',
  },
});
