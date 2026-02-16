/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { getCurrentAdapter } from '../adapters';
import type { RouteContext } from '../router';
import { errorResponse, jsonResponse, notFoundResponse } from '../router';

/**
 * GET /api/v1/contest/:id
 */
export const getContest = async (ctx: RouteContext): Promise<Response> => {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const id = parseInt(ctx.params.id, 10);
  const page = ctx.query.page as number | undefined;
  const perPage = ctx.query.perPage as number | undefined;

  const data = await adapter.getContest(id, page, perPage);

  if (data === null) {
    return notFoundResponse('Contest not found');
  }

  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
};

/**
 * GET /api/v1/contest
 */
export const listContests = async (ctx: RouteContext): Promise<Response> => {
  const adapter = getCurrentAdapter();

  if (!adapter) {
    return errorResponse(503, 'Service Worker not initialized');
  }

  const data = await adapter.listContests(ctx.query);
  return jsonResponse(data, 200, {
    'X-SW-Adapter': adapter.getType(),
  });
};
