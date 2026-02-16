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

// SW Status types (mirrored from sw.ts)
export enum SwStatusEnum {
  Uninitialized = 0,
  Initializing,
  UsingHttp,
  UsingMemory,
  UsingIdb,
}

export interface SwStatus {
  status: SwStatusEnum;
  adapterType: string;
  text: string;
  dataVersion: string;
}

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
  const { type, payload } = event.data || {};

  if (type === 'statusChange' || type === 'statusResponse') {
    const swStatus = payload as SwStatus;
    console.log('[Client] Received SW status:', swStatus);

    const clientStatus = mapSwStatusToClientStatus(swStatus);
    setStatus(clientStatus);
  }
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
      const { type, payload } = event.data || {};
      if (type === 'statusResponse') {
        navigator.serviceWorker?.removeEventListener('message', handler);
        resolve(payload as SwStatus);
      }
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
