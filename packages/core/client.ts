import QuickLRU from 'quick-lru';

import {
  isAbortError,
  AdapterFeatureUnsupportedError, AllAdaptersFailedError,
  InvalidQueryError, StaleAdapterRegistryError, type AdapterFailure,
} from './errors';
import type {
  AdapterOperation, AdapterOperationResults, AdapterType,
  IAdapter, IAdapterOperations, PageParams, RequestOptions,
  StatusResult, SummaryResult,
  GetContestResult, GetOIerResult, GetSchoolResult,
  ListContestsQuery, ListContestsResult,
  ListOIersQuery, ListOIersResult, ListSchoolsQuery, ListSchoolsResult,
  SearchContestsQuery, SearchContestsResult, SearchOIersQuery, SearchOIersResult,
  SearchSchoolsQuery, SearchSchoolsResult,
} from './query';
import { normalizePageParams } from './query';
import { deepFreeze, throwIfAborted } from './util';

type CachedResponse = AdapterOperationResults[AdapterOperation];

interface InternalRegistration {
  readonly adapter: IAdapter;
  readonly type: AdapterType;
  priority: number;
  enabled: boolean;
  readonly registrationOrder: number;
  readonly token: number;
}

export interface AdapterRegistrationOptions {
  /** 数字越大越优先；默认 0。 */
  priority?: number;
  /** 是否参与 dispatch；默认 true。 */
  enabled?: boolean;
}

export interface RegisteredAdapter {
  readonly adapter: IAdapter;
  readonly type: AdapterType;
  readonly priority: number;
  readonly enabled: boolean;
  readonly registrationOrder: number;
}

export type OIerDbClientOperations = IAdapterOperations;

export interface OIerDbClientDiagnostics {
  status(type: AdapterType): Promise<StatusResult>;
}

export interface OIerDbAdapterRegistry {
  registerAdapter(adapter: IAdapter, options?: AdapterRegistrationOptions): () => void;
  unregisterAdapter(type: AdapterType): boolean;
  updateAdapterRegistration(type: AdapterType, patch: AdapterRegistrationOptions): boolean;
  getRegisteredAdapters(): readonly RegisteredAdapter[];
  invalidateAdapter(type?: AdapterType): void;
}

export interface OIerDbClientCacheControls {
  clearCache(): void;
  setCacheEnabled(enabled: boolean): void;
  isCacheEnabled(): boolean;
}

export interface AdapterErrorEvent {
  operation: AdapterOperation;
  adapterType: AdapterType;
  error: unknown;
}

export interface AdapterFallbackEvent {
  operation: AdapterOperation;
  fromType: AdapterType;
  toType: AdapterType;
  error: unknown;
}

export interface OIerDbClientOptions {
  adapters?: ReadonlyArray<{ adapter: IAdapter; options?: AdapterRegistrationOptions }>;
  cache?: {
    enabled?: boolean;
    maxSize?: number;
  };
  onAdapterError?: (event: AdapterErrorEvent) => void;
  onFallback?: (event: AdapterFallbackEvent) => void;
}

const UNKNOWN_VERSION = '';
const KEY_SEPARATOR = '\u0001';
const DEFAULT_MAX_SIZE = 2000;

export class OIerDbClient
implements OIerDbAdapterRegistry, OIerDbClientCacheControls, OIerDbClientOperations, OIerDbClientDiagnostics {
  private readonly registrations = new Map<AdapterType, InternalRegistration>();
  private readonly cache: QuickLRU<string, CachedResponse>;
  private readonly versionByType = new Map<AdapterType, string>();
  private readonly onAdapterError: OIerDbClientOptions['onAdapterError'];
  private readonly onFallback: OIerDbClientOptions['onFallback'];
  private cacheEnabled: boolean;
  private registrationSequence = 0;
  private tokenSequence = 0;
  private registryRevision = 0;

  constructor(options: OIerDbClientOptions = {}) {
    const cacheOptions = options.cache ?? {};
    this.cacheEnabled = cacheOptions.enabled ?? true;
    this.cache = new QuickLRU<string, CachedResponse>({
      maxSize: Math.max(1, cacheOptions.maxSize ?? DEFAULT_MAX_SIZE),
    });
    this.onAdapterError = options.onAdapterError;
    this.onFallback = options.onFallback;

    for (const entry of options.adapters ?? []) {
      this.registerAdapter(entry.adapter, entry.options);
    }
  }

  registerAdapter(adapter: IAdapter, options: AdapterRegistrationOptions = {}): () => void {
    const type = adapter.type;
    if (this.registrations.has(type)) {
      throw new Error(`Adapter of type "${type}" is already registered`);
    }

    const token = ++this.tokenSequence;
    this.registrations.set(type, {
      adapter,
      type,
      priority: options.priority ?? 0,
      enabled: options.enabled ?? true,
      registrationOrder: this.registrationSequence++,
      token,
    });
    this.bumpRegistryRevision();

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const current = this.registrations.get(type);
      if (!current || current.token !== token) return;
      this.removeRegistration(type);
    };
  }

  unregisterAdapter(type: AdapterType): boolean {
    if (!this.registrations.has(type)) return false;
    this.removeRegistration(type);
    return true;
  }

  updateAdapterRegistration(type: AdapterType, patch: AdapterRegistrationOptions): boolean {
    const current = this.registrations.get(type);
    if (!current) return false;

    const priority = patch.priority ?? current.priority;
    const enabled = patch.enabled ?? current.enabled;
    if (priority === current.priority && enabled === current.enabled) return true;

    this.registrations.set(type, { ...current, priority, enabled });
    this.bumpRegistryRevision();
    return true;
  }

  getRegisteredAdapters(): readonly RegisteredAdapter[] {
    return this.sortedRegistrations(false).map(registration => ({
      adapter: registration.adapter,
      type: registration.type,
      priority: registration.priority,
      enabled: registration.enabled,
      registrationOrder: registration.registrationOrder,
    }));
  }

  invalidateAdapter(type?: AdapterType): void {
    if (type === undefined) {
      this.cache.clear();
      this.versionByType.clear();
    } else {
      this.deleteTypeCacheEntries(type);
      this.versionByType.delete(type);
    }
    this.registryRevision += 1;
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) this.clearCache();
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  private async dispatch<O extends AdapterOperation>(
    operation: O,
    invoke: (adapter: IAdapter, signal: AbortSignal | undefined) => Promise<AdapterOperationResults[O]>,
    requestKey?: string,
    signal?: AbortSignal
  ): Promise<AdapterOperationResults[O]> {
    throwIfAborted(signal);
    const startedRevision = this.registryRevision;
    const candidates = this.sortedRegistrations(true);
    const failures: AdapterFailure[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      throwIfAborted(signal);
      this.assertRevision(startedRevision);
      const candidate = candidates[index];
      const { type } = candidate;

      if (requestKey !== undefined) {
        const cached = this.lookupCache(type, operation, requestKey);
        if (cached !== undefined) {
          const stillFresh = await this.verifyCacheFreshness(candidate, signal);
          this.assertRevision(startedRevision);
          if (stillFresh) return cached;
          const refreshed = this.lookupCache(type, operation, requestKey);
          if (refreshed !== undefined) return refreshed;
        }
      }

      try {
        const value = await invoke(candidate.adapter, signal);
        this.assertRevision(startedRevision);

        deepFreeze(value);
        if (requestKey !== undefined) {
          this.storeCache(type, operation, requestKey, value);
        }
        return value;
      } catch (error) {
        this.assertRevision(startedRevision);
        if (error instanceof InvalidQueryError || error instanceof StaleAdapterRegistryError || isAbortError(error)) {
          throw error;
        }

        console.error(`Error occurred while dispatching operation "${operation}" on adapter "${type}":`, error);
        failures.push({ adapterType: type, error });
        this.emitAdapterError(operation, type, error);
        const next = candidates[index + 1];
        if (next) this.emitFallback(operation, type, next.type, error);
      }
    }

    if (failures.length > 0 && failures.every(failure => failure.error instanceof AdapterFeatureUnsupportedError)) {
      throw new AdapterFeatureUnsupportedError(operation, failures.map(failure => failure.adapterType), failures);
    }
    throw new AllAdaptersFailedError(operation, failures);
  }

  async summary(options: RequestOptions = {}): Promise<SummaryResult> {
    return this.dispatch('summary', (adapter, signal) => adapter.summary({ signal }), '', options.signal);
  }

  async getOIer(uid: number, options: RequestOptions = {}): Promise<GetOIerResult | null> {
    return this.dispatch('getOIer', (adapter, signal) => adapter.getOIer(uid, { signal }), String(uid), options.signal);
  }

  async listOIers(query: ListOIersQuery = {}, options: RequestOptions = {}): Promise<ListOIersResult> {
    return this.dispatch('listOIers', (adapter, signal) => adapter.listOIers(query, { signal }), undefined, options.signal);
  }

  async searchOIers(query: SearchOIersQuery, options: RequestOptions = {}): Promise<SearchOIersResult> {
    return this.dispatch('searchOIers', (adapter, signal) => adapter.searchOIers(query, { signal }), undefined, options.signal);
  }

  async getSchool(id: number, pageParams?: PageParams, options: RequestOptions = {}): Promise<GetSchoolResult | null> {
    const { page, perPage } = normalizePageParams(pageParams);
    return this.dispatch('getSchool', (adapter, signal) => adapter.getSchool(id, { page, perPage }, { signal }), `${id}:${page}:${perPage}`, options.signal);
  }

  async listSchools(query: ListSchoolsQuery = {}, options: RequestOptions = {}): Promise<ListSchoolsResult> {
    return this.dispatch('listSchools', (adapter, signal) => adapter.listSchools(query, { signal }), undefined, options.signal);
  }

  async searchSchools(query: SearchSchoolsQuery, options: RequestOptions = {}): Promise<SearchSchoolsResult> {
    return this.dispatch('searchSchools', (adapter, signal) => adapter.searchSchools(query, { signal }), undefined, options.signal);
  }

  async getContest(
    id: number,
    pageParams?: PageParams,
    options: RequestOptions = {}
  ): Promise<GetContestResult | null> {
    const { page, perPage } = normalizePageParams(pageParams);
    return this.dispatch('getContest', (adapter, signal) => adapter.getContest(id, { page, perPage }, { signal }), `${id}:${page}:${perPage}`, options.signal);
  }

  async listContests(query: ListContestsQuery = {}, options: RequestOptions = {}): Promise<ListContestsResult> {
    return this.dispatch('listContests', (adapter, signal) => adapter.listContests(query, { signal }), undefined, options.signal);
  }

  async searchContests(query: SearchContestsQuery, options: RequestOptions = {}): Promise<SearchContestsResult> {
    return this.dispatch('searchContests', (adapter, signal) => adapter.searchContests(query, { signal }), undefined, options.signal);
  }

  async status(type: AdapterType): Promise<StatusResult> {
    const registration = this.registrations.get(type);
    if (!registration) throw new Error(`No adapter of type "${type}" is registered`);
    return registration.adapter.status();
  }

  private sortedRegistrations(onlyEnabled: boolean): InternalRegistration[] {
    return Array.from(this.registrations.values())
      .filter(registration => !onlyEnabled || registration.enabled)
      .sort((a, b) => b.priority - a.priority || a.registrationOrder - b.registrationOrder);
  }

  private removeRegistration(type: AdapterType): void {
    this.registrations.delete(type);
    this.deleteTypeCacheEntries(type);
    this.versionByType.delete(type);
    this.bumpRegistryRevision();
  }

  private deleteTypeCacheEntries(type: AdapterType): void {
    const infix = `${KEY_SEPARATOR}${type}${KEY_SEPARATOR}`;
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(infix)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.cache.delete(key);
  }

  private lookupCache<O extends AdapterOperation>(
    type: AdapterType, operation: O, requestKey: string): AdapterOperationResults[O] | undefined {
    if (!this.cacheEnabled) return undefined;
    const tracked = this.versionByType.get(type) ?? UNKNOWN_VERSION;
    const key = this.buildCacheKey(tracked, type, operation, requestKey);
    return this.cache.get(key) as AdapterOperationResults[O] | undefined;
  }

  private storeCache<O extends AdapterOperation>(
    type: AdapterType, operation: O, requestKey: string, value: AdapterOperationResults[O]) {
    if (!this.cacheEnabled) return;
    const version = value?.version;
    let prefixVersion = this.versionByType.get(type) ?? UNKNOWN_VERSION;
    if (version !== undefined && version !== prefixVersion) {
      this.deleteTypeCacheEntries(type);
      this.versionByType.set(type, version);
      prefixVersion = version;
    }
    this.cache.set(this.buildCacheKey(prefixVersion, type, operation, requestKey), value);
  }

  private async verifyCacheFreshness(candidate: InternalRegistration, signal?: AbortSignal): Promise<boolean> {
    let status: StatusResult;
    try {
      status = await candidate.adapter.status();
    } catch (error) {
      if (isAbortError(error)) throw error;
      console.error('Error occurred while fetching adapter status:', error);
      return true;
    }
    throwIfAborted(signal);
    if (status.version == null) return true;
    if (this.versionByType.get(candidate.type) === status.version) return true;

    this.versionByType.set(candidate.type, status.version);
    this.deleteTypeCacheEntries(candidate.type);
    return false;
  }

  private buildCacheKey(version: string, type: AdapterType, operation: AdapterOperation, requestKey: string) {
    return `${version}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${operation}${KEY_SEPARATOR}${requestKey}`;
  }

  private assertRevision(startedRevision: number): void {
    if (startedRevision !== this.registryRevision) {
      throw new StaleAdapterRegistryError(startedRevision, this.registryRevision);
    }
  }

  private bumpRegistryRevision(): void {
    this.registryRevision += 1;
  }

  private emitAdapterError(operation: AdapterOperation, adapterType: AdapterType, error: unknown) {
    try {
      this.onAdapterError?.({ operation, adapterType, error });
    } catch (error) {
      console.error('Error in onAdapterError callback:', error);
    }
  }

  private emitFallback(operation: AdapterOperation, fromType: AdapterType, toType: AdapterType, error: unknown) {
    try {
      this.onFallback?.({ operation, fromType, toType, error });
    } catch (error) {
      console.error('Error in onFallback callback:', error);
    }
  }
}
