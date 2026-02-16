import { HttpAdapter } from '@oierdb/adapter-http';
import { OIerDbClient } from '@oierdb/core';

import { backendEndpoint } from './constant';
import { OIerDbClientStatusEnum, setStatus, setupSwStatusListener, SwStatusEnum } from './status';

/**
 * Initialize the OIerDbClient with HttpAdapter.
 * The endpoint is determined by SW availability:
 * - If SW is ready: use current origin (SW will intercept /api/v1/* requests)
 * - If SW is not ready: use backendEndpoint directly
 *
 * Steps:
 * - Check if SW is registered and ready
 * - Create HttpAdapter with appropriate baseUrl
 * - Set up OIerDbClient with the adapter
 * - Set up Service Worker status listener for status updates
 * - When SW becomes ready, switch to origin-based endpoint
 */
const initClientAsync = async () => {
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据查询模块' });

  // Check if SW is registered and controlling the page
  const swReady = navigator.serviceWorker?.controller != null;
  console.log('[Client] SW ready:', swReady);

  // Use backendEndpoint directly if SW is not ready
  // Otherwise use origin so SW can intercept requests
  const baseUrl = swReady ? window.location.origin : backendEndpoint;
  console.log('[Client] Using baseUrl:', baseUrl);

  const httpAdapter = new HttpAdapter({ baseUrl });

  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '检查服务可用性' });

  try {
    // Test connectivity by getting version
    const version = await httpAdapter.getVersion();
    console.log('[Client] API version:', version.data_version);

    // Create client with HTTP adapter
    globalThis.OIerDbClientInstance = new OIerDbClient(httpAdapter);

    // Set up SW status listener to update UI based on SW state
    setupSwStatusListener();

    // If SW wasn't ready, listen for it to become ready and switch endpoint
    if (!swReady) {
      waitForSwAndSwitchEndpoint();
    }

    setStatus({
      type: OIerDbClientStatusEnum.InitializedPartially,
      text: swReady ? '等待 Service Worker 就绪' : '使用在线服务',
    });
  } catch (error) {
    console.error('[Client] Failed to initialize:', error);
    setStatus({
      type: OIerDbClientStatusEnum.Uninitialized,
      text: '初始化失败',
    });
    throw error;
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
  // First set status to Initializing
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据查询模块' });

  // Then start async initialization, but don't wait for it
  void initClientAsync().catch((error) => {
    console.error('[Client] initClientAsync rejected:', error);
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
