// Health check endpoint
export const onRequestGet: PagesFunction<Env> = async () => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'cloudflare-pages',
  });
};
