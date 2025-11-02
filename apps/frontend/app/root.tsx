import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import { useMemo } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import { useClientStatus } from '~/hooks/use-client';
import { useHydrated } from '~/hooks/use-hydrated';
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
  // Render SSR-stable text on the first client render; switch to live status after hydration
  const hydrated = useHydrated();
  const status = useClientStatus();
  const text = useMemo(() => (hydrated ? status?.text || '请稍候' : '请稍候'), [hydrated, status]);

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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
