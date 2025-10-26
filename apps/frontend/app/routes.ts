import { type RouteConfig, index, layout } from '@react-router/dev/routes';

export default [
  layout('./layout.tsx', [
    index('./routes/main.tsx'),

    // other routes can be added here...
  ]),
] satisfies RouteConfig;
