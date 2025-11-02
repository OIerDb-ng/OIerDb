import type { OIerDbClientOptions } from '@oierdb/core';

export const oierdbClientOptions: OIerDbClientOptions = {
  cache: {
    enabled: false,
  },
};

// API endpoints
export const backendEndpoint = !import.meta.env.DEV
  ? 'https://oier.api.baoshuo.dev'
  : 'http://localhost:32002';
export const staticEndpoint = !import.meta.env.DEV
  ? 'https://oier.cdn.baoshuo.xyz'
  : 'http://localhost:32001';

// Static data URLs
export const staticDataVersionUrl = `${staticEndpoint}/version.json`;
export const resultDataUrl = `${staticEndpoint}/result.txt`;
export const staticDataUrl = `${staticEndpoint}/static.json`;
