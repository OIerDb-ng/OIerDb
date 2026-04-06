/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { parseOIerDbData } from '@oierdb/parser';

import { staticDataVersionUrl } from '../libs/client/constant';
import { getResultUrl, getStaticUrl } from '../libs/client/util';
import { getIdbAdapter, getMemoryAdapter, setCurrentAdapter, useAdapter } from './adapters';
import { BackgroundTaskType, SwAdapterType, SwStatusEnum as SwStatus } from './protocol';
import {
  completeBackgroundTask,
  failBackgroundTask,
  setStatus,
  startBackgroundTask,
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

async function loadParsedDataToAdapters(
  parsedData: ReturnType<typeof parseOIerDbData>,
  targetVersion: string,
) {
  const memoryAdapter = getMemoryAdapter();
  const idbAdapter = getIdbAdapter();

  if (!memoryAdapter || !idbAdapter) {
    throw new Error('Adapters not initialized');
  }

  // 加载到内存适配器
  startBackgroundTask(BackgroundTaskType.LoadingToMemory);
  try {
    await memoryAdapter.loadData(parsedData);
  } catch (error) {
    failBackgroundTask(BackgroundTaskType.LoadingToMemory);
    throw error;
  }
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
  try {
    await idbAdapter.loadData(parsedData);
  } catch (error) {
    console.timeEnd('[SW] IDB save time');
    failBackgroundTask(BackgroundTaskType.SavingToIdb);
    throw error;
  }
  console.timeEnd('[SW] IDB save time');
  setCurrentAdapter(idbAdapter);
  setStatus({
    status: SwStatus.UsingIdb,
    adapterType: SwAdapterType.IDB,
    dataVersion: targetVersion,
  });
  completeBackgroundTask();
}

export async function loadDataInBackground(targetVersion: string) {
  try {
    startBackgroundTask(BackgroundTaskType.FetchingData);
    const parsedData = await fetchAndParseData(targetVersion);
    completeBackgroundTask();

    await loadParsedDataToAdapters(parsedData, targetVersion);
  } catch (error) {
    console.error('[SW] Failed to load data in background:', error);
    // failBackgroundTask 已由失败的具体步骤调用，保持使用当前适配器
  }
}

export async function loadDataFromStaticSource(targetVersion: string) {
  let fetchPhaseComplete = false;
  try {
    startBackgroundTask(BackgroundTaskType.LoadingFromStatic);
    const parsedData = await fetchAndParseData(targetVersion);
    completeBackgroundTask();
    fetchPhaseComplete = true;

    await loadParsedDataToAdapters(parsedData, targetVersion);
  } catch (error) {
    console.error('[SW] Failed to load data from static source:', error);
    if (!fetchPhaseComplete) {
      failBackgroundTask(BackgroundTaskType.LoadingFromStatic);
    }
    // 重新抛出，由 sw.ts 的外层 catch 设置 Uninitialized 状态
    throw error;
  }
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
