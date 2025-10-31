import { useClientStatus } from '~/hooks/use-client';

import type { Route } from './+types/main';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'OIerDb' },
    { name: 'description', content: 'A database for Chinese OI participants.' },
  ];
}

export default function Home() {
  const status = useClientStatus();

  return (
    <div>
      {status.type}. {status.text}
    </div>
  );
}
