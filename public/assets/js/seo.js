/**
 * Canonical + Open Graph tags from the current origin (works on Pages previews too).
 */
(function () {
  var path = location.pathname.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
  if (!path) path = "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  var url = location.origin + path;
  var title = document.title || "DreamUtopia";
  var descEl = document.querySelector('meta[name="description"]');
  var desc = (descEl && descEl.getAttribute("content")) || title;
  var image = location.origin + "/assets/images/feature-image-to-video.webp";

  function link(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function meta(attr, key, content) {
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  link("canonical", url);
  meta("property", "og:type", "website");
  meta("property", "og:site_name", "DreamUtopia");
  meta("property", "og:title", title);
  meta("property", "og:description", desc);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", desc);
  meta("name", "twitter:image", image);
})();
