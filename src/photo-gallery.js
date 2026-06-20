const __portfolioUtils = window.__portfolioAssetUtils || {};
const getImageDisplaySrc = __portfolioUtils.getImageDisplaySrc || function(_img, src){ return src || ""; };

/* ── PHOTO gallery: render the new product / outdoor sets on demand ── */
(function(){
  "use strict";

  var root = document.getElementById("view-photo");
  if(!root) return;

  var index = root.querySelector("#photoIndex");
  var buttons = Array.from(root.querySelectorAll("[data-photo-category-button]"));
  if(!index || !buttons.length) return;

  var categories = {
    product: {
      label: "PRODUCT",
      key: "product",
      files: [
        "01.jpg",
        "product-002.jpg",
        "product-003.jpg",
        "product-004.jpg",
        "product-005.jpg",
        "product-016.jpg",
        "product-017.jpg",
        "product-019.jpg",
        "product-024.jpg",
        "product-025.jpg",
        "product-026.jpg",
        "product-029.jpg",
        "product-030.jpg",
        "product-031.jpg",
        "product-034.jpg",
        "product-036.jpg",
        "product-038.jpg",
        "product-039.jpg",
        "product-041.jpg",
        "product-042.jpg",
        "product-043.jpg",
        "product-044.jpg",
        "product-045.jpg",
        "product-046.jpg",
        "product-047.jpg",
        "product-048.jpg",
        "product-049.jpg",
        "product-050.jpg",
        "product-051.jpg",
        "product-052.jpg",
        "product-053.jpg",
        "product-054.jpg",
        "product-055.jpg",
        "product-056.jpg",
        "product-057.jpg",
        "product-058.jpg",
        "product-059.jpg",
        "product-060.jpg",
        "product-061.jpg",
        "product-062.jpg",
        "product-063.jpg",
        "product-065.jpg",
        "product-067.jpg",
        "product-069.jpg",
        "product-073.jpg",
        "product-074.jpg",
        "product-076.jpg",
        "product-077.jpg",
        "product-078.jpg",
        "product-081.jpg",
        "product-082.jpg",
        "product-083.jpg",
        "product-084.jpg",
        "product-085.jpg",
        "product-086.jpg",
        "product-087.jpg"
      ],
      alt: "Product photo"
    },
    outside: {
      label: "OUTDOOR",
      key: "outside",
      files: [
        "outside-011.jpg",
        "outside-012.jpg",
        "outside-013.jpg",
        "outside-014.jpg",
        "outside-015.jpg",
        "outside-016.jpg",
        "outside-017.jpg",
        "outside-018.jpg",
        "outside-020.jpg",
        "outside-021.jpg",
        "outside-022.jpg",
        "outside-023.jpg",
        "outside-024.jpg",
        "outside-025.jpg",
        "outside-026.jpg",
        "outside-027.jpg",
        "outside-028.jpg",
        "outside-029.jpg",
        "outside-030.jpg",
        "outside-032.jpg",
        "outside-034.jpg",
        "outside-035.jpg",
        "outside-036.jpg",
        "outside-037.jpg",
        "outside-038.jpg",
        "outside-039.jpg",
        "outside-040.jpg",
        "outside-041.jpg",
        "outside-042.jpg",
        "outside-043.jpg",
        "outside-045.jpg",
        "outside-047.jpg",
        "outside-048.jpg",
        "outside-049.jpg",
        "outside-050.jpg",
        "outside-051.jpg",
        "outside-052.jpg",
        "outside-053.jpg",
        "outside-054.jpg",
        "outside-055.jpg",
        "outside-056.jpg"
      ],
      alt: "Outdoor photo"
    }
  };

  var activeKey = "outside";
  var renderedKey = "";
  var switchingTimer = 0;

  function pad(number){
    return String(number).padStart(3, "0");
  }

  function buildPhoto(category, file, number){
    var desktop = "/assets/newphoto/" + category.key + "/" + file;

    var figure = document.createElement("figure");
    figure.className = "photo-item";
    figure.style.setProperty("--photo-order", String(number));

    var frame = document.createElement("div");
    frame.className = "photo-frame";

    var img = document.createElement("img");
    img.src = desktop;
    img.sizes = "(max-width: 720px) 92vw, (max-width: 980px) 46vw, 31vw";
    img.alt = category.alt + " " + pad(number);
    img.loading = "lazy";
    img.decoding = "async";
    img.setAttribute("data-full-src", desktop);

    var caption = document.createElement("figcaption");
    var no = document.createElement("span");
    var title = document.createElement("strong");
    no.textContent = pad(number);
    title.textContent = category.label;

    frame.appendChild(img);
    caption.appendChild(no);
    caption.appendChild(title);
    figure.appendChild(frame);
    figure.appendChild(caption);
    return figure;
  }

  function render(key){
    var category = categories[key] || categories.product;
    var columns = [0, 1, 2].map(function(){
      var column = document.createElement("div");
      column.className = "photo-column";
      return column;
    });

    category.files.forEach(function(file, index){
      columns[index % columns.length].appendChild(buildPhoto(category, file, index + 1));
    });

    index.replaceChildren.apply(index, columns);
    renderedKey = key;
    index.setAttribute("data-photo-current", key);
    index.setAttribute("aria-label", category.label + " photo works");
    root.dispatchEvent(new CustomEvent("photo-gallery-updated"));
  }

  function isPhotoActive(){
    return root.classList.contains("is-active") || document.body.classList.contains("theme-view-photo");
  }

  function ensureRendered(){
    if(!isPhotoActive()) return;
    if(renderedKey === activeKey) return;
    render(activeKey);
  }
  window.__ensurePhotoRendered = ensureRendered;

  function setActiveButton(key){
    buttons.forEach(function(button){
      var isActive = button.getAttribute("data-photo-category-button") === key;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function setCategory(key){
    if(!categories[key]) key = "product";
    activeKey = key;
    setActiveButton(key);
    index.classList.add("is-switching");
    window.clearTimeout(switchingTimer);
    switchingTimer = window.setTimeout(function(){
      if(isPhotoActive()){
        render(activeKey);
      }else{
        renderedKey = "";
        index.replaceChildren();
        index.removeAttribute("data-photo-current");
      }
      requestAnimationFrame(function(){
        index.classList.remove("is-switching");
      });
    }, 110);
  }

  buttons.forEach(function(button){
    button.addEventListener("click", function(){
      var key = button.getAttribute("data-photo-category-button") || "product";
      if(key === activeKey) return;
      setCategory(key);
    });
  });

  setActiveButton(activeKey);
  ensureRendered();
  if("MutationObserver" in window){
    var observer = new MutationObserver(ensureRendered);
    observer.observe(root, { attributes:true, attributeFilter:["class"] });
    observer.observe(document.body, { attributes:true, attributeFilter:["class"] });
  }
})();



/* ── PHOTO lightbox: large view without preloading original files ── */
(function(){
  "use strict";

  var root = document.getElementById("view-photo");
  if(!root) return;

  var frames = [];
  var overlay = null;
  var imageEl = null;
  var captionEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var currentIndex = 0;

  function refreshFrames(){
    frames = Array.from(root.querySelectorAll(".photo-frame"));
    frames.forEach(function(frame, index){
      frame.setAttribute("role", "button");
      frame.setAttribute("tabindex", "0");
      frame.setAttribute("aria-label", "Open photo " + String(index + 1).padStart(2, "0"));
    });
  }

  function getFrameData(index){
    var frame = frames[index];
    if(!frame) return null;
    var img = frame.querySelector("img");
    var item = frame.closest(".photo-item");
    var caption = item ? item.querySelector("figcaption") : null;
    var no = caption ? caption.querySelector("span") : null;
    var title = caption ? caption.querySelector("strong") : null;
    var src = "";
    if(img){
      src = img.getAttribute("data-full-src") || "";
      if(!src){
        var raw = img.getAttribute("src") || img.currentSrc || img.src || "";
        src = raw.replace(/\/assets\/optimized\/photo\/([^/?#]+)\.jpg([?#].*)?$/i, "/assets/photo/$1.JPG$2");
      }
      src = getImageDisplaySrc(img, src);
    }
    return {
      src: src,
      alt: img ? (img.alt || "") : "",
      label: [no ? no.textContent : "", title ? title.textContent : ""].filter(Boolean).join(" / ")
    };
  }

  function ensureOverlay(){
    if(overlay) return;

    overlay = document.createElement("div");
    overlay.className = "photo-lightbox";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = [
      '<button class="photo-lightbox-close" type="button" aria-label="Close">×</button>',
      '<button class="photo-lightbox-nav photo-lightbox-prev" type="button" aria-label="Previous">←</button>',
      '<figure class="photo-lightbox-stage">',
      '  <img alt="">',
      '  <figcaption></figcaption>',
      '</figure>',
      '<button class="photo-lightbox-nav photo-lightbox-next" type="button" aria-label="Next">→</button>'
    ].join("");
    document.body.appendChild(overlay);

    imageEl = overlay.querySelector("img");
    captionEl = overlay.querySelector("figcaption");
    prevBtn = overlay.querySelector(".photo-lightbox-prev");
    nextBtn = overlay.querySelector(".photo-lightbox-next");

    overlay.addEventListener("click", function(event){
      if(event.target === overlay || event.target.closest(".photo-lightbox-close")){
        close();
      }
    });
    prevBtn.addEventListener("click", function(event){
      event.stopPropagation();
      show(currentIndex - 1);
    });
    nextBtn.addEventListener("click", function(event){
      event.stopPropagation();
      show(currentIndex + 1);
    });

    document.addEventListener("keydown", function(event){
      if(!overlay || !overlay.classList.contains("is-open")) return;
      if(event.key === "Escape") close();
      if(event.key === "ArrowLeft") show(currentIndex - 1);
      if(event.key === "ArrowRight") show(currentIndex + 1);
    });
  }

  function show(index){
    if(!frames.length) refreshFrames();
    if(!frames.length) return;
    currentIndex = (index + frames.length) % frames.length;
    var data = getFrameData(currentIndex);
    if(!data || !data.src) return;

    ensureOverlay();
    overlay.classList.add("is-loading");
    imageEl.style.opacity = "0";
    imageEl.src = data.src;
    imageEl.alt = data.alt;
    captionEl.textContent = data.label;

    imageEl.onload = function(){
      overlay.classList.remove("is-loading");
      requestAnimationFrame(function(){
        imageEl.style.opacity = "1";
      });
    };

    prevBtn.disabled = frames.length < 2;
    nextBtn.disabled = frames.length < 2;
  }

  function open(index){
    ensureOverlay();
    show(index);
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("is-open");
    document.body.classList.add("photo-lightbox-open");
  }

  function close(){
    if(!overlay) return;
    overlay.classList.remove("is-open", "is-loading");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("photo-lightbox-open");
  }

  function bind(){
    refreshFrames();
    root.addEventListener("click", function(event){
      var frame = event.target.closest ? event.target.closest(".photo-frame") : null;
      if(!frame || !root.contains(frame)) return;
      event.preventDefault();
      refreshFrames();
      var index = frames.indexOf(frame);
      if(index < 0) return;
      open(index);
    });
    root.addEventListener("keydown", function(event){
      if(event.key !== "Enter" && event.key !== " ") return;
      var frame = event.target.closest ? event.target.closest(".photo-frame") : null;
      if(!frame || !root.contains(frame)) return;
      event.preventDefault();
      refreshFrames();
      var index = frames.indexOf(frame);
      if(index < 0) return;
      open(index);
    });
    root.addEventListener("photo-gallery-updated", refreshFrames);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind, { once:true });
  }else{
    bind();
  }
})();
