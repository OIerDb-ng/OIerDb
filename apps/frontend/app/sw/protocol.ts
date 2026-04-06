export enum SwAdapterType {
  None = 0,
  Http,
  Memory,
  IDB,
}

export enum SwStatusEnum {
  Uninitialized = 0,
  Initializing,
  UsingHttp,
  UsingMemory,
  UsingIdb,
}

export enum BackgroundTaskType {
  None = 0,
  CheckingBackend,
  FetchingData,
  ParsingData,
  LoadingToMemory,
  SavingToIdb,
  LoadingFromStatic,
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

export interface SwRuntimeStatus {
  status: SwStatusEnum;
  adapterType: SwAdapterType;
  text: string;
  dataVersion: string;
  backgroundTask: BackgroundTask;
  isOffline: boolean;
  failureReason: InitFailureReason;
  seq: number;
}

export interface SwStatusChangeMessage {
  type: 'statusChange';
  payload: SwRuntimeStatus;
}

export interface SwStatusResponseMessage {
  type: 'statusResponse';
  payload: SwRuntimeStatus;
}

export interface SwGetStatusMessage {
  type: 'getStatus';
}

export type SwInboundMessage = SwGetStatusMessage;
export type SwOutboundMessage = SwStatusChangeMessage | SwStatusResponseMessage;
export type SwMessage = SwInboundMessage | SwOutboundMessage;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isGetStatusMessage = (value: unknown): value is SwGetStatusMessage => {
  if (!isRecord(value)) return false;
  return value.type === 'getStatus';
};

export const isSwRuntimeStatus = (value: unknown): value is SwRuntimeStatus => {
  if (!isRecord(value)) return false;

  if (typeof value.status !== 'number') return false;
  if (typeof value.adapterType !== 'number') return false;
  if (typeof value.text !== 'string') return false;
  if (typeof value.dataVersion !== 'string') return false;
  if (typeof value.isOffline !== 'boolean') return false;
  if (typeof value.failureReason !== 'number') return false;
  if (typeof value.seq !== 'number') return false;

  const task = value.backgroundTask;
  if (!isRecord(task)) return false;
  if (typeof task.type !== 'number') return false;
  if (typeof task.status !== 'number') return false;

  return true;
};

export const isSwStatusMessage = (
  value: unknown,
): value is SwStatusChangeMessage | SwStatusResponseMessage => {
  if (!isRecord(value)) return false;

  if (value.type !== 'statusChange' && value.type !== 'statusResponse') {
    return false;
  }

  return isSwRuntimeStatus(value.payload);
};
