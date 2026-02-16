/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { HttpAdapter } from '@oierdb/adapter-http';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { MemoryAdapter } from '@oierdb/adapter-memory';
import type { IAdapter } from '@oierdb/core';

import { SwAdapterType } from '~/sw/status';
import { backendEndpoint } from '../libs/client/constant';

// ==============================
// Adapter Instances
// ==============================

let httpAdapter: HttpAdapter | null = null;
let memoryAdapter: MemoryAdapter | null = null;
let idbAdapter: IDBAdapter | null = null;
let currentAdapter: IAdapter | null = null;

// ==============================
// Adapter Accessors
// ==============================

export const getHttpAdapter = () => httpAdapter;
export const getMemoryAdapter = () => memoryAdapter;
export const getIdbAdapter = () => idbAdapter;
export const getCurrentAdapter = () => currentAdapter;
export const setCurrentAdapter = (adapter: IAdapter | null) => {
  currentAdapter = adapter;
};

// ==============================
// Adapter Initialization
// ==============================

export function createAdapters() {
  httpAdapter = new HttpAdapter({ baseUrl: backendEndpoint });
  memoryAdapter = new MemoryAdapter();
  idbAdapter = new IDBAdapter(indexedDB, IDBKeyRange);
}

export async function checkBackend(): Promise<[available: boolean, version: string]> {
  if (!httpAdapter) {
    return [false, ''];
  }

  try {
    const versionResponse = await httpAdapter.getVersion();
    return [true, versionResponse.data_version];
  } catch (error) {
    console.warn('[SW] Backend not available:', error);
    return [false, ''];
  }
}

export async function checkIdb(version: string): Promise<boolean> {
  if (!idbAdapter || !version) {
    return false;
  }

  try {
    return await idbAdapter.checkAvailability(version);
  } catch (error) {
    console.warn('[SW] IDB check failed:', error);
    return false;
  }
}

export function useAdapter(type: SwAdapterType): IAdapter | null {
  switch (type) {
    case SwAdapterType.Http:
      currentAdapter = httpAdapter;
      break;

    case SwAdapterType.Memory:
      currentAdapter = memoryAdapter;
      break;

    case SwAdapterType.IDB:
      currentAdapter = idbAdapter;
      break;

    case SwAdapterType.None:
    default:
      currentAdapter = null;
      break;
  }

  return currentAdapter;
}
