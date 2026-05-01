
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
      /* Final safety net: if anything stalls, dismiss the loader
         as soon as window load fires, or after 2.5s — whichever
         comes first — so the page is always usable. */
      function __dropLoader(){
        try{
          var ld = document.getElementById("loader");
          if(ld && !ld.classList.contains("hide")){
            ld.classList.add("hide");
            /* ── opening reveal ── */
            setTimeout(function(){ document.body.classList.add('page-revealed'); }, 80);
            setTimeout(function(){ try{ ld.style.display = "none"; }catch(_){} }, 900);
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
      var MIN_LOADER_MS = 1600;
      var MAX_LOADER_MS = 12000;
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
        var CATASTROPHIC_TIMEOUT_MS = 12000;
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
  async function ensureThreeLib(){
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
  if(!hasThree){
    console.warn("three.js の読み込みに失敗しました。3D表示のみスキップします。");
  }

  const introFilmEl = document.getElementById("introFilm");
  const introFilmStageEl = document.getElementById("introFilmStage");
  const introFilmVideoEl = document.getElementById("introFilmVideo");
  const introFilmScrollEl = document.getElementById("introFilmScroll");
  const heroEl = document.getElementById("hero3d");
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
    const currentY = window.scrollY || window.pageYOffset || 0;
    if(
      forceShow ||
      document.body.classList.contains("is-intro-mode") ||
      !document.body.classList.contains("page-revealed") ||
      currentY < 28
    ){
      document.body.classList.remove("is-topbar-hidden");
      lastTopbarScrollY = currentY;
      return;
    }

    const delta = currentY - lastTopbarScrollY;
    if(currentY > 120 && delta > 10){
      document.body.classList.add("is-topbar-hidden");
    }else if(delta < -8){
      document.body.classList.remove("is-topbar-hidden");
    }
    lastTopbarScrollY = currentY;
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
    const shouldHideUi = viewSectionActive && progress < 0.72;
    document.body.classList.toggle("is-intro-mode", shouldHideUi);
  }

  function resetIntroProgressState(){
    _introProgressDisabled = false;
    _lastIntroP = -1;
    _cacheIntroLayout();
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

    /* CSS変数を使わず直接スタイルを書く → スタイル再計算ゼロ */

    /* .intro-film-stage */
    introFilmStageEl.style.opacity   = 1 - p * 0.5;
    introFilmStageEl.style.transform = `translate3d(${p * -2.2 * vw / 100}px,${p * 18}px,0) scale(${1.01 - p * 0.03})`;

    /* video */
    if(introFilmVideoEl){
      introFilmVideoEl.style.transform = `translate3d(${p * -4 * vw / 100}px,${p * -2.2 * vh / 100}px,0) scale(${1 + p * 0.12})`;
    }

    /* .intro-film-copy */
    if(_introCopyEl){
      _introCopyEl.style.opacity   = 0.98 - p * 0.72;
      _introCopyEl.style.transform = `translate3d(${p * -3 * vw / 100}px,${p * -18}px,0)`;
    }

    /* scroll button — CSS var で Y 値を渡し hover が CSS で正しく計算できるようにする */
    if(introFilmScrollEl){
      introFilmScrollEl.style.opacity = 0.92 - p * 0.6;
      introFilmScrollEl.style.setProperty("--_scroll-btn-y", `${(p * -8).toFixed(2)}px`);
    }

    /* .hero-3d */
    if(heroEl){
      heroEl.style.opacity   = 0.52 + p * 0.48;
      heroEl.style.transform = `translate3d(0,${(1 - p) * 86}px,0) scale(${0.962 + p * 0.038})`;
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
        heroInViewport = !!(entry && entry.isIntersecting && entry.intersectionRatio > 0.02);
      }, { threshold:[0, 0.02, 0.08] });
      heroVisibilityObserver.observe(heroEl);
    }else{
      const syncHeroVisibility = ()=>{
        const rect = heroEl.getBoundingClientRect();
        heroInViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      };
      syncHeroVisibility();
      window.addEventListener("scroll", syncHeroVisibility, { passive:true });
      window.addEventListener("resize", syncHeroVisibility);
    }
  }

  function getVisibleViews(view){
    return [view];
  }

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
      requestAnimationFrame(()=>{
        if(view === "profile"){
          resetIntroProgressState();
        }
        safeScrollToTop();
        slowScrollTargetY = 0;
        requestIntroFilmProgress();
      });
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
      resetIntroProgressState();
      if(threeInteractionReady){
        viewScrollSpinCarry = 0;
        viewScrollSpinDirection = 0;
        if(typeof resize3D === "function"){
          try{ resize3D(); }catch(_e){}
        }
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
      syncTopbarScrollState(true);
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
  const viewCards = [
    { image:"/assets/view/view1.jpeg",  title:"重なり", url:"https://1.com" },
    { image:"/assets/view/view2.jpeg",  title:"リアルタイム色立体", url:"https://2.com" },
    { image:"/assets/view/view3.jpeg",  title:"リミナルスペース", url:"https://3.com" },
    { image:"/assets/view/view4.jpeg",  title:"ロゴ制作", url:"https://4.com" },
    { image:"/assets/view/view5.jpeg",  title:"ゲームエンジンを用いた街制作", url:"https://5.com" },
    { image:"/assets/view/view6.jpeg",  title:"ライブ背景映像", url:"https://6.com" },
    { image:"/assets/view/view7.jpeg",  title:"07.com", url:"https://7.com" },
    { image:"/assets/view/view8.jpeg",  title:"08.com", url:"https://8.com" },
    { image:"/assets/view/view9.jpeg",  title:"09.com", url:"https://9.com" },
    { image:"/assets/view/view10.jpeg", title:"10.com", url:"https://10.com" },
    { image:"/assets/view/view11.jpeg", title:"11.com", url:"https://11.com" },
    { image:"/assets/view/view12.jpeg", title:"12.com", url:"https://12.com" },
    { image:"/assets/view/view12.jpeg", title:"13.com", url:"https://13.com" },
    { image:"/assets/view/view14.jpeg", title:"14.com", url:"https://14.com" },
    { image:"/assets/view/view15.jpeg", title:"15.com", url:"https://15.com" }
  ];
  const COUNT = viewCards.length;
  const viewImages = viewCards.map((card)=>card.image);
  window.__THREE_VIEW_TEXTURES_READY__ = COUNT === 0;
  window.__THREE_VIEW_TEXTURES_PENDING__ = COUNT;
  try{
    const preloadBucket = Array.isArray(window.__EXTRA_PRELOAD_IMAGES__)
      ? window.__EXTRA_PRELOAD_IMAGES__
      : (window.__EXTRA_PRELOAD_IMAGES__ = []);
    viewImages.forEach((src)=>{
      const normalized = typeof src === "string" ? src.trim() : "";
      if(!normalized || preloadBucket.includes(normalized)) return;
      preloadBucket.push(normalized);
    });
  }catch(_){}
  const titles = viewCards.map((card)=>card.title);
  const links = viewCards.map((card)=>card.url);
  const ENABLE_VIEW_NAVIGATION = false;
  const VIEW_TEXTURE_EAGER_COUNT = COUNT;
  const VIEW_TEXTURE_CONCURRENCY = STABLE_PERFORMANCE_MODE
    ? (isCoarsePointer ? 2 : 4)
    : 5;

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

  function pumpTextureQueue(){
    while(activeTextureJobs < VIEW_TEXTURE_CONCURRENCY && pendingTextureJobs.length){
      const job = pendingTextureJobs.shift();
      if(!job) return;
      activeTextureJobs += 1;
      texLoader.load(
        job.src,
        (t)=>{
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = renderer.capabilities.getMaxAnisotropy();
          fitImagePlaneContain(job.imagePlane, t);
          job.imageMat.map = t;
          job.imageMat.color.set(0xffffff);
          job.imageMat.needsUpdate = true;
          job.imagePlane.visible = true;
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

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);

    /* 3Dエリア内の左右スワイプ時のブラウザ戻る/進むを抑止 */
    if(absX > absY && absX > 2){
      e.preventDefault();
    }

    /* トラックパッドのピンチ（Ctrl+wheel）でモード切替 */
    if(e.ctrlKey){
      e.preventDefault();
      handlePinchSwitch(e.deltaY);
      return;
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
  function animate(now){
    /* hero が見えていない / 3D 必要無いときは rAF を再キューしない。
       これで永続 60fps の rAF サイクルが消えてスクロール時の負荷が下がる。 */
    if(!threeInteractionReady || !viewSectionActive || !pageVisible || !heroInViewport){
      drawTrail();
      /* 復帰用にゆるい watch だけ残す（500ms ごと監視） */
      setTimeout(function(){
        if(threeInteractionReady && viewSectionActive && pageVisible && heroInViewport){
          requestAnimationFrame(animate);
        } else {
          requestAnimationFrame(animate);  /* 引き続き待機 */
        }
      }, 500);
      return;
    }
    requestAnimationFrame(animate);

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
    if(typeof animate === "function") animate();
  }catch(_animErr){
    console.warn("[stability] animate() failed", _animErr);
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
      setTimeout(()=>{
        document.body.classList.add('page-revealed');
        syncTopbarScrollState(true);
      }, 80);
      setTimeout(()=>{ try{ loader.style.display = "none"; }catch(_){} }, 900);
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
  var galleryEl, galleryWrap, lightbox, lightboxImg;
  var processEl, processWrap, toolsEl;
  var lbSrcs = [], lbIdx = 0;

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

    /* close */
    document.getElementById("wv-x").addEventListener("click", close);
    bg.addEventListener("click", close);

    /* nav */
    prev.addEventListener("click", function(){ go(cur - 1, "left"); });
    nextBig.addEventListener("click", function(){ go(cur + 1, "right"); });

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
    var href  = ds.url || ds.href ||
                (el.querySelector("a[href]") ? el.querySelector("a[href]").href : "") || "";
    var process = ds.process || "";
    var tools   = ds.tools   || "";
    return { src:src, title:title, cat:catTx, desc:desc,
             long:long, year:year, role:role, media:media,
             gallery:gallery, href:href,
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
    if(!d.gallery || !d.gallery.length){ galleryWrap.style.display="none"; return; }
    galleryWrap.style.display = "";
    lbSrcs = d.gallery.slice(); /* store all gallery srcs for prev/next */
    d.gallery.forEach(function(src, gi){
      var block = document.createElement("div");
      block.className = "wv-story-block";

      /* image wrap */
      var imgWrap = document.createElement("div");
      imgWrap.className = "wv-story-img-wrap";
      var numSpan = document.createElement("span");
      numSpan.className = "wv-story-img-num";
      numSpan.textContent = String(gi+1).padStart(2,"0");
      var im = document.createElement("img");
      im.alt = ""; im.draggable = false;
      imgWrap.appendChild(numSpan);
      imgWrap.appendChild(im);

      /* lazy load */
      (function(imEl, s){
        var ldr = new Image();
        ldr.onload = function(){
          imEl.src = s;
          requestAnimationFrame(function(){ imEl.classList.add("lo"); });
        };
        ldr.onerror = function(){ imEl.closest(".wv-story-img-wrap").style.background="#111"; };
        ldr.src = s;
      })(im, src);

      /* lightbox on click */
      imgWrap.addEventListener("click", function(){ lbShow(gi); });

      /* text block */
      var cap = STORY_CAPTIONS[gi] || ["制作の一場面。"];
      var txt = document.createElement("div");
      txt.className = "wv-story-text";
      txt.innerHTML = cap.map(function(p, pi){
        return '<p class="'+(pi===0?"wv-story-lead":"")+'">' + esc(p) + '</p>';
      }).join("");

      block.appendChild(imgWrap);
      block.appendChild(txt);
      galleryEl.appendChild(block);
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
    cur = idx; buildDots(); render(cur, null);
    ov.classList.add("open");
    /* no body overflow lock — conflicts with custom scroll */
  }

  function close(){
    ov.classList.remove("open");
    /* overflow restored */
  }

  function init(){ setTimeout(build, 300); }
  if(document.readyState === "complete"){ init(); }
  else { window.addEventListener("load", init); }

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

  function start(){
    var collectedSrcs = new Set();

    function safeQueryAll(sel){
      try{ return document.querySelectorAll(sel); }
      catch(_){ return []; }
    }
    function pushSrc(s){
      if(typeof s !== "string") return;
      s = s.trim();
      if(!s) return;
      if(s.indexOf("data:") === 0) return;
      collectedSrcs.add(s);
    }

    /* (a) ページ内の全 <img>（src / data-src / currentSrc 全部） */
    try{
      safeQueryAll("img").forEach(function(img){
        try{
          pushSrc(img.getAttribute("src"));
          pushSrc(img.getAttribute("data-src"));
          pushSrc(img.currentSrc);
        }catch(_){}
      });
    }catch(_){}

    /* (b) -2 ホバー差し替え画像（design / illustration） */
    function makeSwap(src){
      try{
        if(!src) return null;
        var m = src.match(/^(.*?)(\.[a-zA-Z0-9]+)(\?.*)?$/);
        if(!m) return null;
        return m[1] + "-2" + m[2] + (m[3] || "");
      }catch(_){ return null; }
    }
    try{
      safeQueryAll(".design-thumb img, .illus-thumb img").forEach(function(img){
        try{
          pushSrc(makeSwap(img.getAttribute("src")));
        }catch(_){}
      });
    }catch(_){}

    /* (c) data-gallery（design 各カードの全枚） */
    try{
      safeQueryAll("[data-gallery]").forEach(function(el){
        try{
          (el.getAttribute("data-gallery") || "").split("|").forEach(function(s){
            pushSrc(s);
          });
        }catch(_){}
      });
    }catch(_){}

    /* (d) video poster */
    try{
      safeQueryAll("video[poster]").forEach(function(v){
        try{ pushSrc(v.getAttribute("poster")); }catch(_){}
      });
    }catch(_){}

    /* (e) DOM 外で使う 3D VIEW テクスチャも初回ロードに含める */
    try{
      (window.__EXTRA_PRELOAD_IMAGES__ || []).forEach(function(src){
        pushSrc(src);
      });
    }catch(_){}

    var srcs = Array.from(collectedSrcs);
    if(!srcs.length){
      window._viewAssetsReady = true;
      window._viewImagesReady = true;
      return;
    }

    var pending = srcs.length;
    var startedAt = Date.now();
    var cursor = 0;
    /* 並列数: 6 が経験的にバランス良し（モバイル詰まり＆同時 decode 軽減） */
    var MAX_CONCURRENT = 6;
    var inflight = 0;
    var images = [];   /* GC 抑制用に参照保持 */

    function markReady(){
      if(window._viewAssetsReady) return;
      if(window.__THREE_VIEW_TEXTURES_READY__ !== true){
        setTimeout(markReady, 60);
        return;
      }
      /* フラグを立てるのは scroll-warm が終わってから。
         先に立てるとローダーが先に降りて温まる前にユーザーに見える。 */

      /* ── ページ全画像の完全ロード必須ゲート ── */
      try{
        var allImgs = document.querySelectorAll("img");
        var pendingAll = 0;
        allImgs.forEach(function(img){
          if(!(img.complete && img.naturalWidth > 0)){
            pendingAll++;
            var done = false;
            function onSettle(){
              if(done) return; done = true;
              pendingAll--;
              if(pendingAll <= 0){
                window._allImagesLoaded = true;
                markReady();
              }
            }
            img.addEventListener("load",  onSettle, { once:true });
            img.addEventListener("error", onSettle, { once:true });
          }
        });
        if(pendingAll > 0){
          return;
        }
      }catch(_){}

      /* ── 動画 (sasisho.mp4 / nowback.mp4 / その他 video[src]) を
            canplaythrough まで待つ ── */
      try{
        if(!window._videosAllLoaded){
          var allVideos = document.querySelectorAll("video[src]");
          var pendingVid = 0;
          allVideos.forEach(function(v){
            /* readyState >= 4 = HAVE_ENOUGH_DATA = canplaythrough 相当 */
            if(v.readyState < 4){
              pendingVid++;
              var doneV = false;
              function onSettleV(){
                if(doneV) return; doneV = true;
                pendingVid--;
                if(pendingVid <= 0){
                  window._videosAllLoaded = true;
                  markReady();
                }
              }
              v.addEventListener("canplaythrough", onSettleV, { once:true });
              v.addEventListener("loadeddata",     onSettleV, { once:true });
              v.addEventListener("error",          onSettleV, { once:true });
              /* preload を強制 */
              try{ v.preload = "auto"; v.load(); }catch(_){}
            }
          });
          if(pendingVid > 0){
            window._videosAllLoaded = false;
            return;
          }
          window._videosAllLoaded = true;
        }
      }catch(_){}

      /* ── Web フォント読込完了を待つ ── */
      try{
        if(!window._fontsLoaded && document.fonts && document.fonts.ready){
          document.fonts.ready.then(function(){
            window._fontsLoaded = true;
            markReady();
          }).catch(function(){
            window._fontsLoaded = true;
            markReady();
          });
          /* 安全網 */
          setTimeout(function(){
            if(!window._fontsLoaded){
              window._fontsLoaded = true;
              markReady();
            }
          }, 8000);
          return;
        }
        if(!window._fontsLoaded) window._fontsLoaded = true;
      }catch(_){
        window._fontsLoaded = true;
      }

      /* motion-reveal は全部即時 inview に（class 追加だけなので副作用なし） */
      try{
        document.querySelectorAll(".motion-reveal").forEach(function(el){
          el.classList.add("is-inview");
        });
      }catch(_){}

      /* ── SHORT WARM PASS ──
         スクロールしない（ページが上下に動かない）。
         代わりに以下を数回だけ繰り返して初回表示に必要な面を温める:
           1. 全 img の decode() 連打
           2. 主要要素の getBoundingClientRect / offsetHeight read
           3. 主要セクションに will-change: transform を付け外しして
              GPU レイヤーを事前確保
           4. 短い間隔で paint の機会を確保
         長時間バックグラウンドで回し続けない。 */
      var WARM_TARGETS_SEL =
        ".view-section-wrap, .view-card, .view-thumb, " +
        ".design-list, .design-item, .design-thumb, " +
        ".illus-grid, .illus-card, .illus-thumb, " +
        ".profile-page, .profile-wrap";

      function decodeAllImages(){
        try{
          document.querySelectorAll("img").forEach(function(img){
            try{
              if(img.complete && img.naturalWidth > 0 && typeof img.decode === "function"){
                var p = img.decode();
                if(p && typeof p.catch === "function") p.catch(function(){});
              }
            }catch(_){}
          });
        }catch(_){}
      }
      function readLayout(){
        try{
          void document.body.offsetHeight;
          document.querySelectorAll(WARM_TARGETS_SEL).forEach(function(el){
            try{
              void el.offsetHeight;
              void el.getBoundingClientRect();
            }catch(_){}
          });
        }catch(_){}
      }
      function flickGpu(on){
        try{
          document.querySelectorAll(WARM_TARGETS_SEL).forEach(function(el){
            try{
              el.style.willChange = on ? "transform" : "";
            }catch(_){}
          });
        }catch(_){}
      }

      var passes = 0;
      var TOTAL_PASSES = 5;
      var INTERVAL = 48;

      /* ── VIEW SECTION FORCED PAINT ──
         ローダー（fixed z-index:500 #000）が画面を覆っている間に、
         view-section-wrap を position:fixed で viewport に貼り付けて
         実際にブラウザにペイントさせる。これで初回スクロールで paint が
         走るのを完全回避。loader が上に居るのでユーザーには見えない。 */
      var _viewPaintForced = false;
      function forcePaintViewOnce(){
        if(_viewPaintForced) return;
        _viewPaintForced = true;
        try{
          var section = document.querySelector(".view-section-wrap");
          if(!section) return;
          /* 元のスタイルを退避 */
          var orig = {
            position:   section.style.position,
            top:        section.style.top,
            left:       section.style.left,
            right:      section.style.right,
            width:      section.style.width,
            maxWidth:   section.style.maxWidth,
            margin:     section.style.margin,
            zIndex:     section.style.zIndex,
            visibility: section.style.visibility,
            opacity:    section.style.opacity
          };
          /* viewport に貼り付け（loader 500 より下、コンテンツより上） */
          section.style.position   = "fixed";
          section.style.top        = "0";
          section.style.left       = "0";
          section.style.right      = "0";
          section.style.width      = "100%";
          section.style.maxWidth   = "100vw";
          section.style.margin     = "0";
          section.style.zIndex     = "1";
          section.style.visibility = "visible";
          section.style.opacity    = "1";
          /* レイアウトとペイントを強制発火 */
          void section.offsetHeight;
          section.querySelectorAll("img").forEach(function(img){
            try{
              if(img.complete && img.naturalWidth > 0 && typeof img.decode === "function"){
                var p = img.decode();
                if(p && typeof p.catch === "function") p.catch(function(){});
              }
            }catch(_){}
            void img.offsetHeight;
          });
          /* 3 フレーム置いてから元に戻す（paint が確実に走る時間を確保） */
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              requestAnimationFrame(function(){
                Object.keys(orig).forEach(function(k){
                  section.style[k] = orig[k] || "";
                });
              });
            });
          });
        }catch(_){}
      }
      /* warm pass 序盤で 1 度発火（ローダーが必ず up 状態のときに行う） */
      setTimeout(forcePaintViewOnce, 120);

      function passStep(){
        try{
          /* GPU レイヤー確保 → ペイント → 解放 を交互に */
          var phaseOn = (passes % 4 === 0);
          if(phaseOn) flickGpu(true);
          decodeAllImages();
          readLayout();
          if(phaseOn){
            requestAnimationFrame(function(){
              flickGpu(false);
            });
          }
        }catch(_){}
        passes++;
        if(passes < TOTAL_PASSES){
          setTimeout(passStep, INTERVAL);
        } else {
          finish();
        }
      }

      function finish(){
        try{ flickGpu(false); }catch(_){}
        decodeAllImages();
        readLayout();
        /* 仕上げに 3 rAF 待ってからレディ */
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              window._viewAssetsReady = true;
              window._viewImagesReady = true;
              try{ window._loaderAssetsReadyAt = Date.now() - startedAt; }catch(_){}
            });
          });
        });
      }

      requestAnimationFrame(passStep);
    }

    function imgDone(im){
      var p = null;
      try{
        if(im && im.decode && im.naturalWidth > 0){
          p = im.decode();
        }
      }catch(_){}
      function settle(){
        pending--;
        if(pending <= 0) markReady();
        pump();
      }
      if(p && typeof p.then === "function"){
        p.then(settle, settle);
      } else {
        settle();
      }
    }

    function loadOne(src){
      var im;
      try{
        im = new Image();
        im.decoding = "async";
        im.loading  = "eager";
        images.push(im);
        var fired = false;
        function once(){
          if(fired) return; fired = true;
          inflight--;
          imgDone(im);
        }
        im.onload  = once;
        im.onerror = once;   /* 404 / 失敗してもブロックしない */
        im.src = src;
        /* キャッシュヒットの場合 src 設定直後に complete=true */
        if(im.complete && !fired){
          once();
        }
      }catch(_){
        inflight--;
        imgDone(im);
      }
    }

    function pump(){
      while(inflight < MAX_CONCURRENT && cursor < srcs.length){
        inflight++;
        loadOne(srcs[cursor++]);
      }
    }
    pump();

    /* プリロード自体の安全網 */
    setTimeout(markReady, 12000);
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
      if(sizeRoll < 0.45)      size = Math.round(rand(28, 64));    /* 小 */
      else if(sizeRoll < 0.85) size = Math.round(rand(70, 140));   /* 中 */
      else                     size = Math.round(rand(150, 240));  /* 大 */
      sq.style.width  = size + "px";
      sq.style.height = size + "px";

      /* 上方向に飛び出すと、design / illustration の説明文 hero に
         被ってしまう。ホストの中だけで漂わせる。 */
      sq.style.top  = rand(0, 92).toFixed(2) + "%";
      sq.style.left = rand(-4, 100).toFixed(2) + "%";

      sq.style.setProperty("--dx",  rand(-50, 50).toFixed(1)  + "px");
      sq.style.setProperty("--dy",  rand(-80, 80).toFixed(1)  + "px");
      sq.style.setProperty("--rot", rand(-10, 10).toFixed(2)  + "deg");
      sq.style.setProperty("--dur",  rand(7, 16).toFixed(2)   + "s");
      sq.style.setProperty("--delay", (-rand(0, 16)).toFixed(2) + "s");
      /* 控えめな濃さ：薄く漂う */
      sq.style.setProperty("--baseOp", rand(0.18, 0.42).toFixed(2));

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



(function(){
  function getVideo(){
    return document.querySelector(".design-hero-bg-video");
  }
  function ensurePlay(){
    var v = getVideo();
    if(!v) return;
    try{
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.loop = true;
      var p = v.play();
      if(p && typeof p.catch === "function"){
        p.catch(function(){
          /* autoplay がブロックされた場合は最初のユーザー操作で再試行 */
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
  function pauseVideo(){
    var v = getVideo();
    if(!v) return;
    try{ v.pause(); }catch(_){}
  }

  function bind(){
    var design = document.getElementById("view-design");
    if(!design) return;
    /* 既に active ならすぐ再生 */
    if(design.classList.contains("is-active")){
      ensurePlay();
    }
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.attributeName !== "class") return;
        if(design.classList.contains("is-active")){
          ensurePlay();
        } else {
          pauseVideo();
        }
      });
    });
    mo.observe(design, { attributes:true, attributeFilter:["class"] });

    /* タブ復帰時にも再生再開 */
    document.addEventListener("visibilitychange", function(){
      if(!document.hidden && design.classList.contains("is-active")){
        ensurePlay();
      }
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind, { once:true });
  } else {
    bind();
  }
})();
