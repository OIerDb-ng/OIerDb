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
