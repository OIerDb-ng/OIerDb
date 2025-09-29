import 'fake-indexeddb/auto';

declare global {
  var indexedDB: IDBFactory;
  var IDBKeyRange: typeof IDBKeyRange;
}

// Polyfill structuredClone for Node.js test environment
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Mock console methods for cleaner test output
global.console = {
  ...console,
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
};
