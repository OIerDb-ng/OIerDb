import { HttpAdapter } from '@oierdb/adapter-http';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { OIerDbClient } from '@oierdb/core';
import { parseOIerDbData } from '@oierdb/parser';

import { backendEndpoint, staticDataVersionUrl } from './constant';
import { OIerDbClientStatusEnum, setStatus } from './status';
import { getResultUrl, getStaticUrl } from './util';

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
    baseUrl: backendEndpoint,
  });
  const idbAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据库适配器' });

  let backendAvailable = false;
  let backendVersion = '';

  // Check backend availability
  try {
    setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '检查后端服务可用性' });
    const versionResponse = await httpAdapter.getVersion();
    backendVersion = versionResponse.data_version;
    backendAvailable = true;
  } catch (error) {
    console.warn('Backend is not available:', error);
    backendAvailable = false;
  }

  console.log('BackendAvailable:', backendAvailable, 'Version:', backendVersion);

  // Get local IndexedDB version
  let localVersion = '';
  try {
    const localVersionResponse = await idbAdapter.getVersion();
    localVersion = localVersionResponse.data_version;
  } catch (error) {
    console.warn('Failed to get local version:', error);
  }

  console.log('Local IndexedDB version:', localVersion);

  if (backendAvailable) {
    // Backend is available
    if (localVersion && localVersion === backendVersion) {
      // Local version is up-to-date, use IDB adapter directly
      setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '使用本地数据库' });
      globalThis.OIerDbClientInstance = new OIerDbClient(idbAdapter);
      setStatus({ type: OIerDbClientStatusEnum.Initialized, text: '' });
    } else {
      // Local version is outdated, use HTTP adapter first
      setStatus({
        type: OIerDbClientStatusEnum.InitializedPartially,
        text: '使用在线数据服务 [后台: 更新本地数据库]',
      });
      globalThis.OIerDbClientInstance = new OIerDbClient(httpAdapter);

      // Load data in background
      loadDataInBackground(idbAdapter, backendVersion);
    }
  } else {
    // Backend is not available, use static data source
    // Get the latest version from static data source
    let staticVersion = '';
    try {
      setStatus({
        type: OIerDbClientStatusEnum.Initializing,
        text: '检查静态数据版本 [后端: 不可用]',
      });
      const versionResponse = await fetch(staticDataVersionUrl);
      const versionData = await versionResponse.json();
      staticVersion = versionData.data_version;
    } catch (error) {
      console.warn('Failed to get static data version:', error);
    }

    console.log('Static data version:', staticVersion);

    if (localVersion && localVersion === staticVersion) {
      // Local version is up-to-date with static data
      setStatus({
        type: OIerDbClientStatusEnum.Initializing,
        text: '使用本地数据库',
      });
      globalThis.OIerDbClientInstance = new OIerDbClient(idbAdapter);
      setStatus({ type: OIerDbClientStatusEnum.Initialized, text: '' });
    } else if (localVersion && !staticVersion) {
      // Cannot get static version, but have local data - use it anyway
      setStatus({
        type: OIerDbClientStatusEnum.Initializing,
        text: '使用本地数据库',
      });
      globalThis.OIerDbClientInstance = new OIerDbClient(idbAdapter);
      setStatus({ type: OIerDbClientStatusEnum.Initialized, text: '离线模式' });
    } else {
      // Local version is outdated or doesn't exist, need to load from static source
      try {
        setStatus({
          type: OIerDbClientStatusEnum.Initializing,
          text: '加载数据',
        });
        await loadDataFromStaticSource(idbAdapter, staticVersion);
      } catch (error) {
        console.error('Failed to load data from static source:', error);
        setStatus({ type: OIerDbClientStatusEnum.Uninitialized, text: '加载失败' });
        throw new Error('Cannot initialize OIerDbClient: backend unavailable and no local data');
      }
    }
  }
};

const fetchAndParseData = async (targetVersion: string) => {
  // Fetch static.json and result.txt
  console.time('Data fetch time');
  const [staticResponse, resultResponse] = await Promise.all([
    fetch(getStaticUrl(targetVersion)),
    fetch(getResultUrl(targetVersion)),
  ]);
  if (!staticResponse.ok || !resultResponse.ok) {
    throw new Error('Failed to fetch data');
  }
  const [staticText, resultText] = await Promise.all([
    staticResponse.text(),
    resultResponse.text(),
  ]);
  console.timeEnd('Data fetch time');

  // Parse data
  console.time('Data parse time');
  const parsedData = parseOIerDbData(resultText, staticText);
  console.log('Parsed data version:', parsedData.data_version);
  console.timeEnd('Data parse time');

  return parsedData;
};

const loadDataToIndexedDB = async (
  idbAdapter: IDBAdapter,
  targetVersion: string,
  isBackground: boolean,
) => {
  const statusType = isBackground
    ? OIerDbClientStatusEnum.InitializedPartially
    : OIerDbClientStatusEnum.Initializing;

  // Fetch and parse data
  setStatus({
    type: statusType,
    text: isBackground ? '使用在线数据服务 [后台: 拉取并解析数据]' : '拉取并解析数据',
  });
  const parsedData = await fetchAndParseData(targetVersion);

  // Save to IndexedDB
  setStatus({
    type: statusType,
    text: isBackground ? '使用在线数据服务 [后台: 保存到本地数据库]' : '保存到本地数据库',
  });
  console.time('Data save time');
  await idbAdapter.loadData(parsedData);
  console.timeEnd('Data save time');
};

const loadDataInBackground = async (idbAdapter: IDBAdapter, targetVersion: string) => {
  try {
    await loadDataToIndexedDB(idbAdapter, targetVersion, true);

    // Switch to IDB adapter
    globalThis.OIerDbClientInstance!.setAdapter(idbAdapter);
    setStatus({ type: OIerDbClientStatusEnum.Initialized, text: '' });
  } catch (error) {
    console.error('Failed to load data in background:', error);
    // Keep using HTTP adapter
  }
};

const loadDataFromStaticSource = async (idbAdapter: IDBAdapter, targetVersion: string) => {
  await loadDataToIndexedDB(idbAdapter, targetVersion, false);

  globalThis.OIerDbClientInstance = new OIerDbClient(idbAdapter);
  setStatus({ type: OIerDbClientStatusEnum.Initialized, text: '' });
};

export const initClient = () => {
  // First set status to Initializing
  setStatus({ type: OIerDbClientStatusEnum.Initializing, text: '初始化数据查询模块' });

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
