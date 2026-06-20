const __portfolioUtils = window.__portfolioAssetUtils || {};
const getFastDisplayAssetSrc = __portfolioUtils.getFastDisplayAssetSrc || function(src){ return src || ""; };
const getDesktopAssetSrc = __portfolioUtils.getDesktopAssetSrc || function(src){ return src || ""; };
const getImageDisplaySrc = __portfolioUtils.getImageDisplaySrc || function(_img, src){ return src || ""; };
const getAssignedImageSrc = __portfolioUtils.getAssignedImageSrc || function(img){ return img ? (img.currentSrc || img.getAttribute("src") || img.src || "") : ""; };
const getHighQualityImageSrc = __portfolioUtils.getHighQualityImageSrc || function(_img, src){ return src || ""; };
const upgradeImageQuality = __portfolioUtils.upgradeImageQuality || function(){};
const isHeavyMediaConstrained = __portfolioUtils.isHeavyMediaConstrained || function(){ return false; };

/* ══ ISOLATED WORK VIEWER v3 — rich viewer ══════════════════ */
(function(){
  "use strict";

  var SELECTOR = ".design-item:not([hidden]), .illus-card"; /* all visible cards clickable even if image missing */
  var items = [], cur = 0;
  var ov, panel, bg, img, wrap, num, cat, ttl, dsc, metaEl, lnk;
  var dots, prev, nextBig, scrollEl, topFab, longEl, longWrap;
  var galleryEl, galleryWrap, videoWrap, videoFrame, themeWrap, themeTrack, lightbox, lightboxImg;
  var processEl, processWrap, toolsEl;
  var lbSrcs = [], lbIdx = 0;
  var videoTimer = 0;
  var storyImageObserver = null;
  var workTransitionEl = null;
  var workTransitioning = false;
  var workTransitionOpenTimer = 0;
  var workTransitionEndTimer = 0;
  var slugToIndex = Object.create(null);
  var workRoutePopBound = false;
  var closingFromRoute = false;

  var DESSIN_GALLERY = [
    "/assets/illustration-art/デッサン、色彩構成/1.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-1.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-2.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-3.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-4.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-5.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-6.jpg",
    "/assets/illustration-art/デッサン、色彩構成/2-7.jpg",
    "/assets/illustration-art/デッサン、色彩構成/3.jpg",
    "/assets/illustration-art/デッサン、色彩構成/4.jpg",
    "/assets/illustration-art/デッサン、色彩構成/5.jpg",
    "/assets/illustration-art/デッサン、色彩構成/6.jpg",
    "/assets/illustration-art/デッサン、色彩構成/7.jpg",
    "/assets/illustration-art/デッサン、色彩構成/8.jpg",
    "/assets/illustration-art/デッサン、色彩構成/9.jpg",
    "/assets/illustration-art/デッサン、色彩構成/10.jpg"
  ];

  var ILLUSTRATION_FOLDER_GALLERIES = {
    "メカ軍団": [
      "/assets/illustration-art/メカ軍団/01-view7.jpeg",
      "/assets/illustration-art/メカ軍団/02-view8.jpeg"
    ],
    "ペン画": [
      "/assets/illustration-art/ペン画/03-bill.jpg",
      "/assets/illustration-art/ペン画/04-meka.jpg",
      "/assets/illustration-art/ペン画/05-meka2.jpg"
    ],
    "絵画": [
      "/assets/illustration-art/絵画/06-img-9457-2.jpg",
      "/assets/illustration-art/絵画/07-img-9458-3.jpg",
      "/assets/illustration-art/絵画/08-img-9459.jpg",
      "/assets/illustration-art/絵画/09-img-9460-3.jpg",
      "/assets/illustration-art/絵画/10-img-9461-2.jpg",
      "/assets/illustration-art/絵画/11-img-9464.jpg",
      "/assets/illustration-art/絵画/12-img-9465-2.jpg",
      "/assets/illustration-art/絵画/13-img-9508.jpg"
    ],
    "animal": [
      "/assets/illustration-art/animal/14-view8.jpeg"
    ],
    "デッサン、色彩構成": DESSIN_GALLERY
  };

  function applyIllustrationFolderGalleries(){
    document.querySelectorAll("#illusGrid .illus-card").forEach(function(card){
      var title = tx(card, ".illus-title");
      var gallery = ILLUSTRATION_FOLDER_GALLERIES[title];
      if(!gallery || !gallery.length) return;
      card.dataset.gallery = gallery.join("|");
      card.dataset.galleryLayout = "photo-grid";
    });
  }

  function getWorkViewForItem(item){
    return item && item.classList && item.classList.contains("illus-card") ? "illustration" : "design";
  }

  function getWorkListRouteForItem(item){
    var view = getWorkViewForItem(item);
    if(window.__portfolioGetRouteForView){
      return window.__portfolioGetRouteForView(view);
    }
    return view === "illustration" ? "/art" : "/design";
  }

  function getKnownWorkSlug(title){
    var key = String(title || "").trim();
    var known = {
      "重なる": "kasanaru",
      "リアルタイム色立体": "realtime-color-volume",
      "リミナルスペース": "liminal-space",
      "エヴィス": "evice",
      "背景映像、VJ": "background-vj",
      "視点の可視化": "visualizing-viewpoints",
      "メカ軍団": "mecha",
      "ペン画": "pen-drawing",
      "絵画": "painting",
      "デッサン、色彩構成": "dessin-color",
      "animal": "animal"
    };
    return known[key] || "";
  }

  function makeWorkSlug(title, index){
    var known = getKnownWorkSlug(title);
    if(known) return known;
    var slug = String(title || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || ("work-" + pad(index + 1));
  }

  function setupWorkSlugs(){
    slugToIndex = Object.create(null);
    var used = Object.create(null);
    items.forEach(function(item, index){
      var d = getData(item);
      var baseSlug = item.dataset.workSlug || makeWorkSlug(d.title, index);
      var slug = baseSlug;
      var count = used[baseSlug] || 0;
      used[baseSlug] = count + 1;
      if(count > 0) slug = baseSlug + "-" + (count + 1);
      item.dataset.workSlug = slug;
      item.dataset.workHref = "/work/" + encodeURIComponent(slug);
      slugToIndex[slug] = index;
    });
  }

  function getWorkRoute(idx){
    var item = items[idx];
    var slug = item && item.dataset ? item.dataset.workSlug : "";
    return slug ? "/work/" + encodeURIComponent(slug) : "";
  }

  function getWorkSlugFromLocation(){
    if(typeof window === "undefined") return "";
    var match = window.location.pathname.match(/^\/work\/([^/]+)\/?$/);
    if(!match) return "";
    try{ return decodeURIComponent(match[1]); }
    catch(_){ return match[1]; }
  }

  function isWorkRoute(){
    return !!getWorkSlugFromLocation();
  }

  function syncUnderlyingWorkView(idx, routeMode){
    var item = items[idx];
    if(!item || !window.__portfolioSetView) return;
    window.__portfolioSetView(getWorkViewForItem(item), true, false, routeMode || "silent");
  }

  function writeWorkRoute(idx, mode){
    if(!window.history || window.location.protocol === "file:") return;
    var route = getWorkRoute(idx);
    if(!route) return;
    var item = items[idx];
    var d = getData(item);
    var state = {
      portfolioView:getWorkViewForItem(item),
      portfolioWork:item.dataset.workSlug || "",
      portfolioReturn:getWorkListRouteForItem(item)
    };
    try{ document.title = (d.title ? d.title + " | " : "") + "Ryotaro Portfolio"; }catch(_){}
    try{
      if(mode === "replace") window.history.replaceState(state, "", route);
      else window.history.pushState(state, "", route);
    }catch(_){}
  }

  function writeListRouteForWork(idx, mode){
    if(!window.history || window.location.protocol === "file:") return;
    var item = items[idx];
    if(!item) return;
    var view = getWorkViewForItem(item);
    var route = getWorkListRouteForItem(item);
    try{
      if(mode === "replace") window.history.replaceState({ portfolioView:view }, "", route);
      else window.history.pushState({ portfolioView:view }, "", route);
    }catch(_){}
    if(window.__portfolioSetView){
      window.__portfolioSetView(view, true, false, "silent");
    }
  }

  function handleWorkRouteChange(){
    var slug = getWorkSlugFromLocation();
    if(!slug){
      if(ov && ov.classList.contains("open")){
        close({ skipRoute:true });
      }
      return;
    }
    var idx = slugToIndex[slug];
    if(typeof idx !== "number") return;
    syncUnderlyingWorkView(idx, "silent");
    if(ov && ov.classList.contains("open")){
      cur = idx;
      buildDots();
      render(cur, null);
    }else{
      openAt(idx, { skipRoute:true });
    }
  }

  function build(){
    applyIllustrationFolderGalleries();
    items = Array.from(document.querySelectorAll(SELECTOR));
    if(!items.length) return;
    setupWorkSlugs();

    ov = document.createElement("div"); ov.id = "wv";
    ov.innerHTML =
      '<div id="wv-bg"></div>' +
      '<div id="wv-panel">' +
        '<div id="wv-hd">' +
          '<div id="wv-breadcrumb">WORKS <span>/</span> <span id="wv-breadcrumb-title"></span></div>' +
          '<div id="wv-hd-right">' +
            '<button class="wv-hd-pill" id="wv-home" type="button">&#8962; ホーム</button>' +
            '<button id="wv-x" type="button" aria-label="閉じる">&#x2715;</button>' +
          '</div>' +
        '</div>' +
        '<div id="wv-scroll">' +
          '<div id="wv-video-wrap">' +
            '<p id="wv-video-label">FILM PREVIEW</p>' +
            '<div id="wv-video-frame"></div>' +
          '</div>' +
          '<div id="wv-body">' +
            '<div id="wv-img-wrap"><img id="wv-img" alt="" draggable="false"></div>' +
            '<div id="wv-info">' +
              '<p  id="wv-num" class="wvi"></p>' +
              '<p  id="wv-cat" class="wvi"></p>' +
              '<h2 id="wv-ttl" class="wvi"></h2>' +
              '<div id="wv-hr" class="wvi"></div>' +
              '<p  id="wv-concept-label" class="wvi">CONCEPT</p>' +
              '<p  id="wv-dsc" class="wvi"></p>' +
              '<div id="wv-meta" class="wvi"></div>' +
              '<a  id="wv-lnk" class="wvi" target="_blank" rel="noopener">VIEW PROJECT &#8594;</a>' +
              '<a  id="wv-contact" class="wvi" href="mailto:ryotaro.a09@gmail.com">CONTACT &#8594;</a>' +
            '</div>' +
            '<div id="wv-theme-wrap">' +
              '<p id="wv-theme-label">THEME / SIDE IMAGES</p>' +
              '<button class="wv-theme-btn is-prev" type="button" aria-label="Previous theme image">&#8592;</button>' +
              '<div id="wv-theme-track" aria-label="Theme horizontal image slider"></div>' +
              '<button class="wv-theme-btn is-next" type="button" aria-label="Next theme image">&#8594;</button>' +
            '</div>' +
          '</div>' +
          '<div class="wv-section-divider"></div>' +
          '<div id="wv-long-wrap">' +
            '<p id="wv-long-label">DESCRIPTION</p>' +
            '<div id="wv-long"></div>' +
          '</div>' +
          '<div id="wv-process-wrap">' +
            '<p id="wv-process-label">PROCESS &amp; TOOLS</p>' +
            '<div id="wv-tools"></div>' +
            '<div id="wv-process"></div>' +
          '</div>' +
          '<div class="wv-section-divider"></div>' +
          '<div id="wv-gallery-wrap">' +
            '<p id="wv-gallery-label">GALLERY</p>' +
            '<div id="wv-gallery"></div>' +
          '</div>' +
          '<button id="wv-top-fab" type="button" aria-label="トップへ戻る">&#8593;</button>' +
        '</div>' +
        '<nav id="wv-nav">' +
          '<button class="wvbtn" id="wv-prev" type="button">&#8592; 前の作品</button>' +
          '<div id="wv-dots"></div>' +
          '<button class="wvbtn wv-next-big" id="wv-next" type="button">次の作品 &#8594;</button>' +
        '</nav>' +
      '</div>';

    document.body.appendChild(ov);

    /* lightbox */
    lightbox = document.createElement("div");
    lightbox.id = "wv-lb";
    lightbox.innerHTML = '<button id="wv-lb-prev" type="button" aria-label="前へ">&#8592;</button><img alt=""><button id="wv-lb-next" type="button" aria-label="次へ">&#8594;</button><button id="wv-lb-x" type="button" aria-label="閉じる">&#x2715;</button>';
    document.body.appendChild(lightbox);
    lightboxImg = lightbox.querySelector("img");

    function lbShow(idx){
      lbIdx = idx;
      var src = getDesktopAssetSrc(lbSrcs[lbIdx]) || lbSrcs[lbIdx];
      lightboxImg.style.opacity = "0";
      lightboxImg.onload = function(){
        if(lightbox.classList.contains("is-native")){
          requestAnimationFrame(function(){
            lightbox.scrollLeft = Math.max(0, (lightbox.scrollWidth - lightbox.clientWidth) / 2);
            lightbox.scrollTop = Math.max(0, (lightbox.scrollHeight - lightbox.clientHeight) / 2);
          });
        }
      };
      lightboxImg.src = src;
      lightbox.classList.add("on");
      requestAnimationFrame(function(){ lightboxImg.style.opacity = "1"; });
      lightbox.querySelector("#wv-lb-prev").classList.toggle("hidden", lbIdx === 0);
      lightbox.querySelector("#wv-lb-next").classList.toggle("hidden", lbIdx === lbSrcs.length - 1);
    }
    function lbClose(){ lightbox.classList.remove("on", "is-native"); }

    lightbox.addEventListener("click", function(e){
      if(e.target === lightbox || e.target.id === "wv-lb-x"){ lbClose(); }
      if(e.target.id === "wv-lb-prev" && lbIdx > 0){ lbShow(lbIdx - 1); }
      if(e.target.id === "wv-lb-next" && lbIdx < lbSrcs.length - 1){ lbShow(lbIdx + 1); }
    });
    document.addEventListener("keydown", function(e){
      if(!lightbox.classList.contains("on")) return;
      if(e.key === "ArrowLeft" && lbIdx > 0){ lbShow(lbIdx - 1); }
      if(e.key === "ArrowRight" && lbIdx < lbSrcs.length - 1){ lbShow(lbIdx + 1); }
      if(e.key === "Escape"){ lbClose(); }
    });
    lightboxImg.addEventListener("click", function(e){
      e.stopPropagation();
      lightbox.classList.toggle("is-native");
      if(lightbox.classList.contains("is-native")){
        requestAnimationFrame(function(){
          lightbox.scrollLeft = Math.max(0, (lightbox.scrollWidth - lightbox.clientWidth) / 2);
          lightbox.scrollTop = Math.max(0, (lightbox.scrollHeight - lightbox.clientHeight) / 2);
        });
      }
    });

    /* refs */
    bg         = document.getElementById("wv-bg");
    panel      = document.getElementById("wv-panel");
    img        = document.getElementById("wv-img");
    wrap       = document.getElementById("wv-img-wrap");
    num        = document.getElementById("wv-num");
    cat        = document.getElementById("wv-cat");
    ttl        = document.getElementById("wv-ttl");
    dsc        = document.getElementById("wv-dsc");
    metaEl     = document.getElementById("wv-meta");
    lnk        = document.getElementById("wv-lnk");
    dots       = document.getElementById("wv-dots");
    prev       = document.getElementById("wv-prev");
    nextBig    = document.getElementById("wv-next");
    topFab     = document.getElementById("wv-top-fab");
    scrollEl   = document.getElementById("wv-scroll");
    longEl     = document.getElementById("wv-long");
    longWrap   = document.getElementById("wv-long-wrap");
    videoWrap  = document.getElementById("wv-video-wrap");
    videoFrame = document.getElementById("wv-video-frame");
    themeWrap  = document.getElementById("wv-theme-wrap");
    themeTrack = document.getElementById("wv-theme-track");
    galleryEl  = document.getElementById("wv-gallery");
    galleryWrap= document.getElementById("wv-gallery-wrap");
    processEl  = document.getElementById("wv-process");
    processWrap= document.getElementById("wv-process-wrap");
    toolsEl    = document.getElementById("wv-tools");

    buildDots();

    /* card clicks (capture) */
    items.forEach(function(el, i){
      el.style.cursor = "pointer";
      el.setAttribute("role", el.getAttribute("role") || "link");
      el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
      el.setAttribute("aria-label", (getData(el).title || "WORK") + " detail page");
      el.addEventListener("click", function(e){
        var href = getWorkRoute(i);
        if(href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)){
          try{ window.open(href, "_blank", "noopener,noreferrer"); }catch(_){}
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        openWithShowcaseTransition(i, el, null, { routeMode:"push" });
      }, true);
      el.addEventListener("keydown", function(e){
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openWithShowcaseTransition(i, el, null, { routeMode:"push" });
      });
    });

    window.__openWorkFromElement = function(targetEl, opts){
      var idx = items.indexOf(targetEl);
      if(idx < 0) return false;
      openWithShowcaseTransition(idx, targetEl, function(){
        if(!(opts && opts.scrollLong)) return;
        setTimeout(function(){
          try{
            if(scrollEl && longWrap && longWrap.style.display !== "none"){
              scrollEl.scrollTo({ top:Math.max(0, longWrap.offsetTop - 72), behavior:"smooth" });
            }
          }catch(_){}
        }, 420);
      }, { routeMode:"push" });
      return true;
    };

    /* close */
    document.getElementById("wv-x").addEventListener("click", close);
    bg.addEventListener("click", close);

    /* nav */
    prev.addEventListener("click", function(){ go(cur - 1, "left"); });
    nextBig.addEventListener("click", function(){ go(cur + 1, "right"); });

    if(themeTrack){
      var themePrevBtn = themeWrap ? themeWrap.querySelector(".wv-theme-btn.is-prev") : null;
      var themeNextBtn = themeWrap ? themeWrap.querySelector(".wv-theme-btn.is-next") : null;
      function moveTheme(dir){
        var amount = themeTrack.clientWidth || 320;
        try{ themeTrack.scrollBy({ left:amount * dir, behavior:"smooth" }); }
        catch(_){ themeTrack.scrollLeft += amount * dir; }
      }
      if(themePrevBtn) themePrevBtn.addEventListener("click", function(e){ e.stopPropagation(); moveTheme(-1); });
      if(themeNextBtn) themeNextBtn.addEventListener("click", function(e){ e.stopPropagation(); moveTheme(1); });
    }

    /* top fab */
    topFab.addEventListener("click", function(){
      try{ scrollEl.scrollTo({ top:0, behavior:"smooth" }); }
      catch(_){ scrollEl.scrollTop = 0; }
    });
    scrollEl.addEventListener("scroll", function(){
      topFab.classList.toggle("on", scrollEl.scrollTop > 260);
    }, { passive:true });

    /* home */
    document.getElementById("wv-home").addEventListener("click", function(){
      close({ skipRoute:true });
      if(window.__portfolioSetView){
        window.__portfolioSetView("profile", false, true, "push");
      }
      setTimeout(function(){
        try{
          var p = document.getElementById("view-profile");
          if(p){ p.scrollIntoView({ behavior:"smooth", block:"start" }); }
          else { window.scrollTo({ top:0, behavior:"smooth" }); }
        }catch(_){ window.scrollTo(0,0); }
      }, 240);
    });

    /* keyboard */
    document.addEventListener("keydown", function(e){
      if(lightbox.classList.contains("on")){
        if(e.key === "Escape"){ lightbox.classList.remove("on"); }
        return;
      }
      if(!ov.classList.contains("open")) return;
      if(e.key === "Escape"){ close(); return; }
      if(e.key === "ArrowRight"){ go(cur + 1, "right"); }
      if(e.key === "ArrowLeft" ){ go(cur - 1, "left"); }
      if(e.key === "Home"){ try{ scrollEl.scrollTo({top:0,behavior:"smooth"}); }catch(_){} }
    });

    if(!workRoutePopBound){
      workRoutePopBound = true;
      window.addEventListener("popstate", handleWorkRouteChange);
    }
    handleWorkRouteChange();
  }

  function buildDots(){
    dots.innerHTML = "";
    var max = Math.min(items.length, 12);
    for(var i = 0; i < max; i++){
      (function(idx){
        var d = document.createElement("button");
        d.className = "wvdot" + (idx === cur ? " on" : "");
        d.type = "button";
        d.setAttribute("aria-label", "作品 " + (idx+1));
        d.addEventListener("click", function(){ go(idx, idx > cur ? "right" : "left"); });
        dots.appendChild(d);
      })(i);
    }
  }

  function updateDots(){
    dots.querySelectorAll(".wvdot").forEach(function(d, i){
      d.classList.toggle("on", i === cur);
    });
  }

  function getData(el){
    var imgEl = el.querySelector("img.swap-base") || el.querySelector("img:not(.swap-hover)");
    var fallbackSrc = imgEl ? (imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || "") : "";
    var rawSrc = imgEl ? (imgEl.getAttribute("data-full-src") || fallbackSrc) : "";
    var src   = imgEl ? getFastDisplayAssetSrc(rawSrc) : "";
    var desktopFallbackSrc = rawSrc ? getDesktopAssetSrc(rawSrc) : fallbackSrc;
    var title = tx(el, ".design-title,.illus-title,.view-title") || tx(el,"h2,h3") || "";
    var catTx = tx(el, ".design-meta,.illus-sub,.view-meta,.design-index,.view-no") || "";
    var desc  = tx(el, ".design-desc,.illus-desc,.view-desc") || "";
    var ds    = el.dataset || {};
    var long  = ds.long  || "";
    var year  = ds.year  || "";
    var role  = ds.role  || "";
    var media = ds.media || "";
    var gRaw  = ds.gallery || "";
    var gallery = gRaw ? gRaw.split("|").map(function(s){ return getFastDisplayAssetSrc(s.trim()); }).filter(Boolean) : [];
    var galleryLayout = ds.galleryLayout || "";
    var youtubeRaw = ds.youtube || "";
    var youtubeListRaw = ds.youtubeList || "";
    var youtubeList = youtubeListRaw
      ? youtubeListRaw.split("|").map(getYoutubeId).filter(Boolean)
      : (youtubeRaw ? youtubeRaw.split("|").map(getYoutubeId).filter(Boolean) : []);
    var youtube = youtubeList[0] || "";
    var themeRaw = ds.themeGallery || "";
    var themeGallery = themeRaw ? themeRaw.split("|").map(function(s){ return getFastDisplayAssetSrc(s.trim()); }).filter(Boolean) : [];
    var download = ds.download || "";
    var downloadName = ds.downloadName || "";
    var linkLabel = ds.linkLabel || "";
    var href  = download || ds.url || ds.href ||
                (el.querySelector("a[href]") ? el.querySelector("a[href]").href : "") || "";
    var process = ds.process || "";
    var tools   = ds.tools   || "";
    return { src:src, fallbackSrc:desktopFallbackSrc, title:title, cat:catTx, desc:desc,
             long:long, year:year, role:role, media:media,
             gallery:gallery, galleryLayout:galleryLayout, youtube:youtube, youtubeList:youtubeList, themeGallery:themeGallery,
             href:href, download:download, downloadName:downloadName, linkLabel:linkLabel,
             process:process, tools:tools };
  }

  function tx(el, sel){
    var n = el.querySelector(sel);
    return n ? (n.textContent||"").trim() : "";
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function getYoutubeId(value){
    var raw = String(value || "").trim();
    if(!raw) return "";
    if(/^[A-Za-z0-9_-]{8,}$/.test(raw) && raw.indexOf("/") < 0){
      return raw;
    }
    try{
      var url = new URL(raw, window.location.href);
      var host = url.hostname.replace(/^www\./, "");
      if(host === "youtu.be"){
        return (url.pathname.split("/").filter(Boolean)[0] || "").trim();
      }
      var queryId = url.searchParams.get("v");
      if(queryId) return queryId.trim();
      var parts = url.pathname.split("/").filter(Boolean);
      for(var i = 0; i < parts.length - 1; i++){
        if(parts[i] === "embed" || parts[i] === "shorts"){
          return parts[i + 1].trim();
        }
      }
    }catch(_){}
    var match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/)|[?&]v=)([A-Za-z0-9_-]{8,})/);
    return match ? match[1] : raw;
  }

  function getYoutubeEmbedSrc(id, opts){
    var videoId = getYoutubeId(id);
    var muted = !opts || opts.muted !== false;
    var autoplay = !!(opts && opts.autoplay);
    var loop = !!(opts && opts.loop);
    var controls = opts && opts.controls ? "1" : "0";
    var params = [
      "playsinline=1",
      "rel=0",
      "controls=" + controls,
      "disablekb=" + (controls === "1" ? "0" : "1"),
      "fs=" + (controls === "1" ? "1" : "0"),
      "iv_load_policy=3",
      "enablejsapi=1",
      "vq=hd1080",
      "origin=" + encodeURIComponent(window.location.origin || "http://localhost")
    ];
    if(autoplay) params.push("autoplay=1");
    if(muted) params.push("mute=1");
    if(loop){
      params.push("loop=1");
      params.push("playlist=" + encodeURIComponent(videoId));
    }
    return "https://www.youtube.com/embed/" + encodeURIComponent(videoId) + "?" + params.join("&");
  }

  function getYoutubeWatchUrl(id){
    var videoId = getYoutubeId(id);
    return videoId ? "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId) : "";
  }

  function renderMeta(){
    metaEl.innerHTML = "";
    metaEl.style.display = "none";
  }

  /* ── story captions – one per gallery image ── */
  var STORY_CAPTIONS = [
    ["コンセプトの起点となったカット。",
     "「何を見せるか」より「何を感じてもらうか」を優先し、光と余白の構成を徹底的に検討しました。撮影初日の試行を経てたどり着いた1枚です。"],
    ["ライティングと空気感の調整。",
     "被写体周辺の光量を複数パターン試しながら、最終的に自然光と補助ライトの比率を3:1に落ち着けました。色温度の統一が全体のトーンを決定づけています。"],
    ["テクスチャとディテールへのフォーカス。",
     "素材の表面感を引き出すために、レンズを被写体に近づけマクロ的なアプローチで撮影。質感の粗さと滑らかさが共存する瞬間を切り取っています。"],
    ["編集フェーズでの色彩設計。",
     "カラーグレーディングは画全体のコントラストを抑えつつ、ハイライトのロールオフにこだわりました。柔らかさの中に芯のある仕上がりを意識しています。"],
    ["完成したビジュアルの全体像。",
     "すべての要素が統合されたファイナルカット。制作を通じて積み上げた判断と選択の結果として、作り手の意図がもっとも純粋に表れているシーンです。"]
  ];

  function renderGallery(d){
    if(storyImageObserver){
      try{ storyImageObserver.disconnect(); }catch(_){}
      storyImageObserver = null;
    }
    galleryEl.innerHTML = "";
    galleryWrap.classList.remove("is-visual-film-gallery");
    galleryWrap.classList.remove("is-photo-grid-gallery");
    galleryEl.classList.remove("is-visual-film-gallery");
    galleryEl.classList.remove("is-photo-grid-gallery");
    if(!d.gallery || !d.gallery.length){ galleryWrap.style.display="none"; return; }
    galleryWrap.style.display = "";
    var isVisualFilm = d.galleryLayout === "visual-film";
    var isPhotoGrid = d.galleryLayout === "photo-grid";
    galleryWrap.classList.toggle("is-visual-film-gallery", isVisualFilm);
    galleryEl.classList.toggle("is-visual-film-gallery", isVisualFilm);
    galleryWrap.classList.toggle("is-photo-grid-gallery", isPhotoGrid);
    galleryEl.classList.toggle("is-photo-grid-gallery", isPhotoGrid);
    lbSrcs = d.gallery.slice(); /* store all gallery srcs for prev/next */
    function revealBlock(revealEl, delay){
      revealEl.style.transitionDelay = delay + "ms";
      requestAnimationFrame(function(){
        revealEl.classList.add("is-revealed");
      });
    }
    function loadStoryImage(image){
      if(!image) return;
      var pendingSrc = image.getAttribute("data-src");
      if(!pendingSrc) return;
      image.removeAttribute("data-src");
      image.src = pendingSrc;
    }
    function observeStoryImage(image){
      if(!image) return;
      if(!("IntersectionObserver" in window)){
        loadStoryImage(image);
        return;
      }
      if(!storyImageObserver){
        storyImageObserver = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(!entry.isIntersecting) return;
            storyImageObserver.unobserve(entry.target);
            loadStoryImage(entry.target);
          });
        }, { root:scrollEl || null, rootMargin:"360px 0px", threshold:0.01 });
      }
      storyImageObserver.observe(image);
    }
    d.gallery.forEach(function(src, gi){
      var block = document.createElement("div");
      block.className = "wv-story-block";
      if(isVisualFilm) block.classList.add("is-visual-film-frame");
      if(isPhotoGrid) block.classList.add("is-photo-grid-frame");

      /* image wrap */
      var imgWrap = document.createElement("div");
      imgWrap.className = "wv-story-img-wrap";
      var numSpan = document.createElement("span");
      numSpan.className = "wv-story-img-num";
      numSpan.textContent = String(gi+1).padStart(2,"0");
      var im = document.createElement("img");
      im.alt = "";
      im.draggable = false;
      im.decoding = "async";
      im.loading = gi === 0 ? "eager" : "lazy";
      imgWrap.appendChild(numSpan);
      imgWrap.appendChild(im);
      im.onload = function(){
        im.classList.add("lo");
        var lowSrc = getAssignedImageSrc(im);
        upgradeImageQuality(im, lowSrc, getHighQualityImageSrc(im, lowSrc));
      };
      im.onerror = function(){
        var desktopSrc = getDesktopAssetSrc(im.getAttribute("src") || im.getAttribute("data-src") || "");
        if(desktopSrc && desktopSrc !== im.getAttribute("src") && !im.dataset.desktopFallbackTried){
          im.dataset.desktopFallbackTried = "1";
          im.classList.remove("is-error");
          var hostBefore = im.closest(".wv-story-img-wrap");
          if(hostBefore) hostBefore.classList.remove("is-error");
          im.src = desktopSrc;
          return;
        }
        im.classList.add("lo", "is-error");
        var host = im.closest(".wv-story-img-wrap");
        if(host) host.classList.add("is-error");
      };
      if(gi === 0){
        im.src = src;
      }else{
        im.setAttribute("data-src", src);
      }

      /* lightbox on click */
      imgWrap.addEventListener("click", function(){ lbShow(gi); });

      /* text block */
      var txt = null;
      if(!isVisualFilm && !isPhotoGrid){
        var cap = STORY_CAPTIONS[gi] || ["制作の一場面。"];
        txt = document.createElement("div");
        txt.className = "wv-story-text";
        txt.innerHTML = cap.map(function(p, pi){
          return '<p class="'+(pi===0?"wv-story-lead":"")+'">' + esc(p) + '</p>';
        }).join("");
      }

      block.appendChild(imgWrap);
      if(txt) block.appendChild(txt);
      galleryEl.appendChild(block);
      if(gi !== 0){
        observeStoryImage(im);
      }
      revealBlock(block, isVisualFilm ? gi * 45 : gi * 65);
    });
  }

  function renderProcess(d){
    if(!processWrap) return;
    /* tools chips */
    if(toolsEl){
      toolsEl.innerHTML = "";
      var toolList = d.tools ? d.tools.split(",").map(function(s){return s.trim();}).filter(Boolean) : [];
      if(!toolList.length && d.media){
        toolList = d.media.split(/[\/,]/).map(function(s){return s.trim();}).filter(Boolean);
      }
      toolList.forEach(function(t){
        var chip = document.createElement("span");
        chip.className = "wv-chip";
        chip.textContent = t;
        toolsEl.appendChild(chip);
      });
    }
    /* process text */
    if(processEl) processEl.textContent = d.process || "";
    /* show/hide whole section */
    var hasContent = !!(d.process || d.tools);
    processWrap.style.display = hasContent ? "" : "none";
  }

  function renderVideo(d){
    if(!videoWrap || !videoFrame) return;
    clearTimeout(videoTimer);
    videoFrame.innerHTML = "";
    videoFrame.classList.remove("is-playing", "is-multi");
    videoWrap.querySelectorAll(".wv-video-external").forEach(function(link){
      link.remove();
    });
    var videos = d.youtubeList && d.youtubeList.length
      ? d.youtubeList
      : (d.youtube ? [d.youtube] : []);
    if(ov) ov.classList.toggle("has-video-preview", videos.length > 0);
    if(!videos.length){
      videoWrap.style.display = "none";
      return;
    }
    videoWrap.style.display = "block";
    videoFrame.classList.toggle("is-multi", videos.length > 1);

    videos.forEach(function(videoId, index){
      var slot = document.createElement("div");
      slot.className = "wv-video-slot";
      slot.setAttribute("data-video-index", String(index + 1).padStart(2, "0"));

      var iframe = document.createElement("iframe");
      iframe.title = (d.title ? d.title : "Film") + " preview " + String(index + 1);
      iframe.src = getYoutubeEmbedSrc(videoId, { autoplay:false, muted:true, loop:false, controls:false });
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.setAttribute("allowfullscreen", "");
      iframe.loading = isHeavyMediaConstrained() ? "lazy" : (index === 0 ? "eager" : "lazy");
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      slot.appendChild(iframe);

      var playButton = document.createElement("button");
      playButton.className = "wv-video-play";
      playButton.type = "button";
      playButton.setAttribute("aria-label", "Play film " + String(index + 1));
      playButton.innerHTML = "<span>PLAY FILM " + String(index + 1).padStart(2, "0") + "</span>";
      playButton.addEventListener("click", function(){
        function postPlay(){
          if(!iframe.contentWindow) return;
          iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":[]}', "*");
          iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":[]}', "*");
        }
        slot.classList.add("is-playing");
        videoFrame.classList.add("is-playing");
        iframe.src = getYoutubeEmbedSrc(videoId, { autoplay:true, muted:false, loop:false, controls:true });
        iframe.addEventListener("load", postPlay, { once:true });
        setTimeout(postPlay, 120);
        setTimeout(postPlay, 520);
      });
      slot.appendChild(playButton);
      videoFrame.appendChild(slot);

      var watchUrl = getYoutubeWatchUrl(videoId);
      if(watchUrl){
        var externalLink = document.createElement("a");
        externalLink.className = "wv-video-external";
        externalLink.href = watchUrl;
        externalLink.target = "_blank";
        externalLink.rel = "noopener noreferrer";
        externalLink.textContent = "OPEN YOUTUBE " + String(index + 1).padStart(2, "0");
        externalLink.setAttribute("aria-label", "Open film " + String(index + 1) + " on YouTube");
        externalLink.addEventListener("pointerdown", function(event){
          event.stopPropagation();
        });
        externalLink.addEventListener("click", function(event){
          event.stopPropagation();
          if(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey){
            return;
          }
          event.preventDefault();
          var opened = null;
          try{
            opened = window.open(watchUrl, "_blank", "noopener,noreferrer");
          }catch(_){}
          if(opened){
            try{ opened.opener = null; opened.focus(); }catch(_){}
            return;
          }
          window.location.href = watchUrl;
        });
        videoWrap.appendChild(externalLink);
      }
    });
  }

  function renderThemeGallery(d){
    if(!themeWrap || !themeTrack) return;
    themeTrack.innerHTML = "";
    if(!d.themeGallery || !d.themeGallery.length){
      themeWrap.style.display = "none";
      return;
    }
    themeWrap.style.display = "";
    var themeObserver = null;
    function loadThemeImage(image){
      if(!image) return;
      var pendingSrc = image.getAttribute("data-src");
      if(!pendingSrc) return;
      image.removeAttribute("data-src");
      image.src = pendingSrc;
    }
    function observeThemeImage(image){
      if(!image) return;
      if(!("IntersectionObserver" in window)){
        loadThemeImage(image);
        return;
      }
      if(!themeObserver){
        themeObserver = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(!entry.isIntersecting) return;
            themeObserver.unobserve(entry.target);
            loadThemeImage(entry.target);
          });
        }, { root:themeTrack, rootMargin:"260px 0px", threshold:0.01 });
      }
      themeObserver.observe(image);
    }
    d.themeGallery.forEach(function(src, i){
      var figure = document.createElement("figure");
      figure.className = "wv-theme-slide";
      figure.setAttribute("data-index", String(i + 1).padStart(2, "0"));
      var im = document.createElement("img");
      im.alt = "theme image " + String(i + 1).padStart(2, "0");
      im.loading = i === 0 ? "eager" : "lazy";
      im.decoding = "async";
      im.onerror = function(){
        var desktopSrc = getDesktopAssetSrc(im.getAttribute("src") || im.getAttribute("data-src") || "");
        if(desktopSrc && desktopSrc !== im.getAttribute("src") && !im.dataset.desktopFallbackTried){
          im.dataset.desktopFallbackTried = "1";
          im.src = desktopSrc;
        }
      };
      if(i === 0){
        im.src = src;
      }else{
        im.setAttribute("data-src", src);
      }
      figure.appendChild(im);
      themeTrack.appendChild(figure);
      if(i !== 0){
        observeThemeImage(im);
      }
    });
    try{ themeTrack.scrollLeft = 0; }catch(_){}
  }

  function loadImg(src, dir, fallbackSrc){
    img.classList.remove("vis","wv-out-l","wv-out-r","wv-in-r","wv-in-l");
    wrap.classList.remove("loaded");
    if(!src){ wrap.classList.add("loaded"); return; }
    var t = new Image();
    var activeSrc = src;
    t.onload = function(){
      img.src = activeSrc;
      upgradeImageQuality(img, activeSrc, fallbackSrc);
      requestAnimationFrame(function(){
        if(dir === "right")     img.classList.add("wv-in-r");
        else if(dir === "left") img.classList.add("wv-in-l");
        else                    img.classList.add("vis");
        wrap.classList.add("loaded");
      });
    };
    t.onerror = function(){
      if(fallbackSrc && fallbackSrc !== activeSrc){
        activeSrc = fallbackSrc;
        t.src = activeSrc;
        return;
      }
      wrap.classList.add("loaded");
    };
    t.src = activeSrc;
  }

  function render(idx, dir){
    var item = items[idx];
    var d = getData(items[idx]);
    var isIllustrationWork = !!(item && item.classList && item.classList.contains("illus-card"));
    if(ov){
      ov.classList.toggle("is-visual-film", d.galleryLayout === "visual-film");
      ov.classList.toggle("is-illustration-work", isIllustrationWork);
    }

    /* breadcrumb */
    var bc = document.getElementById("wv-breadcrumb-title");
    if(bc) bc.textContent = d.title;

    num.textContent = pad(idx+1) + " / " + pad(items.length);
    cat.textContent = d.cat;
    ttl.textContent = d.title;
    dsc.textContent = d.desc || d.long || "";

    renderMeta(d);

    /* long */
    if(d.long){ longEl.textContent = d.long; longWrap.style.display=""; }
    else       { longEl.textContent = ""; longWrap.style.display="none"; }

    renderGallery(d);
    renderVideo(d);
    renderThemeGallery(d);
    renderProcess(d);

    /* link */
    if(d.href && d.href !== "#" && d.href !== window.location.href){
      lnk.href = d.href;
      lnk.textContent = (d.linkLabel || "VIEW PROJECT") + " \u2192";
      if(d.download){
        lnk.setAttribute("download", d.downloadName || "");
        lnk.removeAttribute("target");
        lnk.removeAttribute("rel");
      }else{
        lnk.removeAttribute("download");
        lnk.target = "_blank";
        lnk.rel = "noopener";
      }
      lnk.classList.add("visible");
    } else {
      lnk.classList.remove("visible");
      lnk.removeAttribute("download");
      lnk.textContent = "VIEW PROJECT \u2192";
    }

    prev.disabled    = (idx === 0);
    nextBig.disabled = (idx === items.length - 1);
    updateDots();

    /* scroll reset */
    try{ scrollEl.scrollTop = 0; }catch(_){}
    topFab.classList.remove("on");

    if(dir){
      var outCls = dir === "right" ? "wv-out-l" : "wv-out-r";
      img.classList.add(outCls);
      setTimeout(function(){ loadImg(d.src, dir, d.fallbackSrc); }, 160);
    } else {
      loadImg(d.src, null, d.fallbackSrc);
    }
  }

  function pad(n){ return n < 10 ? "0"+n : ""+n; }

  function go(idx, dir){
    if(idx < 0 || idx >= items.length) return;
    cur = idx;
    syncUnderlyingWorkView(cur, "silent");
    writeWorkRoute(cur, "push");
    render(cur, dir);
  }

  function ensureWorkTransition(){
    if(workTransitionEl) return workTransitionEl;
    workTransitionEl = document.createElement("div");
    workTransitionEl.id = "work-open-transition";
    workTransitionEl.className = "work-open-transition";
    workTransitionEl.setAttribute("aria-hidden", "true");
    workTransitionEl.innerHTML =
      '<span class="work-trans-panel"></span>' +
      '<span class="work-trans-panel"></span>' +
      '<span class="work-trans-panel"></span>' +
      '<div class="work-trans-grid"></div>' +
      '<div class="work-trans-copy">' +
        '<span class="work-trans-kicker">SELECTED WORK</span>' +
        '<strong class="work-trans-title"></strong>' +
        '<em class="work-trans-meta"></em>' +
      '</div>' +
      '<div class="work-trans-media"><img alt="" draggable="false"></div>' +
      '<span class="work-trans-line"></span>';
    document.body.appendChild(workTransitionEl);
    return workTransitionEl;
  }

  function getSourceImage(card){
    if(!card) return null;
    return card.querySelector(".design-thumb img:not(.swap-hover), .illus-thumb img:not(.swap-hover), img.swap-base, img:not(.swap-hover), img");
  }

  function openWithShowcaseTransition(idx, sourceEl, afterOpen, opts){
    if(idx < 0 || idx >= items.length) return;
    var reduce = false;
    try{ reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(_){}
    if(workTransitioning) return;
    if(reduce){
      openAt(idx, opts);
      if(typeof afterOpen === "function") afterOpen();
      return;
    }

    var d = getData(items[idx]);
    var tr = ensureWorkTransition();
    var sourceImg = getSourceImage(sourceEl || items[idx]);
    var sourceRect = sourceImg ? sourceImg.getBoundingClientRect() : (sourceEl || items[idx]).getBoundingClientRect();
    var media = tr.querySelector(".work-trans-media");
    var mediaImg = media ? media.querySelector("img") : null;
    var title = tr.querySelector(".work-trans-title");
    var meta = tr.querySelector(".work-trans-meta");

    if(title) title.textContent = d.title || "UNTITLED";
    if(meta) meta.textContent = (d.cat || d.year || "WORK") + " / " + pad(idx + 1);
    if(mediaImg){
      mediaImg.src = (sourceImg && (sourceImg.currentSrc || sourceImg.src)) || d.src || "";
      mediaImg.alt = d.title || "";
    }

    clearTimeout(workTransitionOpenTimer);
    clearTimeout(workTransitionEndTimer);
    workTransitioning = true;
    tr.classList.remove("is-running", "is-ending");
    tr.style.display = "block";

    var vw = window.innerWidth || 1440;
    var vh = window.innerHeight || 900;
    var targetW = Math.min(vw * 0.36, 620);
    var targetH = Math.min(vh * 0.48, 430);
    if(vw < 760){
      targetW = Math.min(vw - 36, 560);
      targetH = Math.min(vh * 0.42, 420);
    }
    var targetLeft = vw < 760 ? 18 : Math.max(vw * 0.56, vw - targetW - 68);
    var targetTop = vw < 760 ? Math.max(116, vh * 0.2) : Math.max(112, vh * 0.2);

    if(media){
      media.style.left = Math.round(sourceRect.left) + "px";
      media.style.top = Math.round(sourceRect.top) + "px";
      media.style.width = Math.max(48, Math.round(sourceRect.width)) + "px";
      media.style.height = Math.max(48, Math.round(sourceRect.height)) + "px";
    }

    void tr.offsetWidth;
    tr.classList.add("is-running");
    requestAnimationFrame(function(){
      if(media){
        media.style.left = Math.round(targetLeft) + "px";
        media.style.top = Math.round(targetTop) + "px";
        media.style.width = Math.round(targetW) + "px";
        media.style.height = Math.round(targetH) + "px";
      }
    });

    workTransitionOpenTimer = setTimeout(function(){
      if(ov) ov.classList.add("is-showcase-opening");
      openAt(idx, opts);
      if(typeof afterOpen === "function") afterOpen();
    }, 320);

    workTransitionEndTimer = setTimeout(function(){
      tr.classList.add("is-ending");
      setTimeout(function(){
        tr.classList.remove("is-running", "is-ending");
        tr.style.display = "none";
        if(media) media.removeAttribute("style");
        if(ov) ov.classList.remove("is-showcase-opening");
        workTransitioning = false;
      }, 180);
    }, 680);
  }

  function openAt(idx, opts){
    opts = opts || {};
    syncUnderlyingWorkView(idx, "silent");
    if(!opts.skipRoute){
      writeWorkRoute(idx, opts.routeMode || "push");
    }
    ov.classList.add("open");
    cur = idx; buildDots(); render(cur, null);
    /* no body overflow lock — conflicts with custom scroll */
  }

  function close(opts){
    opts = opts || {};
    if(closingFromRoute) return;
    closingFromRoute = true;
    ov.classList.remove("open");
    clearTimeout(videoTimer);
    if(videoFrame) videoFrame.innerHTML = "";
    if(!opts.skipRoute && isWorkRoute()){
      writeListRouteForWork(cur, opts.routeMode || "push");
    }
    closingFromRoute = false;
    /* overflow restored */
  }

  function init(){ setTimeout(build, 0); }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }

})();
