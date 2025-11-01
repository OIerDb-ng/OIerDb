import { HttpAdapter } from '@oierdb/adapter-http';
import { IDBAdapter } from '@oierdb/adapter-idb';

import { OIerDbClientStatusEnum, setStatus } from './status';

/**
 * Initialize the OIerDbClient with both HTTP and IndexedDB adapters.
 * This function sets up the global OIerDbClientInstance.
 *
 * Steps:
 * - (Before calling this function) Set status to Initializing.
 * - Create an instance of HttpAdapter pointing to the remote OIer API.
 * - Create an instance of IDBAdapter using the browser's IndexedDB.
 * - Check the backend availability. (health check can be done via getVersion API, use error handling to determine unavailability)
 *   If backend is available:
 *   - Get the latest version from the backend.
 *     If the local IndexedDB version is outdated:
 *     - Set status to InitializedPartially, and use HttpAdapter to create OIerDbClient first.
 *     - Load data in the background to update IndexedDB.
 *     - Once data is loaded, switch client's adapter to IDBAdapter and set status to Initialized.
 *     If the local IndexedDB version is up-to-date:
 *     - Set status to Initialized and use IDBAdapter directly to create OIerDbClient.
 *   If backend is not available:
 *   - Get the latest version from static data source.
 *     If the local IndexedDB version is outdated:
 *     - Load data from static source into IndexedDB.
 *     - Set status to Initialized once done. (No InitializedPartially state here since no backend is available.)
 *     - Use IDBAdapter to create OIerDbClient.
 *     If the local IndexedDB version is up-to-date:
 *     - Set status to Initialized and use IDBAdapter directly to create OIerDbClient.
 *     If cannot load data from static source:
 *     - Set status to Uninitialized and throw an error.
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
