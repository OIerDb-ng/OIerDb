// ==============================
// Shared Metadata Keys
// ==============================

export const META_KEY_DATA_VERSION = 'data_version';
export const META_KEY_LOADING_PROGRESS = 'loading_progress';

// ==============================
// Shared Utilities
// ==============================

/**
 * 规范化分页参数
 * @param page 页码，默认为 1
 * @param perPage 每页数量，默认为 20
 * @returns 规范化后的分页参数 { page, perPage }
 */
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
