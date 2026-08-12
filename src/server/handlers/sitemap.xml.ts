import type { Env } from "@/server/libs/utils";

const PATHS = [
  "/",
  "/pricing",
  "/workspace",
  "/auth",
  "/privacy",
  "/terms",
  "/image-to-video",
  "/photo-to-video",
  "/free-ai-video",
];

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const urls = PATHS.map(
    (path) =>
      `  <url><loc>${origin}${path}</loc><changefreq>${path === "/" ? "daily" : "weekly"}</changefreq></url>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
