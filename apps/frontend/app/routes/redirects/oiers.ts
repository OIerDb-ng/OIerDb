import { redirect } from 'react-router';

import type { Route } from './+types/oiers';

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`/oier${search}`);
}
