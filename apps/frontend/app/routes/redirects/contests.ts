import { redirect } from 'react-router';

import type { Route } from './+types/contests';

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`/contest${search}`);
}
