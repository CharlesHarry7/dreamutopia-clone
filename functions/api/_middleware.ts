/**
 * Catch uncaught Pages Function throws under /api/* so clients get JSON, never CF 1101.
 * Import-free so module init cannot fail.
 */
export const onRequest: PagesFunction = async (context) => {
  try {
    return await context.next();
  } catch {
    return new Response(
      JSON.stringify({
        error: "worker_exception",
        code: "worker_exception",
        message: "Request failed. Please try again.",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      }
    );
  }
};
