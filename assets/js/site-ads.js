/* Banner-only placements for blog and tool pages. No pop-under scripts. */
(() => {
  "use strict";
  if (window.__faizanSiteAdsInitialized) return;
  window.__faizanSiteAdsInitialized = true;

  const NETWORK = "https://bauval.org";
  const BANNERS = {
    mobile: { key: "432e234b26f124866b0730ef00ae9df1", width: 320, height: 50 },
    sidebar: { key: "d8a0b9c9e5434e4b6d4d7b4ddefd1db1", width: 160, height: 600 },
    rectangle: { key: "88cb49fe2d8f281de2d0c72480081664", width: 300, height: 250 },
    horizontal: { key: "b3baf7441c1f93eb0a01436f9d8f8c26", width: 468, height: 60 },
    leaderboard: { key: "a25d1a94e1ba95e415d119397882ff4b", width: 728, height: 90 }
  };
  const NATIVE = "9190ac6aa9226f14a970133f0b174a33";
  const SCRIPT_END = "</scr" + "ipt>";

  function addCss() {
    if (document.querySelector('link[data-faizan-ads-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/site-ads.css";
    link.setAttribute("data-faizan-ads-css", "");
    document.head.appendChild(link);
  }

  function pathHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return hash;
  }

  function createSlot(kind) {
    const slot = document.createElement("div");
    slot.className = "site-ad site-ad--" + kind;
    slot.setAttribute("role", "complementary");
    slot.setAttribute("aria-label", "Advertisement");
    const label = document.createElement("span");
    label.className = "site-ad__label";
    label.textContent = "Advertisement";
    slot.appendChild(label);
    const mount = document.createElement("div");
    mount.className = "site-ad__mount";
    slot.appendChild(mount);
    return { slot, mount };
  }

  function renderBanner(mount, banner, eager) {
    if (!banner || mount.firstChild) return;
    const frame = document.createElement("iframe");
    frame.title = "Advertisement";
    frame.width = String(banner.width);
    frame.height = String(banner.height);
    frame.style.width = banner.width + "px";
    frame.style.height = banner.height + "px";
    frame.loading = eager ? "eager" : "lazy";
    frame.scrolling = "no";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    const options = { key: banner.key, format: "iframe", height: banner.height, width: banner.width, params: {} };
    frame.srcdoc = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}body{text-align:center}</style></head><body>' +
      '<script>var atOptions=' + JSON.stringify(options) + ';' + SCRIPT_END +
      '<script src="' + NETWORK + '/22/' + banner.key + '">' + SCRIPT_END + '</body></html>';
    mount.appendChild(frame);
  }

  function renderNative(mount) {
    if (mount.firstChild) return;
    const frame = document.createElement("iframe");
    frame.title = "Sponsored recommendations";
    frame.width = "320";
    frame.height = "300";
    frame.style.width = "100%";
    frame.style.height = "300px";
    frame.loading = "lazy";
    frame.scrolling = "no";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    const resizeCode = "(function(){var box=document.getElementById('container-" + NATIVE + "');" +
      "function send(){var h=Math.ceil(Math.max(box?box.scrollHeight:0,box?box.getBoundingClientRect().height:0,document.body.scrollHeight));" +
      "parent.postMessage({faizanNative:" + JSON.stringify(NATIVE) + ",height:h},'*');}" +
      "if(window.ResizeObserver){var ro=new ResizeObserver(send);if(box)ro.observe(box);ro.observe(document.body);}" +
      "window.addEventListener('load',send);setTimeout(send,700);})();";
    frame.srcdoc = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>' +
      '<div id="container-' + NATIVE + '"></div>' +
      '<script async data-cfasync="false" src="' + NETWORK + '/21/' + NATIVE + '">' + SCRIPT_END +
      '<script>' + resizeCode + SCRIPT_END + '</body></html>';
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.faizanNative !== NATIVE) return;
      const h = Math.max(280, Math.min(720, Number(event.data.height) || 300));
      if (Math.abs(parseFloat(frame.style.height) - h) > 12) frame.style.height = h + "px";
    });
    mount.appendChild(frame);
  }

  // Request below-the-fold creatives close to view, not all at once.
  function loadNearViewport(element, callback) {
    if (!("IntersectionObserver" in window)) {
      callback();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        callback();
      }
    }, { rootMargin: "280px 0px" });
    observer.observe(element);
  }

  function findAnchor(children, ratio, minIndex) {
    const start = Math.max(minIndex, Math.floor(children.length * ratio));
    for (let i = start; i < children.length; i++) {
      if (children[i].matches("p, ul, ol, blockquote, table, figure, .faq-item, .tools-note, .card, section")) {
        return { node: children[i], index: i };
      }
    }
    for (let i = start - 1; i >= minIndex; i--) {
      if (children[i].matches("p, ul, ol, blockquote, table, figure, .faq-item, section")) {
        return { node: children[i], index: i };
      }
    }
    return { node: children[Math.min(children.length - 1, start)], index: start };
  }

  function init() {
    const main = document.querySelector("main");
    if (!main || !/^\/(blog|tools)(\/|$)/.test(window.location.pathname)) return;
    addCss();

    const narrow = window.innerWidth < 768;
    const hash = pathHash(window.location.pathname);
    const isBlog = window.location.pathname.startsWith("/blog");
    const isHub = /\/(blog|tools)\/?(?:index\.html)?$/.test(window.location.pathname);
    const hero = main.querySelector(".blog-hero, .bloghub-hero, .tools-hero, .page-hero, section");
    const article = main.querySelector(".prose, .tools-copy");
    const top = createSlot("top");
    const mid = createSlot("inline");
    const end = createSlot("lower");

    // Small first banner is visible without covering content or opening tabs.
    const topHost = hero && hero.querySelector(".wrap");
    if (topHost) topHost.appendChild(top.slot);
    else if (hero) hero.appendChild(top.slot);
    else main.prepend(top.slot);

    renderBanner(top.mount,
      narrow ? BANNERS.mobile : (hash % 2 ? BANNERS.leaderboard : BANNERS.horizontal),
      true
    );

    let thirdSidebar = null;
    if (article && !isHub) {
      const blocks = Array.from(article.children);
      const start = findAnchor(blocks, 0.34, 2);
      if (start.node) start.node.after(mid.slot);
      else article.appendChild(mid.slot);
      const finish = findAnchor(blocks, 0.74, Math.min(blocks.length - 1, start.index + 3));
      if (finish.node && finish.node !== start.node) finish.node.after(end.slot);
      else article.appendChild(end.slot);
      // Tall banners belong in an existing desktop sidebar, never in the reading column.
      if (!narrow && hash % 3 === 0) {
        const side = main.querySelector(".tools-related, .blog-sidebar, .toc-sidebar, .sidebar, aside:not(.tools-side)");
        if (side && !article.contains(side)) {
          side.appendChild(end.slot);
          end.slot.classList.add("site-ad--sidebar");
          thirdSidebar = BANNERS.sidebar;
        }
      }
    } else {
      const sections = Array.from(main.querySelectorAll(":scope > section"));
      const midSection = sections[Math.min(sections.length - 1, Math.max(1, Math.floor(sections.length * 0.4)))];
      const endSection = sections[Math.min(sections.length - 1, Math.max(2, Math.floor(sections.length * 0.75)))];
      if (midSection) midSection.after(mid.slot);
      else main.appendChild(mid.slot);
      if (endSection && endSection !== midSection) endSection.after(end.slot);
      else main.appendChild(end.slot);
    }

    loadNearViewport(mid.slot, () => renderBanner(mid.mount, BANNERS.rectangle, false));
    // Two ads on small screens protect the reading and calculator experience.
    // Desktop has a third ad, either in an existing sidebar or lower in content.
    if (narrow) {
      end.slot.remove();
    } else {
      loadNearViewport(end.slot, () => {
        if (thirdSidebar) renderBanner(end.mount, thirdSidebar, false);
        else renderNative(end.mount);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
