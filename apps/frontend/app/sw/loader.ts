/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { parseOIerDbData } from '@oierdb/parser';

import { staticDataVersionUrl } from '../libs/client/constant';
import { getResultUrl, getStaticUrl } from '../libs/client/util';
import { getIdbAdapter, getMemoryAdapter, setCurrentAdapter, useAdapter } from './adapters';
import {
  BackgroundTaskType,
  completeBackgroundTask,
  failBackgroundTask,
  setStatus,
  startBackgroundTask,
  SwAdapterType,
  SwStatus,
} from './status';

// ==============================
// Data Fetching
// ==============================

export async function fetchAndParseData(targetVersion: string) {
  console.time('[SW] Data fetch time');
  const [staticResponse, resultResponse] = await Promise.all([
    fetch(getStaticUrl(targetVersion)),
    fetch(getResultUrl(targetVersion)),
  ]);

  if (!staticResponse.ok || !resultResponse.ok) {
    throw new Error('Failed to fetch static data');
  }

  const [staticText, resultText] = await Promise.all([
    staticResponse.text(),
    resultResponse.text(),
  ]);
  console.timeEnd('[SW] Data fetch time');

  console.time('[SW] Data parse time');
  const parsedData = parseOIerDbData(resultText, staticText);
  console.log('[SW] Parsed data version:', parsedData.data_version);
  console.timeEnd('[SW] Data parse time');

  return parsedData;
}

// ==============================
// Data Loading Strategies
// ==============================

export async function loadDataInBackground(targetVersion: string) {
  const memoryAdapter = getMemoryAdapter();
  const idbAdapter = getIdbAdapter();

  if (!memoryAdapter || !idbAdapter) {
    throw new Error('Adapters not initialized');
  }

  try {
    // 拉取数据
    startBackgroundTask(BackgroundTaskType.FetchingData);
    const parsedData = await fetchAndParseData(targetVersion);
    completeBackgroundTask();

    // 加载到内存适配器
    startBackgroundTask(BackgroundTaskType.LoadingToMemory);
    await memoryAdapter.loadData(parsedData);

    // 切换到内存适配器
    setCurrentAdapter(memoryAdapter);
    setStatus({
      status: SwStatus.UsingMemory,
      adapterType: SwAdapterType.Memory,
      dataVersion: targetVersion,
    });
    completeBackgroundTask();

    // 保存到 IndexedDB
    startBackgroundTask(BackgroundTaskType.SavingToIdb);
    console.time('[SW] IDB save time');
    await idbAdapter.loadData(parsedData);
    console.timeEnd('[SW] IDB save time');

    // 切换到 IDB 适配器
    setCurrentAdapter(idbAdapter);
    setStatus({
      status: SwStatus.UsingIdb,
      adapterType: SwAdapterType.IDB,
      dataVersion: targetVersion,
    });
    completeBackgroundTask();
  } catch (error) {
    console.error('[SW] Failed to load data in background:', error);
    failBackgroundTask(BackgroundTaskType.FetchingData);
    // 保持使用当前适配器
  }
}

export async function loadDataFromStaticSource(targetVersion: string) {
  const memoryAdapter = getMemoryAdapter();
  const idbAdapter = getIdbAdapter();

  if (!memoryAdapter || !idbAdapter) {
    throw new Error('Adapters not initialized');
  }

  // 拉取数据
  startBackgroundTask(BackgroundTaskType.LoadingFromStatic);
  const parsedData = await fetchAndParseData(targetVersion);
  completeBackgroundTask();

  // 加载到内存
  startBackgroundTask(BackgroundTaskType.LoadingToMemory);
  await memoryAdapter.loadData(parsedData);
  setCurrentAdapter(memoryAdapter);
  setStatus({
    status: SwStatus.UsingMemory,
    adapterType: SwAdapterType.Memory,
    dataVersion: targetVersion,
  });
  completeBackgroundTask();

  // 保存到 IndexedDB
  startBackgroundTask(BackgroundTaskType.SavingToIdb);
  await idbAdapter.loadData(parsedData);

  // 切换到 IDB
  setCurrentAdapter(idbAdapter);
  setStatus({
    status: SwStatus.UsingIdb,
    adapterType: SwAdapterType.IDB,
    dataVersion: targetVersion,
  });
  completeBackgroundTask();
}

export async function fetchStaticDataVersion() {
  const response = await fetch(staticDataVersionUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch static data version: ${response.status}`);
  }

  const data = await response.json();
  return data.data_version;
}

export async function tryUseIdbCache(version: string): Promise<boolean> {
  const idbAdapter = getIdbAdapter();
  if (!idbAdapter) return false;

  try {
    const available = await idbAdapter.checkAvailability(version);
    if (available) {
      useAdapter(SwAdapterType.IDB);
      setStatus({
        status: SwStatus.UsingIdb,
        adapterType: SwAdapterType.IDB,
        dataVersion: version,
        isOffline: true,
      });
      completeBackgroundTask();
      return true;
    }
  } catch (error) {
    console.warn('[SW] IDB check failed:', error);
  }

  return false;
}
