/** Minimal PagesFunction typing so migrated Worker handlers keep their onRequest* exports. */
type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next?: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  params?: Record<string, string>;
  data?: unknown;
}) => Response | Promise<Response>;
