// The little scripts the page runs before it paints, so that a visitor's settings show at once: no spoilers, accent colour,
// compact mode, folded menu. Plain strings, in a module the server and the browser can both read.
export const SPOILER_KEY = "vct-nospoil";
export const ACCENT_KEY = "vct-accent";
export const DENSITY_KEY = "vct-density";
export const NAV_KEY = "vct-nav-mini";
export const HEAD_SCRIPT = [
  `try{if(localStorage.getItem("${SPOILER_KEY}")==="1")document.documentElement.dataset.nospoil="1"}catch(e){}`,
  `try{var a=localStorage.getItem("${ACCENT_KEY}");if(a)document.documentElement.dataset.accent=a}catch(e){}`,
  `try{if(localStorage.getItem("${DENSITY_KEY}")==="compact")document.documentElement.dataset.density="compact"}catch(e){}`,
  `try{if(localStorage.getItem("${NAV_KEY}")==="1")document.documentElement.dataset.nav="mini"}catch(e){}`,
  // a piece of the page that did not arrive (a version put online meanwhile, or a short network fault): the page loads again,
  // once in 30 s at most, instead of showing Next.js's "Application error" or a page without its styles
  `try{var R="vct-chunk-reload";var h=function(m){if(!/ChunkLoadError|Loading (CSS )?chunk|dynamically imported module/i.test(m||""))return;var t=+sessionStorage.getItem(R)||0;if(Date.now()-t<3e4)return;sessionStorage.setItem(R,String(Date.now()));location.reload()};addEventListener("error",function(e){h(e.error?e.error.name+" "+e.error.message:e.message)});addEventListener("unhandledrejection",function(e){var r=e.reason;h(r?r.name+" "+r.message:"")});addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="LINK"&&(t.href||"").indexOf("/_next/static/css/")>=0)h("Loading CSS chunk")},true);addEventListener("load",function(){var l=document.querySelectorAll('link[rel="stylesheet"][href*="/_next/static/css/"]');for(var i=0;i<l.length;i++)if(!l[i].sheet){h("Loading CSS chunk");break}})}catch(e){}`,
].join(";");

// After the page has loaded: the site's worker (pages kept for offline), and once an hour it keeps the week's programme ahead.
export const OFFLINE_SCRIPT = `try{if("serviceWorker" in navigator&&!/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname))addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").then(function(){return navigator.serviceWorker.ready}).then(function(r){var k="vct-warm",t=+localStorage.getItem(k)||0;if(Date.now()-t<36e5||!r.active)return;localStorage.setItem(k,String(Date.now()));r.active.postMessage({type:"warm"})}).catch(function(){})})}catch(e){}`;
