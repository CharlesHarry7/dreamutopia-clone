import {
  json,
  preflight,
  hasDb,
  hasSessions,
  hasMedia,
  hasKieKey,
  type Env,
} from "@/server/libs/utils";
import { hasStripe } from "@/server/libs/stripe";
import { hasMailer } from "@/server/libs/mail";
import { hasKieWebhookHmac } from "@/server/libs/kieWebhook";
import { GUEST_LIMIT } from "@/server/libs/guest";

export const onRequestOptions = (): Response => preflight();

type Probe = { ok: boolean; detail?: string };

async function probeDb(env: Env): Promise<Probe> {
  if (!hasDb(env)) return { ok: false, detail: "unbound" };
  try {
    await env.DB!.prepare("SELECT 1 AS ok").first();
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 160) : "query_failed" };
  }
}

async function probeSessions(env: Env): Promise<Probe> {
  if (!hasSessions(env)) return { ok: false, detail: "unbound" };
  try {
    // Cheap read — key need not exist
    await env.SESSIONS!.get("__health_ping__");
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 160) : "kv_failed" };
  }
}

// GET /api/health — liveness + binding readiness (+ soft probes)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const bindings = {
    DB: hasDb(env),
    SESSIONS: hasSessions(env),
    MEDIA: hasMedia(env),
  };

  const [dbProbe, sessionsProbe] = await Promise.all([probeDb(env), probeSessions(env)]);

  const authReady = bindings.DB && bindings.SESSIONS && dbProbe.ok && sessionsProbe.ok;
  const kieConfigured = hasKieKey(env);
  const checkoutConfigured = hasStripe(env);
  const mailConfigured = hasMailer(env);
  const kieWebhookHmac = hasKieWebhookHmac(env);
  // Guest trials need SESSIONS (+ KIE for real generate)
  const guestTrialsReady = bindings.SESSIONS && sessionsProbe.ok;
  const generateReady = guestTrialsReady && kieConfigured;
  const uploadReady = bindings.MEDIA;
  const degraded =
    (bindings.DB && !dbProbe.ok) || (bindings.SESSIONS && !sessionsProbe.ok);

  let message: string;
  if (degraded) {
    message = "Worker up but a binding probe failed — see probes (DEPLOY.md)";
  } else if (!authReady) {
    message = "Worker up; bind DB + SESSIONS for auth/credits (see BACKEND.md / DEPLOY.md)";
  } else if (!guestTrialsReady) {
    message = "SESSIONS probe failed — guest trials unavailable until KV is healthy";
  } else if (!kieConfigured) {
    message =
      "Auth ready — set Workers secret KIE_API_KEY for generation (Pages secrets are separate; live Pages is unchanged)";
  } else if (uploadReady) {
    message = "D1 + KV + KIE + R2 ready — 2 free Lite I2V tries, then sign in";
  } else {
    message = "D1 + KV + KIE ready — generate via public imageUrl (bind MEDIA for uploads)";
  }

  return json({
    ok: true,
    service: "dreamutopia-clone",
    /** Distinguishes Next OpenNext Worker from legacy Pages Functions. */
    runtime: "next-opennext-workers",
    /**
     * Live production is still Cloudflare Pages until the manual cutover in DEPLOY.md.
     * Do not change this string (or cutoverComplete) while dreamutopia-clone.pages.dev remains live.
     */
    productionSurface: "pages-until-cutover" as const,
    cutoverComplete: false as const,
    livePagesHint: "https://dreamutopia-clone.pages.dev",
    time: Date.now(),
    bindings,
    probes: {
      DB: dbProbe,
      SESSIONS: sessionsProbe,
    },
    degraded,
    authReady,
    kieConfigured,
    generateReady,
    uploadReady,
    checkoutConfigured,
    mailConfigured,
    kieWebhookHmac,
    /** Product supports anonymous Lite trials (see guestLimit). */
    guestTrials: true,
    /** KV probe healthy — guest cookie/IP quota + job list can run. */
    guestTrialsReady,
    guestLimit: GUEST_LIMIT,
    mediaRequiredForGenerate: false,
    message,
  });
};
