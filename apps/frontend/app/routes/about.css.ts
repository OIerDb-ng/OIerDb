import { style } from '@vanilla-extract/css';

import { vars } from '~/theme';

export const container = style({
  paddingTop: '2rem',
  paddingBottom: '2rem',
});

export const logo = style({
  display: 'block',
  margin: '0 auto',
  width: 128,
  height: 128,
});

export const title = style({
  textAlign: 'center',
  fontSize: '2rem',
  fontWeight: 600,
  marginTop: '1rem',
  marginBottom: '0.5rem',
});

export const subtitle = style({
  textAlign: 'center',
  color: vars.colors.gray[6],
  marginBottom: '2rem',

  [vars.darkSelector]: {
    color: vars.colors.dark[2],
  },
});

export const section = style({
  marginBottom: '2rem',
});

export const sectionTitle = style({
  fontSize: '1.25rem',
  fontWeight: 600,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: vars.colors.gray[3],

  [vars.darkSelector]: {
    borderBottomColor: vars.colors.dark[4],
  },
});

export const question = style({
  fontSize: '1rem',
  fontWeight: 600,
  marginTop: '1rem',
  marginBottom: '0.5rem',
});

export const paragraph = style({
  lineHeight: 1.6,
  marginBottom: '0.75rem',
});

export const link = style({
  color: vars.colors.blue[6],
  textDecoration: 'none',

  ':hover': {
    textDecoration: 'underline',
  },
});

export const list = style({
  paddingLeft: '1.5rem',
  marginTop: 0,
  marginBottom: '0.75rem',
});

export const starText = style({
  color: vars.colors.red[6],
});
