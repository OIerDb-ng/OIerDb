/// <reference types="vite/client" />

import type { OIerDbData } from './libs/OIerDb';

declare global {
  const OIerDb: OIerDbData;

  interface Window {
    appVersion: string;
    OIerDb: OIerDbData;
  }
}

export {};
