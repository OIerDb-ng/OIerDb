/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { getCurrentAdapter } from '../adapters';
import type { RouteContext } from '../router';
import { errorResponse, jsonResponse, notFoundResponse } from '../router';

/**
 * GET /api/v1/school/:id
 */
export const getSchool = async (ctx: RouteContext): Promise<Response> => {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const id = parseInt(ctx.params.id, 10);
  const data = await adapter.getSchool(id);

  if (data === null) {
    return notFoundResponse('School not found');
  }

  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
};

/**
 * GET /api/v1/school
 */
export const listSchools = async (ctx: RouteContext): Promise<Response> => {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const data = await adapter.listSchools(ctx.query);
  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
};
