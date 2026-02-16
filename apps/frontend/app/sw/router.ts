/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  query: Record<string, string | number | null>;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;
export type FallbackHandler = (ctx: RouteContext, error: Error) => Promise<Response>;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private fallbackHandler: FallbackHandler | null = null;
  private notFoundHandler: RouteHandler | null = null;

  register(pattern: string, handler: RouteHandler): this {
    const [regex, paramNames] = compilePattern(pattern);
    this.routes.push({
      pattern: regex,
      paramNames,
      handler,
    });
    return this;
  }

  fallback(handler: FallbackHandler): this {
    this.fallbackHandler = handler;
    return this;
  }

  notFound(handler: RouteHandler): this {
    this.notFoundHandler = handler;
    return this;
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    for (const route of this.routes) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params = extractParams(match, route.paramNames);
        const query = parseQueryParams(url);

        const ctx: RouteContext = {
          request,
          url,
          params,
          query,
        };

        try {
          return await route.handler(ctx);
        } catch (error) {
          console.error('[SW] Route handler error:', error);

          if (this.fallbackHandler) {
            return await this.fallbackHandler(ctx, error as Error);
          }

          return errorResponse(500, 'Internal server error');
        }
      }
    }

    // No matching route found
    if (this.notFoundHandler) {
      const ctx: RouteContext = {
        request,
        url,
        params: {},
        query: parseQueryParams(url),
      };
      return await this.notFoundHandler(ctx);
    }

    return errorResponse(404, 'Not found');
  }
}

export function jsonResponse<T = unknown>(
  data: T,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function errorResponse(status: number, message: string) {
  return jsonResponse({ error: message }, status);
}

export function notFoundResponse(message: string = 'Not found') {
  return errorResponse(404, message);
}

function compilePattern(pattern: string): [regex: RegExp, paramNames: string[]] {
  const paramNames: string[] = [];

  // Escape special characters and replace :param with capture groups
  const regexStr = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
    .replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

  return [new RegExp(`^${regexStr}$`), paramNames];
}

function extractParams(match: RegExpMatchArray, paramNames: string[]) {
  return paramNames.reduce<Record<string, string>>((params, name, index) => {
    params[name] = match[index + 1];
    return params;
  }, {});
}

function parseQueryParams(url: URL): Record<string, string | number | null> {
  const params: Record<string, string | number | null> = {};
  const numericParams = ['page', 'perPage', 'enroll_middle', 'gender', 'year'];

  url.searchParams.forEach((value, key) => {
    if (numericParams.includes(key)) {
      const numValue = parseInt(value, 10);
      params[key] = isNaN(numValue) ? value : numValue;
    } else {
      params[key] = value || null;
    }
  });

  return params;
}
