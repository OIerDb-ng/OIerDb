import { style } from '@vanilla-extract/css';

import { vars } from '~/theme';

export const header = style({
  backgroundColor: vars.colors.body,
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: vars.colors.gray[3],

  [vars.darkSelector]: {
    borderBottomColor: vars.colors.dark[4],
  },
});

export const container = style({
  paddingLeft: 0,
  paddingRight: 0,
});

export const inner = style({
  height: 56,
  display: 'flex',
  alignItems: 'stretch',

  '@media': {
    [vars.smallerThan(vars.breakpoints.sm)]: {
      height: 48,
      justifyContent: 'space-between',
    },
  },
});

export const group = style({
  display: 'flex',
  alignItems: 'stretch',
});

const link = style({
  display: 'block',
  textDecoration: 'none',
  color: vars.colors.black,
  padding: '8px 12px',
  lineHeight: 1,
  userSelect: 'none',
  transform: 'background-color 100ms ease',

  [vars.darkSelector]: {
    color: vars.colors.dark[0],
  },

  ':hover': {
    backgroundColor: vars.colors.gray[0],

    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[6],
    },
  },

  ':active': {
    backgroundColor: vars.colors.gray[1],

    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[5],
    },
  },
});

export const logo = style([
  link,
  {
    fontFamily: 'Saira',
    fontSize: 22,
    fontWeight: 500,

    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
]);

export const item = style([
  link,
  {
    display: 'flex',
    alignItems: 'center',
    fontSize: vars.fontSizes.sm,
  },
]);

export const burger = style({
  vars: {
    '--mantine-spacing-xs': '30px',
  },
});

export const mobileLogo = style([
  logo,
  {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: vars.colors.gray[3],

    [vars.darkSelector]: {
      borderBottomColor: vars.colors.dark[4],
    },
  },
]);

export const mobileItem = style([
  item,
  {
    padding: '12px 16px',
    fontSize: vars.fontSizes.md,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: vars.colors.gray[3],

    [vars.darkSelector]: {
      borderBottomColor: vars.colors.dark[4],
    },
  },
]);
