/**
 * Mobile header drawer. Pages hide <nav> under 768px (see chrome.css);
 * this toggles header.nav-open. Does not depend on Next/shadcn.
 */
(function () {
  function closeNav(header, btn) {
    if (!header) return;
    header.classList.remove("nav-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function onReady() {
    var header = document.querySelector("header");
    var btn = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav") || (header && header.querySelector("nav"));
    if (!header || !btn || !nav) return;
    if (!nav.id) nav.id = "site-nav";
    btn.setAttribute("aria-controls", nav.id);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = header.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav(header, btn);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav(header, btn);
    });

    document.addEventListener("click", function (e) {
      if (!header.classList.contains("nav-open")) return;
      if (header.contains(e.target)) return;
      closeNav(header, btn);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
