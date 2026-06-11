import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('./layout.tsx', [
    index('./routes/main.tsx'),
    route('oier', './routes/oiers.tsx'),
    route('oier/:uid', './routes/oier_detail.tsx'),
    route('school', './routes/schools.tsx'),
    route('school/:id', './routes/school_detail.tsx'),
    route('contest', './routes/contests.tsx'),
    route('contest/:id', './routes/contest_detail.tsx'),
    route('about', './routes/about.tsx'),
  ]),
  route('oiers', './routes/redirects/oiers.ts'),
  route('schools', './routes/redirects/schools.ts'),
  route('contests', './routes/redirects/contests.ts'),
] satisfies RouteConfig;
