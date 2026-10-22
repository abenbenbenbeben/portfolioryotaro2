(function(){
  var released = false;
  function releaseLoader(){
    if(released) return;
    var loader = document.getElementById("loader");
    if(!loader || loader.classList.contains("hide")) return;
    released = true;
    try{
      window._viewAssetsReady = true;
      window._viewImagesReady = true;
      document.body.classList.add("page-revealed");
      loader.classList.add("hide");
      setTimeout(function(){
        try{ loader.style.display = "none"; }catch(_){}
      }, 900);
    }catch(_){
      try{ loader.style.display = "none"; }catch(__){}
    }
  }
  window.__forceLoaderRelease = releaseLoader;
  /* Normal release is controlled by the first video's decoded frame in main.js. */
  setTimeout(releaseLoader, 20000);
  window.addEventListener("pageshow", function(){
    if(window._viewAssetsReady === true) releaseLoader();
  }, { once:true });
})();
