/**
 * Register the service worker and show an install-to-home-screen banner
 * (Chrome beforeinstallprompt + iOS Add to Home Screen hint).
 */
(function () {
  const DISMISS = "du_pwa_dismiss";
  let deferred = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function t(key, fallback) {
    if (window.DU_I18N && typeof window.DU_I18N.t === "function") {
      const v = window.DU_I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function banner() {
    return document.getElementById("pwaBanner");
  }

  function show() {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS)) return;
    } catch (e) {}
    const el = banner();
    if (!el) return;
    el.hidden = false;
    el.classList.add("show");
  }

  function hide() {
    const el = banner();
    if (!el) return;
    el.hidden = true;
    el.classList.remove("show");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    show();
  });

  window.addEventListener("appinstalled", function () {
    deferred = null;
    try { localStorage.setItem(DISMISS, "1"); } catch (e) {}
    hide();
  });

  function onReady() {
    if (isIos() && !isStandalone()) setTimeout(show, 1400);

    const install = document.getElementById("pwaInstall");
    const dismiss = document.getElementById("pwaDismiss");
    const hint = document.getElementById("pwaHint");

    if (install) {
      install.addEventListener("click", async function () {
        if (deferred) {
          deferred.prompt();
          try { await deferred.userChoice; } catch (e) {}
          deferred = null;
          hide();
          return;
        }
        const msg = isIos() ? t("pwa.ios", "On iPhone/iPad: tap Share, then Add to Home Screen.") : t("pwa.other", "Use your browser menu → Install app / Add to Home Screen.");
        if (hint) {
          hint.textContent = msg;
          hint.hidden = false;
        } else {
          window.alert(msg);
        }
      });
    }
    if (dismiss) {
      dismiss.addEventListener("click", function () {
        try { localStorage.setItem(DISMISS, "1"); } catch (e) {}
        hide();
      });
    }

    document.querySelectorAll("[data-pwa-install]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (deferred) {
          e.preventDefault();
          deferred.prompt();
        } else {
          show();
          const inst = document.getElementById("pwaInstall");
          if (inst) inst.click();
        }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
