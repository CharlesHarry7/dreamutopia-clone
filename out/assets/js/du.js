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

  function progressLabel(status, providerState) {
    const state = String(providerState || status || "").toLowerCase();
    if (state === "waiting") return t("progress.waiting", "Queued…");
    if (state === "queuing" || state === "queued") return t("progress.queue", "In queue…");
    if (state === "generating" || state === "processing") return t("progress.rendering", "Rendering…");
    if (state === "success" || state === "done") return t("progress.finishing", "Finishing…");
    if (state === "fail" || state === "failed") return t("progress.failed", "Generation failed");
    return t("progress.generating", "Generating…") + (status ? " (" + status + ")" : "");
  }

  function cancelledError() {
    const err = new Error(t("progress.cancelled", "Stopped waiting — the job may still finish. Check Workspace / History."));
    err.code = "poll_cancelled";
    return err;
  }

  function sleep(ms, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        reject(cancelledError());
        return;
      }
      const timer = setTimeout(resolve, ms);
      if (!signal) return;
      signal.addEventListener(
        "abort",
        function () {
          clearTimeout(timer);
          reject(cancelledError());
        },
        { once: true }
      );
    });
  }

  function shouldRetryPoll(err) {
    if (!err) return false;
    if (err.code === "poll_cancelled") return false;
    const code = String(err.code || "");
    if (
      code === "kie_api_key_missing" ||
      code === "provider_credits_insufficient" ||
      code === "kie_unauthorized" ||
      code === "guest_limit" ||
      code === "unauthorized" ||
      code === "not_found"
    ) {
      return false;
    }
    if (err.status === 400 || err.status === 401 || err.status === 402 || err.status === 404) return false;
    if (err.status === 429 || code === "rate_limited") return true;
    if (err.status === 502 || err.status === 504) return true;
    if (!err.status) return true;
    return false;
  }

  function failedJobError(message) {
    const raw = String(message || "");
    if (/credits insufficient|balance isn.?t enough|top up/i.test(raw)) {
      const err = new Error(t("err.provider_credits_insufficient", "Generation is temporarily unavailable. Please try again later."));
      err.code = "provider_credits_insufficient";
      return err;
    }
    return new Error(raw || t("progress.failed", "Generation failed"));
  }

  async function pollGeneration(generationId, onStatus, opts) {
    opts = opts || {};
    const signal = opts.signal;
    const maxAttempts = opts.maxAttempts || 80;
    const started = Date.now();
    let networkFails = 0;
    for (let i = 0; i < maxAttempts; i++) {
      const hidden = typeof document !== "undefined" && document.hidden;
      const delay = i === 0 ? 800 : i < 10 ? 1500 : hidden ? 5000 : 3000;
      await sleep(delay, signal);
      try {
        const data = await api("/generate?id=" + encodeURIComponent(generationId));
        networkFails = 0;
        const g = data.generation || {};
        const status = data.status || g.status;
        const resultUrl = data.resultUrl || g.result_url || g.resultUrl || null;
        const extra = {
          elapsedSec: Math.round((Date.now() - started) / 1000),
          attempt: i + 1,
        };
        if (typeof onStatus === "function") onStatus(status, Object.assign({}, data, extra));
        if (status === "done" && resultUrl) {
          return { status: status, resultUrl: resultUrl, generation: g, kind: g.kind || data.kind || "video" };
        }
        if (status === "failed") {
          throw failedJobError(g.error_message || g.errorMessage);
        }
      } catch (e) {
        if (e && e.code === "poll_cancelled") throw e;
        if (!shouldRetryPoll(e)) throw e;
        networkFails += 1;
        if (networkFails >= 6) {
          const err = new Error(t("err.network", "Network hiccup while waiting. Check Workspace / History."));
          err.code = "network";
          throw err;
        }
        if (typeof onStatus === "function") {
          onStatus("processing", {
            providerState: "waiting",
            elapsedSec: Math.round((Date.now() - started) / 1000),
            networkRetry: true,
          });
        }
      }
    }
    throw new Error(t("progress.timeout", "Timed out waiting for provider result — check History later"));
  }

  function formatProgress(status, data) {
    if (data && data.networkRetry) {
      const wait = data.elapsedSec ? " · " + data.elapsedSec + "s" : "";
      return t("err.network", "Connection blip — still waiting.") + wait;
    }
    let label = progressLabel(status, data && data.providerState);
    if (data && data.elapsedSec) label += " · " + data.elapsedSec + "s";
    return label;
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

  function errorMessage(err, fallback) {
    const code = (err && (err.code || (err.payload && err.payload.code))) || "";
    if (code) {
      const translated = t("err." + code, "");
      if (translated) return translated;
    }
    return (err && err.message) || fallback || t("progress.failed", "Generation failed");
  }

  async function likeGallery(id) {
    return api("/gallery/like", { method: "POST", body: JSON.stringify({ id: id }) });
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
    formatProgress: formatProgress,
    downloadResult: downloadResult,
    publishGallery: publishGallery,
    likeGallery: likeGallery,
    errorMessage: errorMessage,
    isAllowedImageFile: isAllowedImageFile,
    newIdempotencyKey: newIdempotencyKey,
  };
})(window);
