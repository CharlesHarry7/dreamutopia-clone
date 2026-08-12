/**
 * Catch uncaught Pages Function throws under /api/* so clients get JSON, never CF 1101.
 * Keep this file import-free so module init cannot fail.
 */
export const onRequest: PagesFunction = async (context) => {
  try {
    return await context.next();
  } catch {
    return new Response(
      JSON.stringify({
        error: "request_failed",
        code: "request_failed",
        message: "Request failed. Please try again.",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "Content-Type, Authorization, Idempotency-Key",
          "access-control-allow-methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
        },
      }
    );
  }
};
