/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { checkBackend, checkIdb, createAdapters, useAdapter } from './sw/adapters';
import { createFallbackHandler } from './sw/fallback';
import * as handlers from './sw/handlers';
import {
  fetchStaticDataVersion,
  loadDataFromStaticSource,
  loadDataInBackground,
  tryUseIdbCache,
} from './sw/loader';
import {
  BackgroundTaskType,
  InitFailureReason,
  isGetStatusMessage,
  SwAdapterType,
  SwStatusEnum as SwStatus,
} from './sw/protocol';
import { Router, type RouteContext } from './sw/router';
import {
  completeBackgroundTask,
  handleStatusRequest,
  setStatus,
  startBackgroundTask,
} from './sw/status';

// ==============================
// Router Setup
// ==============================

const router = new Router()
  // Meta routes
  .register('/api/v1/meta/version', handlers.meta.getVersion)
  // OIer routes
  .register('/api/v1/oier/:uid', handlers.oier.getOIer)
  .register('/api/v1/oier', handlers.oier.listOIers)
  // School routes
  .register('/api/v1/school/:id', handlers.school.getSchool)
  .register('/api/v1/school', handlers.school.listSchools)
  // Contest routes
  .register('/api/v1/contest/:id', handlers.contest.getContest)
  .register('/api/v1/contest', handlers.contest.listContests)
  // Set fallback handler
  .fallback(createFallbackHandler())
  // Unknown routes: pass through
  .notFound(async (ctx: RouteContext) => fetch(ctx.request));

// ==============================
// Initialization
// ==============================

const initializeAdapters = async () => {
  setStatus({ status: SwStatus.Initializing });

  createAdapters();

  // 检查后端可用性
  startBackgroundTask(BackgroundTaskType.CheckingBackend);
  const [backendAvailable, backendVersion] = await checkBackend();
  console.log('[SW] Backend available:', backendAvailable, 'version:', backendVersion);

  // 检查 IndexedDB 可用性
  const idbAvailable = backendVersion ? await checkIdb(backendVersion) : false;
  console.log('[SW] IndexedDB available:', idbAvailable);

  if (idbAvailable && backendVersion) {
    // IndexedDB 已是最新，直接使用
    useAdapter(SwAdapterType.IDB);
    setStatus({
      status: SwStatus.UsingIdb,
      adapterType: SwAdapterType.IDB,
      dataVersion: backendVersion,
    });
    completeBackgroundTask();
    return;
  }

  if (backendAvailable) {
    // 先使用 HTTP 适配器，后台加载数据
    useAdapter(SwAdapterType.Http);
    setStatus({
      status: SwStatus.UsingHttp,
      adapterType: SwAdapterType.Http,
      dataVersion: backendVersion,
    });

    // 后台加载数据
    loadDataInBackground(backendVersion);
  } else {
    // 后端不可用，尝试从静态源加载
    try {
      const staticVersion = await fetchStaticDataVersion();

      // 检查 IndexedDB 是否有此版本
      if (await tryUseIdbCache(staticVersion)) {
        return;
      }

      // 从静态源加载
      await loadDataFromStaticSource(staticVersion);
    } catch (error) {
      console.error('[SW] Failed to initialize:', error);
      setStatus({
        status: SwStatus.Uninitialized,
        failureReason: InitFailureReason.StaticFetchFailed,
      });
    }
  }
};

// ==============================
// Request Handler
// ==============================

const handleApiRequest = async (request: Request): Promise<Response> => {
  return router.handle(request);
};

// ==============================
// Service Worker Event Handlers
// ==============================

self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    (async () => {
      // Claim all clients immediately
      await self.clients.claim();
      // Initialize adapters
      await initializeAdapters();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept /api/v1/* requests on the same origin
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/v1/')) {
    event.respondWith(handleApiRequest(event.request));
  }
  // Don't intercept other requests, let them pass through
});

self.addEventListener('message', (event) => {
  if (isGetStatusMessage(event.data)) {
    handleStatusRequest(event);
  }

  // otherwise ignore the event
});

console.log('[SW] Service Worker registered successfully.');
