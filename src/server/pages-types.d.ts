/** Minimal PagesFunction typing so migrated handlers compile under Next.js. */
type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next?: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  params?: Record<string, string>;
  data?: unknown;
}) => Response | Promise<Response>;
