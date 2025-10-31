// 🔒 adblock.js — Blocco pubblicità e pop-up globale per DGTV
(function() {
  console.log("🧱 Sistema blocco pubblicità DGTV attivo...");

  // 🧠 Elenco parole chiave/domìni noti per pubblicità o tracking
  const blockedKeywords = [
    "ads", "adservice", "advert", "doubleclick", "googlesyndication", "googletag",
    "banner", "click", "tracking", "metrics", "pub", "promo", "affiliates",
    "analytics", "statcounter", "pixel", "scorecardresearch", "demdex",
    "criteo", "quantserve", "zedo", "yieldmanager", "banners", "sponsor",
    "popunder", "popads", "adserver", "taboola", "outbrain", "revcontent",
    "adnxs", "rubiconproject", "moatads", "appsflyer", "smartadserver",
    "amazon-adsystem", "chartbeat", "mathtag", "rtb", "videoads", "infolinks"
  ];

  // 🔎 Funzione di verifica
  function isBlocked(url) {
    return blockedKeywords.some(word => url.toLowerCase().includes(word));
  }

  // 🚫 Blocca richieste fetch
  const origFetch = window.fetch;
  window.fetch = (...args) => {
    if (isBlocked(args[0])) {
      console.warn("🛑 BLOCCATO (fetch):", args[0]);
      return new Promise(() => {}); // interrompe la richiesta
    }
    return origFetch(...args);
  };

  // 🚫 Blocca richieste XHR
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(_, url) {
    if (isBlocked(url)) {
      console.warn("🛑 BLOCCATO (XHR):", url);
      return;
    }
    return origOpen.apply(this, arguments);
  };

  // 🚫 Blocca pop-up indesiderati
  const origWindowOpen = window.open;
  window.open = function(url, ...rest) {
    if (url && isBlocked(url)) {
      console.warn("🛑 BLOCCATO (popup):", url);
      return null;
    }
    return origWindowOpen ? origWindowOpen.call(window, url, ...rest) : null;
  };

  // 🧹 Rimuove elementi pubblicitari già caricati o nuovi
  const observer = new MutationObserver(() => {
    document.querySelectorAll(`
      [id*="ad"],
      [class*="ad"],
      [src*="ads"],
      iframe[src*="banner"],
      iframe[src*="ad"],
      div[class*="sponsor"],
      div[id*="sponsor"],
      img[src*="banner"],
      .ad-container,
      .advertisement,
      .sponsored
    `).forEach(el => {
      el.remove();
      console.log("🧹 Elemento pubblicitario rimosso:", el.tagName);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 🧩 Protezione da redirect pubblicitari improvvisi
  const origAssign = window.location.assign;
  window.location.assign = function(url) {
    if (isBlocked(url)) {
      console.warn("🛑 BLOCCATO (redirect):", url);
      return;
    }
    return origAssign.call(window.location, url);
  };

  console.log("✅ Blocco pubblicità DGTV attivo globalmente");
})();
