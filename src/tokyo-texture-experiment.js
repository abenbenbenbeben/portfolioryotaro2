const viewers = [...document.querySelectorAll(".zoom-stage")].map(createViewer);
let activeViewer = viewers[0] || null;

const MIN_SCALE = 1;
const MAX_SCALE = 8;

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function isTouchPointer(event){
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function pointerDistance(a, b){
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function pointerCenter(a, b){
  return { x:(a.clientX + b.clientX) / 2, y:(a.clientY + b.clientY) / 2 };
}

function createViewer(stage){
  const stageCard = stage.closest(".zoom-stage-card") || stage;
  const imageWrap = stage.querySelector(".zoom-image-wrap");
  const image = stage.querySelector("img");
  const readout = stage.querySelector(".zoom-readout");
  const state = {
    scale:1,
    fitScale:1,
    x:0,
    y:0,
    pointers:new Map(),
    dragStart:null,
    pinchStart:null
  };

  function render(){
    imageWrap.style.transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) scale(${state.scale * state.fitScale})`;
    readout.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function markInteracted(){
    stage.classList.add("has-interacted");
  }

  function reset(){
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    render();
  }

  function updateFitScale(){
    if(!image.naturalWidth || !image.naturalHeight) return;
    const rect = stage.getBoundingClientRect();
    const availableWidth = Math.max(120, rect.width - 48);
    const availableHeight = Math.max(120, rect.height - 64);
    state.fitScale = Math.min(
      availableWidth / image.naturalWidth,
      availableHeight / image.naturalHeight
    );
    imageWrap.style.width = `${image.naturalWidth}px`;
  }

  function fitImage(resetState = true){
    if(!image.naturalWidth || !image.naturalHeight) return;
    updateFitScale();
    if(resetState){
      state.scale = 1;
      state.x = 0;
      state.y = 0;
    }
    render();
  }

  function zoomAt(nextScale, clientX, clientY){
    const rect = stage.getBoundingClientRect();
    const pointX = clientX - (rect.left + rect.width / 2);
    const pointY = clientY - (rect.top + rect.height / 2);
    const previous = state.scale;
    const next = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const ratio = next / previous;

    state.x = pointX - (pointX - state.x) * ratio;
    state.y = pointY - (pointY - state.y) * ratio;
    state.scale = next;
    render();
    markInteracted();
  }

  stageCard.querySelectorAll("[data-stage-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.stageAction;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if(action === "reset") reset();
      if(action === "in") zoomAt(state.scale * 1.35, centerX, centerY);
      if(action === "out") zoomAt(state.scale * 0.74, centerX, centerY);
    });
  });

  stage.addEventListener("wheel", (event) => {
    if(!event.ctrlKey) return;
    event.preventDefault();
    zoomAt(state.scale * (event.deltaY < 0 ? 1.12 : 0.89), event.clientX, event.clientY);
  }, { passive:false });

  stage.addEventListener("pointerdown", (event) => {
    state.pointers.set(event.pointerId, event);
    markInteracted();

    if(isTouchPointer(event)){
      if(state.pointers.size === 2){
        for(const pointerId of state.pointers.keys()){
          try{ stage.setPointerCapture(pointerId); }catch(_){ /* Native scroll may own the first pointer. */ }
        }
        const [a, b] = [...state.pointers.values()];
        state.pinchStart = { distance:pointerDistance(a, b), scale:state.scale };
      }
      return;
    }

    if(state.pointers.size === 1){
      stage.setPointerCapture(event.pointerId);
      state.dragStart = { x:event.clientX, y:event.clientY, originX:state.x, originY:state.y };
      stage.classList.add("is-dragging");
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if(!state.pointers.has(event.pointerId)) return;
    state.pointers.set(event.pointerId, event);

    if(state.pointers.size === 2 && state.pinchStart){
      event.preventDefault();
      const [a, b] = [...state.pointers.values()];
      const center = pointerCenter(a, b);
      const ratio = pointerDistance(a, b) / state.pinchStart.distance;
      zoomAt(state.pinchStart.scale * ratio, center.x, center.y);
      return;
    }

    if(state.dragStart && event.pointerType === "mouse"){
      state.x = state.dragStart.originX + event.clientX - state.dragStart.x;
      state.y = state.dragStart.originY + event.clientY - state.dragStart.y;
      render();
    }
  });

  function endPointer(event){
    state.pointers.delete(event.pointerId);
    if(state.pointers.size < 2) state.pinchStart = null;
    if(state.pointers.size === 0){
      state.dragStart = null;
      stage.classList.remove("is-dragging");
    }
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("dblclick", (event) => {
    zoomAt(state.scale > 1 ? 1 : 2.5, event.clientX, event.clientY);
  });

  image.addEventListener("load", () => fitImage(), { once:true });
  if(image.complete) fitImage();
  else render();
  return {
    get scale(){ return state.scale; },
    reset,
    fitImage,
    zoomAt,
    stage
  };
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if(visible){
    activeViewer = viewers.find((viewer) => viewer.stage === visible.target) || activeViewer;
  }
}, { threshold:[.25, .5, .75] });

viewers.forEach((viewer) => observer.observe(viewer.stage));

window.addEventListener("resize", () => {
  viewers.forEach((viewer) => viewer.fitImage());
});
