/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import {
  BackgroundTaskStatus,
  BackgroundTaskType,
  InitFailureReason,
  SwAdapterType,
  SwStatusEnum,
  type SwRuntimeStatus,
} from './protocol';

// ==============================
// State
// ==============================

let currentStatus: SwRuntimeStatus = {
  status: SwStatusEnum.Uninitialized,
  adapterType: SwAdapterType.None,
  text: '未初始化',
  dataVersion: '',
  backgroundTask: {
    type: BackgroundTaskType.None,
    status: BackgroundTaskStatus.Idle,
  },
  isOffline: false,
  failureReason: InitFailureReason.None,
  seq: 0,
};

const copyStatus = (status: SwRuntimeStatus): SwRuntimeStatus => ({
  ...status,
  backgroundTask: { ...status.backgroundTask },
});

const isSameStatus = (a: SwRuntimeStatus, b: SwRuntimeStatus): boolean => {
  return (
    a.status === b.status &&
    a.adapterType === b.adapterType &&
    a.text === b.text &&
    a.dataVersion === b.dataVersion &&
    a.backgroundTask.type === b.backgroundTask.type &&
    a.backgroundTask.status === b.backgroundTask.status &&
    a.isOffline === b.isOffline &&
    a.failureReason === b.failureReason
  );
};

// ==============================
// Status Management
// ==============================

export function getStatus() {
  return copyStatus(currentStatus);
}

export function setStatus(status: Partial<SwRuntimeStatus>) {
  const nextStatus = { ...currentStatus, ...status } as SwRuntimeStatus;

  if (isSameStatus(nextStatus, currentStatus)) {
    return;
  }

  currentStatus = {
    ...nextStatus,
    seq: currentStatus.seq + 1,
  };

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
  const payload = copyStatus(currentStatus);
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({
      type: 'statusChange',
      payload,
    });
  });
}

export function handleStatusRequest(event: ExtendableMessageEvent) {
  const payload = copyStatus(currentStatus);
  event.source?.postMessage({
    type: 'statusResponse',
    payload,
  });
}
