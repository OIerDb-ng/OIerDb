import { style } from '@vanilla-extract/css';

export const layout = style({
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
});

export const main = style({
  flex: 1,
});
