/* adblock.js — versione aggressiva */
/* Metti questo script PRIMA di ogni altro script nel <head> */

(function(){
  'use strict';

  // -------------------------
  // Configurazione: pattern domini / URL da bloccare
  // Aggiungi qui altri domini/regex che ritieni sospetti
  // -------------------------
  const BLOCK_PATTERNS = [
    /doubleclick\.net/i,
    /googlesyndication\.com/i,
    /google-analytics\.com/i,
    /googletagservices\.com/i,
    /adservice\.google\.com/i,
    /adform\.net/i,
    /adnxs\.com/i,
    /adsystem\.com/i,
    /taboola\.com/i,
    /outbrain\.com/i,
    /revcontent\.com/i,
    /pubmatic\.com/i,
    /criteo\.com/i,
    /popads\.net/i,
    /popcash\.net/i,
    /adsymptotic\.com/i,
    /zedo\.com/i,
    /trafficfactory\.biz/i,
    /admxfront\.net/i,
    /adserver/i,
    /\.rewardedads\./i,
    /sponsor\.|banner|ads|tracking|analytics/i // catch-all utile ma prudente
  ];

  // -------------------------
  // Utility
  // -------------------------
  function matchesBlocked(urlOrText){
    if(!urlOrText) return false;
    try {
      // check both as url and as raw text
      for(const re of BLOCK_PATTERNS) if(re.test(urlOrText)) return true;
      return false;
    } catch(e){ return false; }
  }

  function safeRemove(node, reason){
    try{
      node.remove?.();
    }catch(e){}
    console.warn('[AdBlock] Removed:', node, reason || '');
  }

  // -------------------------
  // 1) Override global popup/alert/open APIs
  // -------------------------
  try {
    window.open = function(){ console.log('[AdBlock] window.open blocked'); return null; };
    window.alert = window.confirm = window.prompt = function(){ console.log('[AdBlock] modal blocked'); return null; };
    window.print = function(){ console.log('[AdBlock] print blocked'); return null; };
  } catch(e){ console.warn('adblock override failed', e); }

  // -------------------------
  // 2) Intercetta fetch / XHR per bloccare richieste verso domini ADS
  // -------------------------
  // Override fetch
  if(window.fetch){
    const _fetch = window.fetch;
    window.fetch = function(resource, init){
      try {
        const url = (typeof resource === 'string')? resource : (resource && resource.url) || '';
        if(matchesBlocked(url)) {
          console.warn('[AdBlock] fetch blocked:', url);
          return Promise.reject(new Error('Ad blocked'));
        }
      } catch(e){}
      return _fetch.apply(this, arguments);
    };
  }

  // Override XMLHttpRequest.open
  try {
    const XOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url){
      if(matchesBlocked(url)){
        console.warn('[AdBlock] XHR blocked:', url);
        // emulate a failed XHR for caller
        try{ setTimeout(()=>this.abort(),0); }catch(e){}
        // still call original open to keep caller code from breaking (best-effort)
      }
      return XOpen.apply(this, arguments);
    };
  } catch(e){ console.warn('XHR override failed', e); }

  // -------------------------
  // 3) Block <script>, <iframe>, <link rel="stylesheet">, <img> in ingresso
  //    - rimuove nodi sospetti appena appaiono
  //    - blocca gli script impostandone type="javascript/blocked"
  // -------------------------
  const observer = new MutationObserver((mutations) => {
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node && node.tagName)) continue;
        const tag = node.tagName.toUpperCase();

        // handle <script>
        if(tag === 'SCRIPT'){
          const src = node.src || '';
          const txt = node.textContent || '';
          if(matchesBlocked(src) || matchesBlocked(txt)){
            console.warn('[AdBlock] Blocking script:', src);
            try{
              // neutralizza lo script: rimuovilo o cambiane il type per non eseguirlo
              node.type = 'javascript/blocked';
              safeRemove(node, 'script blocked');
            }catch(e){}
          }
        }

        // handle iframe
        if(tag === 'IFRAME'){
          const src = node.src || '';
          if(matchesBlocked(src)){
            console.warn('[AdBlock] Removing iframe:', src);
            safeRemove(node, 'iframe blocked');
            continue;
          }
          // For iframes we try to enforce sandbox if same-origin can be set by creator
          try {
            node.setAttribute('sandbox', 'allow-same-origin allow-scripts'); // disallow popups/forms by default
          } catch(e){}
        }

        // handle link rel=stylesheet or prefetch
        if(tag === 'LINK'){
          const href = node.href || '';
          if(matchesBlocked(href)){
            console.warn('[AdBlock] Removing link:', href);
            safeRemove(node, 'link blocked');
          }
        }

        // handle images (ad networks sometimes load banners as imgs)
        if(tag === 'IMG'){
          const src = node.src || '';
          if(matchesBlocked(src)){
            console.warn('[AdBlock] Removing image ad:', src);
            safeRemove(node, 'img blocked');
          }
        }

        // handle video/source elements with src pointing to ad servers
        if(tag === 'SOURCE' || tag === 'VIDEO' || tag === 'AUDIO'){
          const s = node.src || node.getAttribute?.('src') || '';
          if(matchesBlocked(s)) {
            console.warn('[AdBlock] Removing media element:', s);
            safeRemove(node, 'media blocked');
          }
        }
      }
    }
  });

  observer.observe(document, { childList:true, subtree:true });

  // -------------------------
  // 4) Override creation / insertion APIs to prevent dynamic injection
  // -------------------------
  (function(){
    const origCreate = Document.prototype.createElement;
    Document.prototype.createElement = function(name, options){
      const el = origCreate.call(this, name, options);
      // wrap setAttribute to catch immediate src assignment
      const oSet = el.setAttribute.bind(el);
      el.setAttribute = function(k,v){
        try {
          if((k==='src' || k==='href') && matchesBlocked(v)){ 
            console.warn('[AdBlock] Blocked setAttribute', k, v);
            return; // ignore
          }
        } catch(e){}
        return oSet(k,v);
      };
      return el;
    };

    // intercept appendChild / insertBefore
    const origAppend = Node.prototype.appendChild;
    Node.prototype.appendChild = function(node){
      try {
        const tag = node && node.tagName && node.tagName.toUpperCase();
        if(tag){
          // check src/href/textContent
          const src = node.src || node.href || node.getAttribute?.('src') || node.getAttribute?.('href') || node.textContent || '';
          if(matchesBlocked(src)){
            console.warn('[AdBlock] appendChild blocked for', tag, src);
            return node;
          }
        }
      } catch(e){}
      return origAppend.apply(this, arguments);
    };
    const origInsert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(node, ref){
      try {
        const tag = node && node.tagName && node.tagName.toUpperCase();
        const src = node.src || node.href || node.getAttribute?.('src') || node.getAttribute?.('href') || node.textContent || '';
        if(tag && matchesBlocked(src)){
          console.warn('[AdBlock] insertBefore blocked for', tag, src);
          return node;
        }
      } catch(e){}
      return origInsert.apply(this, arguments);
    };
  })();

  // -------------------------
  // 5) Remove existing nodes already present at startup
  // -------------------------
  function sweepInitial(){
    // scripts
    document.querySelectorAll('script').forEach(s => {
      try {
        const src = s.src || s.textContent || '';
        if(matchesBlocked(src)){ safeRemove(s, 'initial script'); }
      } catch(e){}
    });
    // iframes
    document.querySelectorAll('iframe').forEach(f => {
      try {
        const src = f.src || '';
        if(matchesBlocked(src)){ safeRemove(f, 'initial iframe'); }
        else {
          // tighten sandbox if possible
          try{ f.setAttribute('sandbox', 'allow-same-origin allow-scripts'); }catch(e){}
        }
      } catch(e){}
    });
    // links, imgs
    document.querySelectorAll('link, img, source').forEach(n => {
      try {
        const src = n.href || n.src || n.getAttribute?.('src') || '';
        if(matchesBlocked(src)) safeRemove(n, 'initial media/link');
      } catch(e){}
    });
  }

  // Run sweep as soon as possible
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', sweepInitial, { once:true });
  } else {
    sweepInitial();
  }

  // -------------------------
  // 6) CSP suggestion via JS (best-effort fallback)
  // Note: Better to put real CSP meta on server-side HTML <meta http-equiv="Content-Security-Policy" ...>
  // -------------------------
  try {
    const csp = "default-src 'self' 'unsafe-inline' https: data:; script-src 'self' 'unsafe-inline' https:; connect-src *;";
    // we cannot set server HTTP header from client JS — this is only suggestion log
    console.info('[AdBlock] Suggest adding CSP meta: ', csp);
  } catch(e){}

  // -------------------------
  // 7) Optional: register a Service Worker for request interception (requires HTTPS and SW file on same origin)
  //    — if vuoi questa opzione, devo darti il file sw.js e le istruzioni.
  // -------------------------
  // petit info log
  console.log('[AdBlock] Heavy protection active — patterns:', BLOCK_PATTERNS.length);
})();
