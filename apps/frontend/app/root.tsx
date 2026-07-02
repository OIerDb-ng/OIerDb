import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import { useClientStatus } from '~/hooks/use-client-status';
import { waitUntilClientReady } from '~/libs/client';

import type { Route } from './+types/root';
import { theme } from './theme';

import '@mantine/core/styles.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" {...mantineHtmlProps}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <ColorSchemeScript defaultColorScheme="auto" />
        <Meta />
        <Links />
      </head>
      <body>
        <MantineProvider defaultColorScheme="auto" theme={theme}>
          {children}
        </MantineProvider>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Block all client-side data fetching until the client is initialized.
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async () => {
    console.log('Waiting for OIerDbClient to be ready in client middleware...');
    await waitUntilClientReady();
    console.log('OIerDbClient is ready, continuing client middleware...');
  },
];

// Global loading UI while hydrating or while the root is waiting for client initialization
export function HydrateFallback(_props: Route.HydrateFallbackProps) {
  const status = useClientStatus();
  const text = status?.text || '请稍候';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontSize: 16,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>正在准备应用…</div>
        <div style={{ opacity: 0.75 }}>{text}</div>
      </div>
    </div>
  );
}

const isDataSourceUnavailableError = (error: unknown) => {
  if (isRouteErrorResponse(error)) {
    return error.status === 503;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /Service Worker not initialized|Internal server error|Failed to (get|list) |Failed to get version/i.test(
    error.message,
  );
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;
  const isDataSourceUnavailable = isDataSourceUnavailableError(error);

  if (isDataSourceUnavailable) {
    message = '数据暂时不可用';
    details = '当前没有可用的数据源。请检查网络连接后刷新页面，或在关于页清除缓存后重试。';
  } else if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details = error.status === 404 ? '未找到请求的页面。' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div
          style={{
            border: '1px solid #e9ecef',
            borderRadius: 8,
            padding: '2rem',
            backgroundColor: '#fff',
          }}
        >
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              margin: '0 0 0.5rem',
              color: '#dc2626',
            }}
          >
            {message}
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1.5rem', color: '#495057' }}>
            {details}
          </p>
          {is404 && (
            <Link
              to="/"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                backgroundColor: '#228be6',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: 4,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              返回首页
            </Link>
          )}
        </div>
        {stack && (
          <pre style={{ marginTop: '1rem', overflow: 'auto', fontSize: '0.75rem' }}>
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
