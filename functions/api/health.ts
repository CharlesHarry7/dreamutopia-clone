import { json, preflight, hasDb, hasSessions, hasMedia } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/health — liveness + binding readiness
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const bindings = {
    DB: hasDb(env),
    SESSIONS: hasSessions(env),
    MEDIA: hasMedia(env),
  };
  const ready = bindings.DB && bindings.SESSIONS;

  return json({
    ok: true,
    service: "dreamutopia-clone",
    time: Date.now(),
    bindings,
    authReady: ready,
    message: ready
      ? "D1 + KV bound — auth/credits live"
      : "Functions up; bind DB + SESSIONS for auth/credits (see BACKEND.md)",
  });
};
