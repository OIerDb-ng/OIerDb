/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { backendEndpoint } from '../libs/client/constant';
import { getCurrentAdapter, getHttpAdapter } from './adapters';
import type { FallbackHandler, RouteContext } from './router';
import { errorResponse } from './router';

export const createFallbackHandler =
  (): FallbackHandler =>
  async (ctx: RouteContext, error: Error): Promise<Response> => {
    const currentAdapter = getCurrentAdapter();
    const httpAdapter = getHttpAdapter();

    // 如果当前适配器不是 HTTP 适配器，且 HTTP 适配器可用，尝试 fallback
    if (currentAdapter !== httpAdapter && httpAdapter) {
      console.log('[SW] Falling back to HTTP adapter');

      try {
        const backendUrl = `${backendEndpoint}${ctx.url.pathname}${ctx.url.search}`;
        const response = await fetch(new Request(backendUrl, ctx.request));
        return response;
      } catch (fallbackError) {
        console.error('[SW] Fallback also failed:', fallbackError);
      }
    }

    return errorResponse(500, 'Internal server error');
  };

export const withFallback = <T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> => primary().catch(() => fallback());
