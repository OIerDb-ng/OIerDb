/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { getCurrentAdapter } from '../adapters';
import type { RouteContext } from '../router';
import { errorResponse, jsonResponse } from '../router';

/**
 * GET /api/v1/meta/version
 */
export const getVersion = async (_ctx: RouteContext): Promise<Response> => {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const data = await adapter.getVersion();
  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
};
