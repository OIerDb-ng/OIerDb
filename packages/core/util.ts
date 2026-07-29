export function normalizePositiveInteger(value: number | null | undefined, fallback: number, max?: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  const normalized = Math.max(1, Math.trunc(value));
  return max === undefined ? normalized : Math.min(max, normalized);
}
