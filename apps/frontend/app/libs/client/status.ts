import { isSwStatusMessage, type SwRuntimeStatus as SwStatus, SwStatusEnum } from '~/sw/protocol';

export enum OIerDbClientStatusEnum {
  Uninitialized = 0,
  Initializing,
  InitializedPartially, // using adapter which is not has full functionality
  Initialized, // using a fully functional adapter (adapter-idb)
}

export interface OIerDbClientStatusType {
  type: OIerDbClientStatusEnum;
  text: string;
}

export { SwStatusEnum };
export type { SwStatus };

type StatusChangeListener = (status: OIerDbClientStatusType) => void;

const statusListeners = new Set<StatusChangeListener>();

const notifyStatusChange = (newStatus: OIerDbClientStatusType) => {
  statusListeners.forEach((listener) => listener(newStatus));
};

export const subscribeToStatusChange = (listener: StatusChangeListener) => {
  statusListeners.add(listener);

  return () => {
    statusListeners.delete(listener);
  };
};

export const getStatus = () => {
  return globalThis.OIerDbClientStatus;
};

export const setStatus = (newStatus: OIerDbClientStatusType) => {
  console.log('OIerDbClient status changed:', JSON.stringify(newStatus));
  globalThis.OIerDbClientStatus = newStatus;
  notifyStatusChange(newStatus);
};

export const waitUntilClientReady = (timeoutMs = 15000) =>
  new Promise<void>((resolve) => {
    const isReadyOrTerminal = (status: OIerDbClientStatusType) =>
      status.type >= OIerDbClientStatusEnum.InitializedPartially ||
      status.type === OIerDbClientStatusEnum.Uninitialized;

    const current = globalThis.OIerDbClientStatus;
    if (current && isReadyOrTerminal(current)) {
      resolve();
      return;
    }

    let completed = false;
    let unsubscribe: (() => void) | null = null;

    const timerId = setTimeout(() => {
      if (completed) return;
      completed = true;
      unsubscribe?.();
      console.warn('[Client] waitUntilClientReady timed out');
      resolve();
    }, timeoutMs);

    unsubscribe = subscribeToStatusChange((s) => {
      if (!isReadyOrTerminal(s) || completed) {
        return;
      }

      completed = true;
      clearTimeout(timerId);
      unsubscribe?.();
      resolve();
    });
  });

// ==============================
// Service Worker Status Communication
// ==============================

let swStatusListenerSetup = false;
let latestSwStatusSeq = -1;

const mapSwStatusToClientStatus = (swStatus: SwStatus): OIerDbClientStatusType => {
  switch (swStatus.status) {
    case SwStatusEnum.Uninitialized:
      return { type: OIerDbClientStatusEnum.Uninitialized, text: swStatus.text };
    case SwStatusEnum.Initializing:
      return { type: OIerDbClientStatusEnum.Initializing, text: swStatus.text };
    case SwStatusEnum.UsingHttp:
    case SwStatusEnum.UsingMemory:
      return { type: OIerDbClientStatusEnum.InitializedPartially, text: swStatus.text };
    case SwStatusEnum.UsingIdb:
      return { type: OIerDbClientStatusEnum.Initialized, text: swStatus.text };
    default:
      return { type: OIerDbClientStatusEnum.Uninitialized, text: '未知状态' };
  }
};

const handleSwMessage = (event: MessageEvent) => {
  if (!isSwStatusMessage(event.data)) {
    return;
  }

  const { payload } = event.data;

  if (payload.seq <= latestSwStatusSeq) {
    return;
  }

  latestSwStatusSeq = payload.seq;

  console.log('[Client] Received SW status:', payload);

  const clientStatus = mapSwStatusToClientStatus(payload);
  setStatus(clientStatus);
};

export const setupSwStatusListener = () => {
  if (swStatusListenerSetup) return;
  swStatusListenerSetup = true;

  // Listen for messages from Service Worker
  navigator.serviceWorker?.addEventListener('message', handleSwMessage);

  // Query current SW status
  querySwStatus();
};

export const querySwStatus = () => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'getStatus' });
  }
};

export const getSwStatus = (): Promise<SwStatus | null> => {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker?.controller) {
      resolve(null);
      return;
    }

    const handler = (event: MessageEvent) => {
      if (!isSwStatusMessage(event.data) || event.data.type !== 'statusResponse') {
        return;
      }

      const { payload } = event.data;

      navigator.serviceWorker?.removeEventListener('message', handler);
      resolve(payload);
    };

    navigator.serviceWorker.addEventListener('message', handler);
    navigator.serviceWorker.controller.postMessage({ type: 'getStatus' });

    // Timeout after 5 seconds
    setTimeout(() => {
      navigator.serviceWorker?.removeEventListener('message', handler);
      resolve(null);
    }, 5000);
  });
};
