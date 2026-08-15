import type { AdapterOperation, AdapterType } from './query';

export interface AdapterFailure {
  adapterType: AdapterType;
  error: unknown;
}

export class InvalidQueryError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

export class AdapterFeatureUnsupportedError extends Error {
  constructor(
    public readonly operation: AdapterOperation,
    public readonly adapterTypes: readonly AdapterType[] = [],
    public readonly cause?: unknown
  ) {
    super(
      adapterTypes.length > 0
        ? `No candidate adapter supports "${operation}" (${adapterTypes.join(', ')})`
        : `Adapter does not support "${operation}"`
    );
    this.name = 'AdapterFeatureUnsupportedError';
  }
}

export class AdapterNotReadyError extends Error {
  constructor(
    message = 'Adapter is not ready',
    public readonly adapterType?: AdapterType
  ) {
    super(message);
    this.name = 'AdapterNotReadyError';
  }
}

export class AdapterUnavailableError extends Error {
  constructor(
    message = 'Adapter is unavailable',
    public readonly adapterType?: AdapterType,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AdapterUnavailableError';
  }
}

export class AllAdaptersFailedError extends Error {
  constructor(
    public readonly operation: AdapterOperation,
    public readonly failures: readonly AdapterFailure[]
  ) {
    super(
      failures.length === 0
        ? `No enabled adapter is available for "${operation}"`
        : `All candidate adapters failed for "${operation}"`
    );
    this.name = 'AllAdaptersFailedError';
  }
}

export class StaleAdapterRegistryError extends Error {
  constructor(
    public readonly startedRevision: number,
    public readonly currentRevision: number
  ) {
    super('Adapter registry changed while the request was in flight');
    this.name = 'StaleAdapterRegistryError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
