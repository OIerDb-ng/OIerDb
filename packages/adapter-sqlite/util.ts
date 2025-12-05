export function normalizePaginationParams(
  page?: number | null,
  perPage?: number | null,
): {
  page: number;
  perPage: number;
} {
  const normalizedPage = Math.max(1, page || 1);
  const normalizedPerPage = Math.min(100, Math.max(1, perPage || 20));

  return {
    page: normalizedPage,
    perPage: normalizedPerPage,
  };
}
