/**
 * Shared fetch helpers for homepage + workspace (same-origin cookies for guest trials).
 */
(function (global) {
  const TOKEN_KEY = "dreamutopia_token";
  const CREDITS_KEY = "dreamutopia_credits";
  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[a-z0-9]{6,16}$/i.test(ref.trim())) {
      localStorage.setItem("du_ref", ref.trim());
    }
  } catch (e) {}

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function t(key, fallback) {
    if (global.DU_I18N && typeof global.DU_I18N.t === "function") {
      const v = global.DU_I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function isAllowedImageFile(file) {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    if (/^image\/(jpeg|jpg|png|webp|gif|tiff|tif|x-tiff)$/.test(type)) return true;
    if (!type || type === "application/octet-stream") {
      return /\.(jpe?g|png|webp|gif|tiff?)$/i.test(file.name || "");
    }
    return false;
  }

  async function api(path, options) {
    options = options || {};
    const token = getToken();
    const headers = Object.assign({}, options.headers || {});
    if (options.body && typeof options.body === "string" && !headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }
    if (token) headers.authorization = "Bearer " + token;
    const res = await fetch("/api" + path, Object.assign({}, options, { headers, credentials: "same-origin" }));
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error(data.message || data.error || "request failed");
      err.status = res.status;
      err.code = data.code || data.error || null;
      err.payload = data;
      throw err;
    }
    return data;
  }

  function newIdempotencyKey() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    } catch (e) {}
    const bytes = new Uint8Array(16);
    (global.crypto || window.crypto).getRandomValues(bytes);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  async function uploadImage(file) {
    const token = getToken();
    const headers = {};
    if (token) headers.authorization = "Bearer " + token;
    if (file.type && file.type !== "application/octet-stream") headers["content-type"] = file.type;
    else if (/\.tiff?$/i.test(file.name || "")) headers["content-type"] = "image/tiff";
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: headers,
      body: file,
      credentials: "same-origin",
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error(data.message || data.error || "upload failed");
      err.status = res.status;
      err.code = data.code || data.error || null;
      err.payload = data;
      throw err;
    }
    return data;
  }

  function signupHref(opts) {
    opts = opts || {};
    const mode = opts.mode === "login" ? "login" : opts.mode === "register" ? "register" : "signup";
    const next = opts.next || "/workspace";
    return "/auth?mode=" + encodeURIComponent(mode) + "&next=" + encodeURIComponent(next);
  }

  function normalizeErrorCode(err) {
    if (!err) return "";
    const payload = err.payload || {};
    const raw = err.code || err.error || payload.code || payload.error || "";
    let code = String(raw || "").trim();
    if (!code && err.message) {
      const m = String(err.message).trim();
      if (/insufficient credits/i.test(m) || /^credits insufficient$/i.test(m)) code = "insufficient_credits";
      else if (/kie_insufficient_balance/i.test(m) || /provider.*balance/i.test(m)) code = "kie_insufficient_balance";
      else if (/guest_limit/i.test(m)) code = "guest_limit";
      else if (/guest_lite_only/i.test(m)) code = "guest_lite_only";
    }
    code = code.toLowerCase().replace(/[\s-]+/g, "_");
    if (code === "insufficientcredits" || code === "credits_insufficient" || code === "not_enough_credits") {
      code = "insufficient_credits";
    }
    return code;
  }

  function mapApiError(err) {
    const code = normalizeErrorCode(err);
    const fallback = (err && err.message) || t("progress.failed", "Generation failed");
    const messages = {
      kie_insufficient_balance: t(
        "err.kie_balance",
        "The video provider is out of credit right now. This is not your DreamUtopia balance — nothing was marked as successful. Try again later."
      ),
      kie_api_key_missing: t(
        "err.kie_key",
        "Video generation isn’t configured yet (provider API key missing). Your credits were not charged."
      ),
      guest_limit: t(
        "err.guest_limit",
        "You used both free Lite videos on this device. Create a free account for 10 credits to keep creating."
      ),
      guest_lite_only: t(
        "err.guest_lite",
        "Free trial is Lite image-to-video only. Sign up for 10 credits to use Medium, Pro, and image generation."
      ),
      guest_upload_limit: t(
        "err.guest_limit",
        "You used both free Lite videos on this device. Create a free account for 10 credits to keep creating."
      ),
      insufficient_credits: t(
        "err.credits",
        "This model costs more credits than you currently have. Buy a pack on Pricing, or pick a cheaper model (Lite video is 3 credits). Nothing was generated."
      ),
      first_last_requires_medium: t(
        "err.flf",
        "First + last frame needs a signed-in account on Medium or Pro. Create a free account for 10 credits."
      ),
      kie_create_failed: t(
        "err.kie_create",
        "The provider couldn’t start this job. Nothing was marked as successful — wait a moment and try again."
      ),
      schema_migration_required: t(
        "err.schema",
        "The database still needs a migration before generation can run. Your credits were not charged."
      ),
      media_not_bound: t(
        "err.media",
        "File upload isn’t bound — paste a public https image URL instead."
      ),
      image_url_required: t(
        "err.image_required",
        "Free trial needs a start image. Upload a file or paste a public https URL."
      ),
      image_url_invalid: t(
        "err.image_invalid",
        "That image URL isn’t a public https link the provider can fetch."
      ),
      rate_limited: t("err.rate", "Too many requests — wait a moment and try again."),
      job_in_flight: t("err.in_flight", "You already have jobs rendering. Wait for one to finish."),
      unauthorized: t("err.auth", "Please sign in again to continue."),
    };
    let message = messages[code] || fallback;
    if (/^credits insufficient$/i.test(String(message).trim()) || /^insufficient credits$/i.test(String(message).trim())) {
      message = messages.insufficient_credits;
    }
    return { code: code, message: message, gated: code === "guest_limit" || code === "guest_lite_only" || code === "guest_upload_limit" || code === "first_last_requires_medium" || code === "unauthorized" };
  }

  function ensureDialogStyles() {
    if (document.getElementById("du-dialog-css")) return;
    const style = document.createElement("style");
    style.id = "du-dialog-css";
    style.textContent =
      ".du-dialog-backdrop{position:fixed;inset:0;z-index:200;background:rgba(6,6,10,.72);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)}" +
      ".du-dialog{width:100%;max-width:420px;background:#1c1c26;border:1px solid #2a2a38;border-radius:16px;padding:24px 22px 20px;box-shadow:0 24px 64px rgba(0,0,0,.55);color:#fff}" +
      ".du-dialog h2{font-size:18px;font-weight:800;letter-spacing:-.2px;margin:0 0 8px}" +
      ".du-dialog p{font-size:14px;line-height:1.55;color:#a8a8b8;margin:0 0 18px}" +
      ".du-dialog-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}" +
      ".du-dialog-secondary{border:1px solid #3a3a4a;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;background:transparent}" +
      ".du-dialog-secondary:hover{border-color:#a855f7}" +
      ".du-dialog-primary{background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none}" +
      ".du-dialog-primary:hover{opacity:.92}" +
      ".du-toast{position:fixed;top:20px;right:20px;z-index:210;display:none;max-width:340px;background:#1c1c26;border:1px solid #2a2a38;border-radius:10px;padding:14px 18px;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.5)}" +
      ".du-toast.show{display:block}" +
      ".du-toast.error{border-color:#ef4444}";
    document.head.appendChild(style);
  }

  function closeAlertDialog() {
    const el = document.getElementById("duAlertDialog");
    if (!el) return;
    document.removeEventListener("keydown", el._onKey);
    el.remove();
  }

  function alertDialog(opts) {
    opts = opts || {};
    ensureDialogStyles();
    closeAlertDialog();
    const backdrop = document.createElement("div");
    backdrop.id = "duAlertDialog";
    backdrop.className = "du-dialog-backdrop";
    backdrop.setAttribute("role", "presentation");
    const title = opts.title || t("dialog.signup.h", "Create a free account to continue");
    const body = opts.body || t("dialog.signup.p", "Guests can try 2 Lite videos. Sign up for 10 credits and every model.");
    const primaryHref = opts.primaryHref || signupHref({ next: "/workspace" });
    const primaryLabel = opts.primaryLabel || t("dialog.signup.cta", "Create a free account");
    const secondaryLabel = opts.secondaryLabel == null
      ? t("dialog.guest", "Continue as guest")
      : opts.secondaryLabel;
    backdrop.innerHTML =
      '<div class="du-dialog" role="alertdialog" aria-modal="true" aria-labelledby="duDialogTitle" aria-describedby="duDialogBody">' +
      '<h2 id="duDialogTitle"></h2><p id="duDialogBody"></p>' +
      '<div class="du-dialog-actions">' +
      (secondaryLabel ? '<button type="button" class="du-dialog-secondary" id="duDialogSecondary"></button>' : "") +
      '<a class="du-dialog-primary" id="duDialogPrimary"></a>' +
      "</div></div>";
    document.body.appendChild(backdrop);
    backdrop.querySelector("#duDialogTitle").textContent = title;
    backdrop.querySelector("#duDialogBody").textContent = body;
    const primary = backdrop.querySelector("#duDialogPrimary");
    primary.href = primaryHref;
    primary.textContent = primaryLabel;
    const secondary = backdrop.querySelector("#duDialogSecondary");
    function dismiss() {
      closeAlertDialog();
      if (typeof opts.onSecondary === "function") opts.onSecondary();
    }
    if (secondary) {
      secondary.textContent = secondaryLabel;
      secondary.addEventListener("click", dismiss);
    }
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) dismiss();
    });
    backdrop._onKey = function (e) {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", backdrop._onKey);
    if (secondary) secondary.focus();
    else primary.focus();
    return backdrop;
  }

  function toast(msg, isError) {
    ensureDialogStyles();
    var el = document.getElementById("duToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "duToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "du-toast show" + (isError ? " error" : "");
    clearTimeout(el._hide);
    el._hide = setTimeout(function () { el.classList.remove("show"); }, 4200);
  }

  function showGateDialog(kind) {
    const signupNext = signupHref({ mode: "signup", next: "/workspace" });
    if (kind === "medium" || kind === "pro") {
      return alertDialog({
        title: t("dialog.model.h", "Sign up to use Medium and Pro"),
        body: t(
          "dialog.model.p",
          "Free trial is Lite image-to-video only. Create a free account for 10 credits — Medium, Pro with sound, text-to-video, and image generation."
        ),
        primaryHref: signupNext,
        primaryLabel: t("dialog.signup.cta", "Create a free account"),
        secondaryLabel: t("dialog.lite", "Stay on Lite"),
      });
    }
    if (kind === "image") {
      return alertDialog({
        title: t("dialog.image.h", "Image generation needs an account"),
        body: t(
          "dialog.image.p",
          "Guests can try 2 Lite videos on this device. Sign up free for 10 credits to generate stills (Lite 1 credit · Pro 2 credits)."
        ),
        primaryHref: signupNext,
        primaryLabel: t("dialog.signup.cta", "Create a free account"),
        secondaryLabel: t("dialog.guest", "Continue as guest"),
      });
    }
    if (kind === "limit") {
      return alertDialog({
        title: t("dialog.limit.h", "Free tries used"),
        body: t(
          "dialog.limit.p",
          "You used both free Lite videos on this device. Create a free account for 10 credits to keep creating."
        ),
        primaryHref: signupNext,
        primaryLabel: t("dialog.signup.cta", "Create a free account"),
        secondaryLabel: t("dialog.dismiss", "Dismiss"),
      });
    }
    if (kind === "credits") {
      return alertDialog({
        title: t("dialog.credits.h", "Not enough credits for this model"),
        body: t(
          "dialog.credits.p",
          "This job costs more credits than you currently have. Credits never expire — buy a pack, or pick a cheaper model (Lite video is 3 credits). Nothing was generated."
        ),
        primaryHref: "/pricing",
        primaryLabel: t("dialog.credits.cta", "View credit packs"),
        secondaryLabel: t("dialog.dismiss", "Dismiss"),
      });
    }
    return alertDialog({
      title: t("dialog.signup.h", "Create a free account to continue"),
      body: t("dialog.signup.p", "Guests can try 2 Lite videos. Sign up for 10 credits and every model."),
      primaryHref: signupNext,
    });
  }

  function presentApiError(err, opts) {
    opts = opts || {};
    const mapped = mapApiError(err);
    if (mapped.code === "guest_limit" || mapped.code === "guest_upload_limit") {
      showGateDialog("limit");
      return mapped;
    }
    if (mapped.code === "guest_lite_only" || mapped.code === "first_last_requires_medium") {
      showGateDialog("medium");
      return mapped;
    }
    if (mapped.code === "insufficient_credits") {
      showGateDialog("credits");
      return mapped;
    }
    (typeof opts.toast === "function" ? opts.toast : toast)(mapped.message, true);
    return mapped;
  }

  function progressLabel(status, providerState) {
    const state = String(providerState || status || "").toLowerCase();
    if (state === "waiting") return t("progress.waiting", "Queued…");
    if (state === "queuing" || state === "queued") return t("progress.queue", "In queue…");
    if (state === "generating" || state === "processing") return t("progress.rendering", "Rendering…");
    if (state === "success" || state === "done") return t("progress.finishing", "Finishing…");
    if (state === "fail" || state === "failed") return t("progress.failed", "Generation failed");
    return t("progress.generating", "Generating…") + (status ? " (" + status + ")" : "");
  }

  async function pollGeneration(generationId, onStatus) {
    const maxAttempts = 80;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(function (r) { setTimeout(r, i < 10 ? 1500 : 3000); });
      const data = await api("/generate?id=" + encodeURIComponent(generationId));
      const g = data.generation || {};
      const status = data.status || g.status;
      const resultUrl = data.resultUrl || g.result_url || g.resultUrl || null;
      if (typeof onStatus === "function") onStatus(status, data);
      if (status === "done" && resultUrl) {
        return { status: status, resultUrl: resultUrl, generation: g, kind: g.kind || data.kind || "video" };
      }
      if (status === "failed") {
        const err = new Error(g.error_message || t("progress.failed", "Generation failed"));
        err.code = g.error_code || g.errorCode || g.failCode || null;
        err.payload = g;
        throw err;
      }
    }
    const timeout = new Error(t("progress.timeout", "Timed out waiting for provider result — check History later"));
    timeout.code = "provider_timeout";
    throw timeout;
  }

  async function downloadResult(url, filename) {
    if (!url) return;
    const name = filename || "dreamutopia-result";
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = (blob.type || "").indexOf("video") >= 0 ? ".mp4" : (blob.type || "").indexOf("png") >= 0 ? ".png" : ".jpg";
      a.download = /\.[a-z0-9]+$/i.test(name) ? name : name + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    } catch (e) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function publishGallery(generationId) {
    return api("/gallery", { method: "POST", body: JSON.stringify({ generationId: generationId }) });
  }

  global.DU = {
    TOKEN_KEY: TOKEN_KEY,
    CREDITS_KEY: CREDITS_KEY,
    MAX_UPLOAD_BYTES: MAX_UPLOAD_BYTES,
    getToken: getToken,
    t: t,
    api: api,
    uploadImage: uploadImage,
    pollGeneration: pollGeneration,
    progressLabel: progressLabel,
    downloadResult: downloadResult,
    publishGallery: publishGallery,
    isAllowedImageFile: isAllowedImageFile,
    newIdempotencyKey: newIdempotencyKey,
    signupHref: signupHref,
    mapApiError: mapApiError,
    alertDialog: alertDialog,
    closeAlertDialog: closeAlertDialog,
    showGateDialog: showGateDialog,
    presentApiError: presentApiError,
    toast: toast,
  };
})(window);
