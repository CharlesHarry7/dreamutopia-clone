import { json, preflight, asHead, hasDb, hasSessions, hasMedia, hasKieKey } from "../../libs/utils";
import { hasStripe } from "../../libs/stripe";
import { hasMailer } from "../../libs/mail";
import { hasKieWebhookHmac } from "../../libs/kieWebhook";
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
  const checkoutConfigured = hasStripe(env);
  const mailConfigured = hasMailer(env);
  const kieWebhookHmac = hasKieWebhookHmac(env);
  // Guest trials need SESSIONS + KIE; signed-in generate also needs DB
  const generateReady = bindings.SESSIONS && kieConfigured;
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
    checkoutConfigured,
    mailConfigured,
    kieWebhookHmac,
    guestTrials: true,
    guestLimit: 2,
    mediaRequiredForGenerate: false,
    message: !authReady
      ? "Functions up; bind DB + SESSIONS for auth/credits (see BACKEND.md)"
      : !kieConfigured
        ? "Auth ready — set Pages secret KIE_API_KEY for generation"
        : uploadReady
          ? "D1 + KV + KIE + R2 ready — 2 free Lite I2V tries, then sign in"
          : "D1 + KV + KIE ready — generate via public imageUrl (bind MEDIA for uploads)",
  });
};

export const onRequestHead: PagesFunction<Env> = async (ctx) => asHead(await onRequestGet(ctx));
