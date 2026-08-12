/**
 * Shared fetch helpers for homepage + workspace (same-origin cookies for guest trials).
 */
(function (global) {
  const TOKEN_KEY = "dreamutopia_token";
  const CREDITS_KEY = "dreamutopia_credits";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
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
    if (file.type) headers["content-type"] = file.type;
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

  async function pollGeneration(generationId, onStatus) {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(function (r) { setTimeout(r, i < 5 ? 2500 : 4000); });
      const data = await api("/generate?id=" + encodeURIComponent(generationId));
      const g = data.generation || {};
      const status = data.status || g.status;
      const resultUrl = data.resultUrl || g.result_url || g.resultUrl || null;
      if (typeof onStatus === "function") onStatus(status, data);
      if (status === "done" && resultUrl) {
        return { status: status, resultUrl: resultUrl, generation: g, kind: g.kind || data.kind || "video" };
      }
      if (status === "failed") {
        throw new Error(g.error_message || "Generation failed");
      }
    }
    throw new Error("Timed out waiting for provider result — check History later");
  }

  global.DU = {
    TOKEN_KEY: TOKEN_KEY,
    CREDITS_KEY: CREDITS_KEY,
    getToken: getToken,
    api: api,
    uploadImage: uploadImage,
    pollGeneration: pollGeneration,
  };
})(window);
