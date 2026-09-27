(() => {
  const classroomIcon = "/media/google-classroom.svg";
  const enforceSiteIdentity = () => {
    if (document.title !== "Google Classroom") document.title = "Google Classroom";
    let icons = [...document.querySelectorAll('link[rel~="icon"]')];
    if (!icons.length && document.head) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
      icons = [icon];
    }
    icons.forEach((icon) => {
      if (icon.getAttribute("href") !== classroomIcon) icon.href = classroomIcon;
      icon.type = "image/svg+xml";
    });
  };
  enforceSiteIdentity();
  if (document.head) {
    new MutationObserver(enforceSiteIdentity).observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href"],
    });
  }
})();

const PARTICLES_ENGINE_URL =
  "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
let particlesLibraryPromise = null;

const LOCAL_USERS_KEY = "xandersarcade-local-users-v1";
const LOCAL_SESSION_KEY = "xandersarcade-local-session-v1";
const ACTIVE_GAME_KEY = "xandersarcade-active-game-v1";
const POTATO_MODE_KEY = "xandersarcade-potato-mode";
if (localStorage.getItem(POTATO_MODE_KEY) === "true") {
  document.documentElement.classList.add("xandersarcade-potato");
  document.body?.classList.add("xandersarcade-potato");
}

function applyAppearanceAdjustments() {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const textScale = clamp(localStorage.getItem("appearanceTextScale"), 80, 140, 100);
  const contrast = clamp(localStorage.getItem("appearanceContrast"), 70, 140, 100);
  const saturation = clamp(localStorage.getItem("appearanceSaturation"), 0, 180, 100);
  document.documentElement.style.fontSize = `${textScale}%`;
  document.documentElement.style.setProperty("--xandersarcade-text-scale", `${textScale / 100}`);
  const hasDisplayAdjustment =
    localStorage.getItem("appearanceContrast") !== null ||
    localStorage.getItem("appearanceSaturation") !== null;
  if (hasDisplayAdjustment) {
    document.documentElement.style.filter = `contrast(${contrast}%) saturate(${saturation}%)`;
  } else {
    document.documentElement.style.removeProperty("filter");
  }
}

window.__xandersarcadeApplyAppearanceAdjustments = applyAppearanceAdjustments;

let tomPearlPaintFrame = 0;
let tomPearlPaintResize = null;

function syncTomPearlPaint(theme = document.body?.getAttribute("theme")) {
  if (document.body?.classList.contains("xandersarcade-potato")) theme = null;
  const existing = document.getElementById("tom-pearl-drips");
  if (theme !== "tompearl") {
    if (tomPearlPaintFrame) cancelAnimationFrame(tomPearlPaintFrame);
    tomPearlPaintFrame = 0;
    if (tomPearlPaintResize) window.removeEventListener("resize", tomPearlPaintResize);
    tomPearlPaintResize = null;
    existing?.remove();
    return;
  }
  if (existing) return;

  const canvas = document.createElement("canvas");
  canvas.id = "tom-pearl-drips";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const paint = [];
  let width = 0;
  let height = 0;
  let topSplatters = [];
  const colors = ["#5b2818", "#6f351f", "#7b3b21", "#8b4728", "#4b2115"];

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    topSplatters = Array.from({ length: Math.max(10, Math.floor(width / 70)) }, () => ({
      x: Math.random() * width,
      size: Math.random() * 16 + 10,
      drip: Math.random() * 170 + 42,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  };
  const addPaint = () => {
    const total = Math.max(8, Math.floor(width / 50));
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const size = Math.random() * 18 + 10;
      const x = Math.random() * width;
      const conflict = paint.some((drop) => x + size > drop.x - drop.s && x - size < drop.x + drop.s);
      if (!conflict || paint.length < total) {
        paint.push({ s: size, x, y: -size * 2, v: Math.random() * 2.5 + 1.5, c: colors[Math.floor(Math.random() * colors.length)] });
        return;
      }
    }
  };
  const drawPaint = (drop) => {
    ctx.fillStyle = drop.c;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(drop.x - drop.s * 0.34, drop.y - drop.s * 2.8, drop.s * 0.68, drop.s * 3.2, drop.s * 0.32);
    } else {
      ctx.rect(drop.x - drop.s * 0.34, drop.y - drop.s * 2.8, drop.s * 0.68, drop.s * 3.2);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.s, 0, Math.PI * 2);
    ctx.fill();
  };
  const update = () => {
    ctx.clearRect(0, 0, width, height);
    topSplatters.forEach((splat) => {
      ctx.fillStyle = splat.color;
      ctx.beginPath();
      ctx.arc(splat.x, 0, splat.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(splat.x - splat.size * 0.34, 0, splat.size * 0.68, splat.drip, splat.size * 0.32);
      } else {
        ctx.rect(splat.x - splat.size * 0.34, 0, splat.size * 0.68, splat.drip);
      }
      ctx.fill();
    });
    for (let index = paint.length - 1; index >= 0; index -= 1) {
      const drop = paint[index];
      drop.y += drop.v;
      if (drop.y > height + 220) {
        paint.splice(index, 1);
        addPaint();
      } else {
        drawPaint(drop);
      }
    }
    tomPearlPaintFrame = requestAnimationFrame(update);
  };
  resize();
  tomPearlPaintResize = resize;
  window.addEventListener("resize", tomPearlPaintResize, { passive: true });
  for (let index = 0; index < Math.max(8, Math.floor(width / 50)); index += 1) addPaint();
  update();
}

window.syncTomPearlPaint = syncTomPearlPaint;

/* Native, dependency-free adaptation of ReactBits' Topography background. */
let topographyState = null;
const TOPOGRAPHY_DEFAULTS = {
  lowColor: "#3300ff", midColor: "#84cc16", highColor: "#ffffff", speed: 0.35,
  morphAmount: 3, morphSpeed: 0.05, bands: 2, thickness: 0.01, scale: 2,
  pixelSize: 1, glow: 0.5, colorMode: "elevation", contrast: 3, brightness: 1,
  fillBands: false, opacity: 1, grain: true, grainIntensity: 0.05,
  cursorElevation: true, cursorRadius: 0.3, cursorStrength: 0.4, lightMode: false,
};
const TOPOGRAPHY_VERTEX = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
const TOPOGRAPHY_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 iResolution; uniform float iTime, uMorphAmount, uBands, uThickness, uScale, uPixelSize, uGlow, uColorMode, uContrast, uBrightness, uFillBands, uOpacity, uLightMode, uMouseEnabled, uMouseRadius, uMouseStrength, uMouseActive, uGrain, uGrainIntensity;
uniform vec3 uLow, uMid, uHigh; uniform vec2 uMouse; uniform vec4 uCtrlA, uCtrlB, uCtrlC, uCtrlD;
out vec4 fragColor;
float bez(float t, vec4 c){ float w=6.2831853*t; return .5*(c.x*sin(w)+c.y*cos(w)+c.z*sin(2.*w)+c.w*cos(2.*w)); }
float field(vec2 uv){ vec2 a=vec2(bez(uv.x,uCtrlA),bez(uv.x,uCtrlB)); vec2 b=vec2(bez(uv.y,uCtrlC),bez(uv.y,uCtrlD)); return distance(a,b); }
vec3 elevationColor(float e){ vec3 c=mix(uLow,uMid,smoothstep(0.,.5,e)); return mix(c,uHigh,smoothstep(.5,1.,e)); }
void main(){
 vec2 res=iResolution.xy, uv=gl_FragCoord.xy/res, suv=(uv-.5)/max(uScale,.001)+.5, sampleUv=suv;
 if(uPixelSize>1.){ vec2 px=res/uPixelSize; sampleUv=(floor(suv*px)+.5)/px; }
 float fv=field(sampleUv);
 if(uMouseEnabled>.5){ vec2 d=uv-uMouse; d.x*=res.x/max(res.y,1.); float bump=exp(-dot(d,d)/max(uMouseRadius,.001)/max(uMouseRadius,.001))*uMouseStrength*uMouseActive; fv+=bump; }
 float f=fv*uBands, fr=fract(f), lineDist=min(fr,1.-fr), aa=fwidth(f)+.0001;
 float mask=1.-smoothstep(uThickness-aa,uThickness+aa,lineDist), glowR=uThickness+uGlow*.5+aa;
 float glow=(1.-smoothstep(uThickness,glowR,lineDist))*step(.0001,uGlow), elev=clamp(fv/(uMorphAmount*2.5+.001),0.,1.);
 vec3 lineCol;
 if(uColorMode<.5) lineCol=elevationColor(elev); else if(uColorMode<1.5) lineCol=uMid; else lineCol=mix(uMid,uHigh,mod(floor(f),2.));
 float coverage=pow(clamp(mask+glow*.55,0.,1.),max(uContrast,.001)); vec3 outColor=lineCol; float outAlpha=coverage;
 if(uFillBands>.5){ vec3 fillCol=elevationColor(elev); outColor=mix(fillCol,lineCol,coverage); outAlpha=clamp(coverage+.1*elev,0.,1.); }
 if(uGrain>.5){ float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+iTime)*43758.5453); outAlpha+=(g-.5)*uGrainIntensity; }
 outColor=clamp(outColor*uBrightness,0.,1.); float a=clamp(outAlpha,0.,1.)*uOpacity;
 if(uLightMode>.5){ float peak=max(outColor.r,max(outColor.g,outColor.b)); vec3 chroma=pow(clamp(outColor/max(peak,.0001),0.,1.),vec3(1.18)); fragColor=vec4(mix(vec3(1.),chroma,a*.94),1.); }
 else fragColor=vec4(outColor*a,a);
}`;
const topoHex = (hex) => { const value = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ""); return value ? [parseInt(value[1], 16) / 255, parseInt(value[2], 16) / 255, parseInt(value[3], 16) / 255] : [1, 1, 1]; };
const topoColorMode = (mode) => mode === "uniform" ? 1 : mode === "alternating" ? 2 : 0;
const topoReadSettings = () => { try { return { ...TOPOGRAPHY_DEFAULTS, ...JSON.parse(localStorage.getItem("topographySettings") || "{}")} } catch { return { ...TOPOGRAPHY_DEFAULTS }; } };
const topoCompile = (gl, type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; } return shader; };

function syncTopography(theme = document.body?.getAttribute("theme"), patch = {}) {
  if (patch && Object.keys(patch).length) localStorage.setItem("topographySettings", JSON.stringify({ ...topoReadSettings(), ...patch }));
  const isGamePlayer = document.body?.classList.contains("xandersarcade-game-player") || location.pathname === "/go" || location.pathname.endsWith("/go.html");
  if (theme !== "topography" || isGamePlayer || document.body?.classList.contains("xandersarcade-potato")) { if (topographyState) { cancelAnimationFrame(topographyState.raf); topographyState.resizeObserver?.disconnect(); topographyState.cleanup?.(); topographyState.canvas.remove(); topographyState = null; } return; }
  if (topographyState) { Object.assign(topographyState.settings, patch); return; }
  const glCanvas = document.createElement("canvas"); glCanvas.id = "topography-background"; glCanvas.setAttribute("aria-hidden", "true"); document.body.appendChild(glCanvas);
  const gl = glCanvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) { glCanvas.remove(); return; }
  const vs = topoCompile(gl, gl.VERTEX_SHADER, TOPOGRAPHY_VERTEX), fs = topoCompile(gl, gl.FRAGMENT_SHADER, TOPOGRAPHY_FRAGMENT); if (!vs || !fs) { glCanvas.remove(); return; }
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.bindAttribLocation(program, 0, "position"); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); glCanvas.remove(); return; }
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const uniform = (name) => gl.getUniformLocation(program, name), u = {}; ["iResolution","iTime","uMorphAmount","uBands","uThickness","uScale","uPixelSize","uGlow","uColorMode","uContrast","uBrightness","uFillBands","uOpacity","uLightMode","uLow","uMid","uHigh","uMouse","uMouseEnabled","uMouseRadius","uMouseStrength","uMouseActive","uGrain","uGrainIntensity","uCtrlA","uCtrlB","uCtrlC","uCtrlD"].forEach((name) => u[name] = uniform(name));
  const state = topographyState = { canvas: glCanvas, gl, program, buffer, u, settings: { ...topoReadSettings(), ...patch }, raf: 0, mouse: [0.5, 0.5], target: [0.5, 0.5], active: 0, activeTarget: 0 };
  const resize = () => { const ratio = Math.min(window.devicePixelRatio || 1, 2); const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight); glCanvas.width = Math.floor(width * ratio); glCanvas.height = Math.floor(height * ratio); glCanvas.style.width = `${width}px`; glCanvas.style.height = `${height}px`; gl.viewport(0, 0, glCanvas.width, glCanvas.height); gl.uniform2f(u.iResolution, glCanvas.width, glCanvas.height); }; state.resizeObserver = new ResizeObserver(resize); state.resizeObserver.observe(document.documentElement); resize();
  const move = (event) => { state.target[0] = event.clientX / Math.max(1, window.innerWidth); state.target[1] = 1 - event.clientY / Math.max(1, window.innerHeight); state.activeTarget = 1; }; window.addEventListener("pointermove", move, { passive: true }); state.cleanup = () => window.removeEventListener("pointermove", move);
  const controls = [[1,-2,3,-4],[9,-8,7,-6],[5,2,5,-5],[-1,-3,8,9]], start = performance.now();
  const render = (now) => { if (!topographyState) return; const s = state.settings, time = (now - start) * .001, c = ["uCtrlA","uCtrlB","uCtrlC","uCtrlD"]; gl.useProgram(program); gl.uniform1f(u.iTime,time); [["uMorphAmount",s.morphAmount],["uBands",s.bands],["uThickness",s.thickness],["uScale",s.scale],["uPixelSize",s.pixelSize],["uGlow",s.glow],["uColorMode",topoColorMode(s.colorMode)],["uContrast",s.contrast],["uBrightness",s.brightness],["uFillBands",s.fillBands?1:0],["uOpacity",s.opacity],["uLightMode",s.lightMode?1:0],["uMouseEnabled",s.cursorElevation?1:0],["uMouseRadius",s.cursorRadius],["uMouseStrength",s.cursorStrength],["uGrain",s.grain?1:0],["uGrainIntensity",s.grainIntensity]].forEach(([key,value])=>gl.uniform1f(u[key], value)); gl.uniform3fv(u.uLow, topoHex(s.lowColor)); gl.uniform3fv(u.uMid, topoHex(s.midColor)); gl.uniform3fv(u.uHigh, topoHex(s.highColor)); state.mouse[0]+=(state.target[0]-state.mouse[0])*.05; state.mouse[1]+=(state.target[1]-state.mouse[1])*.05; state.active+=(state.activeTarget-state.active)*.05; gl.uniform2f(u.uMouse,state.mouse[0],state.mouse[1]); gl.uniform1f(u.uMouseActive,state.active); c.forEach((key,g)=>gl.uniform4f(u[key],...controls[g].map((index)=>s.morphAmount*Math.sin(time*s.speed*Math.sin(index*s.morphSpeed)+index)))); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.drawArrays(gl.TRIANGLES,0,3); state.raf=requestAnimationFrame(render); }; state.raf=requestAnimationFrame(render);
}
window.syncTopography = syncTopography;
window.updateTopography = (patch) => syncTopography("topography", patch);

const XANDER_BAN_API_URL = "https://ljmycyhjagwwjlkitpht.supabase.co";
const XANDER_BAN_API_KEY = "sb_publishable_253EPMx1DR3NvZgU-BMoSw_0Dlhmdv3";

function readXanderAuthSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.includes("-auth-token")) continue;
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (value?.access_token && value?.user?.id) return value;
    }
  } catch {}
  return null;
}

function escapeBanText(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function showBanOverlay(ban) {
  let overlay = document.getElementById("xandersarcade-ban-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "xandersarcade-ban-overlay";
    overlay.innerHTML = `<div class="xandersarcade-ban-card"><h1>UH OH! :(</h1><p>You have been banned from Xander's Arcade for reason:</p><strong class="xandersarcade-ban-reason"></strong><label>Appeal ban with a reason<textarea maxlength="1000" placeholder="Explain why this ban should be lifted"></textarea></label><button type="button">Submit appeal</button><p class="xandersarcade-ban-message" role="status"></p></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("button").addEventListener("click", async () => {
      const session = readXanderAuthSession();
      const reason = overlay.querySelector("textarea").value.trim();
      const message = overlay.querySelector(".xandersarcade-ban-message");
      if (!reason) { message.textContent = "Please enter an appeal reason."; return; }
      if (!session) { message.textContent = "Your session expired. Please sign in again."; return; }
      const response = await fetch(`${XANDER_BAN_API_URL}/rest/v1/appeals`, {
        method: "POST",
        headers: { apikey: XANDER_BAN_API_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ban_id: ban.id, user_id: session.user.id, reason }),
      });
      message.textContent = response.ok ? "Appeal submitted." : "Could not submit the appeal yet.";
      if (response.ok) overlay.querySelector("button").disabled = true;
    });
  }
  overlay.querySelector(".xandersarcade-ban-reason").textContent = ban.reason || "No reason provided.";
  overlay.classList.add("is-visible");
  document.body.classList.add("xandersarcade-is-banned");
}

function removeBanOverlay() {
  document.getElementById("xandersarcade-ban-overlay")?.classList.remove("is-visible");
  document.body.classList.remove("xandersarcade-is-banned");
}

const ARCADE_393_NOTICE_KEY = "xandersarcade-notice-393-fixed-dismissed-v1";

const TERMS_ACCEPTANCE_KEY = "xandersarcade-terms-accepted-v1";
const TERMS_ACCEPTANCE_VERSION = "2026-09-26-v3";

function hasAcceptedCurrentTerms() {
  try {
    if (localStorage.getItem(TERMS_ACCEPTANCE_KEY) === TERMS_ACCEPTANCE_VERSION) return true;
  } catch {}
  return document.cookie.split("; ").includes(`${TERMS_ACCEPTANCE_KEY}=${TERMS_ACCEPTANCE_VERSION}`);
}

async function showTermsAcceptanceGate() {
  if (hasAcceptedCurrentTerms() || document.getElementById("xandersarcade-terms-gate")) return;

  const overlay = document.createElement("div");
  overlay.id = "xandersarcade-terms-gate";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "xandersarcade-terms-title");

  const style = document.createElement("style");
  style.textContent = `
    #xandersarcade-terms-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);color:#f7f7f8;font:16px/1.6 system-ui,sans-serif}
    #xandersarcade-terms-gate *{box-sizing:border-box}
    #xandersarcade-terms-gate .terms-card{width:min(820px,100%);max-height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden;background:#191a1f;border:1px solid #444650;border-radius:20px;box-shadow:0 24px 90px #000a}
    #xandersarcade-terms-gate .terms-heading{padding:22px 26px 14px;border-bottom:1px solid #373943}
    #xandersarcade-terms-gate h1{margin:0;font-size:1.55rem;color:#8ee59a}
    #xandersarcade-terms-gate .terms-hint{margin:6px 0 0;color:#c5c7ce;font-size:.93rem}
    #xandersarcade-terms-gate .terms-scroll{overflow:auto;overscroll-behavior:contain;padding:8px 26px 26px;scrollbar-gutter:stable;min-height:150px}
    #xandersarcade-terms-gate .terms-scroll h1{margin:18px 0;color:#f7f7f8;font-size:1.35rem}
    #xandersarcade-terms-gate .terms-scroll h2{margin:24px 0 6px;color:#f7f7f8;font-size:1.05rem}
    #xandersarcade-terms-gate .terms-scroll p,#xandersarcade-terms-gate .terms-scroll li{color:#d6d7dc}
    #xandersarcade-terms-gate .terms-actions{display:flex;justify-content:flex-end;gap:12px;padding:16px 26px 22px;border-top:1px solid #373943}
    #xandersarcade-terms-gate button{min-height:48px;padding:10px 18px;border:1px solid #626571;border-radius:11px;background:#292b32;color:#f7f7f8;font:600 1rem system-ui,sans-serif;cursor:pointer}
    #xandersarcade-terms-gate button:disabled{opacity:.48;cursor:not-allowed}
    #xandersarcade-terms-gate .terms-decline{border-color:#a13a43;color:#ffb8bc}
    #xandersarcade-terms-gate .terms-accept{position:relative;overflow:hidden;border-color:#3d9c65;background:#17653e;touch-action:none;user-select:none}
    #xandersarcade-terms-gate .terms-accept::before{content:"";position:absolute;inset:0 auto 0 0;width:100%;background:#34a765;transform:scaleX(0);transform-origin:left;pointer-events:none}
    #xandersarcade-terms-gate .terms-accept.holding::before{transform:scaleX(1);transition:transform 5s linear}
    #xandersarcade-terms-gate .terms-accept span{position:relative;z-index:1}
    @media(max-width:560px){#xandersarcade-terms-gate{padding:10px}#xandersarcade-terms-gate .terms-heading{padding:17px 18px 12px}#xandersarcade-terms-gate .terms-scroll{padding:6px 18px 20px}#xandersarcade-terms-gate .terms-actions{padding:12px 18px 16px;flex-direction:column-reverse}#xandersarcade-terms-gate button{width:100%}}
  `;

  const card = document.createElement("section");
  card.className = "terms-card";
  const heading = document.createElement("header");
  heading.className = "terms-heading";
  heading.innerHTML = `<h1 id="xandersarcade-terms-title">Please review Xander’s Arcade Terms of Service</h1><p class="terms-hint">Scroll through the full terms to the bottom. To accept, press and hold the green button for 5 seconds.</p>`;
  const scroller = document.createElement("div");
  scroller.className = "terms-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", "Terms of Service. Scroll to the bottom to enable acceptance.");
  const actions = document.createElement("footer");
  actions.className = "terms-actions";
  const decline = document.createElement("button");
  decline.type = "button";
  decline.className = "terms-decline";
  decline.textContent = "Do Not Accept";
  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "terms-accept";
  accept.disabled = true;
  accept.setAttribute("aria-label", "Scroll to the bottom of the terms before accepting");
  accept.innerHTML = "<span>Accept &amp; Dismiss</span>";
  actions.append(decline, accept);
  card.append(heading, scroller, actions);
  overlay.append(style, card);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);

  try {
    const response = await fetch("/tos", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`Terms request returned ${response.status}`);
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const content = page.querySelector(".tos-page");
    if (!content) throw new Error("Terms content was missing.");
    scroller.appendChild(content.cloneNode(true));
  } catch (error) {
    console.error("Could not load Terms of Service into the acceptance dialog:", error);
    scroller.innerHTML = `<p>We couldn’t load the Terms of Service. Please reload this page to try again, or <a href="/tos" target="_blank" rel="noopener">open the terms in a new tab</a>. Acceptance is unavailable until the full terms load.</p>`;
    accept.disabled = true;
    decline.focus({ preventScroll: true });
    return;
  }

  const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
  const updateScrollState = () => {
    if (!accept.disabled && !atBottom()) cancelHold();
    if (atBottom()) {
      accept.disabled = false;
      accept.setAttribute("aria-label", "Press and hold for 5 seconds to accept the Terms of Service");
    }
  };
  let holdTimer = 0;
  let holdStarted = false;
  const cancelHold = () => {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdStarted = false;
    accept.classList.remove("holding");
  };
  const finishAccept = () => {
    cancelHold();
    try { localStorage.setItem(TERMS_ACCEPTANCE_KEY, TERMS_ACCEPTANCE_VERSION); } catch {}
    document.cookie = `${TERMS_ACCEPTANCE_KEY}=${TERMS_ACCEPTANCE_VERSION}; Max-Age=315360000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.body.style.overflow = previousOverflow;
    overlay.remove();
    window.removeEventListener("storage", onTermsStorage);
  };
  const onTermsStorage = (event) => {
    if (event.key === TERMS_ACCEPTANCE_KEY && event.newValue === TERMS_ACCEPTANCE_VERSION) finishAccept();
  };
  const beginHold = (event) => {
    if (accept.disabled || holdStarted) return;
    event.preventDefault();
    holdStarted = true;
    accept.classList.add("holding");
    holdTimer = window.setTimeout(finishAccept, 5000);
  };
  accept.addEventListener("pointerdown", beginHold);
  accept.addEventListener("pointerup", cancelHold);
  accept.addEventListener("pointerleave", cancelHold);
  accept.addEventListener("pointercancel", cancelHold);
  accept.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") beginHold(event);
  });
  accept.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") cancelHold();
  });
  decline.addEventListener("click", () => window.location.replace("about:blank"));
  scroller.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("storage", onTermsStorage);
  updateScrollState();
  decline.focus({ preventScroll: true });
}

function showArcade393Notice() {
  try {
    if (localStorage.getItem(ARCADE_393_NOTICE_KEY) === "true") return;
  } catch {}
  if (document.cookie.split("; ").includes(`${ARCADE_393_NOTICE_KEY}=true`)) return;
  if (document.body.classList.contains("xandersarcade-is-banned")) {
    window.setTimeout(showArcade393Notice, 5000);
    return;
  }
  if (document.getElementById("xandersarcade-393-notice")) return;

  const overlay = document.createElement("div");
  overlay.id = "xandersarcade-393-notice";
  overlay.className = "xandersarcade-notice-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "xandersarcade-393-notice-title");

  const card = document.createElement("section");
  card.className = "xandersarcade-notice-card";
  const title = document.createElement("h1");
  title.id = "xandersarcade-393-notice-title";
  title.textContent = "NOTICE!";
  const message = document.createElement("p");
  message.textContent = "393 Non-working games now fixed, less to no proxy errors anymore, Enjoy the new and extremely improved website, Also gladihoppers is here because of that black guy tyrone, anyways peace -Xander";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "xandersarcade-notice-dismiss";
  dismiss.textContent = "Got it · Enjoy!";
  const closeNotice = () => {
    try { localStorage.setItem(ARCADE_393_NOTICE_KEY, "true"); } catch {}
    document.cookie = `${ARCADE_393_NOTICE_KEY}=true; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    overlay.remove();
    document.removeEventListener("keydown", handleNoticeKeydown);
    window.removeEventListener("storage", handleNoticeStorage);
  };
  const handleNoticeKeydown = (event) => {
    if (event.key === "Escape") closeNotice();
  };
  const handleNoticeStorage = (event) => {
    if (event.key === ARCADE_393_NOTICE_KEY && event.newValue === "true") closeNotice();
  };
  dismiss.addEventListener("click", closeNotice);
  document.addEventListener("keydown", handleNoticeKeydown);
  window.addEventListener("storage", handleNoticeStorage);
  card.append(title, message, dismiss);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  dismiss.focus({ preventScroll: true });
}

async function checkXanderBanStatus() {
  const session = readXanderAuthSession();
  if (!session) { removeBanOverlay(); return; }
  try {
    const response = await fetch(`${XANDER_BAN_API_URL}/rest/v1/bans?select=id,reason&user_id=eq.${encodeURIComponent(session.user.id)}&active=eq.true&limit=1`, {
      headers: { apikey: XANDER_BAN_API_KEY, Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!response.ok) return;
    const bans = await response.json();
    if (bans[0]) showBanOverlay(bans[0]); else removeBanOverlay();
  } catch {}
}

window.__xandersarcadeCheckBanStatus = checkXanderBanStatus;

function initRainbowSplashCursor() {
  // The cursor splash has been retired. Remove any canvas left by an older
  // cached script before returning so it cannot keep covering the page.
  document.getElementById("fluid")?.remove();
  return;

  if (document.body.classList.contains("xandersarcade-game-player") || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (document.getElementById("fluid")) return;
  const canvas = document.createElement("canvas");
  canvas.id = "fluid";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  const dye = document.createElement("canvas");
  const dyeCtx = dye.getContext("2d");
  const splats = [];
  let lastFrameAt = 0;
  let width = 0;
  let height = 0;
  let hue = 0;
  const pointer = { x: -100, y: -100, previousX: -100, previousY: -100, active: false, activeUntil: 0 };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    dye.width = Math.max(1, Math.floor(width * 0.5));
    dye.height = Math.max(1, Math.floor(height * 0.5));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    dyeCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const rainbow = () => { hue = (hue + 2.8) % 360; return `hsl(${hue}, 100%, 62%)`; };
  const addSplat = (x, y, dx, dy, force = 1) => {
    const radius = Math.max(18, Math.min(130, 28 + Math.hypot(dx, dy) * 0.8)) * force;
    splats.push({ x, y, dx, dy, radius, color: rainbow(), life: 1 });
    if (splats.length > 42) splats.splice(0, splats.length - 42);
  };
  const move = (event) => {
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.activeUntil = performance.now() + 900;
    if (Math.hypot(dx, dy) > 0.5) addSplat(event.clientX, event.clientY, dx, dy, 0.42);
  };
  const click = (event) => addSplat(event.clientX, event.clientY, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, 2.1);
  const leave = () => { pointer.active = false; };
  const update = (now = performance.now()) => {
    // The cursor effect remains smooth while avoiding a full-resolution canvas
    // composite on every display refresh.
    if (now - lastFrameAt < 30) {
      requestAnimationFrame(update);
      return;
    }
    lastFrameAt = now;
    dyeCtx.globalCompositeOperation = "source-over";
    dyeCtx.fillStyle = "rgba(0, 0, 0, 0.075)";
    dyeCtx.fillRect(0, 0, dye.width, dye.height);
    dyeCtx.globalCompositeOperation = "lighter";
    splats.forEach((splat) => {
      const scaleX = dye.width / Math.max(1, width);
      const scaleY = dye.height / Math.max(1, height);
      const x = splat.x * scaleX;
      const y = splat.y * scaleY;
      const radius = splat.radius * ((scaleX + scaleY) * 0.5);
      const gradient = dyeCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, splat.color.replace("hsl", "hsla").replace(")", ", 0.7)"));
      gradient.addColorStop(0.45, splat.color.replace("hsl", "hsla").replace(")", ", 0.18)"));
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      dyeCtx.fillStyle = gradient;
      dyeCtx.beginPath(); dyeCtx.arc(x, y, radius, 0, Math.PI * 2); dyeCtx.fill();
      splat.x += splat.dx * 0.018; splat.y += splat.dy * 0.018; splat.dx *= 0.96; splat.dy *= 0.96; splat.life -= 0.012;
    });
    for (let index = splats.length - 1; index >= 0; index -= 1) if (splats[index].life <= 0) splats.splice(index, 1);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 0.92;
    ctx.drawImage(dye, 0, 0, width, height);
    ctx.globalAlpha = 1;
    if (pointer.active && now < pointer.activeUntil) {
      const radius = 24 + Math.min(34, Math.hypot(pointer.x - pointer.previousX, pointer.y - pointer.previousY));
      const fluid = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
      fluid.addColorStop(0, `hsla(${hue}, 100%, 82%, .72)`); fluid.addColorStop(.45, `hsla(${(hue + 110) % 360}, 100%, 62%, .2)`); fluid.addColorStop(1, "transparent");
      ctx.fillStyle = fluid; ctx.beginPath(); ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2); ctx.fill();
    } else pointer.active = false;
    ctx.globalCompositeOperation = "lighter";
    if (pointer.x > -50) {
      ctx.strokeStyle = `hsla(${(hue + 210) % 360}, 100%, 78%, .55)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 9 + Math.sin(now / 90) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(update);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", click, { passive: true });
  window.addEventListener("pointerleave", leave, { passive: true });
  update();
}

window.initRainbowSplashCursor = initRainbowSplashCursor;

function readLocalUsersForStats() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function recordLocalGameTime() {
  if (document.hidden) return;
  const username = String(localStorage.getItem(LOCAL_SESSION_KEY) || "").trim().toLowerCase();
  if (!username) return;
  let activeGame;
  try {
    activeGame = JSON.parse(sessionStorage.getItem(ACTIVE_GAME_KEY) || "null");
  } catch {
    activeGame = null;
  }
  if (!activeGame?.name || !activeGame.lastTick) return;
  const now = Date.now();
  const elapsed = Math.min(Math.max(0, now - activeGame.lastTick), 120000) / 1000;
  const users = readLocalUsersForStats();
  const user = users[username];
  if (!user) return;
  user.stats = user.stats || { games: {} };
  user.stats.games = user.stats.games || {};
  user.stats.games[activeGame.name] = Number(user.stats.games[activeGame.name] || 0) + elapsed;
  user.stats.lastPlayed = activeGame.name;
  activeGame.lastTick = now;
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(activeGame));
}

function startLocalGameTracking() {
  if (window.location.pathname !== "/go") return;
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem("xandersarcade-pending-game") || "null");
  } catch {
    pending = null;
  }
  if (pending?.name) {
    sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ ...pending, lastTick: Date.now() }));
    sessionStorage.removeItem("xandersarcade-pending-game");
  }
  recordLocalGameTime();
  window.setInterval(recordLocalGameTime, 30000);
  window.addEventListener("beforeunload", recordLocalGameTime);
}

let globalGameStatsWriteInFlight = false;
let profileLastOnlineColumnMissing = false;

async function updateProfileLastOnline(force = false) {
  if (profileLastOnlineColumnMissing) return;
  if (document.hidden && !force) return;
  const supabase = window.xandersSupabase;
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;
  const storageKey = `xandersarcade-last-online:${userId}`;
  const previousUpdate = Number(localStorage.getItem(storageKey) || 0);
  if (!force && Date.now() - previousUpdate < 60 * 1000) return;
  const now = new Date().toISOString();
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ last_online: now })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("last_online") && (error.code === "42703" || /does not exist|schema cache|could not find/.test(message))) {
      profileLastOnlineColumnMissing = true;
    }
    console.error("Could not save profile last-online time:", error);
    return;
  }
  if (!updatedProfile) {
    console.warn("Could not save profile last-online time: no profile row was updated. Check the profiles update policy and matching user profile.");
    return;
  }
  localStorage.setItem(storageKey, String(Date.now()));
}

function startProfilePresenceTracking() {
  updateProfileLastOnline(true);
  window.setInterval(updateProfileLastOnline, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateProfileLastOnline();
  });
  window.xandersSupabase?.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id) window.setTimeout(() => updateProfileLastOnline(true), 0);
  });
}

let remoteAdminSoundAudio = null;
let remoteAdminSoundActive = false;
let remoteAdminSoundChannel = null;
let remoteAdminSoundUserId = null;
let remoteAdminSoundWaitingForGesture = false;

function stopAdminSoundGestureWait() {
  if (!remoteAdminSoundWaitingForGesture) return;
  document.removeEventListener("pointerdown", resumeRemoteAdminSound);
  document.removeEventListener("keydown", resumeRemoteAdminSound);
  remoteAdminSoundWaitingForGesture = false;
}

async function resumeRemoteAdminSound() {
  if (!remoteAdminSoundActive || !remoteAdminSoundAudio) return;
  try {
    await remoteAdminSoundAudio.play();
    stopAdminSoundGestureWait();
  } catch {
    // A browser may keep blocking audio until a user interacts with this tab.
  }
}

async function applyRemoteAdminSoundState(active) {
  remoteAdminSoundActive = Boolean(active);
  if (!remoteAdminSoundAudio) {
    remoteAdminSoundAudio = new Audio("/media/admin-user-sound.wav");
    remoteAdminSoundAudio.loop = true;
    remoteAdminSoundAudio.preload = "auto";
  }
  if (!remoteAdminSoundActive) {
    remoteAdminSoundAudio.pause();
    try { remoteAdminSoundAudio.currentTime = 0; } catch {}
    stopAdminSoundGestureWait();
    return;
  }
  try {
    await remoteAdminSoundAudio.play();
    stopAdminSoundGestureWait();
  } catch {
    if (!remoteAdminSoundWaitingForGesture) {
      remoteAdminSoundWaitingForGesture = true;
      document.addEventListener("pointerdown", resumeRemoteAdminSound);
      document.addEventListener("keydown", resumeRemoteAdminSound);
    }
  }
}

async function startRemoteAdminSoundReceiver() {
  const supabase = window.xandersSupabase;
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;
  if (userId === remoteAdminSoundUserId) return;
  if (remoteAdminSoundChannel) {
    await supabase.removeChannel(remoteAdminSoundChannel);
    remoteAdminSoundChannel = null;
  }
  remoteAdminSoundUserId = userId;
  if (!userId) return applyRemoteAdminSoundState(false);

  const channel = supabase.channel(`user-sound-control:${userId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "user_sound_controls",
      filter: `user_id=eq.${userId}`,
    }, (payload) => applyRemoteAdminSoundState(payload.new?.active))
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const { data, error } = await supabase
        .from("user_sound_controls")
        .select("active")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) console.warn("Remote sound control is not configured:", error.message);
      else await applyRemoteAdminSoundState(data?.active);
    });
  remoteAdminSoundChannel = channel;
}

function initializeRemoteAdminSoundReceiver() {
  const supabase = window.xandersSupabase;
  if (!supabase) return;
  startRemoteAdminSoundReceiver();
  supabase.auth.onAuthStateChange(() => window.setTimeout(startRemoteAdminSoundReceiver, 0));
}

async function recordGlobalGameTime() {
  if (document.hidden || globalGameStatsWriteInFlight || !window.xandersSupabase) return;
  let activeGame;
  try {
    activeGame = JSON.parse(sessionStorage.getItem(ACTIVE_GAME_KEY) || "null");
  } catch {
    activeGame = null;
  }
  if (!activeGame?.name || !activeGame.lastTick) return;
  const { data: { session } } = await window.xandersSupabase.auth.getSession();
  if (!session?.user?.id) return;
  const now = Date.now();
  const elapsed = Math.min(Math.max(0, now - activeGame.lastTick), 120000) / 1000;
  if (elapsed < 1) return;
  globalGameStatsWriteInFlight = true;
  const { data: existing } = await window.xandersSupabase
    .from("game_stats")
    .select("seconds")
    .eq("user_id", session.user.id)
    .eq("game_name", activeGame.name)
    .maybeSingle();
  const { error: statsWriteError } = await window.xandersSupabase.from("game_stats").upsert({
    user_id: session.user.id,
    game_name: activeGame.name,
    seconds: Math.round(Number(existing?.seconds || 0) + elapsed),
    updated_at: new Date().toISOString(),
  });
  if (statsWriteError) {
    console.error("Could not save game playtime:", statsWriteError);
    globalGameStatsWriteInFlight = false;
    return;
  }
  activeGame.lastTick = now;
  sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(activeGame));
  globalGameStatsWriteInFlight = false;
}

function startGlobalGameTracking() {
  if (window.location.pathname !== "/go") return;
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem("xandersarcade-pending-game") || "null");
  } catch {
    pending = null;
  }
  if (pending?.name) {
    sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ ...pending, lastTick: Date.now() }));
    sessionStorage.removeItem("xandersarcade-pending-game");
  }
  recordGlobalGameTime();
  window.setInterval(recordGlobalGameTime, 30000);
  document.addEventListener("visibilitychange", recordGlobalGameTime);
}

function syncAnniversaryRain(theme = document.body?.getAttribute("theme")) {
  const existing = document.querySelector(".anniversary-rain");

  if (theme !== "anniversary" || document.body?.classList.contains("xandersarcade-potato")) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const layer = document.createElement("div");
  layer.className = "anniversary-rain";
  layer.setAttribute("aria-hidden", "true");
  const fragment = document.createDocumentFragment();
  let seed = 731;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const addPiece = (className, index, size, speed, drift) => {
    const piece = document.createElement("span");
    piece.className = `${className} ${className}-${index}`;
    piece.style.setProperty("--fall-left", `${Math.round(random() * 100)}%`);
    piece.style.setProperty("--fall-size", `${size}px`);
    piece.style.setProperty("--fall-speed", `${speed}s`);
    piece.style.setProperty("--fall-delay", `${-Math.round(random() * speed * 10) / 10}s`);
    piece.style.setProperty("--fall-drift", `${Math.round((random() - 0.5) * drift)}px`);
    piece.style.setProperty("--fall-rotation", `${Math.round(random() * 720 - 360)}deg`);
    fragment.appendChild(piece);
  };

  for (let index = 0; index < 400; index += 1) {
    addPiece("anniversary-confetti", index, 5 + random() * 10, 4 + random() * 4, 90);
  }
  for (let index = 0; index < 30; index += 1) {
    addPiece("anniversary-coin", index, 20 + random() * 8, 4.5 + random() * 2.5, 130);
  }
  for (let index = 0; index < 50; index += 1) {
    addPiece("anniversary-dollar", index, 40 + random() * 40, 5 + random() * 5, 160);
  }

  layer.appendChild(fragment);
  document.body.appendChild(layer);
}

window.syncAnniversaryRain = syncAnniversaryRain;

window.setPotatoMode = (enabled) => {
  const active = Boolean(enabled);
  localStorage.setItem(POTATO_MODE_KEY, String(active));
  document.documentElement.classList.toggle("xandersarcade-potato", active);
  document.body.classList.toggle("xandersarcade-potato", active);
  const theme = localStorage.getItem("theme") || "nova";
  if (active) {
    syncTomPearlPaint(null);
    syncTopography(null);
    syncAnniversaryRain(null);
    destroyParticlesInstance();
    setParticlesVisibility(false);
    removeLeafEffects();
    document.getElementById("fluid")?.remove();
  } else {
    syncTomPearlPaint(theme);
    syncTopography(theme);
    syncAnniversaryRain(theme);
    window.updateParticles?.();
  }
};

const PARTICLE_THEME_CONFIGS = {
  ssb: {
    particles: {
      number: { value: 28, density: { enable: true, value_area: 1000 } },
      color: { value: "#fff" },
      shape: {
        type: "circle",
        stroke: { width: 0, color: "#000000" },
        polygon: { nb_sides: 5 },
        image: { src: "img/github.svg", width: 100, height: 100 },
      },
      opacity: {
        value: 0.5,
        random: true,
        anim: { enable: false, speed: 1, opacity_min: 0.1, sync: false },
      },
      size: {
        value: 10,
        random: true,
        anim: { enable: false, speed: 40, size_min: 0.1, sync: false },
      },
      line_linked: {
        enable: false,
        distance: 500,
        color: "#ffffff",
        opacity: 0.4,
        width: 2,
      },
      move: {
        enable: true,
        speed: 6,
        direction: "bottom",
        random: false,
        straight: false,
        out_mode: "out",
        bounce: false,
        attract: { enable: false, rotateX: 600, rotateY: 1200 },
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: true, mode: "bubble" },
        onclick: { enable: true, mode: "repulse" },
        resize: true,
      },
      modes: {
        grab: { distance: 400, line_linked: { opacity: 0.5 } },
        bubble: { distance: 400, size: 4, duration: 0.3, opacity: 1, speed: 3 },
        repulse: { distance: 200, duration: 0.4 },
        push: { particles_nb: 4 },
        remove: { particles_nb: 2 },
      },
    },
    retina_detect: true,
  },
  grey: {
    particles: {
      number: { value: 42, density: { enable: true, value_area: 1000 } },
      color: { value: "#ffffff" },
      shape: {
        type: "circle",
        stroke: { width: 0, color: "#000000" },
        polygon: { nb_sides: 5 },
        image: { src: "img/github.svg", width: 100, height: 100 },
      },
      opacity: {
        value: 0.5,
        random: false,
        anim: { enable: false, speed: 1, opacity_min: 0.1, sync: false },
      },
      size: {
        value: 3,
        random: true,
        anim: { enable: false, speed: 40, size_min: 0.1, sync: false },
      },
      line_linked: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1,
      },
      move: {
        enable: true,
        speed: 6,
        direction: "none",
        random: false,
        straight: false,
        out_mode: "out",
        bounce: false,
        attract: { enable: false, rotateX: 600, rotateY: 1200 },
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: true, mode: "repulse" },
        onclick: { enable: true, mode: "push" },
        resize: true,
      },
      modes: {
        grab: { distance: 400, line_linked: { opacity: 1 } },
        bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 },
        repulse: { distance: 200, duration: 0.4 },
        push: { particles_nb: 4 },
        remove: { particles_nb: 2 },
      },
    },
    retina_detect: true,
  },
  audi: {
    particles: {
      number: { value: 8, density: { enable: true, value_area: 1000 } },
      color: { value: "#f50537" },
      shape: {
        type: "circle",
        stroke: { width: 0, color: "#000" },
        polygon: { nb_sides: 3 },
        image: { src: "img/github.svg", width: 100, height: 100 },
      },
      opacity: {
        value: 0.8286181017543023,
        random: true,
        anim: { enable: true, speed: 0.1, opacity_min: 0.1, sync: false },
      },
      size: {
        value: 100,
        random: false,
        anim: { enable: true, speed: 10, size_min: 40, sync: false },
      },
      line_linked: {
        enable: false,
        distance: 536.6288658980243,
        color: "#f50537",
        opacity: 1,
        width: 2,
      },
      move: {
        enable: true,
        speed: 8,
        direction: "bottom",
        random: true,
        straight: false,
        out_mode: "out",
        bounce: false,
        attract: { enable: false, rotateX: 600, rotateY: 1200 },
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: false, mode: "repulse" },
        onclick: { enable: false, mode: "remove" },
        resize: true,
      },
      modes: {
        grab: { distance: 400, line_linked: { opacity: 1 } },
        bubble: {
          distance: 400,
          size: 267.7151510792516,
          duration: 2,
          opacity: 8,
          speed: 3,
        },
        repulse: { distance: 223.76191731997147, duration: 0.4 },
        push: { particles_nb: 4 },
        remove: { particles_nb: 2 },
      },
    },
    retina_detect: true,
  },
  starlight: {
    particles: {
      number: { value: 24, density: { enable: true, value_area: 1000 } },
      color: { value: "#ffffff" },
      shape: {
        type: "star",
        stroke: { width: 0, color: "#000000" },
        polygon: { nb_sides: 5 },
        image: { src: "img/github.svg", width: 100, height: 100 },
      },
      opacity: {
        value: 0.5,
        random: false,
        anim: { enable: false, speed: 1, opacity_min: 0.1, sync: false },
      },
      size: {
        value: 3.945738208161363,
        random: false,
        anim: { enable: false, speed: 40, size_min: 0.1, sync: false },
      },
      line_linked: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.5,
        direction: "none",
        random: false,
        straight: false,
        out_mode: "out",
        bounce: false,
        attract: { enable: false, rotateX: 600, rotateY: 1200 },
      },
    },
    interactivity: {
      detect_on: "window",
      events: {
        onhover: { enable: true, mode: "repulse" },
        onclick: { enable: true, mode: "push" },
        resize: true,
      },
      modes: {
        grab: { distance: 400, line_linked: { opacity: 1 } },
        bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 },
        repulse: { distance: 200, duration: 0.4 },
        push: { particles_nb: 4 },
        remove: { particles_nb: 2 },
      },
    },
    retina_detect: true,
  },
  default: {
    particles: {
      number: { value: 54, density: { enable: true, value_area: 1000 } },
      color: { value: "#ffffff" },
      shape: {
        type: "circle",
        stroke: { width: 0, color: "#000000" },
        polygon: { nb_sides: 5 },
        image: { src: "img/github.svg", width: 100, height: 100 },
      },
      opacity: {
        value: 1,
        random: true,
        anim: { enable: false, speed: 1, opacity_min: 0, sync: false },
      },
      size: {
        value: 3,
        random: true,
        anim: { enable: false, speed: 4, size_min: 0.3, sync: false },
      },
      line_linked: {
        enable: false,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1,
      },
      move: {
        enable: true,
        speed: 1,
        direction: "none",
        random: true,
        straight: false,
        out_mode: "out",
        bounce: false,
        attract: { enable: false, rotateX: 600, rotateY: 600 },
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: false, mode: "repulse" },
        onclick: { enable: true, mode: "push" },
        resize: true,
      },
      modes: {
        grab: { distance: 400, line_linked: { opacity: 1 } },
        bubble: { distance: 250, size: 0, duration: 2, opacity: 0, speed: 3 },
        repulse: { distance: 400, duration: 0.4 },
        push: { particles_nb: 4 },
        remove: { particles_nb: 2 },
      },
    },
    retina_detect: true,
  },
};

function getParticlesContainer() {
  return document.getElementById("particles-js");
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function ensureParticlesLibrary() {
  if (typeof window.particlesJS === "function") {
    return true;
  }

  if (!particlesLibraryPromise) {
    particlesLibraryPromise = loadExternalScript(PARTICLES_ENGINE_URL).catch(
      (error) => {
        console.warn("Particles library failed to load", error);
        particlesLibraryPromise = null;
        return false;
      },
    );
  }

  const result = await particlesLibraryPromise;
  return result !== false && typeof window.particlesJS === "function";
}

function destroyParticlesInstance() {
  if (!Array.isArray(window.pJSDom) || window.pJSDom.length === 0) {
    return;
  }

  window.pJSDom.forEach((instance) => {
    try {
      instance?.pJS?.fn?.vendors?.destroypJS?.();
    } catch (error) {
      console.warn("Particles destroy failed", error);
    }
  });

  window.pJSDom = [];
}

function setParticlesVisibility(visible) {
  const particlesEl = getParticlesContainer();
  if (!particlesEl) {
    return;
  }

  particlesEl.style.display = visible ? "block" : "none";
}

function removeLeafEffects() {
  const leafCont = document.getElementById("leaf-container");
  if (leafCont) leafCont.remove();

  const leafScript = document.querySelector('script[src="../js/leafs.js"]');
  if (leafScript) leafScript.remove();

  window.leafsLoaded = false;
}

async function applyParticleThemeConfig(config) {
  const particlesEl = getParticlesContainer();
  if (!particlesEl) {
    return;
  }

  const ready = await ensureParticlesLibrary();
  if (!ready) {
    setParticlesVisibility(false);
    return;
  }

  destroyParticlesInstance();
  setParticlesVisibility(true);
  window.particlesJS("particles-js", config);
}

function scheduleIdleTask(callback, timeout = 1200) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout });
    return;
  }

  window.setTimeout(callback, 0);
}

document.addEventListener("DOMContentLoaded", () => {
  showTermsAcceptanceGate();
  const xboxPerformanceMode = /Xbox/i.test(navigator.userAgent || "");
  if (xboxPerformanceMode) {
    document.documentElement.classList.add("xandersarcade-xbox");
    document.body.classList.add("xandersarcade-xbox");
  }
  applyAppearanceAdjustments();
  document.getElementById("fluid")?.remove();
  checkXanderBanStatus();
  window.setInterval(checkXanderBanStatus, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkXanderBanStatus(); });
  if (!window.ConsoleLogged) {
    console.log(
      `%\u004C\u0075\u006E\u0061\u0061\u0072%c v10.0 - main.js Loaded`,
      "font-size: 16px; background-color: #9282fb; border-top-left-radius: 5px; border-bottom-left-radius: 5px; padding: 4px; font-weight: bold;",
      "font-size: 16px; background-color: #090810; font-weight: bold; padding: 4px; border-top-right-radius: 5px; border-bottom-right-radius: 5px;",
    );

    const ascii = `
 _._     _,-'""\`-._
(,-.\`._,'(       |\\\`-/|
        \`-.-' \\ )-\`( , o o)
                    \`-    \\_\`"'- 
        `;

    console.log(
      `%c${ascii}\ndiscord.gg/En5YJYWj3Z`,
      "font-size: 24px; display: block; white-space: pre; text-align: center;",
    );

    window.ConsoleLogged = true;
  }

  let theme = localStorage.getItem("theme");
  const background = localStorage.getItem("backgroundImage");
  const themeDefaultMigrationKey = "xandersarcade-theme-default-v5";

  if (theme?.toLowerCase().startsWith("laser")) {
    theme = "nova";
    localStorage.setItem("theme", theme);
  }

  if (
    localStorage.getItem(themeDefaultMigrationKey) !== "true" &&
    theme === "flux" &&
    localStorage.getItem("defaultThemeSet") === "true"
  ) {
    theme = "nova";
    localStorage.setItem("theme", theme);
  }

  if (!theme || theme === "default") {
    theme = "nova";
    localStorage.setItem("theme", theme);
    localStorage.setItem("defaultThemeSet", "true");
    localStorage.setItem(themeDefaultMigrationKey, "true");
  }

  localStorage.setItem(themeDefaultMigrationKey, "true");

  if (background) {
    console.log(background);
    document.body.style.backgroundImage = `url(${background})`;
  }
  if (theme) {
    document.body.setAttribute("theme", theme);
  }
  syncTomPearlPaint(theme);
  syncTopography(theme);
  syncAnniversaryRain(theme);
  startProfilePresenceTracking();
  initializeRemoteAdminSoundReceiver();
  startGlobalGameTracking();
  window.setTimeout(showArcade393Notice, 500);

  window.updateParticles = async function () {
    if (document.body.classList.contains("xandersarcade-game-player") || xboxPerformanceMode || document.body.classList.contains("xandersarcade-potato")) {
      destroyParticlesInstance();
      setParticlesVisibility(false);
      removeLeafEffects();
      return;
    }

    const checkTheme = localStorage.getItem("theme");
    const starsEnabled = localStorage.getItem("stars") === "true";
    const particlesEl = getParticlesContainer();

    if (!particlesEl) {
      return;
    }

    if (!starsEnabled) {
      destroyParticlesInstance();
      setParticlesVisibility(false);
      const leafCont = document.getElementById("leaf-container");
      if (leafCont) leafCont.style.display = "none";
      return;
    }

    switch (checkTheme) {
      case "ssb":
        removeLeafEffects();
        await applyParticleThemeConfig(PARTICLE_THEME_CONFIGS.ssb);
        break;
      case "grey":
        removeLeafEffects();
        await applyParticleThemeConfig(PARTICLE_THEME_CONFIGS.grey);
        break;
      case "audi":
        removeLeafEffects();
        await applyParticleThemeConfig(PARTICLE_THEME_CONFIGS.audi);
        break;
      case "starlight":
        removeLeafEffects();
        await applyParticleThemeConfig(PARTICLE_THEME_CONFIGS.starlight);
        break;
      case "halloween":
        destroyParticlesInstance();
        setParticlesVisibility(false);
        if (!window.leafsLoaded) {
          const script = document.createElement("script");
          script.src = "../js/leafs.js";
          script.onload = () => {
            window.leafsLoaded = true;
          };
          document.head.appendChild(script);
        }
        const leafContHall = document.getElementById("leaf-container");
        if (leafContHall) {
          leafContHall.style.display =
            localStorage.getItem("stars") === "true" ? "block" : "none";
        }
        break;
      default:
        removeLeafEffects();
        await applyParticleThemeConfig(PARTICLE_THEME_CONFIGS.default);
        break;
    }
  };

  if (document.body.classList.contains("xandersarcade-game-player") || xboxPerformanceMode || document.body.classList.contains("xandersarcade-potato")) {
    destroyParticlesInstance();
    setParticlesVisibility(false);
    removeLeafEffects();
  } else {
    scheduleIdleTask(() => {
      window.updateParticles();
    });
  }

  const proxyDefaultsMigrationKey = "xandersarcade-proxy-defaults-v3";
  if (localStorage.getItem(proxyDefaultsMigrationKey) !== "true") {
    localStorage.setItem("proxy-backend", "ultraviolet");
    localStorage.setItem("transport", "bare");
    localStorage.setItem(proxyDefaultsMigrationKey, "true");
    window.setTransport?.("bare");
  } else {
    if (!localStorage.getItem("proxy-backend")) {
      localStorage.setItem("proxy-backend", "ultraviolet");
    }
    if (!localStorage.getItem("transport")) {
      localStorage.setItem("transport", "bare");
    }
  }

  fetch("/version.json")
    .then((res) => res.json())
    .then((ver) => {
      const footer = document.querySelector(".footer");
      if (footer) {
        footer.insertAdjacentHTML(
          "beforeend",
          `<a class="link footer-version"> v10.0</a>`,
        );
      }
    })
    .catch(() => {
      // Ignore if missing in static build
    });

  // const transport = localStorage.getItem("proxyTransport");

  // if (!transport) {
  //   localStorage.setItem("proxyTransport", "libcurl");
  // }

  let blobs = localStorage.getItem("blobs");
  let stars = localStorage.getItem("stars");

  if (!stars) {
    localStorage.setItem("stars", "true");
    stars = "true";
  }

  if (stars !== "true") {
    document.getElementById("particles-js").style.display = "none";
    const leafCont = document.getElementById("leaf-container");
    if (leafCont) leafCont.style.display = "none";
  }

  if (!blobs) {
    localStorage.setItem("blobs", "true");
    blobs = "true";
  }

  if (blobs !== "true") {
    document.getElementById("blobs").style.display = "none";
  }

  const panicUrl = localStorage.getItem("panicUrl");
  const panicKey = localStorage.getItem("panicKey");

  if (panicUrl && panicKey) {
    window.addEventListener("keydown", (e) => {
      if (e.key === panicKey) {
        window.location.href = panicUrl;
      }
    });
  }

  if (!panicUrl || !panicKey) {
    localStorage.setItem("panicUrl", "https://google.com");
    localStorage.setItem("panicKey", "~");
  }

});

// BareMux helper: respond to requests from the worker to provide a MessagePort
// This lets the bare-mux code obtain a SharedWorker port so pings succeed.
try {
  window.addEventListener("message", (ev) => {
    try {
      const data = ev.data;
      // The worker will post { type: 'getPort', port: MessagePort } and transfer the port
      if (data && data.type === "getPort" && ev.ports && ev.ports[0]) {
        // Try to create a SharedWorker and transfer its port back
        try {
          const sw = new SharedWorker("/baremux/worker.js", "bare-mux-worker");
          // transfer the SharedWorker port back to requester
          ev.ports[0].postMessage(sw.port, [sw.port]);
          return;
        } catch (err) {
          // SharedWorker might not be available or blocked; fall through to fallback
          console.warn(
            "SharedWorker creation failed, falling back to in-page responder",
            err,
          );
        }

        // Fallback: create a MessageChannel that responds to ping messages
        try {
          const ch = new MessageChannel();
          ch.port1.onmessage = (m) => {
            try {
              if (m.data && m.data.type === "ping")
                ch.port1.postMessage({ type: "pong" });
            } catch (e) {
              // ignore
            }
          };
          ev.ports[0].postMessage(ch.port2, [ch.port2]);
        } catch (e) {
          console.warn("bare-mux fallback responder failed", e);
        }
      }
    } catch (e) {
      console.warn("bare-mux getPort handler error", e);
    }
  });
} catch (e) {
  // ignore if addEventListener or SharedWorker unsupported
}

const cloaks = [
  {
    name: "default",
    icon: "./media/google-classroom.svg",
    title: "Google Classroom",
  },
  {
    name: "drive",
    icon: "./media/cloaks/googledrive.png",
    title: "Home - Google Drive",
  },
  {
    name: "edpuzzle",
    icon: "/./media/cloaks/edpuzzle.png",
    title: "Edpuzzle",
  },
  {
    name: "wikipedia",
    icon: "/./media/cloaks/wikipedia.ico",
    title: "Wikipedia",
  },
  {
    name: "classroom",
    icon: "/./media/cloaks/Classroom.png",
    title: "Google Classroom",
  },
  {
    name: "canvas",
    icon: "/./media/cloaks/canvas.png",
    title: "Dashboard",
  },
  {
    name: "classroom",
    icon: "/./media/cloaks/classroom.png",
    title: "Home",
  },
  {
    name: "zoom",
    icon: "/./media/cloaks/zoom.png",
    title: "Zoom",
  },
  {
    name: "khan",
    icon: "/./media/cloaks/khan.ico",
    title: "Khan Academy",
  },
  {
    name: "desmos",
    icon: "/./media/cloaks/desmos.ico",
    title: "Desmos Classroom Activities",
  },
  {
    name: "gforms",
    icon: "/./media/cloaks/googleforms.png",
    title: "Start your quiz",
  },
  {
    name: "quizlet",
    icon: "/./media/cloaks/quizlet.webp",
    title: "Online Flashcard Maker &amp; Flashcard App | Quizlet",
  },
  {
    name: "blob",
    icon: "./media/xandersarcade-logo.png",
    title: "Blob",
  },
];

if (!localStorage.getItem("hasSetCloak")) {
  cloak.setCloak("Google Classroom", "/./media/cloaks/Classroom.png");
  localStorage.setItem("hasSetCloak", "true");
}
