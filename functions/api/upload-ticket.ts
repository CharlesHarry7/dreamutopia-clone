import { json, error, preflight, hasMedia } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/upload-ticket?key=... — R2 upload helper (demo until Workers upload route exists)
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return error("key required");

  return json({
    ok: true,
    key,
    mediaBound: hasMedia(env),
    note: hasMedia(env)
      ? "MEDIA R2 bound — serve/upload via Functions when implemented"
      : "demo — MEDIA R2 not bound; see BACKEND.md",
  });
};
