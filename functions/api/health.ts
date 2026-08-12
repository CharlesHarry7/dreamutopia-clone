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
  // Generate needs auth + KIE; file upload needs MEDIA but is optional if the client has a public URL
  const generateReady = authReady && kieConfigured;
  const uploadReady = bindings.MEDIA;

  return json({
    ok: true,
    service: "dreamutopia-clone",
    time: Date.now(),
    bindings,
    authReady,
    kieConfigured,
    generateReady,
    uploadReady,
    checkoutConfigured: false,
    mediaRequiredForGenerate: false,
    message: !authReady
      ? "Functions up; bind DB + SESSIONS for auth/credits (see BACKEND.md)"
      : !kieConfigured
        ? "Auth ready — set Pages secret KIE_API_KEY for image-to-video"
        : uploadReady
          ? "D1 + KV + KIE + R2 ready — upload a file or paste a public imageUrl"
          : "D1 + KV + KIE ready — generate via public imageUrl (bind MEDIA for uploads)",
  });
};
