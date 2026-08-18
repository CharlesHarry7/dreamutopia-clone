import type { Env } from "@/server/libs/utils";

/** Public marketing / legal URLs only — skip auth, reset, and session workspace. */
const PATHS = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/image-to-video",
  "/photo-to-video",
  "/free-ai-video",
];

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PATHS.map(
    (path) =>
      `  <url><loc>${origin}${path}</loc><lastmod>${lastmod}</lastmod><changefreq>${
        path === "/" ? "daily" : "weekly"
      }</changefreq></url>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
