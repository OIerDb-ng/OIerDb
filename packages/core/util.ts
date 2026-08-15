export function normalizePositiveInteger(value: number | null | undefined, fallback: number, max?: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  const normalized = Math.max(1, Math.trunc(value));
  return max === undefined ? normalized : Math.min(max, normalized);
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  }
}

export function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const child of Object.values(value)) deepFreeze(child);
  }
  Object.freeze(value);
}
