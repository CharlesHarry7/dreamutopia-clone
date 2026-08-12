/**
 * Shared fetch helpers for homepage + workspace (same-origin cookies for guest trials).
 */
(function (global) {
  const TOKEN_KEY = "dreamutopia_token";
  const CREDITS_KEY = "dreamutopia_credits";
  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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
        throw new Error(g.error_message || t("progress.failed", "Generation failed"));
      }
    }
    throw new Error(t("progress.timeout", "Timed out waiting for provider result — check History later"));
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
  };
})(window);
