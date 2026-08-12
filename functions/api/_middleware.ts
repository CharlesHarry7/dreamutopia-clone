/**
 * Catch uncaught Pages Function throws under /api/* so clients get JSON, never CF 1101.
 * Keep this file import-free so module init cannot fail.
 *
 * HEAD /api/checkout and /api/auth/forgot: Pages on some deploys never calls
 * onRequestHead and falls through to the SPA (200 text/html). Rewrite those
 * HEAD probes to GET (same Function as GET/POST), then strip the body.
 * Do not rewrite HEAD /api/generate — that must stay liveness-only (no KIE poll).
 *
 * GET /api/history is canonical history JSON. Aliases: /api/jobs, /api/creations,
 * /api/generations. If Pages serves SPA HTML on those paths, coerce to JSON
 * (HEAD 200, GET 404) so clients never parse the homepage as history.
 */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization, Idempotency-Key",
  "access-control-allow-methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
};

const HEAD_AS_GET = {
  "/api/checkout": true,
  "/api/stripe/checkout": true,
  "/api/auth/forgot": true,
};

const HISTORY_JSON = {
  "/api/history": true,
  "/api/jobs": true,
  "/api/creations": true,
  "/api/generations": true,
};

function pathnameOf(request) {
  try {
    return new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

function asHead(res) {
  return new Response(null, { status: res.status, headers: res.headers });
}

function isHtml(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  return ct.includes("text/html");
}

function headProbe503() {
  return new Response(null, { status: 503, headers: JSON_HEADERS });
}

function jsonProbe503() {
  return new Response(
    JSON.stringify({
      ok: false,
      configured: false,
      error: "not_configured",
      code: "not_configured",
      message: "Endpoint is not configured.",
    }),
    { status: 503, headers: JSON_HEADERS }
  );
}

function historyHeadOk() {
  return new Response(null, { status: 200, headers: JSON_HEADERS });
}

function historyGetMissing() {
  return new Response(
    JSON.stringify({
      error: "not_found",
      code: "not_found",
      message: "History is not available.",
    }),
    { status: 404, headers: JSON_HEADERS }
  );
}

export const onRequest: PagesFunction = async (context) => {
  try {
    const method = context.request.method;
    const path = pathnameOf(context.request);
    if (method === "HEAD" && HEAD_AS_GET[path]) {
      try {
        const getReq = new Request(context.request.url, {
          method: "GET",
          headers: context.request.headers,
        });
        const res = await context.next(getReq);
        if (isHtml(res)) return headProbe503();
        return asHead(res);
      } catch {
        return headProbe503();
      }
    }

    const res = await context.next();
    if (isHtml(res)) {
      if (HEAD_AS_GET[path]) {
        if (method === "HEAD") return headProbe503();
        return jsonProbe503();
      }
      if (HISTORY_JSON[path] && (method === "HEAD" || method === "GET")) {
        if (method === "HEAD") return historyHeadOk();
        return historyGetMissing();
      }
    }
    return res;
  } catch {
    return new Response(
      JSON.stringify({
        error: "request_failed",
        code: "request_failed",
        message: "Request failed. Please try again.",
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      }
    );
  }
};
