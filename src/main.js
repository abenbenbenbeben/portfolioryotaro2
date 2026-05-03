
  /* ページ開始時刻を最優先で記録（最低3秒キープ計算の基準） */
  window._loaderPageStart = window._loaderPageStart || Date.now();
  /* ── Early stability guards (run before main IIFE) ──────────────
     These prevent an uncaught error, missing asset, or slow network
     from leaving the page in an unusable state. */
  (function(){
    try{
      window.runDeferredInit = window.runDeferredInit || function(){};
      window.addEventListener("error", function(e){
        try{ console.warn("[stability:error]", e.message); }catch(_){}
      });
      window.addEventListener("unhandledrejection", function(e){
        try{ console.warn("[stability:rejection]", e.reason); }catch(_){}
      });
      /* Touch devices: ensure the system cursor is used. */
      var mm = window.matchMedia && window.matchMedia("(pointer: coarse)");
      if(mm && mm.matches){
        document.documentElement.style.cursor = "auto";
      }
      function __startOpeningReveal(afterReveal){
        if(window.__openingRevealPlayed){
          document.body.classList.add("page-revealed");
          if(typeof afterReveal === "function") afterReveal();
          return;
        }
        window.__openingRevealPlayed = true;
        var overlay = document.getElementById("openingReveal");
        if(!document.body.classList.contains("is-opening-reveal")){
          document.body.classList.add("is-opening-reveal");
          if(overlay){
            overlay.classList.remove("is-active");
            void overlay.offsetWidth;
            overlay.classList.add("is-active");
          }
        }
        setTimeout(function(){
          document.body.classList.add("page-revealed");
          if(typeof afterReveal === "function") afterReveal();
        }, 90);
        setTimeout(function(){
          document.body.classList.remove("is-opening-reveal");
          if(overlay) overlay.classList.remove("is-active");
        }, 1900);
      }
      window.__startOpeningReveal = __startOpeningReveal;

      /* Final safety net: if anything stalls, dismiss the loader
         as soon as window load fires, or after 2.5s — whichever
         comes first — so the page is always usable. */
      function __dropLoader(){
        try{
          var ld = document.getElementById("loader");
          if(ld && !ld.classList.contains("hide")){
            ld.classList.add("hide");
            __startOpeningReveal();
            setTimeout(function(){ try{ ld.style.display = "none"; }catch(_){} }, 1650);
          }
        }catch(_){}
      }
      var _loaderStart = Date.now();
      /* ── ALL-IN-ONE LOADER ──
         全ページの画像（profile / view / design / illustration / hover swap /
         data-gallery）をローダー表示中にすべてダウンロード＆デコードする。
         ローダーが下がった瞬間、どのビューへ行ってもキャッシュ済みなので
         動きが詰まらない。ready シグナルは window._viewAssetsReady。
         ・MIN: ローダーが一瞬で消えるとチラつくので最低 600ms 出す
         ・MAX: ネットワークが死んでも 12s で必ず下げる（ハードキャップ）  */
      /* ローダーは十分見せつつ、失敗時はすぐ触れる長さに抑える。 */
      var MIN_LOADER_MS = 850;
      var MAX_LOADER_MS = 4500;
      try{ console.log("[loader] MAX-OUT+++ MODE  MIN=", MIN_LOADER_MS, "ms  MAX=", MAX_LOADER_MS, "ms"); }catch(_){}

      function _ready(){
        return window._viewAssetsReady === true;
      }
      function _dropWhenReady(){
        var elapsed = Date.now() - _loaderStart;
        if(_ready() && elapsed >= MIN_LOADER_MS){
          try{ window._viewImagesReady = true; }catch(_){}
          __dropLoader();
          return;
        }
        if(elapsed >= MAX_LOADER_MS){
          try{ window._viewAssetsReady = true; window._viewImagesReady = true; }catch(_){}
          __dropLoader();
          return;
        }
        setTimeout(_dropWhenReady, 100);
      }
      if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", _dropWhenReady, { once:true });
      } else {
        _dropWhenReady();
      }
      window.addEventListener("load", _dropWhenReady);
      /* 絶対安全網 */
      setTimeout(__dropLoader, MAX_LOADER_MS + 800);
    }catch(_){}
  })();

      /* ── 最初の view に行く前に、表示に必要な画像の
            「ネットワーク完了 ＋ デコード完了」まで必ず待つ ── */
      (function preloadViewImages(){
        /* 絶対的な安全網（ネットワーク断・画像破損時のフォールバック）。
           通常はここに到達する前に真のロード完了で解除される。 */
        var CATASTROPHIC_TIMEOUT_MS = 4500;
        window._viewImagesReady = false;

        function collectImgs(){
          return Array.from(document.querySelectorAll(
            "main img, .sidebar img, .intro-film img"
          )).filter(function(img){
            return !img.classList.contains("loader-float")
                && !img.classList.contains("swap-hover"); /* ホバー用は遅延可 */
          });
        }

        function waitForImg(img){
          return new Promise(function(resolve){
            function doneDecode(){
              if(img.decode){
                img.decode().then(resolve, resolve);
              } else {
                resolve();
              }
            }
            if(img.complete && img.naturalWidth > 0){
              doneDecode();
            } else if(img.complete){
              /* 既にエラー済み */
              resolve();
            } else {
              img.addEventListener("load",  doneDecode, { once: true });
              img.addEventListener("error", resolve,   { once: true });
            }
          });
        }

        function collectExtraSrcs(){
          try{
            return Array.from(new Set(
              (window.__EXTRA_PRELOAD_IMAGES__ || [])
                .map(function(src){
                  return typeof src === "string" ? src.trim() : "";
                })
                .filter(Boolean)
            ));
          }catch(_){
            return [];
          }
        }

        function waitForSrc(src){
          return new Promise(function(resolve){
            if(!src){
              resolve();
              return;
            }

            var preloadImg = new Image();
            var settled = false;
            preloadImg.decoding = "async";

            function finish(){
              if(settled) return;
              settled = true;
              resolve();
            }

            function finishAfterDecode(){
              if(settled) return;
              if(typeof preloadImg.decode === "function"){
                preloadImg.decode().then(finish, finish);
                return;
              }
              finish();
            }

            preloadImg.onload = finishAfterDecode;
            preloadImg.onerror = finish;
            preloadImg.src = src;

            if(preloadImg.complete){
              if(preloadImg.naturalWidth > 0){
                finishAfterDecode();
              } else {
                finish();
              }
            }
          });
        }

        function waitAll(){
          var waits = collectImgs().map(waitForImg);
          collectExtraSrcs().forEach(function(src){
            waits.push(waitForSrc(src));
          });
          if(!waits.length){ return Promise.resolve(); }
          return Promise.all(waits);
        }

        /* window.load 後、もう一度再スキャン（JS で後追い挿入された
           画像も確実に含める）→ 全デコード完了で ready */
        function go(){
          waitAll().then(function(){
            /* 1拍おいて再スキャン（遅延注入対策） */
            return new Promise(function(r){ setTimeout(r, 120); });
          }).then(waitAll).then(function(){
            window._viewImagesReady = true;
          }).catch(function(){
            window._viewImagesReady = true;
          });
        }

        if(document.readyState === "complete"){
          go();
        } else {
          window.addEventListener("load", go, { once: true });
        }

        /* 破滅的な安全網 */
        setTimeout(function(){
          if(!window._viewImagesReady){
            try{ console.warn("[loader] catastrophic timeout; revealing anyway"); }catch(_){}
            window._viewImagesReady = true;
          }
        }, CATASTROPHIC_TIMEOUT_MS);
      })();

  (async () => {
  const useScrollViewSystem = !!document.querySelector(".view-scroll-system, .view-legacy-3d");
  async function ensureThreeLib(){
    if(useScrollViewSystem) return false;
    if(typeof THREE !== "undefined") return true;
    return new Promise((resolve, reject)=>{
      const script = document.createElement("script");
      script.src = "https://unpkg.com/three@0.158.0/build/three.min.js";
      /* Hard timeout so a blocked CDN never freezes init. */
      const to = setTimeout(()=>resolve(false), 4000);
      script.onload = ()=>{ clearTimeout(to); resolve(typeof THREE !== "undefined"); };
      script.onerror = ()=>{ clearTimeout(to); resolve(false); };
      document.head.appendChild(script);
    });
  }

  const hasThree = await ensureThreeLib();
  if(!hasThree && !useScrollViewSystem){
    console.warn("three.js の読み込みに失敗しました。3D表示のみスキップします。");
  }

  const introFilmEl = document.getElementById("introFilm");
  const introFilmStageEl = document.getElementById("introFilmStage");
  const introFilmVideoEl = document.getElementById("introFilmVideo");
  const introFilmScrollEl = document.getElementById("introFilmScroll");
  const heroEl = document.getElementById("hero3d") || document.getElementById("viewLegacy3d");
  const threeWrap = document.getElementById("three-wrap");
  const storySectionEl = document.getElementById("story");
  const storyMovieStage = document.querySelector(".movie-stage");
  const galleryGridEl = document.getElementById("viewGrid");
  const galleryCards = Array.from(document.querySelectorAll("#viewGrid .view-card"));
  const illusGridEl = document.getElementById("illusGrid");
  const illusCards = Array.from(document.querySelectorAll("#illusGrid .illus-card"));
  const showreelA = document.getElementById("showreelA");
  const showreelB = document.getElementById("showreelB");
  let activeShowreel = showreelA;
  let standbyShowreel = showreelB;
  let showreelList = [];
  let showreelIndex = 0;
  let showreelSwitching = false;
  const SHOWREEL_CROSSFADE_LEAD = 0.55;
  const designViewEl = document.getElementById("view-design");
  const illustrationViewEl = document.getElementById("view-illustration");
  const viewSwitchLinks = document.querySelectorAll(".menu [data-view]");
  const homeBackEls = document.querySelectorAll(".home-back, .home-back-top");
  const heroScrollEl = document.getElementById("heroScroll");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const loader = document.getElementById("loader");
  const percentEl = document.getElementById("percent");
  const loaderRingStrokeEl = document.getElementById("loaderRingStroke");
  const loaderFloatEls = Array.from(document.querySelectorAll(".loader-float"));
  const STABLE_PERFORMANCE_MODE = true;

  /* ── Loader float image drift animation ── */
  (function animateLoaderFloats(){
    var els = loaderFloatEls.filter(function(el){ return el.offsetParent !== null || el.style.display !== 'none'; });
    if(!els.length) return;
    /* each float gets a unique phase + amplitude */
    var params = els.map(function(el, i){
      return {
        xAmp:  6  + i * 3.2,
        yAmp:  8  + i * 2.8,
        xFreq: 0.00028 + i * 0.000055,
        yFreq: 0.00022 + i * 0.000048,
        phase: i * 1.31
      };
    });
    var startT = performance.now();
    function floatTick(now){
      var t = now - startT;
      els.forEach(function(el, i){
        var p = params[i];
        var x = Math.sin(t * p.xFreq + p.phase) * p.xAmp;
        var y = Math.cos(t * p.yFreq + p.phase * 0.7) * p.yAmp;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      });
      /* stop once loader is hidden */
      var ld = document.getElementById("loader");
      if(!ld || ld.classList.contains("hide") || ld.style.display === "none") return;
      requestAnimationFrame(floatTick);
    }
    requestAnimationFrame(floatTick);
  })();

  /* ── Loader percentage animation (0→100% over 3 s) ── */
  (function startLoaderCount(){
    var pEl  = document.getElementById("percent");
    var rEl  = document.getElementById("loaderRingStroke");
    var CIRC = 427.26;
    var DUR  = 2900; /* slightly under 3 s so it reaches 100 before hide */
    var start = performance.now();
    function tickLoader(now){
      var t = Math.min(1, (now - start) / DUR);
      /* ease-out cubic */
      var ease = 1 - Math.pow(1 - t, 3);
      var pct  = Math.round(ease * 100);
      if(pEl) pEl.textContent = pct + "%";
      if(rEl) rEl.style.strokeDashoffset = (CIRC * (1 - ease)).toFixed(2);
      if(t < 1) requestAnimationFrame(tickLoader);
    }
    requestAnimationFrame(tickLoader);
  })();
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHoverSwap = window.matchMedia("(hover: hover)").matches;
  const compactSidebarMq = window.matchMedia("(max-width: 900px)");
  const heroCopyEl = document.querySelector(".hero-copy");
  const layoutToggleEl = document.querySelector(".layout-toggle");
  const titleBadgeEl = document.getElementById("title");
  const counterBadgeEl = document.getElementById("counter");
  const FALLBACK_LABELS = {
    logo: "RYOTARO",
    profile: "PROFILE IMAGE",
    view: "VIEW IMAGE",
    design: "DESIGN IMAGE",
    illustration: "ILLUSTRATION IMAGE",
    intro: "OPENING FILM",
    showreel: "SHOWREEL COMING SOON",
    three: "3D PREVIEW UNAVAILABLE"
  };

  const viewMap = {
    profile: document.getElementById("view-profile"),
    design: document.getElementById("view-design"),
    illustration: document.getElementById("view-illustration")
  };
  const themeViewClasses = ["theme-view-profile", "theme-view-design", "theme-view-illustration"];
  let currentViewKey = "profile";
  let viewSectionActive = true;
  let introFilmProgressFrame = 0;
  let introFilmUnlockBound = false;
  let introAutoEnterLocked = false;
  let introFilmCandidateIndex = 0;
  const PROGRAMMATIC_SCROLL_DURATION = 1320;
  let programmaticScrollFrame = 0;
  let heroInViewport = true;
  let pageVisible = !document.hidden;
  let threeInteractionReady = false;
  const GLOBAL_SCROLL_SPEED = 0.58;
  const KEYBOARD_SCROLL_SPEED = 0.68;
  const WHEEL_SCROLL_LERP = 0.22;
  let slowScrollTargetY = window.scrollY || window.pageYOffset || 0;
  let slowScrollFrame = 0;
  let cinematicMotionFrame = 0;
  let cinematicRevealObserver = null;
  let cinematicParallaxTargets = [];
  let cinematicParallaxCache = []; // ★追加
  let lastTopbarScrollY = window.scrollY || window.pageYOffset || 0;
  window.__THREE_VIEW_TEXTURES_READY__ = true;
  window.__THREE_VIEW_TEXTURES_PENDING__ = 0;
  /* カクつき対策で cinematic motion（rAF parallax ループ）と
     初期 3D スピンを完全停止。reveal は class 付与だけでも動作する。 */
  const ENABLE_CINEMATIC_MOTION = false;
  const ENABLE_WORKS_PARALLAX = false;
  const ENABLE_INITIAL_VIEW_SPIN = false;
  const CINEMATIC_PARALLAX_MIN_DELTA = 0.45;
  let deferredInitDone = false;
  let renderLoopStarted = false;
  let secondaryInitDone = false;

  let sidebarPreferenceLocked = false;
  document.body.classList.add("is-intro-mode");
  if(STABLE_PERFORMANCE_MODE){
    document.body.classList.add("perf-stable");
  }
  if("scrollRestoration" in history){
    history.scrollRestoration = "manual";
  }

  function syncSidebarButtonState(){
    if(!sidebarToggle) return;
    const collapsed = document.body.classList.contains("is-collapsed");
    sidebarToggle.setAttribute("aria-pressed", String(collapsed));
    sidebarToggle.setAttribute("aria-label", collapsed ? "Open navigation" : "Close navigation");
  }

  function syncTopbarScrollState(forceShow){
    document.body.classList.remove("is-topbar-hidden");
    lastTopbarScrollY = window.scrollY || window.pageYOffset || 0;
  }

  function setSidebarCollapsed(collapsed){
    document.body.classList.toggle("is-collapsed", collapsed);
    syncSidebarButtonState();
    requestAnimationFrame(()=>{
      if(!threeInteractionReady) return;
      if(typeof resize3D === "function"){
        resize3D();
      }
    });
  }

  if(sidebarToggle){
    sidebarToggle.addEventListener("click", ()=>{
      sidebarPreferenceLocked = true;
      setSidebarCollapsed(!document.body.classList.contains("is-collapsed"));
    });
  }
  setSidebarCollapsed(compactSidebarMq.matches);
  const handleCompactSidebarChange = (e)=>{
    if(sidebarPreferenceLocked) return;
    setSidebarCollapsed(e.matches);
  };
  if(typeof compactSidebarMq.addEventListener === "function"){
    compactSidebarMq.addEventListener("change", handleCompactSidebarChange);
  }else if(typeof compactSidebarMq.addListener === "function"){
    compactSidebarMq.addListener(handleCompactSidebarChange);
  }

  function safeScrollToY(top){
    const clampedTop = clampScrollY(top);
    try{
      window.scrollTo({ top: clampedTop, behavior: "auto" });
    }catch(_e){
      window.scrollTo(0, clampedTop);
    }
  }

  function safeScrollToTop(){
    safeScrollToY(0);
  }

  function scrollToStory(){
    if(!storySectionEl) return;
    const top = Math.max(0, storySectionEl.offsetTop - 18);
    animateProgrammaticScroll(top);
  }

  function scrollToViewHero(instant = false){
    if(!heroEl) return;
    const top = Math.max(0, heroEl.offsetTop);
    if(instant){
      safeScrollToY(top);
      return;
    }
    animateProgrammaticScroll(top);
  }

  function enterViewFromIntro(){
    if(introAutoEnterLocked) return;
    if(!viewSectionActive || !heroEl) return;
    if(introFilmStageEl && introFilmStageEl.classList.contains("is-missing")) return;
    introAutoEnterLocked = true;
    scrollToViewHero(false);
    window.setTimeout(()=>{
      introAutoEnterLocked = false;
      requestIntroFilmProgress();
    }, 1080);
  }

  if(introFilmScrollEl){
    introFilmScrollEl.addEventListener("click", enterViewFromIntro);
  }

  if(heroScrollEl){
    heroScrollEl.addEventListener("click", scrollToStory);
    heroScrollEl.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        scrollToStory();
      }
    });
  }

  function makeSwapSrc(src){
    if(typeof src !== "string" || !src) return null;
    if(src.includes("-2.")) return src;
    return src.replace(/(\.[^./?#]+)([?#].*)?$/, "-2$1$2");
  }

  function makeAboutSrc(src){
    if(typeof src !== "string" || !src) return null;
    if(src.includes("-about.")) return src;
    return src.replace(/(\.[^./?#]+)([?#].*)?$/, "-about$1$2");
  }

  function preloadImage(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=>resolve(src);
      img.onerror = reject;
      img.src = src;
    });
  }

  function setMissingState(el, label){
    if(!el) return;
    el.classList.add("is-missing");
    if(label) el.dataset.fallbackLabel = label;
  }

  function disableInteractiveCard(itemEl){
    if(!itemEl) return;
    itemEl.classList.add("is-disabled");
    itemEl.removeAttribute("role");
    itemEl.removeAttribute("tabindex");
    itemEl.setAttribute("aria-disabled", "true");
  }

  function getImageFallbackShell(img){
    return img ? img.closest(".logo, .view-thumb, .design-thumb, .illus-thumb, .bottom-profile") : null;
  }

  function getImageFallbackLabel(img){
    if(!img) return "IMAGE";
    if(img.closest(".logo")) return FALLBACK_LABELS.logo;
    if(img.closest(".bottom-profile")) return FALLBACK_LABELS.profile;
    if(img.closest(".view-thumb")) return FALLBACK_LABELS.view;
    if(img.closest(".design-thumb")) return FALLBACK_LABELS.design;
    if(img.closest(".illus-thumb")) return FALLBACK_LABELS.illustration;
    return (img.alt || "IMAGE").trim() || "IMAGE";
  }

  function markImageMissing(img){
    if(!img || img.dataset.assetMissing === "1") return;
    img.dataset.assetMissing = "1";
    img.classList.add("is-missing-asset");

    if(img.classList.contains("loader-float")){
      img.style.display = "none";
      return;
    }

    const shell = getImageFallbackShell(img);
    setMissingState(shell, getImageFallbackLabel(img));

    const itemEl = img.closest(".view-card, .design-item, .illus-card");
    if(itemEl) disableInteractiveCard(itemEl);
  }

  function wireImageFallback(img){
    if(!img) return;
    img.addEventListener("error", ()=>markImageMissing(img), { once:true });
    if(img.complete && img.naturalWidth === 0){
      markImageMissing(img);
    }
  }

  function markShowreelUnavailable(label){
    pauseAllShowreels();
    setMissingState(storyMovieStage, label || FALLBACK_LABELS.showreel);
  }

  function markIntroFilmUnavailable(label){
    if(!introFilmStageEl) return;
    if(introFilmVideoEl){
      introFilmVideoEl.pause();
    }
    setMissingState(introFilmStageEl, label || FALLBACK_LABELS.intro);
  }

  function setupAssetFallbacks(){
    document.querySelectorAll("img").forEach((img)=>wireImageFallback(img));
  }

  function attachHoverSwap(baseImg, thumbEl, itemEl){
    if(!baseImg || !thumbEl || !itemEl) return;
    const baseSrc = baseImg.getAttribute("src");
    const swapSrc = makeSwapSrc(baseSrc);
    if(!swapSrc || swapSrc === baseSrc) return;

    if(baseImg.classList.contains("swap-base")) return;
    baseImg.classList.add("swap-base");

    let hoverImg = null;
    let hoverReady = false;
    let hoverLoading = false;
    let pointerInside = false;

    const ensureHover = ()=>{
      if(hoverReady || hoverLoading) return;
      hoverLoading = true;

      const img = document.createElement("img");
      img.className = "swap-hover";
      img.alt = baseImg.alt || "";
      img.setAttribute("aria-hidden", "true");
      img.addEventListener("load", ()=>{
        hoverLoading = false;
        hoverReady = true;
        hoverImg = img;
        thumbEl.appendChild(img);
        wireImageFallback(img);
        if(pointerInside){
          itemEl.classList.add("is-hover-swapping");
        }
      }, { once:true });
      img.addEventListener("error", ()=>{
        hoverLoading = false;
      }, { once:true });
      img.src = swapSrc;
    };

    const onEnter = ()=>{
      pointerInside = true;
      if(hoverReady){
        itemEl.classList.add("is-hover-swapping");
        return;
      }
      ensureHover();
    };
    const onLeave = ()=>{
      pointerInside = false;
      itemEl.classList.remove("is-hover-swapping");
    };
    itemEl.addEventListener("mouseenter", onEnter);
    itemEl.addEventListener("mouseleave", onLeave);
  }

  async function setupHoverImageSwap(){
    if(!canHoverSwap) return;

    document.querySelectorAll(".view-card").forEach((itemEl)=>{
      const thumbEl = itemEl.querySelector(".view-thumb");
      const baseImg = thumbEl ? thumbEl.querySelector(":scope > img") : null;
      if(!thumbEl || !baseImg) return;
      attachHoverSwap(baseImg, thumbEl, itemEl);
    });

    document.querySelectorAll(".design-item").forEach((itemEl)=>{
      const thumbEl = itemEl.querySelector(".design-thumb");
      const baseImg = thumbEl ? thumbEl.querySelector(":scope > img") : null;
      if(!thumbEl || !baseImg) return;
      attachHoverSwap(baseImg, thumbEl, itemEl);
    });

    document.querySelectorAll(".illus-card").forEach((itemEl)=>{
      const thumbEl = itemEl.querySelector(".illus-thumb");
      const baseImg = thumbEl ? thumbEl.querySelector(":scope > img") : null;
      if(!thumbEl || !baseImg) return;
      attachHoverSwap(baseImg, thumbEl, itemEl);
    });
  }

  function initViewGalleryLayout(){
    if(!galleryGridEl || !galleryCards.length) return;

    let layoutFrame = 0;
    const slotClasses = ["is-slot-hero", "is-slot-wide", "is-slot-tall", "is-slot-standard"];

    function setViewCardSlot(card, index, ratio){
      card.classList.remove(...slotClasses);

      const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
      const slot = index % 4;

      if(slot === 0){
        card.classList.add(safeRatio >= 1.45 ? "is-slot-hero" : "is-slot-tall");
        return;
      }
      if(slot === 1){
        card.classList.add(safeRatio <= 0.88 ? "is-slot-tall" : "is-slot-wide");
        return;
      }
      if(slot === 2){
        card.classList.add(safeRatio >= 1.35 ? "is-slot-wide" : "is-slot-standard");
        return;
      }
      card.classList.add(safeRatio <= 0.9 ? "is-slot-tall" : "is-slot-standard");
    }

    function layoutCard(card){
      const gridStyle = window.getComputedStyle(galleryGridEl);
      const rowGap = parseFloat(gridStyle.rowGap) || 0;
      const rowHeight = parseFloat(gridStyle.gridAutoRows) || 0;
      if(!rowHeight) return;

      const thumbEl = card.querySelector(".view-thumb");
      const infoEl = card.querySelector(".view-info");
      if(!thumbEl) return;

      const thumbHeight = thumbEl.getBoundingClientRect().height;
      const infoHeight = infoEl ? infoEl.getBoundingClientRect().height : 0;
      const totalHeight = Math.ceil(thumbHeight + infoHeight);
      const span = Math.max(1, Math.ceil((totalHeight + rowGap) / (rowHeight + rowGap)));
      card.style.gridRowEnd = `span ${span}`;
    }

    function applyViewGalleryLayout(){
      layoutFrame = 0;
      galleryCards.forEach((card, index)=>{
        const baseImg = card.querySelector(".view-thumb > img.swap-base") || card.querySelector(".view-thumb > img:not(.swap-hover)") || card.querySelector(".view-thumb > img");
        let ratio = 1;
        if(baseImg && baseImg.naturalWidth && baseImg.naturalHeight){
          ratio = baseImg.naturalWidth / baseImg.naturalHeight;
        }
        setViewCardSlot(card, index, ratio);
        layoutCard(card);
      });
    }

    function requestViewGalleryLayout(){
      if(layoutFrame) return;
      layoutFrame = requestAnimationFrame(applyViewGalleryLayout);
    }

    galleryCards.forEach((card)=>{
      const baseImg = card.querySelector(".view-thumb > img:not(.swap-hover)") || card.querySelector(".view-thumb > img");
      if(!baseImg) return;
      if(baseImg.complete && baseImg.naturalWidth){
        requestViewGalleryLayout();
      }else{
        baseImg.addEventListener("load", requestViewGalleryLayout, { once:true });
      }
    });

    if(typeof ResizeObserver !== "undefined"){
      const ro = new ResizeObserver(()=>requestViewGalleryLayout());
      ro.observe(galleryGridEl);
      galleryCards.forEach((card)=>ro.observe(card));
    }

    window.addEventListener("resize", requestViewGalleryLayout);
    requestViewGalleryLayout();
  }

  function initIllustrationGridLayout(){
    if(!illusGridEl || !illusCards.length) return;

    let layoutFrame = 0;

    function layoutCard(card){
      const gridStyle = window.getComputedStyle(illusGridEl);
      const rowGap = parseFloat(gridStyle.rowGap) || 0;
      const rowHeight = parseFloat(gridStyle.gridAutoRows) || 0;
      if(!rowHeight) return;

      const thumbEl = card.querySelector(".illus-thumb");
      const infoEl = card.querySelector(".illus-info");
      if(!thumbEl) return;

      const thumbHeight = thumbEl.getBoundingClientRect().height;
      const infoHeight = infoEl ? infoEl.getBoundingClientRect().height : 0;
      const totalHeight = Math.ceil(thumbHeight + infoHeight);
      const span = Math.max(1, Math.ceil((totalHeight + rowGap) / (rowHeight + rowGap)));
      card.style.gridRowEnd = `span ${span}`;
    }

    function applyIllustrationGridLayout(){
      layoutFrame = 0;
      illusCards.forEach((card)=>layoutCard(card));
    }

    function requestIllustrationGridLayout(){
      if(layoutFrame) return;
      layoutFrame = requestAnimationFrame(applyIllustrationGridLayout);
    }

    illusCards.forEach((card)=>{
      const baseImg = card.querySelector(".illus-thumb > img:not(.swap-hover)") || card.querySelector(".illus-thumb > img");
      if(!baseImg) return;
      if(baseImg.complete && baseImg.naturalWidth){
        requestIllustrationGridLayout();
      }else{
        baseImg.addEventListener("load", requestIllustrationGridLayout, { once:true });
      }
    });

    if(typeof ResizeObserver !== "undefined"){
      const ro = new ResizeObserver(()=>requestIllustrationGridLayout());
      ro.observe(illusGridEl);
    }

    window.addEventListener("resize", requestIllustrationGridLayout);
    requestIllustrationGridLayout();
  }

  function setupAboutImageViewer(){ /* handled by isolated viewer script */ }
  setupAboutImageViewer();

  function playVideo(video){
    if(!video) return Promise.resolve(false);
    const p = video.play();
    if(p && typeof p.then === "function"){
      return p.then(()=>true).catch(()=>false);
    }
    return Promise.resolve(true);
  }

  function getScrollRoot(){
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getMaxScrollY(){
    const scrollRoot = getScrollRoot();
    return Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
  }

  function clampScrollY(value){
    return Math.max(0, Math.min(getMaxScrollY(), value));
  }

  function cancelSlowScroll(){
    if(!slowScrollFrame) return;
    window.cancelAnimationFrame(slowScrollFrame);
    slowScrollFrame = 0;
  }

  function runSlowScroll(){
    slowScrollFrame = 0;
    const currentY = window.scrollY || window.pageYOffset || 0;
    const diff = slowScrollTargetY - currentY;
    if(Math.abs(diff) < 0.6){
      safeScrollToY(slowScrollTargetY);
      return;
    }
    safeScrollToY(currentY + (diff * WHEEL_SCROLL_LERP));
    slowScrollFrame = window.requestAnimationFrame(runSlowScroll);
  }

  function queueSlowScrollTo(targetY){
    slowScrollTargetY = clampScrollY(targetY);
    if(slowScrollFrame) return;
    slowScrollFrame = window.requestAnimationFrame(runSlowScroll);
  }

  function queueSlowScrollDelta(deltaY, speed = GLOBAL_SCROLL_SPEED){
    if(!Number.isFinite(deltaY) || deltaY === 0) return;
    const currentY = window.scrollY || window.pageYOffset || 0;
    if(!slowScrollFrame){
      slowScrollTargetY = currentY;
    }
    queueSlowScrollTo(slowScrollTargetY + (deltaY * speed));
  }

  function isTypingTarget(target){
    if(!(target instanceof Element)) return false;
    if(target.closest("[contenteditable=\"true\"]")) return true;
    if(target.closest("input, textarea, select, button")) return true;
    return false;
  }

  function shouldBypassGlobalSlowScroll(event){
    if(event.defaultPrevented) return true;
    if(document.body.classList.contains("about-open")) return true;
    if(event.target instanceof Element && event.target.closest(".about-image-scroll")) return true;
    return false;
  }

  function isViewSpinCenterZone(){
    if(!heroEl || !viewSectionActive) return false;
    const rect = heroEl.getBoundingClientRect();
    const vh = Math.max(window.innerHeight || 0, 1);
    const centerY = vh * 0.5;
    const heroCenterY = rect.top + (rect.height * 0.5);
    const tolerance = Math.max(26, Math.min(58, vh * 0.06));
    return Math.abs(heroCenterY - centerY) <= tolerance;
  }

  /* ── Stability: native scrolling restored ────────────────────────
     The previous custom wheel/keyboard scroll hijack called
     preventDefault on every wheel event and replayed the scroll via
     a requestAnimationFrame loop. On some hardware (low-end laptops,
     certain Safari builds) this stalls the main thread and the page
     appears frozen. Instead we let the browser handle scrolling
     natively and only keep the ring-spin interception inside the
     hero 3D area (handled by renderer.domElement’s own listener). */
  window.addEventListener("wheel", (e)=>{
    if(shouldBypassGlobalSlowScroll(e)) return;
    if(e.ctrlKey) return;

    /* Ring auto-spin: while the 3D ring is actively animating, we
       keep it stable by absorbing the wheel event. Outside of that
       window, scrolling is fully native. */
    if(
      threeInteractionReady &&
      viewSectionActive &&
      heroInViewport &&
      pageVisible &&
      layoutMode === "ring" &&
      ringAutoSpin
    ){
      try{ e.preventDefault(); }catch(_){}
    }
  }, { passive:false });

  window.addEventListener("keydown", (e)=>{
    /* Keep native keyboard scrolling (ArrowUp/Down, PageUp/Down,
       Space, Home, End) — no custom hijack. */
    if(shouldBypassGlobalSlowScroll(e)) return;
    if(isTypingTarget(e.target)) return;
  });

  /* ★最適化：キャッシュ関数の追加 */
  function updateCinematicCache() {
    if(!ENABLE_CINEMATIC_MOTION) return;
    const scrollY = window.scrollY || window.pageYOffset;
    cinematicParallaxCache = cinematicParallaxTargets.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        el: el,
        top: rect.top + scrollY,
        height: rect.height,
        factor: parseFloat(el.dataset.motionParallax || "1"),
        prevShift: parseFloat(el.dataset.motionShift || "0")
      };
    }).filter(item => item.height > 0);
  }

  function initCinematicMotion(){
    if(!ENABLE_CINEMATIC_MOTION) return;
    const revealTargets = Array.from(document.querySelectorAll([
      ".design-hero",
      ".design-item",
      ".illus-hero",
      ".illus-card",
      ".profile-hero",
      ".profile-photo",
      ".profile-copy",
      ".contact-row",
      ".movie-stage",
      ".profile-panel"
    ].join(",")));

    let sequence = 0;
    cinematicParallaxTargets = [];
    revealTargets.forEach((el)=>{
      if(!(el instanceof HTMLElement)) return;
      el.classList.add("motion-reveal");
      const delay = Math.min((sequence % 8) * 64, 420);
      el.style.setProperty("--motion-delay", `${delay}ms`);

      if(
        el.matches(".movie-stage, .profile-panel, .contact-row") ||
        (ENABLE_WORKS_PARALLAX && el.matches(".design-item, .illus-card"))
      ){
        const factor = 0.72 + ((sequence % 7) * 0.09);
        el.dataset.motionParallax = factor.toFixed(2);
        el.dataset.motionShift = "0";
        cinematicParallaxTargets.push(el);
      }
      sequence += 1;
    });

    [heroCopyEl, layoutToggleEl, titleBadgeEl, counterBadgeEl].forEach((el)=>{
      if(!(el instanceof HTMLElement)) return;
      el.classList.add("motion-reveal", "motion-parallax", "is-inview");
      el.style.setProperty("--motion-delay", "0ms");
    });

    if(typeof IntersectionObserver !== "undefined"){
      if(cinematicRevealObserver){
        cinematicRevealObserver.disconnect();
      }
      cinematicRevealObserver = new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{
          if(!(entry.target instanceof HTMLElement)) return;
          if(entry.isIntersecting){
            entry.target.classList.add("is-inview");
          }
        });
      }, { threshold:0.14, rootMargin:"0px 0px -12% 0px" });

      revealTargets.forEach((el)=>cinematicRevealObserver.observe(el));
    }else{
      revealTargets.forEach((el)=>el.classList.add("is-inview"));
    }

    requestCinematicMotion();
  }

  /* ★最適化：キャッシュを使用したパララックス処理 */
  function applyCinematicMotion(){
    cinematicMotionFrame = 0;
    if(!ENABLE_CINEMATIC_MOTION) return;

    const vh = Math.max(window.innerHeight || 0, 1);
    const scrollY = window.scrollY || window.pageYOffset;

    if(heroEl){
      const heroRect = heroEl.getBoundingClientRect();
      const heroProgress = Math.max(0, Math.min(1, (vh - heroRect.top) / (vh + heroRect.height)));
      const driftMain = (0.5 - heroProgress) * 24;
      const driftUi = (0.5 - heroProgress) * 14;
      if(heroCopyEl) heroCopyEl.style.transform = `translate3d(0, ${driftMain.toFixed(2)}px, 0)`;
      if(layoutToggleEl) layoutToggleEl.style.transform = `translate3d(0, ${driftUi.toFixed(2)}px, 0)`;
      if(titleBadgeEl) titleBadgeEl.style.transform = `translate3d(-50%, ${(driftUi * 0.72).toFixed(2)}px, 0)`;
      if(counterBadgeEl) counterBadgeEl.style.transform = `translate3d(-50%, ${(-driftUi * 0.58).toFixed(2)}px, 0)`;
    }

    if(cinematicParallaxCache.length === 0 && cinematicParallaxTargets.length > 0) {
      updateCinematicCache();
    }

    cinematicParallaxCache.forEach((item)=>{
      const rectTop = item.top - scrollY;
      const rectBottom = rectTop + item.height;

      if(rectBottom < -120 || rectTop > vh + 120) return;

      const midY = rectTop + (item.height * 0.5);
      const normalized = (midY - (vh * 0.5)) / vh;
      const shift = Math.max(-48, Math.min(48, normalized * -30 * item.factor));
      
      if(Math.abs(shift - item.prevShift) < CINEMATIC_PARALLAX_MIN_DELTA) return;
      
      const nextShift = Number(shift.toFixed(2));
      item.prevShift = nextShift;
      item.el.dataset.motionShift = `${nextShift}`;
      item.el.style.setProperty("--parallax-shift", `${nextShift}px`);
    });
  }

  function requestCinematicMotion(){
    if(!ENABLE_CINEMATIC_MOTION) return;
    if(cinematicMotionFrame) return;
    cinematicMotionFrame = window.requestAnimationFrame(applyCinematicMotion);
  }

  function cancelProgrammaticScroll(){
    if(!programmaticScrollFrame) return;
    window.cancelAnimationFrame(programmaticScrollFrame);
    programmaticScrollFrame = 0;
  }

  function animateProgrammaticScroll(top, duration = PROGRAMMATIC_SCROLL_DURATION){
    cancelProgrammaticScroll();
    cancelSlowScroll();

    const startY = window.scrollY || window.pageYOffset || 0;
    const targetY = clampScrollY(top);

    if(Math.abs(targetY - startY) < 1){
      safeScrollToY(targetY);
      return;
    }

    const startAt = performance.now();
    const easeInOutCubic = (t)=>(t < 0.5)
      ? (4 * t * t * t)
      : (1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now)=>{
      const progress = Math.min(1, (now - startAt) / duration);
      const eased = easeInOutCubic(progress);
      const nextY = startY + ((targetY - startY) * eased);
      safeScrollToY(nextY);
      if(progress >= 1){
        programmaticScrollFrame = 0;
        safeScrollToY(targetY);
        return;
      }
      programmaticScrollFrame = window.requestAnimationFrame(step);
    };

    programmaticScrollFrame = window.requestAnimationFrame(step);
  }

  function bindIntroFilmUnlock(){
    if(introFilmUnlockBound) return;
    introFilmUnlockBound = true;

    const unlock = ()=>{
      if(viewSectionActive){
        playIntroFilm();
      }
      introFilmUnlockBound = false;
    };

    window.addEventListener("pointerdown", unlock, { once:true, passive:true });
    window.addEventListener("touchstart", unlock, { once:true, passive:true });
    window.addEventListener("keydown", unlock, { once:true });
    window.addEventListener("wheel", unlock, { once:true, passive:true });
  }

  async function playIntroFilm(){
    if(!introFilmVideoEl || !viewSectionActive) return;
    if(introFilmStageEl && introFilmStageEl.classList.contains("is-missing")) return;
    const played = await playVideo(introFilmVideoEl);
    if(!played){
      bindIntroFilmUnlock();
    }
  }

  function pauseIntroFilm(){
    if(!introFilmVideoEl) return;
    introFilmVideoEl.pause();
  }

  async function initIntroFilm(){
    if(!introFilmVideoEl) return;

    introFilmVideoEl.muted = true;
    introFilmVideoEl.defaultMuted = true;
    introFilmVideoEl.loop = true;
    introFilmVideoEl.autoplay = true;
    introFilmVideoEl.playsInline = true;
    introFilmVideoEl.setAttribute("muted", "");
    introFilmVideoEl.setAttribute("playsinline", "");
    introFilmVideoEl.setAttribute("webkit-playsinline", "");
    introFilmVideoEl.setAttribute("autoplay", "");
    introFilmVideoEl.setAttribute("loop", "");
    const rawCandidates = [
      introFilmVideoEl.getAttribute("src"),
      "/media/sasisho.mov",
      "/media/sasisho.mp4",
      "/media/saisho.mov",
      "/media/saisho.mp4",
      "/media/sasisho.MOV",
      "/media/sasisho.MP4",
      "/media/saisho.MOV",
      "/media/saisho.MP4",
      "/media/SASISHO.mp4",
      "/media/SASISHO.mov",
      "/media/SASISHO.MOV",
      "/media/SASISHO.MP4"
    ];
    const candidates = [...new Set(rawCandidates.filter(Boolean))];

    const tryIntroCandidate = ()=>{
      const nextSrc = candidates[introFilmCandidateIndex];
      if(!nextSrc){
        markIntroFilmUnavailable();
        return;
      }
      introFilmVideoEl.pause();
      introFilmVideoEl.src = nextSrc;
      introFilmVideoEl.load();
      window.setTimeout(()=>playIntroFilm(), 120);
      window.setTimeout(()=>playIntroFilm(), 600);
    };

    introFilmVideoEl.addEventListener("loadedmetadata", ()=>playIntroFilm());
    introFilmVideoEl.addEventListener("loadeddata", ()=>playIntroFilm());
    introFilmVideoEl.addEventListener("canplay", ()=>playIntroFilm());
    introFilmVideoEl.addEventListener("error", ()=>{
      introFilmCandidateIndex += 1;
      tryIntroCandidate();
    });

    introFilmCandidateIndex = 0;
    tryIntroCandidate();
  }

  function syncIntroMode(progress){
    const shouldHideUi = viewSectionActive && progress < 0.96;
    document.body.classList.toggle("is-intro-mode", shouldHideUi);
  }

  function resetIntroProgressState(){
    _introProgressDisabled = false;
    _lastIntroP = -1;
    if(introFilmStageEl){
      introFilmStageEl.style.opacity = "";
      introFilmStageEl.style.transform = "";
      introFilmStageEl.style.clipPath = "";
      introFilmStageEl.style.borderRadius = "";
    }
    if(introFilmVideoEl){
      introFilmVideoEl.style.transform = "";
    }
    if(_introCopyEl){
      _introCopyEl.style.opacity = "";
      _introCopyEl.style.transform = "";
    }
    if(introFilmScrollEl){
      introFilmScrollEl.style.opacity = "";
      introFilmScrollEl.style.removeProperty("--_scroll-btn-y");
    }
    if(heroEl){
      heroEl.style.opacity = "";
      heroEl.style.transform = "";
    }
    if(introFilmEl){
      introFilmEl.style.removeProperty("--intro-p");
      introFilmEl.style.removeProperty("--intro-progress");
      introFilmEl.style.removeProperty("--intro-ui-y");
      introFilmEl.style.removeProperty("--intro-ui-opacity");
      introFilmEl.style.removeProperty("--intro-overlay-a");
      introFilmEl.style.removeProperty("--intro-curtain-a");
      introFilmEl.style.removeProperty("--intro-shine-x");
      introFilmEl.style.removeProperty("--intro-ring-scale");
      introFilmEl.style.removeProperty("--intro-ring-opacity");
    }
    document.body.classList.remove("is-intro-leaving");
    syncIntroMode(0);
    _cacheIntroLayout();
  }

  function restoreProfileLandingState(){
    resetIntroProgressState();
    document.body.classList.remove("is-topbar-hidden");
    setSidebarCollapsed(false);
    if(introFilmVideoEl){
      try{
        introFilmVideoEl.currentTime = 0;
      }catch(_){}
    }
    playIntroFilm();
  }

  function ensureIntroProgressState(){
    if(!_introProgressDisabled || !viewSectionActive || !introFilmEl){
      return;
    }
    if(_cachedIntroTop < 0){
      _cacheIntroLayout();
    }
    const currentY = window.scrollY || window.pageYOffset || 0;
    const resumeThreshold = _cachedIntroTop + _cachedIntroTravel - 8;
    if(currentY < resumeThreshold){
      resetIntroProgressState();
    }
  }

  /* intro-film のレイアウト値をキャッシュ（スクロール毎の強制レイアウトを回避） */
  let _cachedIntroTop    = -1;
  let _cachedIntroTravel = 1;
  let _cachedVW = window.innerWidth;
  let _cachedVH = window.innerHeight;
  function _cacheIntroLayout(){
    if(!introFilmEl) return;
    _cachedVW = window.innerWidth;
    _cachedVH = window.innerHeight;
    _cachedIntroTop    = introFilmEl.offsetTop;
    _cachedIntroTravel = Math.max(1, introFilmEl.offsetHeight - _cachedVH);
  }

  /* intro-filmアニメーション対象要素 (キャッシュ) */
  let _introCopyEl = null;

  /* スクロールごとに走る intro-film progress が view 上を通過するときも
     毎フレーム inline スタイルを書き込んでいたのが、view カクツキの
     大きな原因。p === 1（intro が完全に画面外）になったら以降は再計算しない。 */
  let _lastIntroP = -1;
  function applyIntroFilmProgress(){
    introFilmProgressFrame = 0;
    if(!introFilmEl || !viewMap.profile || !introFilmStageEl){
      syncIntroMode(1);
      return;
    }
    if(_cachedIntroTop < 0) _cacheIntroLayout();
    if(!_introCopyEl) _introCopyEl = introFilmEl.querySelector(".intro-film-copy");

    const p  = Math.max(0, Math.min(1, (window.scrollY - _cachedIntroTop) / _cachedIntroTravel));
    /* p の変化が極小、または既に最終値で止まっているなら全 write を skip */
    if(_lastIntroP >= 0 && Math.abs(p - _lastIntroP) < 0.002){
      return;
    }
    if(_lastIntroP === 1 && p === 1){
      return;
    }
    /* intro が完全に画面外（p === 1）になったら、最終値を一度だけ書いてから
       以降は scroll 毎の rAF を一切走らせない（view 通過中の毎フレ書き込み
       が view カクツキの主因だったため、根元から止める）。 */
    var _shouldHardStopAfterThis = (p >= 0.9999 && _lastIntroP < 0.9999);
    _lastIntroP = p;
    const vw = _cachedVW;
    const vh = _cachedVH;
    const easedP = p * p * (3 - 2 * p);
    const exitP = Math.max(0, Math.min(1, (p - 0.1) / 0.9));

    if(introFilmEl){
      introFilmEl.style.setProperty("--intro-p", p.toFixed(3));
      introFilmEl.style.setProperty("--intro-progress", `${(p * 100).toFixed(2)}%`);
      introFilmEl.style.setProperty("--intro-ui-y", `${(-18 * p).toFixed(2)}px`);
      introFilmEl.style.setProperty("--intro-ui-opacity", `${Math.max(0, 0.82 - p * 0.58).toFixed(3)}`);
      introFilmEl.style.setProperty("--intro-overlay-a", `${(0.72 + p * 0.2).toFixed(3)}`);
      introFilmEl.style.setProperty("--intro-curtain-a", `${(0.58 + p * 0.32).toFixed(3)}`);
      introFilmEl.style.setProperty("--intro-shine-x", `${(50 + p * 18).toFixed(2)}%`);
      introFilmEl.style.setProperty("--intro-ring-scale", `${(1 - p * 0.12).toFixed(4)}`);
      introFilmEl.style.setProperty("--intro-ring-opacity", `${Math.max(0, 0.68 - p * 0.52).toFixed(3)}`);
    }
    document.body.classList.toggle("is-intro-leaving", p > 0.08 && p < 0.985);

    /* CSS変数を使わず直接スタイルを書く → スタイル再計算ゼロ */

    /* .intro-film-stage */
    introFilmStageEl.style.opacity   = 1 - exitP * 0.18;
    introFilmStageEl.style.transform = `translate3d(0,${(easedP * 18).toFixed(2)}px,0) scale(${(1.006 - easedP * 0.052).toFixed(4)})`;
    introFilmStageEl.style.clipPath = `inset(${(easedP * 3.2).toFixed(2)}% ${(easedP * 2.2).toFixed(2)}% ${(easedP * 2.7).toFixed(2)}% ${(easedP * 2.2).toFixed(2)}% round ${(easedP * 30).toFixed(2)}px)`;
    introFilmStageEl.style.borderRadius = `${(easedP * 34).toFixed(2)}px`;

    /* video */
    if(introFilmVideoEl){
      introFilmVideoEl.style.transform = `translate3d(${p * -1.2 * vw / 100}px,${p * -1.4 * vh / 100}px,0) scale(${(1.055 + easedP * 0.19).toFixed(4)})`;
    }

    /* .intro-film-copy */
    if(_introCopyEl){
      _introCopyEl.style.opacity   = Math.max(0, 0.98 - p * 1.5);
      _introCopyEl.style.transform = `translate3d(${p * -1.4 * vw / 100}px,${p * -36}px,0) scale(${(1 - easedP * 0.035).toFixed(4)})`;
    }

    /* scroll button — CSS var で Y 値を渡し hover が CSS で正しく計算できるようにする */
    if(introFilmScrollEl){
      introFilmScrollEl.style.opacity = Math.max(0, 0.94 - p * 1.42);
      introFilmScrollEl.style.setProperty("--_scroll-btn-y", `${(p * 20).toFixed(2)}px`);
    }

    /* .hero-3d */
    if(heroEl){
      heroEl.style.opacity   = 0.18 + easedP * 0.82;
      heroEl.style.transform = `translate3d(0,${((1 - easedP) * 88).toFixed(2)}px,0) scale(${(0.958 + easedP * 0.042).toFixed(4)})`;
    }

    syncIntroMode(p);

    /* intro が画面外まで流れ切ったら、以降のスクロールで二度と動かさない。
       これで view 通過中の毎フレーム inline-style 書き込みが完全に消える。 */
    if(_shouldHardStopAfterThis){
      _introProgressDisabled = true;
    }
  }

  /* intro が完全に流れ切った後はスクロール毎の rAF を完全停止するためのフラグ */
  let _introProgressDisabled = false;
  function requestIntroFilmProgress(){
    if(_introProgressDisabled) return;
    if(introFilmProgressFrame) return;
    introFilmProgressFrame = requestAnimationFrame(applyIntroFilmProgress);
  }

  function initSectionLoopVideos(){}

  function syncSectionLoopVideosByView(){}

  function pauseAllShowreels(){
    [showreelA, showreelB].forEach((v)=>{
      if(v) v.pause();
    });
  }

  function playCurrentShowreel(){
    if(!activeShowreel || !activeShowreel.src) return;
    playVideo(activeShowreel);
  }

  function waitForVideoReady(video, timeoutMs = 4000){
    return new Promise((resolve, reject)=>{
      if(!video){
        reject(new Error("video missing"));
        return;
      }
      if(video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE){
        reject(new Error(`video failed: ${video.currentSrc || video.src || "(unknown)"}`));
        return;
      }
      if(video.readyState >= 2){
        resolve(video);
        return;
      }

      let settled = false;
      let timeoutId = 0;
      const cleanup = ()=>{
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("error", onError);
        if(timeoutId) window.clearTimeout(timeoutId);
      };
      const finish = (ok)=>{
        if(settled) return;
        settled = true;
        cleanup();
        if(ok){
          resolve(video);
        }else{
          reject(new Error(`video failed: ${video.currentSrc || video.src || "(unknown)"}`));
        }
      };
      const onReady = ()=>finish(true);
      const onError = ()=>finish(false);

      video.addEventListener("loadeddata", onReady);
      video.addEventListener("canplay", onReady);
      video.addEventListener("error", onError);
      timeoutId = window.setTimeout(onError, timeoutMs);
    });
  }

  function probeVideoSource(src, timeoutMs = 1200){
    return new Promise((resolve)=>{
      if(!src){
        resolve(false);
        return;
      }

      const probe = document.createElement("video");
      let settled = false;
      let timeoutId = 0;

      const cleanup = ()=>{
        probe.removeEventListener("loadedmetadata", onReady);
        probe.removeEventListener("canplay", onReady);
        probe.removeEventListener("error", onError);
        if(timeoutId) window.clearTimeout(timeoutId);
        try{
          probe.removeAttribute("src");
          probe.load();
        }catch(_e){}
      };
      const finish = (ok)=>{
        if(settled) return;
        settled = true;
        cleanup();
        resolve(ok);
      };
      const onReady = ()=>finish(true);
      const onError = ()=>finish(false);

      probe.preload = "metadata";
      probe.muted = true;
      probe.defaultMuted = true;
      probe.playsInline = true;
      probe.setAttribute("playsinline", "");
      probe.addEventListener("loadedmetadata", onReady);
      probe.addEventListener("canplay", onReady);
      probe.addEventListener("error", onError);
      timeoutId = window.setTimeout(onError, timeoutMs);
      probe.src = src;
      probe.load();
    });
  }

  async function findSequentialMovies(ext){
    const list = [];
    const MAX_SCAN = 16;
    for(let i=1; i<=MAX_SCAN; i++){
      const src = `movie${i}${ext}`;
      const ok = await probeVideoSource(src);
      if(ok){
        list.push(src);
        continue;
      }
      break;
    }
    return list;
  }

  async function detectShowreelList(){
    const movList = await findSequentialMovies(".mov");
    if(movList.length) return movList;
    const mp4List = await findSequentialMovies(".mp4");
    return mp4List;
  }

  function onActiveShowreelTimeUpdate(){
    if(!viewSectionActive) return;
    if(showreelSwitching) return;
    if(showreelList.length <= 1) return;

    const duration = activeShowreel.duration;
    if(!Number.isFinite(duration) || duration <= 0) return;
    const remain = duration - activeShowreel.currentTime;
    if(remain <= SHOWREEL_CROSSFADE_LEAD){
      transitionToNextShowreel();
    }
  }

  function syncShowreelLoopState(){
    const shouldLoop = showreelList.length <= 1;
    if(activeShowreel) activeShowreel.loop = shouldLoop;
    if(standbyShowreel) standbyShowreel.loop = shouldLoop;
  }

  function removeShowreelAt(index){
    if(index < 0 || index >= showreelList.length) return;
    showreelList.splice(index, 1);
    if(index < showreelIndex){
      showreelIndex -= 1;
    }
    if(showreelIndex >= showreelList.length){
      showreelIndex = 0;
    }
    syncShowreelLoopState();
  }

  async function transitionToNextShowreel(){
    if(!activeShowreel || !standbyShowreel) return;
    if(showreelSwitching) return;
    if(showreelList.length <= 1) return;

    showreelSwitching = true;
    const nextIndex = (showreelIndex + 1) % showreelList.length;
    standbyShowreel.src = showreelList[nextIndex];
    standbyShowreel.load();

    const activateNext = ()=>{
      standbyShowreel.classList.add("is-active");
      activeShowreel.classList.remove("is-active");

      if(viewSectionActive) playVideo(standbyShowreel);
      activeShowreel.pause();
      activeShowreel.currentTime = 0;
      activeShowreel.removeEventListener("timeupdate", onActiveShowreelTimeUpdate);

      showreelIndex = nextIndex;
      const prev = activeShowreel;
      activeShowreel = standbyShowreel;
      standbyShowreel = prev;
      activeShowreel.addEventListener("timeupdate", onActiveShowreelTimeUpdate);
      showreelSwitching = false;
    };

    try{
      await waitForVideoReady(standbyShowreel);
      activateNext();
    }catch(_e){
      removeShowreelAt(nextIndex);
      showreelSwitching = false;
      if(!showreelList.length){
        markShowreelUnavailable();
        return;
      }
      if(showreelList.length === 1){
        syncShowreelLoopState();
        return;
      }
      transitionToNextShowreel();
    }
  }

  async function initShowreel(){
    if(!showreelA || !showreelB || !storyMovieStage) return;
    showreelList = await detectShowreelList();
    if(!showreelList.length){
      console.warn("[SHOWREEL] movie1.mov / movie1.mp4 が見つかりません。");
      markShowreelUnavailable();
      return;
    }

    activeShowreel.classList.add("is-active");
    standbyShowreel.classList.remove("is-active");
    syncShowreelLoopState();

    while(showreelList.length){
      showreelIndex = 0;
      activeShowreel.src = showreelList[0];
      activeShowreel.load();
      try{
        await waitForVideoReady(activeShowreel);
        playCurrentShowreel();
        if(showreelList.length > 1){
          activeShowreel.addEventListener("timeupdate", onActiveShowreelTimeUpdate);
        }
        return;
      }catch(_e){
        removeShowreelAt(0);
      }
    }

    console.warn("[SHOWREEL] 再生可能な動画が見つかりません。");
    markShowreelUnavailable();
  }

  initIntroFilm();
  initSectionLoopVideos();
  setupAssetFallbacks();

  if(heroEl){
    if(typeof IntersectionObserver !== "undefined"){
      const heroVisibilityObserver = new IntersectionObserver((entries)=>{
        const entry = entries[0];
        const wasVisible = heroInViewport;
        heroInViewport = !!(entry && entry.isIntersecting && entry.intersectionRatio > 0.02);
        if(heroInViewport && !wasVisible){
          requestViewRenderLoop();
        }
      }, { threshold:[0, 0.02, 0.08] });
      heroVisibilityObserver.observe(heroEl);
    }else{
      const syncHeroVisibility = ()=>{
        const rect = heroEl.getBoundingClientRect();
        const wasVisible = heroInViewport;
        heroInViewport = rect.bottom > 0 && rect.top < window.innerHeight;
        if(heroInViewport && !wasVisible){
          requestViewRenderLoop();
        }
      };
      syncHeroVisibility();
      window.addEventListener("scroll", syncHeroVisibility, { passive:true });
      window.addEventListener("resize", syncHeroVisibility);
    }
  }

  function getVisibleViews(view){
    return [view];
  }

  function syncThemeViewClass(view){
    document.body.classList.remove(...themeViewClasses);
    document.body.classList.add("theme-view-" + view);
  }
  syncThemeViewClass(currentViewKey);

  /* ── Sliding indicator ─────────────────────────────── */
  const _menuEl = document.querySelector(".menu");
  let _menuIndicator = null;
  if(_menuEl){
    _menuIndicator = document.createElement("div");
    _menuIndicator.className = "menu-indicator";
    _menuEl.insertBefore(_menuIndicator, _menuEl.firstChild);
  }
  function _updateIndicator(instant){
    if(!_menuIndicator || !_menuEl) return;
    const activeLink = _menuEl.querySelector("a.active");
    if(!activeLink){ _menuIndicator.style.opacity = "0"; return; }
    const mTop  = _menuEl.getBoundingClientRect().top;
    const lRect = activeLink.getBoundingClientRect();
    if(instant){
      _menuIndicator.style.transition = "none";
      _menuIndicator.style.top     = (lRect.top - mTop) + "px";
      _menuIndicator.style.height  = lRect.height + "px";
      _menuIndicator.style.opacity = "1";
      void _menuIndicator.offsetWidth;
      _menuIndicator.style.transition = "";
    } else {
      _menuIndicator.style.top     = (lRect.top - mTop) + "px";
      _menuIndicator.style.height  = lRect.height + "px";
      _menuIndicator.style.opacity = "1";
    }
  }
  requestAnimationFrame(()=> _updateIndicator(true));

  /* ── View image preloader: Promiseベース ── */
  function _waitForViewImages(viewEls, timeoutMs){
    timeoutMs = timeoutMs || 3500;
    var imgs = [];
    viewEls.forEach(function(el){
      if(!(el instanceof Element)) return;
      el.querySelectorAll("img").forEach(function(img){
        imgs.push(img);
      });
    });
    if(!imgs.length) return Promise.resolve();

    return new Promise(function(resolve){
      var remaining = imgs.length;
      var resolved  = false;
      var timer = setTimeout(function(){ resolved = true; resolve(); }, timeoutMs);
      function finish(){
        if(resolved) return;
        remaining--;
        if(remaining <= 0){
          resolved = true;
          clearTimeout(timer);
          resolve();
        }
      }
      imgs.forEach(function(img){
        /* complete = ロード済み OR エラー済み、どちらも「終わった」として扱う */
        if(img.complete){
          finish();
        } else {
          img.addEventListener("load",  finish, { once: true });
          img.addEventListener("error", finish, { once: true });
        }
      });
    });
  }

  /* ── Stagger（intro-filmは除外） ────────────────────── */
  function _staggerView(_viewEl){
    /* 切替時のセクション stagger アニメは撤廃。
       view 切替で各セクションに will-change 相当の合成レイヤーが確保され、
       hundreds-of-cards の design/illus で 1〜2 秒のフリーズを引き起こしていた。
       view 自体のフェードはもう CSS でやらないので、ここも no-op にする。 */
  }

  /* ── setView ────────────────────────────────────────── */
  function setView(view, instant = false, forceTop = false){
    const visibleViews = getVisibleViews(view);
    if(!visibleViews.length || visibleViews.some((key)=>!viewMap[key])) return;
    if(view === currentViewKey && forceTop){
      requestAnimationFrame(()=>{ safeScrollToTop(); });
      return;
    }
    if(view === currentViewKey && !instant) return;

    /* 退場: 高さ0 + opacity fade だけ — position は変えない */
    const leavingEls = Object.values(viewMap).filter(el=>el.classList.contains("is-active"));
    leavingEls.forEach(el=>{
      el.classList.add("is-leaving");
      el.classList.remove("is-active");
    });

    /* カーテン（ごく薄くフラッシュ） */
    if(!instant){
      const _curtain = document.getElementById("nav-curtain");
      if(_curtain){
        _curtain.classList.remove("flash");
        /* double-rAF: reflow なしでアニメーションリセット */
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          _curtain.classList.add("flash");
        }));
      }
    }

    /* メニュー更新 */
    viewSwitchLinks.forEach((a)=>a.classList.toggle("active", a.dataset.view === view));
    currentViewKey = view;
    syncThemeViewClass(view);
    requestAnimationFrame(()=> _updateIndicator(false));

    /* 新ビュー: 透明で挿入 → 画像ロード完了後にフェードイン */
    const ENTER_DELAY = instant ? 0 : 50;
    setTimeout(()=>{
      leavingEls.forEach(el=>el.classList.remove("is-leaving"));
      const enterEls = visibleViews.map((key)=>viewMap[key]).filter(Boolean);

      if(instant){
        enterEls.forEach((el)=>el.classList.add("is-active"));
      } else {
        enterEls.forEach((el)=>{
          el.classList.add("is-active");
          _staggerView(el);
        });
      }
    }, ENTER_DELAY);

    /* 動画 / 3D */
    viewSectionActive = visibleViews.includes("profile");
    if(viewSectionActive){
      if(threeInteractionReady){
        viewScrollSpinCarry = 0;
        viewScrollSpinDirection = 0;
        if(typeof resize3D === "function"){
          try{ resize3D(); }catch(_e){}
        }
        requestViewRenderLoop();
      }
      playIntroFilm();
      playCurrentShowreel();
    }else{
      pauseIntroFilm();
      pauseAllShowreels();
      syncIntroMode(1);
    }
    syncSectionLoopVideosByView();
    if(window.innerWidth <= 820){ setSidebarCollapsed(true); }

    /* キャンセル: 前のビューで動いていたプログラマティックスクロールを止める */
    cancelProgrammaticScroll();
    cancelSlowScroll();
    requestAnimationFrame(()=>{
      safeScrollToTop();
      slowScrollTargetY = 0; /* ターゲットもリセット */
      requestIntroFilmProgress();
      requestCinematicMotion();
    });
  }

  /* ── Menu click: tap pulse on active item ── */
  viewSwitchLinks.forEach((a)=>{
    a.addEventListener("click", (e)=>{
      e.preventDefault();
      const forceTop = a.dataset.forceTop === "1";
      /* tap animation */
      a.classList.remove("is-tapping");
      void a.offsetWidth;
      a.classList.add("is-tapping");
      setTimeout(()=>a.classList.remove("is-tapping"), 420);
      setView(a.dataset.view, false, forceTop);
    });
  });

  homeBackEls.forEach((el)=>{
    el.addEventListener("click", (e)=>{
      e.preventDefault();
      setView("profile", false, true);
    });
    el.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        setView("profile", false, true);
      }
    });
  });

  const cursor = document.getElementById("cursor");
  if(isCoarsePointer){
    document.documentElement.style.cursor = "auto";
    document.body.style.cursor = "auto";
    if(cursor) cursor.style.display = "none";
  }
  
  /* ★最適化＆修正：メインカーソルのズレ（遅延）を解消 */
  let tx=0, ty=0;
  window.addEventListener("mousemove", (e)=>{ 
    tx = e.clientX; 
    ty = e.clientY; 
    if(!isCoarsePointer && cursor) {
      cursor.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    }
  });

  const trailCanvas = document.getElementById("trail");
  const tctx = trailCanvas ? trailCanvas.getContext("2d") : null;
  /* TRAIL（カーソル軌跡 canvas）は毎フレーム全画面 clearRect が発生して
     スクロール時のフレームを食う。完全停止する。 */
  const ENABLE_TRAIL = false;
  if(!ENABLE_TRAIL && trailCanvas){
    trailCanvas.style.display = "none";
  }
  let trailPoints = [];
  function resizeTrail(){
    if(!trailCanvas) return;
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
  }
  resizeTrail();
  if(ENABLE_TRAIL){
    window.addEventListener("mousemove", (e)=>{
      trailPoints.push({x:e.clientX, y:e.clientY, t:performance.now()});
      if(trailPoints.length > 80) trailPoints.shift();
    });
    window.addEventListener("mouseleave", ()=>{ trailPoints = []; });
  }
  function drawTrail(){
    if(!ENABLE_TRAIL || !trailCanvas || !tctx) return;
    const now = performance.now();
    while(trailPoints.length && now - trailPoints[0].t > 420) trailPoints.shift();
    tctx.clearRect(0,0,trailCanvas.width, trailCanvas.height);
    if(trailPoints.length < 2) return;

    tctx.lineCap = "round";
    tctx.lineJoin = "round";
    for(let i=1;i<trailPoints.length;i++){
      const p0 = trailPoints[i-1];
      const p1 = trailPoints[i];
      const age = (now - p1.t) / 420;
      const alpha = Math.max(0, 0.35 * (1 - age));
      const width = 1.6 * (1 - age) + 0.2;
      tctx.strokeStyle = `rgba(220,220,220,${alpha * 0.55})`;
      tctx.lineWidth = width;
      tctx.beginPath();
      tctx.moveTo(p0.x, p0.y);
      tctx.lineTo(p1.x, p1.y);
      tctx.stroke();
    }
  }

  let layoutMode = "scroll";
  let ringAutoSpin = null;
  let viewScrollFrame = 0;
  let viewScrollActiveIndex = -1;

  const viewScrollEl = heroEl && heroEl.classList.contains("view-scroll-system") ? heroEl : null;
  const viewScrollStickyEl = viewScrollEl ? viewScrollEl.querySelector(".view-scroll-sticky") : null;
  const viewScrollMediaEl = document.getElementById("viewScrollMedia");
  const viewScrollTrackEl = document.getElementById("viewScrollTrack");
  const viewLegacy3dEl = document.getElementById("viewLegacy3d");
  const legacy3dStageEl = document.getElementById("legacy3dStage");
  const legacy3dRingEl = document.getElementById("legacy3dRing");
  const legacy3dCards = viewLegacy3dEl ? Array.from(viewLegacy3dEl.querySelectorAll(".view-legacy-card")) : [];
  const legacy3dCounterEl = document.getElementById("legacy3dCounter");
  const legacy3dTitleEl = document.getElementById("legacy3dTitle");
  const legacy3dPrevEl = document.getElementById("legacy3dPrev");
  const legacy3dNextEl = document.getElementById("legacy3dNext");
  const viewArchiveEl = document.getElementById("viewArchive");
  const viewScrollSlides = viewScrollEl ? Array.from(viewScrollEl.querySelectorAll(".view-scroll-slide")) : [];
  const viewScrollButtons = viewScrollEl ? Array.from(viewScrollEl.querySelectorAll("[data-view-scroll-index]")) : [];
  const viewScrollTitleEl = document.getElementById("viewScrollTitle");
  const viewScrollBodyEl = document.getElementById("viewScrollBody");
  const viewScrollCounterEl = document.getElementById("viewScrollCounter");
  const viewScrollBarEl = document.getElementById("viewScrollBar");
  let viewScrollMetrics = { step:0, maxX:0 };
  let viewScrollProgress = 0;
  let viewScrollDrag = null;
  let legacy3dTarget = 0;
  let legacy3dCurrent = 0;
  let legacy3dFrame = 0;
  let legacy3dActive = -1;
  let legacy3dWheelSnapTimer = 0;

  function resize3D(){
    requestViewRenderLoop();
  }

  function requestViewRenderLoop(){
    if(!viewScrollEl) return;
    if(viewScrollFrame) return;
    viewScrollFrame = requestAnimationFrame(updateViewScrollSystem);
  }

  function clamp01(n){
    return Math.max(0, Math.min(1, n));
  }

  function measureViewScrollSystem(){
    if(!viewScrollMediaEl || !viewScrollTrackEl || !viewScrollSlides.length) return;
    const mediaRect = viewScrollMediaEl.getBoundingClientRect();
    const mediaWidth = Math.max(1, mediaRect.width || viewScrollMediaEl.clientWidth || window.innerWidth || 1);
    const isSmall = window.matchMedia("(max-width: 620px)").matches;
    const isMedium = window.matchMedia("(max-width: 980px)").matches;
    const slideWidth = isSmall
      ? mediaWidth * 0.86
      : isMedium
        ? mediaWidth * 0.84
        : Math.min(mediaWidth * 0.76, 880);
    const gap = isSmall ? 14 : Math.max(16, Math.min(36, window.innerWidth * 0.024));
    const step = Math.max(1, slideWidth + gap);

    viewScrollSlides.forEach((slide, i)=>{
      slide.style.width = slideWidth.toFixed(2) + "px";
      slide.style.left = (i * step).toFixed(2) + "px";
    });
    viewScrollTrackEl.style.width = ((step * Math.max(0, viewScrollSlides.length - 1)) + slideWidth).toFixed(2) + "px";

    viewScrollMetrics = {
      step,
      maxX:step * Math.max(0, viewScrollSlides.length - 1)
    };
  }

  function setViewScrollProgress(progress){
    viewScrollProgress = clamp01(progress);
    if(viewScrollEl){
      viewScrollEl.classList.toggle("is-cycle-complete", viewScrollProgress >= 0.985);
    }
    requestViewRenderLoop();
  }

  function placeViewArchiveAfterHero(){
    if(!viewArchiveEl) return;
    const anchor = viewLegacy3dEl || viewScrollEl;
    if(!anchor || !anchor.parentNode) return;
    if(anchor.nextElementSibling === viewArchiveEl) return;
    anchor.insertAdjacentElement("afterend", viewArchiveEl);
  }

  function placeLegacy3dAfterHero(){
    if(!viewScrollEl || !viewLegacy3dEl || !viewScrollEl.parentNode) return;
    if(viewScrollEl.nextElementSibling === viewLegacy3dEl) return;
    viewScrollEl.insertAdjacentElement("afterend", viewLegacy3dEl);
  }

  function normalizeLegacyIndex(value){
    if(!legacy3dCards.length) return 0;
    return ((value % legacy3dCards.length) + legacy3dCards.length) % legacy3dCards.length;
  }

  function requestLegacy3dRender(){
    if(legacy3dFrame || !legacy3dRingEl || !legacy3dCards.length) return;
    legacy3dFrame = requestAnimationFrame(renderLegacy3d);
  }

  function setLegacy3dTarget(index){
    legacy3dTarget = Number.isFinite(index) ? index : 0;
    if(viewLegacy3dEl){
      viewLegacy3dEl.classList.remove("is-orbit-complete");
    }
    requestLegacy3dRender();
  }

  function queueLegacy3dWheelSnap(){
    if(legacy3dWheelSnapTimer){
      window.clearTimeout(legacy3dWheelSnapTimer);
    }
    legacy3dWheelSnapTimer = window.setTimeout(()=>{
      legacy3dWheelSnapTimer = 0;
      setLegacy3dTarget(Math.round(legacy3dTarget));
    }, 130);
  }

  function syncLegacy3dActive(){
    if(!legacy3dCards.length) return;
    const active = normalizeLegacyIndex(Math.round(legacy3dCurrent));
    if(active === legacy3dActive) return;
    legacy3dActive = active;
    legacy3dCards.forEach((card, i)=>{
      const directDistance = Math.abs(i - active);
      const distance = Math.min(directDistance, legacy3dCards.length - directDistance);
      card.classList.toggle("is-active", i === active);
      card.classList.toggle("is-neighbor", distance === 1);
      card.setAttribute("aria-hidden", i === active ? "false" : "true");
    });
    if(legacy3dCounterEl){
      legacy3dCounterEl.textContent = String(active + 1).padStart(2, "0") + " / " + String(legacy3dCards.length).padStart(2, "0");
    }
    if(legacy3dTitleEl){
      legacy3dTitleEl.textContent = legacy3dCards[active].dataset.title || "";
    }
  }

  function renderLegacy3d(){
    legacy3dFrame = 0;
    if(!legacy3dRingEl || !legacy3dCards.length) return;
    const diff = legacy3dTarget - legacy3dCurrent;
    legacy3dCurrent += diff * 0.12;
    if(Math.abs(diff) < 0.001){
      legacy3dCurrent = legacy3dTarget;
    }else{
      requestLegacy3dRender();
    }
    const count = legacy3dCards.length;
    if(Math.abs(legacy3dCurrent) > count * 200){
      const offset = Math.trunc(legacy3dCurrent / count) * count;
      legacy3dCurrent -= offset;
      legacy3dTarget -= offset;
    }
    const stageRect = legacy3dStageEl ? legacy3dStageEl.getBoundingClientRect() : { width:window.innerWidth || 1 };
    const firstRect = legacy3dCards[0].getBoundingClientRect();
    const cardW = Math.max(1, firstRect.width || 260);
    const stageW = Math.max(1, stageRect.width || window.innerWidth || 1);
    const sideGap = Math.max(cardW * 1.08, Math.min(stageW * 0.5, 740));
    legacy3dRingEl.style.setProperty("--legacy-rotation", "0deg");
    const wrappedCurrent = normalizeLegacyIndex(legacy3dCurrent);
    legacy3dCards.forEach((card, i)=>{
      let rel = i - wrappedCurrent;
      if(rel > count / 2) rel -= count;
      if(rel < -count / 2) rel += count;
      const abs = Math.abs(rel);
      const clipped = Math.max(-4, Math.min(4, rel));
      const scale = Math.max(0.58, 1.04 - Math.min(abs, 4) * 0.14);
      const x = clipped * sideGap;
      const y = Math.min(abs, 3) * 14;
      const z = -Math.min(abs, 4) * 70;
      const tilt = Math.max(-12, Math.min(12, -clipped * 4.5));
      const visible = abs <= 2.35;
      card.style.transform = "translate(-50%, -50%) translate3d(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px, " + z.toFixed(2) + "px) rotateY(" + tilt.toFixed(2) + "deg) scale(" + scale.toFixed(3) + ")";
      card.style.zIndex = String(1000 - Math.round(abs * 10));
      card.style.opacity = visible ? "" : "0";
      card.style.pointerEvents = abs < 1.2 ? "auto" : "none";
    });
    syncLegacy3dActive();
  }

  function isLegacy3dVisible(){
    if(!viewLegacy3dEl || !viewSectionActive) return false;
    const rect = viewLegacy3dEl.getBoundingClientRect();
    const viewport = Math.max(window.innerHeight || 1, 1);
    return rect.top < viewport * 0.74 && rect.bottom > viewport * 0.26;
  }

  function initLegacy3dView(){
    if(!viewLegacy3dEl || !legacy3dRingEl || !legacy3dCards.length) return;
    legacy3dCards.forEach((card, i)=>{
      card.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    });
    syncLegacy3dActive();
    requestLegacy3dRender();
    if(legacy3dPrevEl){
      legacy3dPrevEl.addEventListener("click", ()=>setLegacy3dTarget(Math.round(legacy3dTarget) - 1));
    }
    if(legacy3dNextEl){
      legacy3dNextEl.addEventListener("click", ()=>setLegacy3dTarget(Math.round(legacy3dTarget) + 1));
    }
    viewLegacy3dEl.addEventListener("wheel", (event)=>{
      if(!isLegacy3dVisible() || event.ctrlKey) return;
      if(Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      const delta = event.deltaX;
      if(!delta) return;
      event.preventDefault();
      cancelSlowScroll();
      setLegacy3dTarget(legacy3dTarget + (delta * 0.006));
      queueLegacy3dWheelSnap();
    }, { passive:false });
    viewLegacy3dEl.addEventListener("pointerdown", (event)=>{
      if(event.pointerType === "mouse" && event.button !== 0) return;
      if(event.target instanceof Element && event.target.closest("button, a")) return;
      if(legacy3dWheelSnapTimer){
        window.clearTimeout(legacy3dWheelSnapTimer);
        legacy3dWheelSnapTimer = 0;
      }
      const startX = event.clientX;
      const startTarget = legacy3dTarget;
      viewLegacy3dEl.classList.add("is-dragging");
      try{ viewLegacy3dEl.setPointerCapture(event.pointerId); }catch(_){}
      const move = (moveEvent)=>{
        if(moveEvent.pointerId !== event.pointerId) return;
        setLegacy3dTarget(startTarget + ((startX - moveEvent.clientX) * 0.018));
      };
      const up = (upEvent)=>{
        if(upEvent.pointerId !== event.pointerId) return;
        viewLegacy3dEl.classList.remove("is-dragging");
        viewLegacy3dEl.removeEventListener("pointermove", move);
        viewLegacy3dEl.removeEventListener("pointerup", up);
        viewLegacy3dEl.removeEventListener("pointercancel", up);
        setLegacy3dTarget(Math.round(legacy3dTarget));
      };
      viewLegacy3dEl.addEventListener("pointermove", move);
      viewLegacy3dEl.addEventListener("pointerup", up);
      viewLegacy3dEl.addEventListener("pointercancel", up);
    });
    window.addEventListener("keydown", (event)=>{
      if(event.defaultPrevented) return;
      if(event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if(event.altKey || event.ctrlKey || event.metaKey) return;
      if(!isLegacy3dVisible()) return;
      if(event.target instanceof Element && event.target.closest("[contenteditable=\"true\"], input, textarea, select")) return;
      event.preventDefault();
      cancelSlowScroll();
      setLegacy3dTarget(Math.round(legacy3dTarget) + (event.key === "ArrowRight" ? 1 : -1));
    });
  }

  function setViewScrollIndex(index){
    if(!viewScrollSlides.length) return;
    const max = viewScrollSlides.length - 1;
    const safeIndex = Math.max(0, Math.min(max, index));
    if(safeIndex === viewScrollActiveIndex) return;
    viewScrollActiveIndex = safeIndex;

    const slide = viewScrollSlides[safeIndex];
    const activeNo = String(safeIndex + 1).padStart(2, "0");
    if(viewScrollStickyEl){
      viewScrollStickyEl.dataset.activeNo = activeNo;
    }
    viewScrollSlides.forEach((el, i)=>{
      const active = i === safeIndex;
      const distance = Math.min(4, Math.abs(i - safeIndex));
      el.dataset.no = String(i + 1).padStart(2, "0");
      el.style.setProperty("--slide-distance", distance);
      el.classList.toggle("is-active", active);
      el.classList.toggle("is-neighbor", Math.abs(i - safeIndex) === 1);
      el.classList.toggle("is-before", i < safeIndex);
      el.classList.toggle("is-after", i > safeIndex);
      el.setAttribute("aria-hidden", i === safeIndex ? "false" : "true");
    });
    viewScrollButtons.forEach((btn, i)=>{
      const active = i === safeIndex;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "true" : "false");
    });

    if(viewScrollTitleEl){
      viewScrollTitleEl.textContent = slide.dataset.title || "";
    }
    if(viewScrollBodyEl){
      viewScrollBodyEl.textContent = slide.dataset.body || "";
    }
    if(viewScrollCounterEl){
      viewScrollCounterEl.textContent = activeNo + " / " + String(viewScrollSlides.length).padStart(2, "0");
    }
  }

  function updateViewScrollSystem(){
    viewScrollFrame = 0;
    if(!viewScrollEl || !viewScrollSlides.length) return;
    const progress = viewScrollProgress;
    const rawIndex = progress * (viewScrollSlides.length - 1);
    const index = Math.round(rawIndex);
    const trackX = progress * viewScrollMetrics.maxX;
    setViewScrollIndex(index);
    viewScrollEl.style.setProperty("--view-progress", progress.toFixed(4));
    viewScrollEl.style.setProperty("--view-step-progress", (rawIndex - Math.floor(rawIndex)).toFixed(4));
    viewScrollEl.style.setProperty("--view-track-x", trackX.toFixed(2) + "px");
    if(viewScrollTrackEl){
      viewScrollTrackEl.style.transform = "translate3d(" + (-trackX).toFixed(2) + "px, 0, 0)";
    }
    if(viewScrollBarEl){
      viewScrollBarEl.style.transform = "scaleX(" + progress.toFixed(4) + ")";
    }
    drawTrail();
  }

  function isViewScrollWheelAreaVisible(){
    if(!viewScrollEl || !viewSectionActive) return false;
    const rect = viewScrollEl.getBoundingClientRect();
    const viewport = Math.max(window.innerHeight || 1, 1);
    return rect.top < viewport * 0.62 && rect.bottom > viewport * 0.38;
  }

  function handleViewScrollWheel(event){
    if(event.defaultPrevented) return;
    if(event.target instanceof Element && event.target.closest(".sidebar, .sidebar-toggle, #loader, #wv")) return;
    if(!viewScrollEl || !viewScrollSlides.length || !isViewScrollWheelAreaVisible()) return;
    if(event.ctrlKey) return;
    if(Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    const horizontalDelta = event.deltaX;
    if(!horizontalDelta) return;

    const atStart = viewScrollProgress <= 0.001;
    const atEnd = viewScrollProgress >= 0.999;
    if((horizontalDelta < 0 && atStart) || (horizontalDelta > 0 && atEnd)) return;

    event.preventDefault();
    cancelSlowScroll();
    const travel = Math.max(viewScrollMetrics.maxX, window.innerWidth * 2.8, 1);
    setViewScrollProgress(viewScrollProgress + ((horizontalDelta * 1.45) / travel));
  }

  function initViewScrollSystem(){
    const hasLegacy3d = !!(viewLegacy3dEl && legacy3dCards.length);
    const hasHorizontalView = !!(viewScrollEl && viewScrollSlides.length);
    if(!hasLegacy3d && !hasHorizontalView) return false;
    document.body.classList.add("has-scroll-view");
    placeLegacy3dAfterHero();
    placeViewArchiveAfterHero();
    initLegacy3dView();
    if(!hasHorizontalView) return true;
    viewScrollSlides.forEach((slide, i)=>{
      slide.style.setProperty("--slide-index", i);
      slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    });
    measureViewScrollSystem();
    viewScrollButtons.forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        const index = Number(btn.dataset.viewScrollIndex || 0);
        const max = Math.max(1, viewScrollSlides.length - 1);
        setViewScrollProgress(index / max);
        if(!isViewScrollWheelAreaVisible()){
          const rect = viewScrollEl.getBoundingClientRect();
          const top = (window.scrollY || window.pageYOffset || 0) + rect.top;
          safeScrollToY(top);
        }
      });
    });
    window.addEventListener("wheel", handleViewScrollWheel, { passive:false, capture:true });
    if(viewScrollMediaEl && viewScrollMediaEl.setPointerCapture){
      viewScrollMediaEl.addEventListener("pointerdown", (event)=>{
        if(event.pointerType === "mouse" && event.button !== 0) return;
        viewScrollDrag = {
          id:event.pointerId,
          x:event.clientX,
          progress:viewScrollProgress
        };
        viewScrollMediaEl.classList.add("is-dragging");
        viewScrollMediaEl.setPointerCapture(event.pointerId);
      });
      viewScrollMediaEl.addEventListener("pointermove", (event)=>{
        if(!viewScrollDrag || event.pointerId !== viewScrollDrag.id) return;
        event.preventDefault();
        const deltaX = viewScrollDrag.x - event.clientX;
        const travel = Math.max(viewScrollMetrics.maxX, 1);
        setViewScrollProgress(viewScrollDrag.progress + (deltaX / travel));
      });
      const endDrag = (event)=>{
        if(!viewScrollDrag || event.pointerId !== viewScrollDrag.id) return;
        viewScrollDrag = null;
        viewScrollMediaEl.classList.remove("is-dragging");
      };
      viewScrollMediaEl.addEventListener("pointerup", endDrag);
      viewScrollMediaEl.addEventListener("pointercancel", endDrag);
    }
    setViewScrollIndex(0);
    requestViewRenderLoop();
    window.addEventListener("resize", ()=>{
      measureViewScrollSystem();
      requestViewRenderLoop();
    });
    return true;
  }

  if(useScrollViewSystem && initViewScrollSystem()){
    threeInteractionReady = false;
    setView("profile", true);
  } else {
  if(typeof THREE === "undefined"){
    if(threeWrap){
      threeWrap.classList.add("is-unavailable");
      threeWrap.dataset.fallbackLabel = FALLBACK_LABELS.three;
    }
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

  let renderer = null;
  try{
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
  }catch(err){
    console.error("[3D] WebGL renderer init failed.", err);
  }
  if(!renderer){
    if(threeWrap){
      threeWrap.classList.add("is-unavailable");
      threeWrap.dataset.fallbackLabel = FALLBACK_LABELS.three;
    }
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  /* 明るい冷灰（#E5E9ED）。旧値 #F8F6F2 はベージュに滲んで見えていた */
  renderer.setClearColor(0xE5E9ED, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  /* Keep vertical page scroll stable on touch devices */
  renderer.domElement.style.touchAction = "pan-y";
  if(!threeWrap){
    console.warn("[3D] #three-wrap が見つからないため、3D表示をスキップします。");
    return;
  }
  threeWrap.appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (e)=>{
    e.preventDefault();
    threeInteractionReady = false;
    threeWrap.classList.add("is-unavailable");
    threeWrap.dataset.fallbackLabel = FALLBACK_LABELS.three;
  }, { passive:false });
  renderer.domElement.addEventListener("webglcontextrestored", ()=>{
    threeInteractionReady = true;
    threeWrap.classList.remove("is-unavailable");
    delete threeWrap.dataset.fallbackLabel;
    requestAnimationFrame(()=>{
      try{ resize3D(); }catch(_e){}
    });
  });

  function resize3D(){
    if(!heroEl || !renderer) return;
    const w = heroEl.clientWidth;
    const h = heroEl.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if(typeof ResizeObserver !== "undefined" && heroEl){
    let _heroRoRaf = 0;
    const heroResizeObserver = new ResizeObserver(()=>{
      cancelAnimationFrame(_heroRoRaf);
      _heroRoRaf = requestAnimationFrame(()=>resize3D());
    });
    heroResizeObserver.observe(heroEl);
  }

  const particleCount = STABLE_PERFORMANCE_MODE
    ? (isCoarsePointer ? 72 : 140)
    : (isCoarsePointer ? 360 : 640);
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(particleCount * 3);
  for(let i=0;i<particleCount;i++){
    pPos[i*3+0] = (Math.random()-0.5)*60;
    pPos[i*3+1] = (Math.random()-0.5)*60;
    pPos[i*3+2] = (Math.random()-0.5)*60;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color:0x333333,
    size:0.08,
    transparent:true,
    opacity:0.3,
    depthWrite:false
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // VIEWカード設定（ここだけ編集すれば画像・表示名・遷移URLを自由に変更できます）
  // 3D VIEWは初回カクつき防止のため、WebGL専用の軽量テクスチャを使う。
  const VIEW_TEXTURE_BASE = "/assets/view-webgl/";
  const viewCards = [
    { image:VIEW_TEXTURE_BASE + "view1.jpeg",  title:"重なり", url:"https://1.com" },
    { image:VIEW_TEXTURE_BASE + "view2.jpeg",  title:"リアルタイム色立体", url:"https://2.com" },
    { image:VIEW_TEXTURE_BASE + "view3.jpeg",  title:"リミナルスペース", url:"https://3.com" },
    { image:VIEW_TEXTURE_BASE + "view4.jpeg",  title:"ロゴ制作", url:"https://4.com" },
    { image:VIEW_TEXTURE_BASE + "view5.jpeg",  title:"ゲームエンジンを用いた街制作", url:"https://5.com" },
    { image:VIEW_TEXTURE_BASE + "view6.jpeg",  title:"ライブ背景映像", url:"https://6.com" },
    { image:VIEW_TEXTURE_BASE + "view7.jpeg",  title:"07.com", url:"https://7.com" },
    { image:VIEW_TEXTURE_BASE + "view8.jpeg",  title:"08.com", url:"https://8.com" },
    { image:VIEW_TEXTURE_BASE + "view9.jpeg",  title:"09.com", url:"https://9.com" },
    { image:VIEW_TEXTURE_BASE + "view10.jpeg", title:"10.com", url:"https://10.com" },
    { image:VIEW_TEXTURE_BASE + "view11.jpeg", title:"11.com", url:"https://11.com" },
    { image:VIEW_TEXTURE_BASE + "view12.jpeg", title:"12.com", url:"https://12.com" },
    { image:VIEW_TEXTURE_BASE + "view12.jpeg", title:"13.com", url:"https://13.com" },
    { image:VIEW_TEXTURE_BASE + "view14.jpeg", title:"14.com", url:"https://14.com" },
    { image:VIEW_TEXTURE_BASE + "view15.jpeg", title:"15.com", url:"https://15.com" }
  ];
  const COUNT = viewCards.length;
  const viewImages = viewCards.map((card)=>card.image);
  const VIEW_TEXTURE_EAGER_COUNT = Math.min(COUNT, isCoarsePointer ? 4 : 6);
  window.__THREE_VIEW_TEXTURES_READY__ = COUNT <= VIEW_TEXTURE_EAGER_COUNT;
  window.__THREE_VIEW_TEXTURES_PENDING__ = COUNT;
  try{
    const preloadBucket = Array.isArray(window.__EXTRA_PRELOAD_IMAGES__)
      ? window.__EXTRA_PRELOAD_IMAGES__
      : (window.__EXTRA_PRELOAD_IMAGES__ = []);
    viewImages.slice(0, VIEW_TEXTURE_EAGER_COUNT).forEach((src)=>{
      const normalized = typeof src === "string" ? src.trim() : "";
      if(!normalized || preloadBucket.includes(normalized)) return;
      preloadBucket.push(normalized);
    });
  }catch(_){}
  const titles = viewCards.map((card)=>card.title);
  const links = viewCards.map((card)=>card.url);
  const ENABLE_VIEW_NAVIGATION = false;
  const VIEW_TEXTURE_CONCURRENCY = STABLE_PERFORMANCE_MODE
    ? (isCoarsePointer ? 1 : 2)
    : 3;

  const STEP = Math.PI * 2 / COUNT;
  const RING_RADIUS = 12.5;
  const SPHERE_RADIUS = 12;
  const SPHERE_SCALE = 0.85;
  const CENTER_OPACITY = 1;
  const OTHER_OPACITY = 0.15;

  const group = new THREE.Group();
  scene.add(group);

  const spherePositions = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for(let i=0;i<COUNT;i++){
    const y = 1 - (i/(COUNT-1))*2;
    const r = Math.sqrt(1 - y*y);
    const theta = goldenAngle * i;
    spherePositions.push(new THREE.Vector3(
      Math.cos(theta) * r * SPHERE_RADIUS,
      y * SPHERE_RADIUS,
      Math.sin(theta) * r * SPHERE_RADIUS
    ));
  }

  const texLoader = new THREE.TextureLoader();
  const meshes = [];
  const VIEW_PLANE_W = 9;
  const VIEW_PLANE_H = 6;
  const VIEW_ASPECT = VIEW_PLANE_W / VIEW_PLANE_H;
  const IMAGE_Z_OFFSET = 0.002;
  const pendingTextureJobs = [];
  let activeTextureJobs = 0;
  let texturePumpQueued = false;
  const VIEW_TEXTURE_MAX_ANISOTROPY = STABLE_PERFORMANCE_MODE ? 2 : 4;
  const textureWarmQueue = [];
  let textureWarmQueued = false;

  if(location.protocol === "file:"){
    console.warn("[VIEW] file:// ではWebGLテクスチャ読み込みがブラウザ制限で失敗する場合があります。http://localhost で開いてください。");
  }

  function settleViewTextureJob(){
    const remaining = Math.max(0, (window.__THREE_VIEW_TEXTURES_PENDING__ || 0) - 1);
    window.__THREE_VIEW_TEXTURES_PENDING__ = remaining;
    if(remaining === 0){
      window.__THREE_VIEW_TEXTURES_READY__ = true;
    }
  }

  function fitImagePlaneContain(imagePlane, tex){
    if(!imagePlane || !tex || !tex.image) return;
    const iw = tex.image.videoWidth || tex.image.width || 1;
    const ih = tex.image.videoHeight || tex.image.height || 1;
    const imageAspect = iw / ih;

    let sx = 1;
    let sy = 1;
  
    if(imageAspect > VIEW_ASPECT){
      sy = VIEW_ASPECT / imageAspect;
    }else{
      sx = imageAspect / VIEW_ASPECT;
    }
    imagePlane.scale.set(sx, sy, 1);
  }

  function scheduleTexturePump(delay = 0){
    if(texturePumpQueued) return;
    texturePumpQueued = true;
    const run = ()=>{
      texturePumpQueued = false;
      pumpTextureQueue();
    };
    if(delay > 0){
      window.setTimeout(run, delay);
      return;
    }
    window.setTimeout(run, 0);
  }

  function scheduleIdleTask(fn, timeout){
    if(typeof window.requestIdleCallback === "function"){
      window.requestIdleCallback(fn, { timeout: timeout || 700 });
      return;
    }
    window.setTimeout(function(){ fn({ didTimeout:true, timeRemaining:function(){ return 0; } }); }, 48);
  }

  function scheduleTextureWarmup(texture){
    if(!texture || !renderer) return;
    textureWarmQueue.push(texture);
    if(textureWarmQueued) return;
    textureWarmQueued = true;
    scheduleIdleTask(processTextureWarmQueue, 900);
  }

  function processTextureWarmQueue(deadline){
    textureWarmQueued = false;
    if(!renderer || !textureWarmQueue.length) return;

    var uploaded = 0;
    while(textureWarmQueue.length && uploaded < 1){
      if(deadline && !deadline.didTimeout && deadline.timeRemaining && deadline.timeRemaining() < 5){
        break;
      }
      var texture = textureWarmQueue.shift();
      try{
        if(typeof renderer.initTexture === "function"){
          renderer.initTexture(texture);
        }else if(!heroInViewport){
          renderer.render(scene, camera);
        }
      }catch(_){}
      uploaded += 1;
    }

    if(textureWarmQueue.length){
      textureWarmQueued = true;
      scheduleIdleTask(processTextureWarmQueue, 900);
    }
  }

  function pumpTextureQueue(){
    while(activeTextureJobs < VIEW_TEXTURE_CONCURRENCY && pendingTextureJobs.length){
      const job = pendingTextureJobs.shift();
      if(!job) return;
      activeTextureJobs += 1;
      texLoader.load(
        job.src,
        (t)=>{
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = Math.min(
            VIEW_TEXTURE_MAX_ANISOTROPY,
            renderer.capabilities && renderer.capabilities.getMaxAnisotropy
              ? renderer.capabilities.getMaxAnisotropy()
              : VIEW_TEXTURE_MAX_ANISOTROPY
          );
          fitImagePlaneContain(job.imagePlane, t);
          job.imageMat.map = t;
          job.imageMat.color.set(0xffffff);
          job.imageMat.needsUpdate = true;
          job.imagePlane.visible = true;
          scheduleTextureWarmup(t);
          requestViewRenderLoop();
          settleViewTextureJob();
          activeTextureJobs = Math.max(0, activeTextureJobs - 1);
          scheduleTexturePump(0);
        },
        undefined,
        (err)=>{
          console.error(`[VIEW] image not found (index:${job.idx + 1}): ${job.src}`, err);
          job.imageMat.map = null;
          job.imageMat.needsUpdate = true;
          job.imagePlane.visible = false;
          settleViewTextureJob();
          activeTextureJobs = Math.max(0, activeTextureJobs - 1);
          scheduleTexturePump(0);
        }
      );
    }
  }

  function queueViewTexture(imagePlane, imageMat, src, idx, eager = false){
    pendingTextureJobs.push({ imagePlane, imageMat, src, idx });
    if(eager){
      scheduleTexturePump(0);
      return;
    }
    scheduleTexturePump(0);
  }

  viewImages.forEach((src, i)=>{
    const frameMat = new THREE.MeshBasicMaterial({
      /* フレーム（画像余白を色で補完していた面）は不可視にする。
         レイキャスト用のジオメトリとしてだけ残す。 */
      color:0xE8EBEF,
      transparent:true,
      opacity:0,
      depthWrite:false,
      side:THREE.DoubleSide
    });
    const imageMat = new THREE.MeshBasicMaterial({
      color:0xffffff,
      transparent:true,
      opacity:1,
      side:THREE.DoubleSide
    });
    const frameMesh = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_PLANE_W, VIEW_PLANE_H), frameMat);
    const imageMesh = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_PLANE_W, VIEW_PLANE_H), imageMat);
    imageMesh.visible = false;
    imageMesh.position.z = IMAGE_Z_OFFSET;
    imageMesh.userData.index = i;
    frameMesh.add(imageMesh);

    queueViewTexture(imageMesh, imageMat, src, i, i < VIEW_TEXTURE_EAGER_COUNT);

    frameMesh.userData.index = i;
    frameMesh.userData.imageMat = imageMat;
    group.add(frameMesh);
    meshes.push(frameMesh);
  });

  let layoutMode = "ring";
  const layoutButtons = document.querySelectorAll(".toggle-btn");

  const ringCamZ = 15;
  const sphereCamZ = 22;
  let targetCamZ = ringCamZ;
  camera.position.z = ringCamZ;

  let currentIndex = 0;
  let sphereCenterIndex = 0;
  let sphereCenteredEnough = false;

  let ringIndex = 0;
  let ringSnap = 0;
  let ringVel = 0;
  let ringScale = 1;
  const ringBaseScale = 1.6;
  const ringDragScale = 0.7;

  let ringPointerDown = false;
  let ringDrag = false;
  let ringDragMoved = false;
  let ringLastX = 0;
  let ringStartX = 0;
  const VIEW_SCROLL_SPIN_COOLDOWN = 520;
  const VIEW_SCROLL_SPIN_THRESHOLD = 26;
  const VIEW_SCROLL_SPIN_DURATION = 920;
  let lastViewScrollSpinAt = 0;
  let viewScrollSpinCarry = 0;
  let viewScrollSpinDirection = 0;
  let ringAutoSpin = null;
  let hasPlayedInitialViewSpin = !ENABLE_INITIAL_VIEW_SPIN;

  let sphereDragging = false;
  let sphereDragMoved = false;
  let sphereStartX = 0;
  let sphereStartY = 0;
  let sphereLastX = 0;
  let sphereLastY = 0;

  let targetRotX = 0;
  let targetRotY = 0;
  let velX = 0;
  let velY = 0;

  function easeInOutSine(t){
    return 0.5 - (Math.cos(Math.PI * t) * 0.5);
  }

  function getRingAutoSpinValue(now = performance.now()){
    if(!ringAutoSpin) return ringIndex;
    const progress = Math.max(0, Math.min(1, (now - ringAutoSpin.startAt) / ringAutoSpin.duration));
    const eased = easeInOutSine(progress);
    return ringAutoSpin.from + ((ringAutoSpin.to - ringAutoSpin.from) * eased);
  }

  function cancelRingAutoSpin(){
    if(!ringAutoSpin) return;
    ringIndex = getRingAutoSpinValue(performance.now());
    ringSnap = ringIndex;
    ringAutoSpin = null;
  }

  function isRingAutoSpinning(){
    return layoutMode === "ring" && !!ringAutoSpin;
  }

  function startRingAutoSpin(turns = 1){
    if(!threeInteractionReady) return;
    if(layoutMode !== "ring") return;
    const now = performance.now();
    const from = getRingAutoSpinValue(now);
    const to = from + (COUNT * turns);
    ringAutoSpin = {
      from,
      to,
      startAt: now,
      duration: VIEW_SCROLL_SPIN_DURATION
    };
    ringIndex = from;
    ringSnap = to;
    ringVel = 0;
  }

  function setLayout(mode){
    if(!threeInteractionReady) return;
    if(isRingAutoSpinning()) return;
    layoutMode = mode;
    layoutButtons.forEach(b=>b.classList.toggle("active", b.dataset.mode===mode));
    viewScrollSpinCarry = 0;
    viewScrollSpinDirection = 0;
    ringAutoSpin = null;

    if(mode === "ring"){
      targetCamZ = ringCamZ;
      ringSnap = currentIndex;
      ringIndex = currentIndex;
      ringVel = 0;
      ringScale = ringBaseScale;
      group.rotation.set(0,0,0);
      targetRotX = 0;
      targetRotY = 0;
      velX = 0;
      velY = 0;
    }else{
      targetCamZ = sphereCamZ;
      snapToIndex(currentIndex);
    }
  }

  layoutButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>setLayout(btn.dataset.mode));
  });

  function snapToIndex(i){
    currentIndex = ((i % COUNT) + COUNT) % COUNT;
    const dir = spherePositions[currentIndex].clone().normalize();
    const yaw = -Math.atan2(dir.x, dir.z);
    const pitch = Math.atan2(dir.y, Math.sqrt(dir.x*dir.x + dir.z*dir.z));
    targetRotY = yaw;
    targetRotX = pitch;
    velX = 0;
    velY = 0;
  }

  function layoutRing(){
    meshes.forEach((m,i)=>{
      const o = i - ringIndex;
      const a = o * STEP;
      const d = Math.cos(a);
      m.position.set(Math.sin(a)*RING_RADIUS, 0, d*RING_RADIUS - RING_RADIUS);
      const s = THREE.MathUtils.mapLinear(d, -1, 1, 0.65, 1.15) * ringScale;
      m.scale.set(s,s,1);

      const targetOpacity = (i === currentIndex) ? CENTER_OPACITY : OTHER_OPACITY;
      m.material.opacity += (targetOpacity - m.material.opacity) * 0.18;
      if(m.userData.imageMat){
        m.userData.imageMat.opacity = m.material.opacity;
      }
      m.rotation.set(0,0,0);
    });
  }

  const centerRay = new THREE.Raycaster();
  const centerNDC = new THREE.Vector2(0,0);
  const tmpPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  let candidateIndex = 0;
  let candidateFrames = 0;

  function getObjectIndex(obj){
    let cur = obj;
    while(cur){
      const idx = cur.userData ? cur.userData.index : undefined;
      if(Number.isInteger(idx)) return idx;
      cur = cur.parent;
    }
    return null;
  }

  function getCenterHitIndex(){
    centerRay.setFromCamera(centerNDC, camera);
    const hits = centerRay.intersectObjects(meshes);
    if(!hits.length) return null;
    return getObjectIndex(hits[0].object);
  }

  function updateSphereCenter(){
    const hit = getCenterHitIndex();
    if(hit !== null){
      sphereCenterIndex = hit;
      candidateIndex = sphereCenterIndex;
      candidateFrames = 0;
      sphereCenteredEnough = true;
      return;
    }

    camera.getWorldDirection(camDir);

    let bestIndex = sphereCenterIndex;
    let bestScore = -Infinity;

    for(let i=0;i<COUNT;i++){
      meshes[i].getWorldPosition(tmpPos);
      const toObj = tmpPos.clone().sub(camera.position).normalize();
      const dot = toObj.dot(camDir);
      if(dot < 0.45) continue;

      tmpPos.project(camera);
      if(tmpPos.z < -1 || tmpPos.z > 1) continue;

      const distSq = tmpPos.x*tmpPos.x + tmpPos.y*tmpPos.y;
      const score = (dot * 1.4) - (distSq * 1.0);
      if(score > bestScore){
        bestScore = score;
        bestIndex = i;
      }
    }

    if(bestIndex !== sphereCenterIndex){
      if(candidateIndex !== bestIndex){
        candidateIndex = bestIndex;
        candidateFrames = 0;
      }
      candidateFrames++;
      if(candidateFrames >= 4){
        sphereCenterIndex = candidateIndex;
        candidateFrames = 0;
      }
    }else{
      candidateFrames = 0;
    }

    meshes[sphereCenterIndex].getWorldPosition(tmpPos);
    tmpPos.project(camera);
    const distSq = tmpPos.x*tmpPos.x + tmpPos.y*tmpPos.y;
    sphereCenteredEnough = distSq < 0.03;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovering = false;
  let hoverObj = null;
  let pointerDirty = true;
  let pointerOverRenderer = false;
  let hoverCheckFrame = 0;
  renderer.domElement.addEventListener("mouseenter", ()=>{
    pointerOverRenderer = true;
    pointerDirty = true;
  });
  renderer.domElement.addEventListener("mouseleave", ()=>{
    pointerOverRenderer = false;
    pointerDirty = false;
    hoverObj = null;
    if(hovering){
      hovering = false;
      if(cursor){
        cursor.classList.remove("gray", "hover");
      }
    }
  });
  renderer.domElement.addEventListener("mousemove", (e)=>{
    const rect = renderer.domElement.getBoundingClientRect();
    if(rect.width <= 0 || rect.height <= 0) return;
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointerDirty = true;
  });

  function isUIEvent(e){
    const t = e.target;
    return t && t.closest ? !!t.closest(".menu, .layout-toggle, .arrow") : false;
  }

  renderer.domElement.addEventListener("mousedown", (e)=>{
    if(isCoarsePointer) return;
    if(e.button !== 0) return;
    if(isUIEvent(e)) return;
    if(cursor) cursor.classList.add("active");

    if(layoutMode === "ring"){
      if(isRingAutoSpinning()) return;
      ringPointerDown = true;
      ringDrag = false;
      ringDragMoved = false;
      ringStartX = e.clientX;
      ringLastX = e.clientX;
      ringVel = 0;
    }else{
      sphereDragging = true;
      sphereDragMoved = false;
      sphereStartX = e.clientX;
      sphereStartY = e.clientY;
      sphereLastX = e.clientX;
      sphereLastY = e.clientY;
      velX = 0;
      velY = 0;
    }
  });

  window.addEventListener("mousemove", (e)=>{
    if(isCoarsePointer) return;
    if(layoutMode === "ring" && ringPointerDown){
      if(isRingAutoSpinning()) return;
      if(Math.abs(e.clientX - ringStartX) > 4){
        ringDrag = true;
        ringDragMoved = true;
      }
      if(ringDrag){
        ringVel -= (e.clientX - ringLastX) * 0.002;
        ringLastX = e.clientX;
      }
    }

    if(layoutMode === "sphere" && sphereDragging){
      const dx = e.clientX - sphereLastX;
      const dy = e.clientY - sphereLastY;
      if(Math.abs(e.clientX-sphereStartX)>4 || Math.abs(e.clientY-sphereStartY)>4){
        sphereDragMoved = true;
      }
      velY = dx * 0.003;
      velX = dy * 0.003;
      targetRotY += velY;
      targetRotX += velX;
      sphereLastX = e.clientX;
      sphereLastY = e.clientY;
    }
  });

  window.addEventListener("mouseup", ()=>{
    if(cursor) cursor.classList.remove("active");

    if(layoutMode === "ring"){
      if(isRingAutoSpinning()) return;
      ringPointerDown = false;
      if(ringDragMoved){
        ringDrag = false;
        ringSnap = Math.round(ringIndex);
      }else if(hoverObj){
        const idx = getObjectIndex(hoverObj);
        if(idx === null) return;
        const isCentered = idx === currentIndex && Math.abs(ringIndex - Math.round(ringIndex)) < 0.12;
        if(ENABLE_VIEW_NAVIGATION && isCentered && links[idx]){
          window.location.href = links[idx];
          return;
        }
        ringSnap = idx;
      }
    }else{
      sphereDragging = false;
      if(!sphereDragMoved && hoverObj){
        const idx = getObjectIndex(hoverObj);
        if(idx === null) return;
        const isCentered = idx === sphereCenterIndex && sphereCenteredEnough;
        if(ENABLE_VIEW_NAVIGATION && isCentered && links[idx]){
          window.location.href = links[idx];
          return;
        }
        snapToIndex(idx);
      }
    }
  });

  const PINCH_SWITCH_COOLDOWN = 250;
  const PINCH_THRESHOLD = 0.03;
  let lastPinchSwitch = 0;

  function switchToRing(){
    if(isRingAutoSpinning()) return;
    if(layoutMode === "ring") return;
    currentIndex = sphereCenterIndex;
    setLayout("ring");
  }
  function switchToSphere(){
    /* SPHERE機能は完全撤去 — 呼ばれても何もしない */
    return;
  }
  function handlePinchSwitch(_deltaY){
    /* ピンチによるSPHERE切替も撤去 */
    return;
  }

  const WHEEL_SENS = 0.0017;

  renderer.domElement.addEventListener("wheel", (e)=>{
    if(isCoarsePointer) return;
    if(e.ctrlKey) return;

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);

    /* 3Dエリア内の左右スワイプ時のブラウザ戻る/進むを抑止 */
    if(absX > absY && absX > 2){
      e.preventDefault();
    }

    if(layoutMode !== "ring") return;
    if(isRingAutoSpinning()){
      e.preventDefault();
      return;
    }

    /* 横スクロールでリング回転（Shift+wheelでも可） */
    const isHorizontal = absX > absY || e.shiftKey;
    if(!isHorizontal) return;

    e.preventDefault();
    const delta = absX > absY ? e.deltaX : e.deltaY;
    ringIndex += delta * WHEEL_SENS;
    ringSnap = ringIndex;
    ringVel = 0;
  }, {passive:false});

  /* SPHERE切替のSafariジェスチャーハンドラは完全撤去 */
  /* ピンチでモードが切り替わる挙動は一切発火させない */

  const arrowLeft = document.getElementById("arrowLeft");
  const arrowRight = document.getElementById("arrowRight");

  function goNext(){
    if(layoutMode === "ring"){
      if(isRingAutoSpinning()) return;
      ringSnap++;
    }
    else snapToIndex(currentIndex+1);
  }
  function goPrev(){
    if(layoutMode === "ring"){
      if(isRingAutoSpinning()) return;
      ringSnap--;
    }
    else snapToIndex(currentIndex-1);
  }

  if(arrowRight) arrowRight.addEventListener("click", goNext);
  if(arrowLeft) arrowLeft.addEventListener("click", goPrev);

  window.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowRight") goNext();
    if(e.key === "ArrowLeft") goPrev();
  });

  const titleEl = document.getElementById("title");
  const counterEl = document.getElementById("counter");

  let _animLastTime = 0;
  let viewRenderFrame = 0;

  function requestViewRenderLoop(){
    if(viewRenderFrame) return;
    viewRenderFrame = requestAnimationFrame(animate);
  }

  function animate(now){
    viewRenderFrame = 0;
    /* hero が見えていない / 3D 必要無いときは rAF を再キューしない。
       これで永続 60fps の rAF サイクルが消えてスクロール時の負荷が下がる。 */
    if(!threeInteractionReady || !viewSectionActive || !pageVisible || !heroInViewport){
      drawTrail();
      _animLastTime = 0;
      return;
    }
    viewRenderFrame = requestAnimationFrame(animate);

    /* フレームレート非依存のデルタタイム（60fps基準） */
    const _dt  = (_animLastTime > 0) ? Math.min(now - _animLastTime, 50) : 16.667;
    _animLastTime = now;
    const _t60 = _dt / 16.667;

    drawTrail();

    particles.rotation.y += 0.0006 * _t60;
    particles.rotation.x += 0.0003 * _t60;

    const _camAlpha = 1 - Math.pow(0.92, _t60);
    camera.position.z += (targetCamZ - camera.position.z) * _camAlpha;

    if(layoutMode === "ring"){
      group.rotation.set(0,0,0);

      if(ringDrag){
        ringIndex += ringVel * _t60;
        ringVel *= Math.pow(0.85, _t60);
      }else if(ringAutoSpin){
        const now = performance.now();
        const progress = Math.max(0, Math.min(1, (now - ringAutoSpin.startAt) / ringAutoSpin.duration));
        const eased = easeInOutSine(progress);
        ringIndex = ringAutoSpin.from + ((ringAutoSpin.to - ringAutoSpin.from) * eased);
        ringSnap = ringAutoSpin.to;
        if(progress >= 1){
          ringIndex = ringAutoSpin.to;
          ringSnap = ringIndex;
          ringAutoSpin = null;
        }
      }else{
        const _ringAlpha = 1 - Math.pow(0.82, _t60);
        ringIndex += (ringSnap - ringIndex) * _ringAlpha;
      }
      if(!ringAutoSpin && Math.abs(ringIndex) > COUNT * 1000){
        const normalized = ((ringIndex % COUNT) + COUNT) % COUNT;
        ringIndex = normalized;
        ringSnap = ((ringSnap % COUNT) + COUNT) % COUNT;
      }

      const _scaleAlpha = 1 - Math.pow(0.88, _t60);
      ringScale += ((ringDrag ? ringDragScale : ringBaseScale) - ringScale) * _scaleAlpha;
      currentIndex = ((Math.round(ringIndex)%COUNT)+COUNT)%COUNT;
      layoutRing();
    }else{
      if(!sphereDragging){
        targetRotY += velY;
        targetRotX += velX;
        velY *= 0.92;
        velX *= 0.92;
      }

      const _rotAlpha = 1 - Math.pow(0.92, _t60);
      group.rotation.y += (targetRotY - group.rotation.y) * _rotAlpha;
      group.rotation.x += (targetRotX - group.rotation.x) * _rotAlpha;

      meshes.forEach((m,i)=>{
        m.position.lerp(spherePositions[i], _rotAlpha);
        m.scale.set(SPHERE_SCALE, SPHERE_SCALE, 1);
        m.lookAt(camera.position);
      });

      updateSphereCenter();
      meshes.forEach((m)=>{
        m.material.opacity = 1;
        if(m.userData.imageMat) m.userData.imageMat.opacity = 1;
      });
      currentIndex = sphereCenterIndex;
    }

    if(titleEl){
      titleEl.textContent = titles[currentIndex];
    }
    if(counterEl){
      counterEl.textContent = `${currentIndex+1} / ${COUNT}`;
    }

    /* ★最適化：ポインターの判定を最適化 */
    if(pointerOverRenderer && !isCoarsePointer && pointerDirty){
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      const nowHover = hits.length > 0;
      hoverObj = nowHover ? hits[0].object : null;
      pointerDirty = false;
      if(nowHover !== hovering){
        hovering = nowHover;
        if(cursor){
          cursor.classList.toggle("gray", hovering);
          cursor.classList.toggle("hover", hovering);
        }
      }
    }

    renderer.render(scene, camera);
  }

  resize3D();
  threeInteractionReady = true;
  setView("profile", true); // Default view set to profile

  /* ── Stability: always start the render loop and always dismiss
     the loader, even if an auxiliary init step is missing. Without
     this the loader stays on top of the page forever and the page
     looks frozen. ─────────────────────────────────────────────── */
  try{
    if(typeof animate === "function") requestViewRenderLoop();
  }catch(_animErr){
    console.warn("[stability] animate() failed", _animErr);
  }

  }

  if(typeof window.runDeferredInit !== "function"){
    window.runDeferredInit = function(){};
  }
  try{ window.runDeferredInit(); }catch(_){}

  function __forceHideLoader(){
    try{
      if(!loader) return;
      loader.classList.add("hide");
      /* ── opening reveal ── */
      const reveal = (typeof window.__startOpeningReveal === "function")
        ? window.__startOpeningReveal
        : function(done){
            setTimeout(()=>{
              document.body.classList.add("page-revealed");
              if(typeof done === "function") done();
            }, 210);
          };
      reveal(()=>{
        syncTopbarScrollState(true);
      });
      setTimeout(()=>{ try{ loader.style.display = "none"; }catch(_){} }, 1650);
    }catch(_){}
  }
  /* Hide after the first paint; also guarantee hide after 4s
     regardless of asset state. */
  /* Respect the 3-second minimum loader display */
  var _mainStart = window._loaderPageStart || Date.now();
  function _scheduleForceHide(){
    /* 画像ロード完了を待ってから最低3秒キープして非表示 */
    function tryHide(){
      if(window._viewAssetsReady){
        var elapsed = Date.now() - _mainStart;
        var remain  = Math.max(0, 3000 - elapsed + 200);
        setTimeout(__forceHideLoader, remain);
      } else {
        setTimeout(tryHide, 80);
      }
    }
    tryHide();
  }
  _scheduleForceHide();
  setTimeout(__forceHideLoader, 30000); /* 絶対安全網 30 秒（画像ロード完了が最優先） */

  document.addEventListener("visibilitychange", ()=>{
    pageVisible = !document.hidden;
    if(document.hidden){
      pauseIntroFilm();
      return;
    }
    if(viewSectionActive){
      playIntroFilm();
      requestViewRenderLoop();
    }
    syncSectionLoopVideosByView();
  });

  window.addEventListener("scroll", ()=>{
    ensureIntroProgressState();
    syncTopbarScrollState(false);
    requestIntroFilmProgress();
    requestCinematicMotion();
    if(!slowScrollFrame){
      slowScrollTargetY = window.scrollY || window.pageYOffset || 0;
    }
  }, { passive:true });
  window.addEventListener("resize", ()=>{
    syncTopbarScrollState(true);
    _cacheIntroLayout();
    updateCinematicCache(); // ★追加
    requestIntroFilmProgress();
    requestCinematicMotion();
    resizeTrail();
    resize3D();
    requestViewRenderLoop();
  });
})();

  /* ── Reading progress bar ─────────────────────────────── */
  (function(){
    const bar = document.getElementById("ux-progress");
    if(!bar) return;
    function updateProgress(){
      const scrollTop  = window.scrollY || window.pageYOffset;
      const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
      if(docHeight <= 0){ bar.style.width = "0%"; return; }
      const pct = Math.min(100, (scrollTop / docHeight) * 100);
      bar.style.width = pct + "%";
      /* 最上部・最下部では非表示 */
      bar.style.opacity = (pct < 1 || pct > 99) ? "0" : "1";
    }
    window.addEventListener("scroll", updateProgress, { passive:true });
    updateProgress();
  })();

  /* ── Section heading stagger (デザイン・イラストページ) ── */
  (function(){
    if(typeof IntersectionObserver === "undefined") return;

    const STAGGER_TARGETS = [
      ".design-hero", ".illus-hero", ".contact-hero",
      ".design-item", ".illus-card",
      ".view-gallery-head", ".view-gallery-copy"
    ];

    const headings = document.querySelectorAll(STAGGER_TARGETS.join(","));
    /* already handled by motion-reveal system — just add stagger delays */
    headings.forEach((el, i)=>{
      /* nth child内での連番ディレイ */
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children).filter(c=> c.classList.contains(el.classList[0]))
        : [];
      const idx = siblings.indexOf(el);
      if(idx > 0 && !el.style.getPropertyValue("--motion-delay")){
        el.style.setProperty("--motion-delay", (idx * 55) + "ms");
      }
    });
  })();




/* ══ ISOLATED WORK VIEWER v3 — rich viewer ══════════════════ */
(function(){
  "use strict";

  var SELECTOR = ".design-item, .illus-card"; /* all cards clickable even if image missing */
  var items = [], cur = 0;
  var ov, panel, bg, img, wrap, num, cat, ttl, dsc, metaEl, lnk;
  var dots, prev, nextBig, scrollEl, topFab, longEl, longWrap;
  var galleryEl, galleryWrap, videoWrap, videoFrame, themeWrap, themeTrack, lightbox, lightboxImg;
  var processEl, processWrap, toolsEl;
  var lbSrcs = [], lbIdx = 0;
  var videoTimer = 0;

  function build(){
    items = Array.from(document.querySelectorAll(SELECTOR));
    if(!items.length) return;

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
              '<p  id="wv-dsc" class="wvi"></p>' +
              '<div id="wv-meta" class="wvi"></div>' +
              '<a  id="wv-lnk" class="wvi" target="_blank" rel="noopener">VIEW PROJECT &#8594;</a>' +
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
            '<p id="wv-long-label">ABOUT THIS WORK</p>' +
            '<div id="wv-long"></div>' +
          '</div>' +
          '<div class="wv-section-divider"></div>' +
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
      var src = lbSrcs[lbIdx];
      lightboxImg.style.opacity = "0";
      lightboxImg.src = src;
      lightbox.classList.add("on");
      requestAnimationFrame(function(){ lightboxImg.style.opacity = "1"; });
      lightbox.querySelector("#wv-lb-prev").classList.toggle("hidden", lbIdx === 0);
      lightbox.querySelector("#wv-lb-next").classList.toggle("hidden", lbIdx === lbSrcs.length - 1);
    }
    function lbClose(){ lightbox.classList.remove("on"); }

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
      el.addEventListener("click", function(e){
        e.stopPropagation(); openAt(i);
      }, true);
    });

    window.__openWorkFromElement = function(targetEl, opts){
      var idx = items.indexOf(targetEl);
      if(idx < 0) return false;
      openAt(idx);
      if(opts && opts.scrollLong){
        setTimeout(function(){
          try{
            if(scrollEl && longWrap && longWrap.style.display !== "none"){
              scrollEl.scrollTo({ top:Math.max(0, longWrap.offsetTop - 72), behavior:"smooth" });
            }
          }catch(_){}
        }, 360);
      }
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
      close();
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
    var src   = imgEl ? (imgEl.getAttribute("src") || "") : "";
    var title = tx(el, ".design-title,.illus-title,.view-title") || tx(el,"h2,h3") || "";
    var catTx = tx(el, ".design-meta,.illus-sub,.view-meta,.design-index,.view-no") || "";
    var desc  = tx(el, ".design-desc,.illus-desc,.view-desc") || "";
    var ds    = el.dataset || {};
    var long  = ds.long  || "";
    var year  = ds.year  || "";
    var role  = ds.role  || "";
    var media = ds.media || "";
    var gRaw  = ds.gallery || "";
    var gallery = gRaw ? gRaw.split("|").map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var galleryLayout = ds.galleryLayout || "";
    var youtube = ds.youtube || "";
    var themeRaw = ds.themeGallery || "";
    var themeGallery = themeRaw ? themeRaw.split("|").map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var href  = ds.url || ds.href ||
                (el.querySelector("a[href]") ? el.querySelector("a[href]").href : "") || "";
    var process = ds.process || "";
    var tools   = ds.tools   || "";
    return { src:src, title:title, cat:catTx, desc:desc,
             long:long, year:year, role:role, media:media,
             gallery:gallery, galleryLayout:galleryLayout, youtube:youtube, themeGallery:themeGallery, href:href,
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

  function renderMeta(d){
    metaEl.innerHTML = "";
    var rows = [];
    if(d.year)  rows.push(["YEAR", d.year]);
    if(d.role)  rows.push(["ROLE", d.role]);
    if(d.media) rows.push(["MEDIA", d.media]);
    if(!rows.length){ metaEl.style.display="none"; return; }
    metaEl.style.display = "";
    rows.forEach(function(r){
      var row = document.createElement("div");
      row.className = "wvmeta-row";
      row.innerHTML = '<span class="wvmeta-k">'+esc(r[0])+'</span><span class="wvmeta-v">'+esc(r[1])+'</span>';
      metaEl.appendChild(row);
    });
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
    galleryEl.innerHTML = "";
    galleryWrap.classList.remove("is-visual-film-gallery");
    galleryEl.classList.remove("is-visual-film-gallery");
    if(!d.gallery || !d.gallery.length){ galleryWrap.style.display="none"; return; }
    galleryWrap.style.display = "";
    var isVisualFilm = d.galleryLayout === "visual-film";
    galleryWrap.classList.toggle("is-visual-film-gallery", isVisualFilm);
    galleryEl.classList.toggle("is-visual-film-gallery", isVisualFilm);
    lbSrcs = d.gallery.slice(); /* store all gallery srcs for prev/next */
    d.gallery.forEach(function(src, gi){
      var block = document.createElement("div");
      block.className = "wv-story-block";
      if(isVisualFilm) block.classList.add("is-visual-film-frame");

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
      im.loading = isVisualFilm ? "eager" : (gi < 2 ? "eager" : "lazy");
      if(isVisualFilm){
        im.sizes = "(max-width: 920px) calc(100vw - 28px), 680px";
      }
      imgWrap.appendChild(numSpan);
      imgWrap.appendChild(im);

      /* Put the URL on the real image immediately so it never stays blank
         if a preloader races with the modal's scroll container. */
      if(isVisualFilm){
        im.srcset = src + " 3500w";
      }
      im.onload = function(){
        im.classList.add("lo");
      };
      im.onerror = function(){
        im.classList.add("lo", "is-error");
        var host = im.closest(".wv-story-img-wrap");
        if(host) host.classList.add("is-error");
      };
      im.src = src;
      requestAnimationFrame(function(){
        im.classList.add("lo");
      });

      /* lightbox on click */
      imgWrap.addEventListener("click", function(){ lbShow(gi); });

      /* text block */
      var txt = null;
      if(!isVisualFilm){
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
      (function(revealBlock, delay){
        revealBlock.style.transitionDelay = delay + "ms";
        requestAnimationFrame(function(){
          revealBlock.classList.add("is-revealed");
        });
      })(block, isVisualFilm ? gi * 45 : gi * 65);
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
    var hasContent = !!(d.process || (d.tools) ||
      (d.media && d.media.length > 0));
    processWrap.style.display = hasContent ? "" : "none";
  }

  function renderVideo(d){
    if(!videoWrap || !videoFrame) return;
    clearTimeout(videoTimer);
    videoFrame.innerHTML = "";
    if(!d.youtube){
      videoWrap.style.display = "none";
      return;
    }
    videoWrap.style.display = "block";
    videoFrame.classList.remove("is-playing");
    var iframe = document.createElement("iframe");
    iframe.title = d.title ? d.title + " film preview" : "Film preview";
    iframe.src = "https://www.youtube.com/embed/" + encodeURIComponent(d.youtube) +
      "?playsinline=1&rel=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1&vq=hd1080&origin=" +
      encodeURIComponent(window.location.origin || "http://localhost");
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.setAttribute("allowfullscreen", "");
    iframe.loading = "eager";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    videoFrame.appendChild(iframe);

    var playButton = document.createElement("button");
    playButton.className = "wv-video-play";
    playButton.type = "button";
    playButton.setAttribute("aria-label", "Play film");
    playButton.innerHTML = "<span>PLAY FILM</span>";
    playButton.addEventListener("click", function(){
      function postPlay(){
        if(!iframe.contentWindow) return;
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":[]}', "*");
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":[]}', "*");
      }
      videoFrame.classList.add("is-playing");
      iframe.src = "https://www.youtube.com/embed/" + encodeURIComponent(d.youtube) +
        "?autoplay=1&mute=0&playsinline=1&rel=0&controls=1&iv_load_policy=3&enablejsapi=1&vq=hd1080&origin=" +
        encodeURIComponent(window.location.origin || "http://localhost");
      iframe.addEventListener("load", postPlay, { once:true });
      setTimeout(postPlay, 120);
      setTimeout(postPlay, 520);
    });
    videoFrame.appendChild(playButton);
  }

  function renderThemeGallery(d){
    if(!themeWrap || !themeTrack) return;
    themeTrack.innerHTML = "";
    if(!d.themeGallery || !d.themeGallery.length){
      themeWrap.style.display = "none";
      return;
    }
    themeWrap.style.display = "";
    d.themeGallery.forEach(function(src, i){
      var figure = document.createElement("figure");
      figure.className = "wv-theme-slide";
      figure.setAttribute("data-index", String(i + 1).padStart(2, "0"));
      var im = document.createElement("img");
      im.src = src;
      im.alt = "theme image " + String(i + 1).padStart(2, "0");
      im.loading = i === 0 ? "eager" : "lazy";
      im.decoding = "async";
      figure.appendChild(im);
      themeTrack.appendChild(figure);
    });
    try{ themeTrack.scrollLeft = 0; }catch(_){}
  }

  function loadImg(src, dir){
    img.classList.remove("vis","wv-out-l","wv-out-r","wv-in-r","wv-in-l");
    wrap.classList.remove("loaded");
    if(!src){ wrap.classList.add("loaded"); return; }
    var t = new Image();
    t.onload = function(){
      img.src = src;
      requestAnimationFrame(function(){
        if(dir === "right")     img.classList.add("wv-in-r");
        else if(dir === "left") img.classList.add("wv-in-l");
        else                    img.classList.add("vis");
        wrap.classList.add("loaded");
      });
    };
    t.onerror = function(){ wrap.classList.add("loaded"); };
    t.src = src;
  }

  function render(idx, dir){
    var d = getData(items[idx]);
    if(ov) ov.classList.toggle("is-visual-film", d.galleryLayout === "visual-film");

    /* breadcrumb */
    var bc = document.getElementById("wv-breadcrumb-title");
    if(bc) bc.textContent = d.title;

    num.textContent = pad(idx+1) + " / " + pad(items.length);
    cat.textContent = d.cat;
    ttl.textContent = d.title;
    dsc.textContent = d.desc || "";

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
      lnk.href = d.href; lnk.classList.add("visible");
    } else { lnk.classList.remove("visible"); }

    prev.disabled    = (idx === 0);
    nextBig.disabled = (idx === items.length - 1);
    updateDots();

    /* scroll reset */
    try{ scrollEl.scrollTop = 0; }catch(_){}
    topFab.classList.remove("on");

    if(dir){
      var outCls = dir === "right" ? "wv-out-l" : "wv-out-r";
      img.classList.add(outCls);
      setTimeout(function(){ loadImg(d.src, dir); }, 160);
    } else {
      loadImg(d.src, null);
    }
  }

  function pad(n){ return n < 10 ? "0"+n : ""+n; }

  function go(idx, dir){
    if(idx < 0 || idx >= items.length) return;
    cur = idx; render(cur, dir);
  }

  function openAt(idx){
    ov.classList.add("open");
    cur = idx; buildDots(); render(cur, null);
    /* no body overflow lock — conflicts with custom scroll */
  }

  function close(){
    ov.classList.remove("open");
    clearTimeout(videoTimer);
    if(videoFrame) videoFrame.innerHTML = "";
    /* overflow restored */
  }

  function init(){ setTimeout(build, 300); }
  if(document.readyState === "complete"){ init(); }
  else { window.addEventListener("load", init); }

})();

(function(){
  "use strict";

  function ready(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once:true });
    else fn();
  }

  function shuffle(items){
    var out = items.slice();
    for(var i = out.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function text(el, selector){
    var node = el.querySelector(selector);
    return node ? (node.textContent || "").trim() : "";
  }

  function classify(card, ratio){
    card.classList.remove("is-wide", "is-tall", "is-square");
    if(!Number.isFinite(ratio) || ratio <= 0){
      card.classList.add("is-square");
      return;
    }
    if(ratio >= 1.35) card.classList.add("is-wide");
    else if(ratio <= 0.86) card.classList.add("is-tall");
    else card.classList.add("is-square");
  }

  ready(function(){
    var grid = document.getElementById("viewGrid");
    if(!grid) return;

    var designItems = shuffle(Array.from(document.querySelectorAll("#view-design .design-item"))).slice(0, 5);
    var illustrationItems = shuffle(Array.from(document.querySelectorAll("#view-illustration .illus-card"))).slice(0, 3);
    var sourceItems = shuffle(designItems.concat(illustrationItems));
    if(!sourceItems.length) return;

    var entries = sourceItems.map(function(item, index){
      var isDesign = item.classList.contains("design-item");
      var thumb = item.querySelector(isDesign ? ".design-thumb img:not(.swap-hover)" : ".illus-thumb img:not(.swap-hover)");
      return {
        item:item,
        type:isDesign ? "DESIGN" : "ILLUSTRATION",
        src:thumb ? (thumb.getAttribute("src") || "") : "",
        alt:thumb ? (thumb.getAttribute("alt") || "") : "",
        title:text(item, isDesign ? ".design-title" : ".illus-title"),
        meta:text(item, isDesign ? ".design-meta" : ".illus-sub"),
        no:String(index + 1).padStart(2, "0")
      };
    }).filter(function(entry){ return entry.src; });

    grid.classList.add("visual-index-grid");
    grid.innerHTML = "";

    entries.forEach(function(entry){
      var card = document.createElement("article");
      card.className = "view-card visual-index-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", entry.type + " " + entry.title);

      var thumb = document.createElement("div");
      thumb.className = "view-thumb";
      var img = document.createElement("img");
      img.className = "swap-base";
      img.src = entry.src;
      img.alt = entry.alt || entry.title;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("load", function(){
        classify(card, img.naturalWidth / Math.max(1, img.naturalHeight));
      }, { once:true });
      thumb.appendChild(img);

      var info = document.createElement("div");
      info.className = "view-info";
      info.innerHTML =
        '<p class="view-no">' + entry.no + '</p>' +
        '<p class="view-title">' + entry.title + '</p>' +
        '<p class="view-meta">' + entry.type + ' / ' + entry.meta + '</p>';

      card.appendChild(thumb);
      card.appendChild(info);
      classify(card, 1);

      function openTarget(){
        if(window.__openWorkFromElement && window.__openWorkFromElement(entry.item, { scrollLong:true })) return;
        entry.item.click();
        setTimeout(function(){
          var scrollEl = document.getElementById("wv-scroll");
          var longWrap = document.getElementById("wv-long-wrap");
          try{
            if(scrollEl && longWrap && longWrap.style.display !== "none"){
              scrollEl.scrollTo({ top:Math.max(0, longWrap.offsetTop - 72), behavior:"smooth" });
            }
          }catch(_){}
        }, 720);
      }

      card.addEventListener("click", openTarget);
      card.addEventListener("keydown", function(event){
        if(event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openTarget();
      });
      grid.appendChild(card);
    });
  });
})();



/* ══ POLISH SCRIPT v2 — アニメーション・UX 総合改善 ══ */
(function(){
  "use strict";

  var isCoarse = window.matchMedia("(pointer:coarse)").matches;

  /* ─── A. 外側スローカーソルリング — 完全停止 ───────────────────
     毎フレーム rAF で inline transform 書き込みする lerp ループが
     常時走っていて、スクロール中の合成パイプラインを毎フレ叩いていた。
     視覚的にはほぼ不要なので IIFE 冒頭で return して殺す。 */
  if(false && !isCoarse){
    var outer = document.createElement("div");
    outer.id = "cursor-outer";
    document.body.appendChild(outer);

    var orx = 0, ory = 0, otx = 0, oty = 0;
    window.addEventListener("mousemove", function(e){
      otx = e.clientX;
      oty = e.clientY;
    });
    (function outerLoop(){
      orx += (otx - orx) * 0.07;
      ory += (oty - ory) * 0.07;
      outer.style.transform = "translate("+orx+"px,"+ory+"px) translate(-50%,-50%)";
      requestAnimationFrame(outerLoop);
    })();

    /* カーソル状態切り替え */
    document.addEventListener("mouseover", function(e){
      var t = e.target;
      if(!t || !t.closest) return;
      if(t.closest(".design-thumb,.view-thumb,.illus-thumb,.wv-story-img-wrap")){
        document.body.classList.add("cursor-zoom");
        document.body.classList.remove("cursor-link");
      } else if(t.closest("a,button,[role=button],.toggle-btn,.menu a,.sidebar-toggle,.wvdot,.view-card,.design-item,.illus-card")){
        document.body.classList.add("cursor-link");
        document.body.classList.remove("cursor-zoom");
      } else {
        document.body.classList.remove("cursor-zoom","cursor-link");
      }
    });
  }

  /* ─── B. ストーリーブロック スクロール登場 ──────────── */
  function revealBlocks(){
    var blocks = document.querySelectorAll(".wv-story-block:not(.is-revealed)");
    if(!blocks.length) return;
    if(typeof IntersectionObserver === "undefined"){
      blocks.forEach(function(b){ b.classList.add("is-revealed"); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          en.target.classList.add("is-revealed");
          io.unobserve(en.target);
        }
      });
    }, { threshold:0.08, rootMargin:"0px 0px -20px 0px" });

    blocks.forEach(function(b, i){
      b.style.transitionDelay = (i * 65)+"ms";
      io.observe(b);
    });
  }

  /* ギャラリーブロックが動的に追加された時も対応 — 監視範囲を wv 系のみに絞る。
     旧: document.body subtree:true で全 DOM 変更を捕捉していて、ノイズスクエア
     生成や hover swap 画像追加の度に大量 callback が走り、scroll を詰まらせていた。
     wv (Work Viewer) の親が存在する場合だけ、その配下に絞って監視する。 */
  if(typeof MutationObserver !== "undefined"){
    var wvHost = document.getElementById("wv") || document.querySelector(".wv-story-stage") || null;
    if(wvHost){
      var mo = new MutationObserver(function(muts){
        var found = false;
        for(var i=0; i<muts.length && !found; i++){
          var addedNodes = muts[i].addedNodes;
          for(var j=0; j<addedNodes.length; j++){
            var n = addedNodes[j];
            if(n.classList && (n.classList.contains("wv-story-block") ||
               (n.querySelectorAll && n.querySelectorAll(".wv-story-block").length))){
              found = true; break;
            }
          }
        }
        if(found) setTimeout(revealBlocks, 30);
      });
      mo.observe(wvHost, { childList:true, subtree:true });
    }
  }
  revealBlocks();

  /* ─── C. キーボード Esc でビューワー閉じる ─────────── */
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      var wv = document.getElementById("wv");
      if(wv && wv.classList.contains("open")){
        var closeBtn = document.getElementById("wv-x");
        if(closeBtn) closeBtn.click();
      }
    }
  });

  /* ─── D. ホバースワップ実装（31.html 由来の軽量版） ──────────── */
  /*    ・setup 時に Promise ベースで一括プリロード → 初回ホバーも即応
        ・decode()/double-RAF/ric を廃し、クラス切替だけに絞る
        ・重複処理を排除、1 系統のみに統一                              */
  (function(){
    var canHover = window.matchMedia("(hover: hover)").matches;
    if(!canHover) return;

    function makeSwap(src){
      if(!src) return null;
      if(src.includes("-2.")) return src;
      if(src.includes("picsum.photos")){
        return src.replace(/\/seed\/([^/]+)\//, function(_, s){ return "/seed/"+s+"b/"; });
      }
      var swapped = src.replace(/(\.[^./?#]+)([?#].*)?$/, "-2$1$2");
      return swapped === src ? null : swapped;
    }

    /* 31.html 方式：事前プリロードで Promise を返す */
    function preloadImage(src){
      return new Promise(function(resolve, reject){
        var img = new Image();
        img.onload  = function(){ resolve(src); };
        img.onerror = reject;
        img.src = src;
      });
    }

    function attach(baseImg, thumbEl, itemEl, swapSrc){
      baseImg.classList.add("swap-base");
      var hoverImg = document.createElement("img");
      hoverImg.className = "swap-hover";
      hoverImg.src = swapSrc;
      hoverImg.alt = baseImg.alt || "";
      hoverImg.setAttribute("aria-hidden","true");
      thumbEl.appendChild(hoverImg);
      if(typeof wireImageFallback === "function") wireImageFallback(hoverImg);

      itemEl.addEventListener("mouseenter", function(){
        itemEl.classList.add("is-hover-swapping");
      });
      itemEl.addEventListener("mouseleave", function(){
        itemEl.classList.remove("is-hover-swapping");
      });
    }

    function wire(itemEl, thumbEl, baseImg){
      if(!baseImg || !thumbEl || baseImg.classList.contains("swap-base")) return null;
      var raw = baseImg.getAttribute("src") || "";
      var isIllus = itemEl && itemEl.classList && itemEl.classList.contains("illus-card");
      var candidates = [];
      var swap = makeSwap(raw);
      if(swap && swap !== raw) candidates.push(swap);
      /* design のみ: -2が見つからない場合のみ data-gallery を予備候補に追加
         illustration は「-2が無かったら表示しない」ポリシー。gallery にはフォールバックしない */
      if(!isIllus){
        var g = itemEl.getAttribute("data-gallery") || "";
        g.split("|").forEach(function(s){
          s = s.trim();
          if(s && s !== raw) candidates.push(s);
        });
      }
      if(!candidates.length) return null;

      /* 候補を順に試し、最初に成功したものを採用。全部失敗したら何もしない */
      function tryNext(i){
        if(i >= candidates.length) return;
        preloadImage(candidates[i])
          .then(function(){ attach(baseImg, thumbEl, itemEl, candidates[i]); })
          .catch(function(){ tryNext(i + 1); });
      }
      tryNext(0);
      return true;
    }

    var tasks = [];
    document.querySelectorAll(".design-item").forEach(function(el){
      var th=el.querySelector(".design-thumb"), bi=th?th.querySelector(":scope>img"):null;
      var t = wire(el,th,bi); if(t) tasks.push(t);
    });
    document.querySelectorAll(".illus-card").forEach(function(el){
      var th=el.querySelector(".illus-thumb"), bi=th?th.querySelector(":scope>img"):null;
      var t = wire(el,th,bi); if(t) tasks.push(t);
    });
    document.querySelectorAll(".view-card").forEach(function(el){
      var th=el.querySelector(".view-thumb"), bi=th?th.querySelector(":scope>img:not(.swap-hover)"):null;
      var t = wire(el,th,bi); if(t) tasks.push(t);
    });
    /* 並列プリロードを投げ放っておく（Promise.allSettled は待たない） */
  })();

  /* ─── E. スクロールバー フェードアウト ─────────────── */
  var scrollTimer = null;
  window.addEventListener("scroll", function(){
    document.body.classList.add("is-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function(){
      document.body.classList.remove("is-scrolling");
    }, 900);
  }, { passive:true });

})();



(function(){
  var VIEW_LABELS = {
    profile: { label:"PROFILE / VIEW", no:"01" },
    design:  { label:"DESIGN",          no:"02" },
    illustration: { label:"ILLUSTRATION / ART", no:"03" }
  };
  var meta = document.querySelector(".sidebar-meta");
  if(!meta) return;

  /* 右端のライブ時刻バッジを挿入 */
  if(!meta.querySelector("i.tb-live")){
    var live = document.createElement("i");
    live.className = "tb-live";
    live.innerHTML = "<span style=\"width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor;\"></span><span class=\"tb-live-time\">--:--</span>";
    meta.appendChild(live);
  }

  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function tick(){
    var t = meta.querySelector(".tb-live-time");
    if(!t) return;
    var d = new Date();
    t.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + " JST";
  }
  tick();
  setInterval(tick, 30000);

  function syncFromActive(){
    var active = document.querySelector(".menu a.active[data-view]");
    var key = active ? active.getAttribute("data-view") : "profile";
    var info = VIEW_LABELS[key] || VIEW_LABELS.profile;
    meta.setAttribute("data-current-label", info.label);
    meta.setAttribute("data-current-no", info.no);
  }
  syncFromActive();

  /* ナビクリックで即時更新（既存の view-switch は data-view をトグル） */
  document.querySelectorAll(".menu [data-view]").forEach(function(a){
    a.addEventListener("click", function(){
      setTimeout(syncFromActive, 60);
    });
  });

  /* アクティブ変化を監視（他所から切替えられた時のため） */
  var observer = new MutationObserver(syncFromActive);
  document.querySelectorAll(".menu a").forEach(function(a){
    observer.observe(a, { attributes:true, attributeFilter:["class"] });
  });
})();

(function(){
  "use strict";
  if(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
  var cursor = document.getElementById("cursor");
  if(!cursor) return;
  var hoverSelector = [
    "a", "button", "[role=button]", "[data-view]",
    ".view-card", ".design-item", ".illus-card",
    ".view-legacy-card", ".view-legacy-controls button",
    ".design-thumb", ".design-companion", ".illus-thumb", ".view-thumb",
    ".wv-story-img-wrap", ".wv-g-item", ".wvdot"
  ].join(",");
  var zoomSelector = ".design-thumb, .design-companion, .illus-thumb, .view-thumb, .wv-story-img-wrap, .view-legacy-card";

  function syncCursor(target){
    var el = target && target.closest ? target.closest(hoverSelector) : null;
    var zoom = target && target.closest ? target.closest(zoomSelector) : null;
    cursor.classList.toggle("hover", !!el);
    document.body.classList.toggle("cursor-zoom", !!zoom);
    document.body.classList.toggle("cursor-link", !!el && !zoom);
  }

  document.addEventListener("mouseover", function(event){
    syncCursor(event.target);
  }, { passive:true });

  document.addEventListener("mouseout", function(event){
    var next = event.relatedTarget;
    if(next && next.closest && next.closest(hoverSelector)) return;
    cursor.classList.remove("hover", "active");
    document.body.classList.remove("cursor-zoom", "cursor-link");
  }, { passive:true });

  document.addEventListener("mousedown", function(event){
    cursor.classList.add("active");
    var ripple = document.createElement("span");
    ripple.className = "cursor-ripple";
    ripple.style.left = event.clientX + "px";
    ripple.style.top = event.clientY + "px";
    document.body.appendChild(ripple);
    window.setTimeout(function(){ ripple.remove(); }, 720);
  }, { passive:true });

  document.addEventListener("mouseup", function(){
    cursor.classList.remove("active");
  }, { passive:true });
})();



/* ── LOADER v2 JS: 進捗バー・経過時間・％表示を DOM 差し込み ── */
(function(){
  var loader = document.getElementById("loader");
  if(!loader) return;
  var loadingText = loader.querySelector(".loading-text");
  if(!loadingText) return;

  /* 進捗バー + メタ行を構築 */
  if(!loadingText.querySelector(".ld-progress")){
    var row = document.createElement("div");
    row.className = "ld-row";
    row.innerHTML =
      '<div class="ld-left"><span>SYSTEM STATUS</span><span style="color:rgba(255,255,255,0.28)">／</span><span>INITIALISING VISUAL ENGINE</span></div>' +
      '<div style="display:flex;align-items:center;gap:18px"><span class="ld-elapsed" id="ldElapsed">+00.00S</span><span class="ld-percent" id="ldPercent">000</span></div>';

    var bar = document.createElement("div");
    bar.className = "ld-progress";
    bar.innerHTML = '<div class="ld-progress-fill" id="ldFill"></div>';

    loadingText.textContent = "";
    loadingText.appendChild(row);
    loadingText.appendChild(bar);
  }

  var startTs = (window._loaderPageStart || Date.now());
  var pctEl = document.getElementById("ldPercent");
  var fillEl = document.getElementById("ldFill");
  var elapsedEl = document.getElementById("ldElapsed");

  /* 既存の「実画像プリロード進捗」に追従しつつ、最低滑らかに上昇 */
  var shown = 0;
  function estimate(){
    var elapsed = (Date.now() - startTs) / 1000;
    /* 画像が揃ったら即100%に近づける */
    if(window._viewAssetsReady) return Math.min(100, Math.max(shown, 96 + Math.random()*4));
    /* 初期は時間ベースでスムーズに 0→88% */
    var t = 1 - Math.exp(-elapsed / 2.2);
    return Math.min(88, t * 88);
  }
  function pad2(n){ n = Math.floor(n); return n<10 ? "0"+n : ""+n; }
  function tick(){
    if(!loader.isConnected) return;
    if(loader.classList.contains("hide")) return;

    var target = estimate();
    /* 軽いイージングで近づく */
    shown += (target - shown) * 0.18;
    if(shown > 99.4 && window._viewAssetsReady) shown = 100;

    var display = Math.min(100, Math.max(0, shown));
    if(pctEl) pctEl.textContent = pad2(display).padStart(3, "0") + "%";
    if(fillEl) fillEl.style.width = display.toFixed(2) + "%";

    var el = (Date.now() - startTs) / 1000;
    if(elapsedEl) elapsedEl.textContent = "+" + el.toFixed(2) + "S";

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();



/* ── CURSOR v2 JS: エコーリング追尾 + ホバー検出拡張 + リップル ──
   NOTE: 軽量化のためエコー追尾 rAF と クリック リップル生成は撤廃。
   ベースカーソルはホバー検出 / クリック演出を伴わない素の表示だけ残す。 */
(function(){
  /* 完全撤廃ブロック：以降の rAF / mousedown 連鎖を全て無効化 */
  return;
  /* eslint-disable-next-line no-unreachable */
  var isCoarse = window.matchMedia("(hover:none) and (pointer:coarse)").matches;
  if(isCoarse) return;

  var cursor = document.getElementById("cursor");
  if(!cursor) return;

  /* ── エコーリング要素を挿入 ── */
  var echoWrap = document.createElement("div");
  echoWrap.className = "cursor-echo-wrap";
  var echo = document.createElement("div");
  echo.className = "cursor-echo";
  echoWrap.appendChild(echo);
  document.body.appendChild(echoWrap);

  /* ── 主カーソル位置（mousemoveで即時）に遅延追尾 ── */
  var mx = window.innerWidth/2, my = window.innerHeight/2;
  var ex = mx, ey = my;
  var rafId = 0;
  var rafRunning = false;

  window.addEventListener("mousemove", function(e){
    mx = e.clientX; my = e.clientY;
  }, { passive:true });

  function raf(){
    try{
      /* lerp — 0.16 で滑らかに追従 */
      ex += (mx - ex) * 0.16;
      ey += (my - ey) * 0.16;
      echoWrap.style.transform = "translate3d(" + ex + "px," + ey + "px,0)";
    }catch(_){}
    if(rafRunning) rafId = requestAnimationFrame(raf);
  }
  function startRaf(){
    if(rafRunning) return;
    rafRunning = true;
    rafId = requestAnimationFrame(raf);
  }
  function stopRaf(){
    rafRunning = false;
    if(rafId){ try{ cancelAnimationFrame(rafId); }catch(_){} rafId = 0; }
  }
  startRaf();
  /* タブ非表示中は CPU を使わない（バッテリーと安定性のため） */
  document.addEventListener("visibilitychange", function(){
    if(document.hidden) stopRaf();
    else { ex = mx; ey = my; startRaf(); }
  });
  window.addEventListener("pagehide", stopRaf);

  /* ── ホバー対象を拡張（リンク・ボタン・クリック可要素） ── */
  var HOVER_SELECTOR = [
    "a", "button",
    ".menu a", ".toggle-btn", ".sidebar-toggle",
    ".view-card", ".design-item", ".illus-card",
    ".arrow", ".counter", ".title",
    ".hero-scroll", ".intro-film-scroll",
    "[role=button]", "[data-view]",
    ".wv-g-item", "#wv-lb", ".wv-x",
    ".home-back", ".home-back-top"
  ].join(",");

  function onOver(e){
    try{
      var t = e.target;
      if(t && t.closest && t.closest(HOVER_SELECTOR)){
        cursor.classList.add("hover");
        echoWrap.classList.add("hover");
      }
    }catch(_){}
  }
  function onOut(e){
    try{
      var t = e.target;
      if(t && t.closest && t.closest(HOVER_SELECTOR)){
        /* 親を辿って他のホバー対象内にまだいるかチェック */
        var toEl = e.relatedTarget;
        if(!toEl || !toEl.closest || !toEl.closest(HOVER_SELECTOR)){
          cursor.classList.remove("hover");
          echoWrap.classList.remove("hover");
        }
      }
    }catch(_){}
  }
  document.addEventListener("mouseover", onOver, { passive:true });
  document.addEventListener("mouseout",  onOut,  { passive:true });

  /* ── クリック時のリップル波紋（同時生成数を制限） ── */
  var _ripples = [];
  var _RIPPLE_MAX = 6;
  document.addEventListener("mousedown", function(e){
    try{
      var r = document.createElement("div");
      r.className = "cursor-ripple";
      r.style.left = e.clientX + "px";
      r.style.top  = e.clientY + "px";
      document.body.appendChild(r);
      _ripples.push(r);
      while(_ripples.length > _RIPPLE_MAX){
        var old = _ripples.shift();
        try{ if(old && old.parentNode) old.parentNode.removeChild(old); }catch(_){}
      }
      setTimeout(function(){
        try{ if(r && r.parentNode) r.parentNode.removeChild(r); }catch(_){}
        var i = _ripples.indexOf(r);
        if(i >= 0) _ripples.splice(i, 1);
      }, 720);
    }catch(_){}
  }, { passive:true });

  /* ── ドラッグ/テキスト選択中は非表示（邪魔しない） ── */
  document.addEventListener("selectstart", function(){
    cursor.style.opacity = "0";
    echoWrap.style.opacity = "0";
  });
  document.addEventListener("mouseup", function(){
    cursor.style.opacity = "";
    echoWrap.style.opacity = "";
  });
})();



(function(){
  window._viewAssetsReady = false;
  window._viewImagesReady = false;

  function waitForImage(img){
    return new Promise(function(resolve){
      if(!img){
        resolve();
        return;
      }
      function settle(){
        if(typeof img.decode === "function" && img.complete && img.naturalWidth > 0){
          img.decode().then(resolve, resolve);
          return;
        }
        resolve();
      }
      if(img.complete){
        settle();
        return;
      }
      img.addEventListener("load", settle, { once:true });
      img.addEventListener("error", resolve, { once:true });
    });
  }

  function waitForSrc(src){
    return new Promise(function(resolve){
      if(!src){
        resolve();
        return;
      }
      var img = new Image();
      img.decoding = "async";
      img.onload = function(){
        if(typeof img.decode === "function"){
          img.decode().then(resolve, resolve);
          return;
        }
        resolve();
      };
      img.onerror = resolve;
      img.src = src;
    });
  }

  function waitForVideo(video){
    return new Promise(function(resolve){
      if(!video){
        resolve();
        return;
      }
      if(video.readyState >= 2){
        resolve();
        return;
      }
      video.addEventListener("loadeddata", resolve, { once:true });
      video.addEventListener("error", resolve, { once:true });
      try{
        video.preload = "metadata";
        video.load();
      }catch(_){}
    });
  }

  function markReady(startedAt){
    if(window._viewAssetsReady) return;
    window._viewAssetsReady = true;
    window._viewImagesReady = true;
    try{ window._loaderAssetsReadyAt = Date.now() - startedAt; }catch(_){}
  }

  function start(){
    var startedAt = Date.now();
    var criticalImages = Array.from(document.querySelectorAll(
      ".sidebar .logo img, .profile-photo img, #viewGrid .view-card:nth-child(-n+4) img"
    ));
    var criticalViewTextures = [
      "/assets/view-webgl/view1.jpeg",
      "/assets/view-webgl/view2.jpeg",
      "/assets/view-webgl/view3.jpeg",
      "/assets/view-webgl/view4.jpeg",
      "/assets/view-webgl/view5.jpeg",
      "/assets/view-webgl/view6.jpeg"
    ];
    var introVideo = document.getElementById("introFilmVideo");

    Promise.all([
      Promise.all(criticalImages.map(waitForImage)),
      Promise.all(criticalViewTextures.map(waitForSrc)),
      waitForVideo(introVideo),
      (document.fonts && document.fonts.ready)
        ? document.fonts.ready.catch(function(){})
        : Promise.resolve()
    ]).then(function(){
      requestAnimationFrame(function(){
        markReady(startedAt);
      });
    }).catch(function(){
      markReady(startedAt);
    });

    setTimeout(function(){
      markReady(startedAt);
    }, 3200);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  } else {
    start();
  }
})();



(function(){
  /* ── ノイズスクエアをランダム生成して背景レイヤーに撒く ── */
  function rand(min, max){ return Math.random() * (max - min) + min; }

  function spawn(host, count){
    if(!host) return null;
    var isProfileHost = !!(host.matches && host.matches(".profile-page"));
    /* 既に注入済みなら作り直さない */
    var existing = host.querySelector(":scope > .noise-squares");
    if(existing) existing.remove();

    var layer = document.createElement("div");
    layer.className = "noise-squares";
    layer.setAttribute("aria-hidden", "true");

    var frag = document.createDocumentFragment();
    for(var i = 0; i < count; i++){
      var sq = document.createElement("div");
      sq.className = "noise-square";

      /* バリエーション：ゴースト（枠だけ）/ 内側ライン入り / 通常 */
      var roll = Math.random();
      if(roll < 0.28)        sq.classList.add("is-ghost");
      else if(roll < 0.50)   sq.classList.add("is-cross");

      /* サイズはばらつかせる：小粒〜大判が混在するほうがおしゃれ */
      var sizeRoll = Math.random();
      var size;
      if(isProfileHost){
        if(sizeRoll < 0.52)      size = Math.round(rand(34, 58));
        else if(sizeRoll < 0.90) size = Math.round(rand(72, 118));
        else                     size = Math.round(rand(126, 170));
      }else{
        if(sizeRoll < 0.45)      size = Math.round(rand(28, 64));    /* 小 */
        else if(sizeRoll < 0.85) size = Math.round(rand(70, 140));   /* 中 */
        else                     size = Math.round(rand(150, 240));  /* 大 */
      }
      sq.style.width  = size + "px";
      sq.style.height = size + "px";

      /* 上方向に飛び出すと、design / illustration の説明文 hero に
         被ってしまう。ホストの中だけで漂わせる。 */
      sq.style.top  = rand(isProfileHost ? 4 : 0, isProfileHost ? 88 : 92).toFixed(2) + "%";
      sq.style.left = rand(isProfileHost ? 0 : -4, isProfileHost ? 96 : 100).toFixed(2) + "%";

      sq.style.setProperty("--dx",  rand(isProfileHost ? -52 : -50, isProfileHost ? 52 : 50).toFixed(1)  + "px");
      sq.style.setProperty("--dy",  rand(isProfileHost ? -82 : -80, isProfileHost ? 82 : 80).toFixed(1)  + "px");
      sq.style.setProperty("--rot", rand(isProfileHost ? -9 : -10, isProfileHost ? 9 : 10).toFixed(2)  + "deg");
      sq.style.setProperty("--dur",  rand(isProfileHost ? 4.2 : 7, isProfileHost ? 7.4 : 16).toFixed(2)   + "s");
      sq.style.setProperty("--delay", (-rand(0, isProfileHost ? 10 : 16)).toFixed(2) + "s");
      /* 控えめな濃さ：薄く漂う */
      sq.style.setProperty("--baseOp", rand(isProfileHost ? 0.12 : 0.18, isProfileHost ? 0.28 : 0.42).toFixed(2));

      /* ノイズパターンの位相をスクエアごとにずらす（同じパターンが
         並んで見えないように） */
      sq.style.backgroundPosition =
        Math.round(rand(-200, 0)) + "px " +
        Math.round(rand(-200, 0)) + "px";

      frag.appendChild(sq);
    }
    layer.appendChild(frag);
    host.appendChild(layer);
    return layer;
  }

  /* ── 端末ごとに数を絞る：モバイルは更に少なめ ── */
  var IS_MOBILE = window.matchMedia
                    && window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  /* スクエア基本数を半減以下に。少なくしても密度感が保てるよう
     サイズ分布を維持しているので、見た目はほぼ同じ。 */
  var COUNT_PROFILE = IS_MOBILE ? 14 : 26;
  var COUNT_VIEW    = IS_MOBILE ? 14 : 28;
  var COUNT_DESIGN  = IS_MOBILE ? 10 : 22;
  var COUNT_ILLUS   = IS_MOBILE ? 10 : 22;

  /* ── タブが裏に回ったら body にクラスを立て、CSS でアニメ全停止 ── */
  function bindVisibility(){
    function sync(){
      try{
        document.body.classList.toggle("is-tab-hidden", document.hidden === true);
      }catch(_){}
    }
    document.addEventListener("visibilitychange", sync);
    sync();
  }

  function start(){
    try{
      /* 4 セクション全部に noise-square を生成。RYOTARO（profile）含めて
         全部フル数で復活。アニメは CSS 側で view のみ静止扱い。 */
      spawn(document.querySelector(".profile-page"),       COUNT_PROFILE);
      spawn(document.querySelector(".view-section-wrap"),  COUNT_VIEW);
      spawn(document.querySelector(".design-list"),        COUNT_DESIGN);
      spawn(document.querySelector(".illus-grid"),         COUNT_ILLUS);
      bindVisibility();
    }catch(_){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  } else {
    start();
  }
})();



(function(){
  return; /* ── 完全無効化：dwell 統一のため ── */
  /* eslint-disable-next-line no-unreachable */
  var coarse = false;
  try{ coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; }catch(_){}

  var INNER = 80;     /* この距離以内なら sat=1（フルカラー） */
  var OUTER = 420;    /* この距離以上なら sat=0（完全モノクロ） */
  var MAX_SAT = 1.0;  /* 上限（0.0〜1.0）。控えめにしたければ 0.7 などへ */

  var mx = -99999, my = -99999;
  var imgs = [];
  var rafQueued = false;
  var designView = null;
  var listRefreshTimer = 0;

  function refreshList(){
    try{
      designView = document.getElementById("view-design");
      imgs = Array.from(document.querySelectorAll("#view-design .design-thumb img"));
    }catch(_){
      imgs = [];
    }
  }

  function isDesignActive(){
    return !!(designView && designView.classList && designView.classList.contains("is-active"));
  }

  function frame(){
    rafQueued = false;
    if(!imgs.length) return;
    /* design view が今表示されていなければ全部 0 にして終了 */
    if(!isDesignActive()){
      for(var i=0;i<imgs.length;i++){
        imgs[i].style.setProperty("--sat", "0");
      }
      return;
    }
    var range = OUTER - INNER;
    if(range <= 0) range = 1;
    /* read 全部 → write 全部、で layout thrash を避ける */
    var rects = new Array(imgs.length);
    for(var i=0;i<imgs.length;i++){
      rects[i] = imgs[i].getBoundingClientRect();
    }
    for(var j=0;j<imgs.length;j++){
      var r = rects[j];
      if(!r || r.width === 0){ continue; }
      var cx = r.left + r.width  * 0.5;
      var cy = r.top  + r.height * 0.5;
      var dx = mx - cx;
      var dy = my - cy;
      var d  = Math.sqrt(dx*dx + dy*dy);
      var t;
      if(d <= INNER) t = 1;
      else if(d >= OUTER) t = 0;
      else t = 1 - (d - INNER) / range;
      /* ease-out（カーソルから離れたほうが急に落ちる方が "視線追従" に見える） */
      t = t * t * (3 - 2 * t);
      imgs[j].style.setProperty("--sat", (t * MAX_SAT).toFixed(3));
    }
  }

  function tick(){
    if(rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(frame);
  }

  function bind(){
    if(coarse){
      /* タッチでは固定で軽くカラーまで戻す（Hover 不可なので意味的にはモノクロ寄せ） */
      try{
        document.querySelectorAll("#view-design .design-thumb img").forEach(function(im){
          im.style.setProperty("--sat", "0.0");
        });
      }catch(_){}
      return;
    }
    document.addEventListener("mousemove", function(e){
      mx = e.clientX;
      my = e.clientY;
      tick();
    }, { passive:true });
    document.addEventListener("mouseleave", function(){
      mx = -99999; my = -99999;
      tick();
    });
    window.addEventListener("scroll", tick, { passive:true });
    window.addEventListener("resize", function(){
      tick();
      /* リサイズ時は念のため要素リストも作り直し */
      clearTimeout(listRefreshTimer);
      listRefreshTimer = setTimeout(refreshList, 200);
    });
    /* design view が active になったタイミングで再収集（lazy 描画対策の保険） */
    var mo = new MutationObserver(function(){
      refreshList();
      tick();
    });
    if(designView) mo.observe(designView, { attributes:true, attributeFilter:["class"] });
  }

  function init(){
    refreshList();
    /* design 画像が後から増えるケースに備えて少し遅延でも再収集 */
    setTimeout(function(){ refreshList(); tick(); },  600);
    setTimeout(function(){ refreshList(); tick(); }, 1800);
    bind();
    tick();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();



(function(){
  function tryPlay(v){
    if(!v) return;
    try{
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted","");
      v.setAttribute("playsinline","");
      v.setAttribute("webkit-playsinline","");
      v.loop = true;
      var p = v.play();
      if(p && typeof p.catch === "function"){
        p.catch(function(){
          var retry = function(){
            try{ v.play().catch(function(){}); }catch(_){}
            window.removeEventListener("click", retry, true);
            window.removeEventListener("touchstart", retry, true);
            window.removeEventListener("keydown", retry, true);
          };
          window.addEventListener("click", retry, true);
          window.addEventListener("touchstart", retry, true);
          window.addEventListener("keydown", retry, true);
        });
      }
    }catch(_){}
  }
  function ensure(){
    /* now-viewing と view-section の両方を一括再生 */
    document.querySelectorAll(".nowback-video, .viewback-video").forEach(function(v){
      tryPlay(v);
    });
  }
  function bind(){
    ensure();
    document.addEventListener("visibilitychange", function(){
      if(!document.hidden) ensure();
    });
    /* view-profile（VIEW セクションを含む）が active になったタイミングでも再生 */
    var profile = document.getElementById("view-profile");
    if(profile){
      var mo = new MutationObserver(function(){
        if(profile.classList.contains("is-active")) ensure();
      });
      mo.observe(profile, { attributes:true, attributeFilter:["class"] });
    }
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind, { once:true });
  } else {
    bind();
  }
})();



/* ── Luxury image reveal: page-wide image entrance choreography ── */
(function(){
  "use strict";

  var SELECTOR = [
    ".view-thumb",
    ".design-thumb",
    ".illus-thumb",
    ".profile-photo",
    ".wv-story-img-wrap",
    ".wv-theme-slide",
    ".project-theme-slide"
  ].join(",");
  var observed = new WeakSet();
  var revealObserver = null;
  var refreshFrame = 0;

  function hasImage(el){
    return !!(el && el.querySelector && el.querySelector("img:not(.swap-hover)"));
  }

  function reveal(el){
    if(!el || !el.classList) return;
    el.classList.add("is-lux-visible");
  }

  function register(el, index){
    if(!(el instanceof HTMLElement)) return;
    if(observed.has(el) || !hasImage(el)) return;
    observed.add(el);
    el.classList.add("lux-image-reveal");
    el.style.setProperty("--lux-delay", Math.min((index % 6) * 44, 176) + "ms");

    if(!("IntersectionObserver" in window)){
      reveal(el);
      return;
    }
    revealObserver.observe(el);
  }

  function refresh(root){
    var scope = root && root.querySelectorAll ? root : document;
    var list = Array.from(scope.querySelectorAll(SELECTOR));
    list.forEach(register);
  }

  function requestRefresh(root){
    if(refreshFrame) return;
    refreshFrame = requestAnimationFrame(function(){
      refreshFrame = 0;
      refresh(root || document);
    });
  }

  function init(){
    if("IntersectionObserver" in window){
      revealObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            reveal(entry.target);
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold:0.18,
        rootMargin:"0px 0px -8% 0px"
      });
    }

    refresh(document);

    if("MutationObserver" in window){
      var mo = new MutationObserver(function(mutations){
        var shouldRefresh = false;
        for(var i = 0; i < mutations.length && !shouldRefresh; i++){
          var nodes = mutations[i].addedNodes || [];
          for(var j = 0; j < nodes.length; j++){
            var node = nodes[j];
            if(node.nodeType !== 1) continue;
            if(
              (node.matches && node.matches(SELECTOR)) ||
              (node.querySelector && node.querySelector(SELECTOR))
            ){
              shouldRefresh = true;
              break;
            }
          }
        }
        if(shouldRefresh) requestRefresh(document);
      });
      mo.observe(document.body, { childList:true, subtree:true });
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once:true });
  }else{
    init();
  }
})();
