import { useSyncExternalStore } from 'react';
import { getStatus, subscribeToStatusChange } from '~/libs/client';

export const useClientStatus = () => {
  const status = useSyncExternalStore(subscribeToStatusChange, getStatus, getStatus);

  return status;
};
