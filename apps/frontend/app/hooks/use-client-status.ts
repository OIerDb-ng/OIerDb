import { useSyncExternalStore } from 'react';

import { getStatus, subscribeToStatusChange } from '~/libs/client';

const getServerSnapshot = () => undefined;

export const useClientStatus = () => {
  return useSyncExternalStore(subscribeToStatusChange, getStatus, getServerSnapshot);
};
