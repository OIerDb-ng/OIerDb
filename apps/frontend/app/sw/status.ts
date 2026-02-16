/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// ==============================
// Status Types
// ==============================

export enum SwAdapterType {
  None = 0,
  Http,
  Memory,
  IDB,
}

export enum SwStatus {
  Uninitialized = 0,
  Initializing,
  UsingHttp, // Using HttpAdapter (Requesting backend directly)
  UsingMemory, // Using MemoryAdapter (Data parsed, not yet saved to IndexedDB)
  UsingIdb, // Using IDBAdapter (Fully cached)
}

export enum BackgroundTaskType {
  None = 0,
  CheckingBackend, // 检查后端服务可用性
  FetchingData, // 拉取数据
  ParsingData, // 解析数据
  LoadingToMemory, // 加载到内存
  SavingToIdb, // 保存到 IndexedDB
  LoadingFromStatic, // 从静态源加载
}

export enum BackgroundTaskStatus {
  Idle = 0,
  Running,
  Completed,
  Failed,
}

export interface BackgroundTask {
  type: BackgroundTaskType;
  status: BackgroundTaskStatus;
}

export enum InitFailureReason {
  None = 0,
  BackendUnavailable,
  StaticFetchFailed,
  DataParseFailed,
  IdbSaveFailed,
  Unknown,
}

interface Status {
  status: SwStatus;
  adapterType: SwAdapterType;
  dataVersion: string;
  backgroundTask: BackgroundTask;
  isOffline: boolean;
  failureReason: InitFailureReason;
}

// ==============================
// State
// ==============================

let currentStatus: Status = {
  status: SwStatus.Uninitialized,
  adapterType: SwAdapterType.None,
  dataVersion: '',
  backgroundTask: {
    type: BackgroundTaskType.None,
    status: BackgroundTaskStatus.Idle,
  },
  isOffline: false,
  failureReason: InitFailureReason.None,
};

// ==============================
// Status Management
// ==============================

export function getStatus() {
  return currentStatus;
}

export function setStatus(status: Partial<Status>) {
  currentStatus = { ...currentStatus, ...status };
  console.log('[SW] Status changed:', currentStatus);
  broadcastStatus();
}

export function setBackgroundTask(type: BackgroundTaskType, status: BackgroundTaskStatus) {
  setStatus({ backgroundTask: { type, status } });
}

export function startBackgroundTask(type: BackgroundTaskType) {
  setBackgroundTask(type, BackgroundTaskStatus.Running);
}

export function completeBackgroundTask() {
  setBackgroundTask(BackgroundTaskType.None, BackgroundTaskStatus.Idle);
}

export function failBackgroundTask(type: BackgroundTaskType) {
  setBackgroundTask(type, BackgroundTaskStatus.Failed);
}

export async function broadcastStatus() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({
      type: 'statusChange',
      payload: currentStatus,
    });
  });
}

export function handleStatusRequest(event: ExtendableMessageEvent) {
  event.source?.postMessage({
    type: 'statusResponse',
    payload: currentStatus,
  });
}
