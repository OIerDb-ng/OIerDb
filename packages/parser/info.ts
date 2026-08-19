import type { DataInfo } from './types';

export function parseInfo(json: string): DataInfo {
  return JSON.parse(json);
}
