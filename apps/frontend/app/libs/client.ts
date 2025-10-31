import { HttpAdapter } from '@oierdb/adapter-http';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { OIerDbClient } from '@oierdb/core';

export enum OIerDbClientStatusEnum {
  Uninitialized = 0,
  Initializing,
  InitializedPartially, // using adapter which is not has full functionality
  Initialized, // using a fully functional adapter (adapter-idb)
}

interface OIerDbClientStatusType {
  type: OIerDbClientStatusEnum;
  text: string;
}

declare global {
  var OIerDbClientInstance: OIerDbClient | null;
  var OIerDbClientStatus: OIerDbClientStatusType;
  var OIerDbClientStatusText: string;
}

globalThis.OIerDbClientInstance = null;
globalThis.OIerDbClientStatus = {
  type: OIerDbClientStatusEnum.Uninitialized,
  text: '未初始化',
};

// Status change listeners
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

const setStatus = (newStatus: OIerDbClientStatusType) => {
  globalThis.OIerDbClientStatus = newStatus;
  notifyStatusChange(newStatus);
};

/**
 * Initialize the OIerDbClient with both HTTP and IndexedDB adapters.
 * This function sets up the global OIerDbClientInstance.
 *
 * Steps:
 */
const initClientAsync = async () => {
  const httpAdapter = new HttpAdapter({
    baseUrl: 'https://oier.api.baoshuo.dev',
  });
  const idbAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

  setTimeout(() => {
    setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据库适配器...' });
  }, 1000);

  // TODO
};

export const initClient = () => {
  // First set status to Initializing
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '加载中...' });

  // Then start async initialization, but don't wait for it
  initClientAsync();
};

export const getClient = () => {
  if (!globalThis.OIerDbClientInstance) {
    throw new Error(
      'OIerDbClient is not initialized yet. Please call initClient() first and wait for initialization to complete.',
    );
  }

  return globalThis.OIerDbClientInstance;
};
