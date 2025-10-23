import type { Route } from './+types/main';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'OIerDb' },
    { name: 'description', content: 'A database for Chinese OI participants.' },
  ];
}

export default function Home() {
  return <div>Home</div>;
}
