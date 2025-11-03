import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('./layout.tsx', [
    index('./routes/main.tsx'),
    route('oier/:uid', './routes/oier_detail.tsx'),

    // other routes can be added here...
  ]),
] satisfies RouteConfig;
