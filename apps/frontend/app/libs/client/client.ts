import { HttpAdapter } from '@oierdb/adapter-http';
import { OIerDbClient } from '@oierdb/core';

import { backendEndpoint } from './constant';
import {
  InitFailureReason,
  OIerDbClientStatusEnum,
  setStatus,
  setupSwStatusListener,
  SwStatusEnum,
} from './status';

/**
 * Initialize the OIerDbClient with HttpAdapter.
 * The endpoint is determined by SW availability:
 * - If SW is ready: use current origin (SW will intercept /api/v1/* requests)
 * - If SW is not ready: use backendEndpoint directly, then switch to SW when ready
 *
 * The client instance is always created so getClient() never throws.
 * Status transitions drive waitUntilClientReady() resolution.
 */
const initClientAsync = async () => {
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据查询模块' });
  setupSwStatusListener();

  // Check if SW is registered and controlling the page
  const swReady = navigator.serviceWorker?.controller != null;
  console.log('[Client] SW ready:', swReady);

  if (swReady) {
    // SW is already controlling the page — use it directly.
    // The SW may still be initializing its adapter (race with clients.claim()),
    // so don't test connectivity here. Just listen for SW status broadcasts.
    const httpAdapter = new HttpAdapter({ baseUrl: window.location.origin });
    globalThis.OIerDbClientInstance = new OIerDbClient(httpAdapter);
    setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '等待 Service Worker 就绪' });
    // Status will be updated when the SW broadcasts its ready state.
    return;
  }

  // SW is not yet controlling the page — try connecting to the backend directly.
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '检查服务可用性' });

  const httpAdapter = new HttpAdapter({ baseUrl: backendEndpoint });
  // Always create the instance so getClient() is safe to call after waitUntilClientReady.
  globalThis.OIerDbClientInstance = new OIerDbClient(httpAdapter);

  try {
    const version = await httpAdapter.getVersion();
    console.log('[Client] API version:', version.data_version);

    // Backend is reachable — use it as a temporary source while waiting for SW.
    waitForSwAndSwitchEndpoint();
    setStatus({ type: OIerDbClientStatusEnum.InitializedPartially, text: '使用在线服务' });
  } catch {
    // Backend unreachable (e.g. first load in dev, or offline).
    // Switch the client to use the origin so it routes through the SW once active.
    console.warn('[Client] Backend unreachable, waiting for Service Worker');
    globalThis.OIerDbClientInstance.setAdapter(
      new HttpAdapter({ baseUrl: window.location.origin }),
    );
    setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '等待 Service Worker 就绪' });
    waitForSwAndSwitchEndpoint();
  }
};

const waitForSwAndSwitchEndpoint = () => {
  if (!navigator.serviceWorker) return;

  // Listen for SW to become activated first
  navigator.serviceWorker.ready.then((registration) => {
    console.log('[Client] SW activated, querying availability via postMessage');

    let switched = false;
    let attempts = 0;
    const maxAttempts = 40;
    const timeoutMs = 20000;
    let timeoutId: number | null = null;

    const cleanup = () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };

    // Handler for SW status response
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};

      if (type === 'statusResponse' && !switched) {
        console.log('[Client] SW status response:', payload);

        // Check if SW is ready (at least UsingHttp status means it can handle requests)
        if (payload.status >= SwStatusEnum.UsingHttp) {
          switched = true;
          cleanup();

          console.log('[Client] SW is ready, switching to origin-based endpoint');

          // Create new adapter with origin baseUrl
          const newAdapter = new HttpAdapter({ baseUrl: window.location.origin });

          // Switch the client's adapter
          if (globalThis.OIerDbClientInstance) {
            globalThis.OIerDbClientInstance.setAdapter(newAdapter);
          }

          // Re-setup SW status listener
          setupSwStatusListener();
        } else if (
          payload.status === SwStatusEnum.Uninitialized &&
          payload.failureReason !== InitFailureReason.None
        ) {
          switched = true;
          cleanup();
        } else {
          // SW is still initializing, retry after a delay
          console.log('[Client] SW still initializing, retrying...');
          attempts += 1;
          if (attempts >= maxAttempts) {
            console.warn('[Client] SW status polling reached max attempts');
            cleanup();
            return;
          }
          setTimeout(queryStatus, 500);
        }
      }
    };

    // Query SW status
    const queryStatus = () => {
      const controller = registration.active;
      if (!controller) {
        console.log('[Client] SW not yet active, retrying...');
        attempts += 1;
        if (attempts >= maxAttempts) {
          console.warn('[Client] SW activation polling reached max attempts');
          cleanup();
          return;
        }
        setTimeout(queryStatus, 100);
        return;
      }
      controller.postMessage({ type: 'getStatus' });
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    timeoutId = window.setTimeout(() => {
      if (!switched) {
        console.warn('[Client] SW readiness polling timed out');
        cleanup();
      }
    }, timeoutMs);
    queryStatus();
  });
};

export const initClient = () => {
  void initClientAsync().catch((error) => {
    console.error('[Client] initClientAsync rejected unexpectedly:', error);
  });
};

export const getClient = () => {
  if (!globalThis.OIerDbClientInstance) {
    throw new Error(
      'OIerDbClient is not initialized yet. Please call initClient() first and wait for initialization to complete.',
    );
  }

  return globalThis.OIerDbClientInstance;
};
