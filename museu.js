import * as THREE from "./lib/three.module.min.js";
import { OBRAS } from "./obras.js";

// ---------- parâmetros do corredor ----------
const W = 7;                 // largura
const H = 4.6;               // altura
const SPACING = 8.5;         // distância entre quadros do mesmo lado
const PAIRS = Math.ceil(OBRAS.length / 2);
const L = 10 + PAIRS * SPACING + 6;   // comprimento total (corredor vai de z=0 a z=-L)
const EYE = 1.7;
const MARGIN = 0.55;         // distância mínima às paredes

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d0d);
scene.fog = new THREE.Fog(0x0d0d0d, 14, 48);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, EYE, -2.2);
camera.rotation.order = "YXZ";

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- utilitários de textura ----------
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// quadro de exemplo (colagem dadaísta aleatória) enquanto a foto real não existe
function placeholderArt(i) {
  const r = rng(i + 3);
  const w = 800, h = i % 2 ? 1000 : 700;
  const pal = ["#e63946", "#ffd23f", "#1d3557", "#f1ece1", "#111", "#2a9d8f", "#f4a261"];
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#e8dfc8"; g.fillRect(0, 0, w, h);
  for (let n = 0; n < 16; n++) {
    g.save();
    g.translate(r() * w, r() * h);
    g.rotate((r() - 0.5) * 1.6);
    g.fillStyle = pal[(r() * pal.length) | 0];
    const s = 60 + r() * 260;
    const k = r();
    if (k < 0.35) g.fillRect(-s / 2, -s / 3, s, s * 0.66);
    else if (k < 0.7) { g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, s / 2); g.lineTo(0, -s / 2); g.closePath(); g.fill(); }
    g.restore();
  }
  const letras = "DADAKURTSCHWITTZ";
  for (let n = 0; n < 9; n++) {
    g.save();
    g.translate(r() * w, 80 + r() * (h - 80));
    g.rotate((r() - 0.5) * 0.9);
    g.font = `${60 + r() * 120}px Impact, sans-serif`;
    g.fillStyle = r() < 0.5 ? "#111" : "#f1ece1";
    g.strokeStyle = "#111"; g.lineWidth = 3;
    const ch = letras[(r() * letras.length) | 0];
    g.fillText(ch, 0, 0); g.strokeText(ch, 0, 0);
    g.restore();
  }
  g.fillStyle = "rgba(0,0,0,.55)";
  g.font = "italic 26px Georgia";
  g.fillText("quadro de exemplo", 20, h - 22);
  return c;
}

function loadArt(obra, i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(placeholderArt(i));
    img.src = obra.imagem;
  });
}

// ---------- materiais ----------
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#ece8df"; g.fillRect(0, 0, w, h);
  for (let n = 0; n < 2500; n++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}, [L / 4, 1.2]);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });

const floorTex = canvasTex(512, 512, (g, w, h) => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const dark = (x + y) % 2 === 0;
      g.fillStyle = dark ? "#1b1b1b" : "#d9d3c4";
      g.fillRect(x * 64, y * 64, 64, 64);
    }
  }
  for (let n = 0; n < 4000; n++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
}, [W / 2, L / 2]);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.1 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

// ---------- estrutura ----------
const zc = -L / 2;
box(W, 0.2, L, floorMat, 0, -0.1, zc);                 // chão
box(W, 0.2, L, ceilMat, 0, H + 0.1, zc);               // teto
box(0.2, H, L, wallMat, -W / 2 - 0.1, H / 2, zc);      // parede esquerda
box(0.2, H, L, wallMat, W / 2 + 0.1, H / 2, zc);       // parede direita
box(W, H, 0.2, wallMat, 0, H / 2, 0.1);                // parede de trás (entrada)
box(W, H, 0.2, wallMat, 0, H / 2, -L - 0.1);           // parede do fundo

// rodapé
const skirt = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 });
box(0.06, 0.18, L, skirt, -W / 2 + 0.03, 0.09, zc);
box(0.06, 0.18, L, skirt, W / 2 - 0.03, 0.09, zc);

// ---------- luz ----------
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x333333, 0.55));

const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
for (let z = -3; z > -L; z -= 6) {
  box(1.4, 0.05, 0.35, lampMat, 0, H - 0.02, z);
  const p = new THREE.PointLight(0xfff0d0, 9, 13, 1.6);
  p.position.set(0, H - 0.4, z);
  scene.add(p);
}

// ---------- palavras dadá na parede ----------
function wordPanel(text, w, h, opts = {}) {
  const tex = canvasTex(1024, Math.round(1024 * h / w), (g, cw, ch) => {
    g.clearRect(0, 0, cw, ch);
    const words = text.split("");
    const r = rng(text.length + 7);
    const colors = ["#e63946", "#111", "#ffd23f", "#1d3557", "#2a9d8f"];
    const cell = cw / words.length;
    words.forEach((chr, i) => {
      g.save();
      g.translate(cell * (i + 0.5), ch / 2 + (r() - 0.5) * ch * 0.18);
      g.rotate((r() - 0.5) * 0.45);
      const sz = Math.min(ch * (0.55 + r() * 0.3), cell * 1.05);
      g.font = `${sz}px Impact, "Arial Black", sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      const m = g.measureText(chr);
      g.fillStyle = r() < 0.5 ? "#f1ece1" : colors[(r() * colors.length) | 0];
      g.fillRect(-m.width / 2 - 8, -sz * 0.45, m.width + 16, sz * 0.9);
      g.fillStyle = g.fillStyle === "#f1ece1" ? "#111" : "#f1ece1";
      g.fillText(chr, 0, 0);
      g.restore();
    });
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 })
  );
  return mesh;
}

const titulo = wordPanel("MUSEU DADAÍSMO", 6.4, 1.2);   // parede do fundo, visível ao longo do corredor
titulo.position.set(0, 3.25, -L + 0.01);
scene.add(titulo);

const entrada = wordPanel("NÃO HÁ ARTE", 5.0, 1.0);  // atrás do visitante, na parede de entrada
entrada.position.set(0, 3.2, -0.01);
entrada.rotation.y = Math.PI;
scene.add(entrada);

// ---------- instalação "ready-made" no fundo ----------
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.65, 1.0, 32),
  new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.5 })
);
pedestal.position.set(0, 0.5, -L + 3);
scene.add(pedestal);
const readymade = new THREE.Group();
const bola = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.25, metalness: 0.3 }));
const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 24), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4 }));
cone.position.y = 0.5; cone.rotation.z = 0.5;
const aro = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 12, 40), new THREE.MeshStandardMaterial({ color: 0x111111 }));
aro.rotation.x = Math.PI / 2.6; aro.position.y = 0.1;
readymade.add(bola, cone, aro);
readymade.position.set(0, 1.45, -L + 3);
scene.add(readymade);
const spotFim = new THREE.SpotLight(0xfff0d0, 60, 12, 0.5, 0.5, 1.5);
spotFim.position.set(0, H - 0.3, -L + 5.5);
spotFim.target.position.set(0, 1.2, -L + 3);
scene.add(spotFim, spotFim.target);

// ---------- quadros ----------
const frames = [];   // { obra, pos, normal }

async function buildArt() {
  for (let i = 0; i < OBRAS.length; i++) {
    const obra = OBRAS[i];
    const side = i % 2 === 0 ? -1 : 1;                 // -1 esquerda, 1 direita
    const z = -(10 + Math.floor(i / 2) * SPACING) - (side === 1 ? SPACING / 2 : 0);
    const img = await loadArt(obra, i);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;

    // dimensões: altura máx 2.3, largura máx 3.4
    const maxW = 3.4, maxH = 2.3;
    const s = Math.min(maxW / iw, maxH / ih);
    const pw = iw * s, ph = ih * s;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;

    const g = new THREE.Group();
    const bw = 0.12;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const f = new THREE.Mesh(new THREE.BoxGeometry(pw + bw * 2, ph + bw * 2, 0.08), frameMat);
    g.add(f);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    pic.position.z = 0.045;
    g.add(pic);

    const cy = 2.1;
    g.position.set(side * (W / 2 - 0.05), cy, z);
    g.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;   // virado para o centro
    scene.add(g);

    // placa
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.35),
      new THREE.MeshStandardMaterial({
        map: canvasTex(256, 136, (c, w, h) => {
          c.fillStyle = "#f1ece1"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#e63946"; c.fillRect(0, 0, 8, h);
          c.fillStyle = "#111"; c.font = "bold 18px Georgia"; c.textBaseline = "top";
          wrapText(c, obra.titulo, 18, 12, w - 28, 22);
          c.font = "italic 15px Georgia"; c.fillStyle = "#555";
          c.fillText(`${obra.artista}, ${obra.ano}`, 18, h - 30);
        }),
      })
    );
    plaque.position.set(side * (W / 2 - 0.02), 1.3, z + pw / 2 + 0.7);
    plaque.rotation.y = g.rotation.y;
    scene.add(plaque);

    // spot
    const sp = new THREE.SpotLight(0xfff2d6, 45, 9, 0.55, 0.6, 1.4);
    sp.position.set(side * (W / 2 - 1.8), H - 0.25, z);
    sp.target.position.set(side * (W / 2), cy, z);
    scene.add(sp, sp.target);
    box(0.16, 0.1, 0.16, new THREE.MeshBasicMaterial({ color: 0x111111 }), sp.position.x, H - 0.1, z);

    frames.push({
      obra,
      pos: new THREE.Vector3(side * (W / 2), cy, z),
      normal: new THREE.Vector3(-side, 0, 0),
    });
  }
}

function wrapText(c, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; }
    else line = t;
  }
  c.fillText(line, x, y);
}

buildArt();

// ---------- controlos ----------
const overlay = document.getElementById("overlay");
const promptEl = document.getElementById("prompt");
const infoEl = document.getElementById("info");
const keys = new Set();
let locked = false, yaw = 0, pitch = 0, infoOpen = false, dragging = false;
let current = null;

function enter() {
  overlay.style.display = "none";
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
  started = true;
}
let started = false;
overlay.addEventListener("click", enter);

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && started) {   // saiu com Esc
    overlay.style.display = "flex";
    started = false;
    closeInfo();
    keys.clear();
  }
});

document.addEventListener("mousemove", (e) => {
  if (!locked && !dragging) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});
renderer.domElement.addEventListener("mousedown", () => { if (started && !locked) dragging = true; });
addEventListener("mouseup", () => { dragging = false; });

addEventListener("keydown", (e) => {
  if (!started) return;
  const k = e.code;
  if (k === "KeyE") { e.preventDefault(); if (!e.repeat) toggleInfo(); return; }
  keys.add(k);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

function toggleInfo() {
  if (infoOpen) return closeInfo();
  if (!current) return;
  document.getElementById("i-titulo").textContent = current.obra.titulo;
  document.getElementById("i-meta").textContent = `${current.obra.artista} · ${current.obra.ano}`;
  document.getElementById("i-desc").textContent = current.obra.descricao;
  infoEl.classList.add("on");
  infoOpen = true;
}
function closeInfo() { infoEl.classList.remove("on"); infoOpen = false; }

// ---------- loop ----------
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
const PED = new THREE.Vector2(0, -L + 3);

function update(dt) {
  // movimento
  if (started && !infoOpen) {
    const sp = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.2 : 2.8) * dt;
    let f = 0, s = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
    if (f || s) {
      const len = Math.hypot(f, s);
      f /= len; s /= len;
      const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
      const dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
      camera.position.x += dx;
      camera.position.z += dz;
    }
  }
  // colisões: paredes
  camera.position.x = Math.max(-W / 2 + MARGIN, Math.min(W / 2 - MARGIN, camera.position.x));
  camera.position.z = Math.max(-L + MARGIN, Math.min(-MARGIN, camera.position.z));
  // colisão com o pedestal
  const dx = camera.position.x - PED.x, dz = camera.position.z - PED.y;
  const d = Math.hypot(dx, dz), R = 1.15;
  if (d < R) { camera.position.x = PED.x + (dx / (d || 1)) * R; camera.position.z = PED.y + (dz / (d || 1)) * R; }

  camera.position.y = EYE + (started && (f_moving()) ? Math.sin(performance.now() * 0.008) * 0.025 : 0);
  camera.rotation.set(pitch, yaw, 0);

  // quadro mais próximo que o visitante olha
  camera.getWorldDirection(fwd);
  let best = null, bestScore = 0;
  for (const fr of frames) {
    tmp.copy(fr.pos).sub(camera.position);
    const dist = tmp.length();
    if (dist > 5.2) continue;
    tmp.normalize();
    const dot = tmp.dot(fwd);
    if (dot < 0.72) continue;
    const score = dot - dist * 0.05;
    if (score > bestScore) { bestScore = score; best = fr; }
  }
  current = best;
  if (infoOpen && !current) closeInfo();
  promptEl.classList.toggle("on", !!current && !infoOpen && started);

  readymade.rotation.y += dt * 0.6;
  readymade.position.y = 1.5 + Math.sin(performance.now() * 0.0015) * 0.08;
}
function f_moving() { return keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD"); }

renderer.setAnimationLoop(() => {
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
});

// para testes
window.__museu = { camera, frames, setView(y, p) { yaw = y; pitch = p; }, start() { started = true; overlay.style.display = "none"; }, key: (k, on) => (on ? keys.add(k) : keys.delete(k)) };
