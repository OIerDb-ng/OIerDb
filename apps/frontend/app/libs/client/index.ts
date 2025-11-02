import type { OIerDbClient } from '@oierdb/core';

import type { OIerDbClientStatusType } from './status';

declare global {
  var OIerDbClientInstance: OIerDbClient | null;
  var OIerDbClientStatus: OIerDbClientStatusType;
  var OIerDbClientStatusText: string;
}

export { getClient, initClient } from './client';
export { getStatus, subscribeToStatusChange, waitUntilClientReady } from './status';
