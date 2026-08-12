import { json, preflight, hasDb, hasSessions, hasMedia, hasKieKey } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/health — liveness + binding readiness
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const bindings = {
    DB: hasDb(env),
    SESSIONS: hasSessions(env),
    MEDIA: hasMedia(env),
  };
  const authReady = bindings.DB && bindings.SESSIONS;
  const kieConfigured = hasKieKey(env);
  // Temp path: real generate needs auth + KIE key; MEDIA/R2 is optional
  const generateReady = authReady && kieConfigured;

  return json({
    ok: true,
    service: "dreamutopia-clone",
    time: Date.now(),
    bindings,
    authReady,
    kieConfigured,
    generateReady,
    mediaRequiredForGenerate: false,
    message: !authReady
      ? "Functions up; bind DB + SESSIONS for auth/credits (see BACKEND.md)"
      : !kieConfigured
        ? "Auth ready — set Pages secret KIE_API_KEY for image-to-video (MEDIA/R2 not required)"
        : bindings.MEDIA
          ? "D1 + KV + KIE ready; MEDIA bound (R2 path optional later)"
          : "D1 + KV + KIE ready — generate via public imageUrl (no R2)",
  });
};
