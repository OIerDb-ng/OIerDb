/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { getCurrentAdapter } from '../adapters';
import type { RouteContext } from '../router';
import { errorResponse, jsonResponse, notFoundResponse } from '../router';

// GET /api/v1/oier/:uid
export async function getOIer(ctx: RouteContext): Promise<Response> {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const uid = parseInt(ctx.params.uid, 10);
  const data = await adapter.getOIer(uid);

  if (data === null) {
    return notFoundResponse('OIer not found');
  }

  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
}

// GET /api/v1/oier
export async function listOIers(ctx: RouteContext): Promise<Response> {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const data = await adapter.listOIers(ctx.query);
  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
}
