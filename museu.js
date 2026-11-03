import * as THREE from "./lib/three.module.min.js";
import { OBRAS } from "./obras.js";

// ---------- parâmetros da sala ----------
const W = 14;                        // largura
const H = 6.4;                       // altura
const GAP = 9;                       // distância entre pares de quadros
const PAIRS = Math.ceil(OBRAS.length / 2);
const L = GAP * PAIRS + 9;           // comprimento (a sala vai de z=0 a z=-L)
const EYE = 1.7;
const MARGIN = 0.6;
const CX = 0, CZ = -L / 2;           // centro da sala
const ART_Y = 2.35;                  // altura do centro dos quadros

// ---------- renderer / cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d0d);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
camera.position.set(0, EYE, -2.6);
camera.rotation.order = "YXZ";

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- utilitários ----------
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

function box(w, h, d, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
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

// ---------- reflexos de ambiente (dá brilho a chão, molduras, metais) ----------
function makeEnvironment() {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(40, 16, 70),
    new THREE.MeshBasicMaterial({ color: 0x6b5f52, side: THREE.BackSide })
  ));
  const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d8).multiplyScalar(7) });
  for (const z of [-22, -8, 8, 22]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 6), panel);
    m.position.set(0, 7.6, z);
    s.add(m);
  }
  scene.environment = pm.fromScene(s, 0.04).texture;
  pm.dispose();
}
makeEnvironment();

// ---------- texturas ----------
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#ebe5d8"; g.fillRect(0, 0, w, h);
  for (let n = 0; n < 3000; n++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}, [L / 4, 1.6]);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, envMapIntensity: 0.35 });
const backMat = new THREE.MeshStandardMaterial({ color: 0x1b2745, roughness: 0.9, envMapIntensity: 0.3 });

const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(11);
  const cols = 16, plankH = 256;
  for (let c = 0; c < cols; c++) {
    const off = Math.floor(r() * plankH);
    for (let y = -plankH + off; y < h; y += plankH) {
      g.fillStyle = `hsl(${22 + r() * 6}, ${34 + r() * 10}%, ${19 + r() * 11}%)`;
      g.fillRect(c * 64, y, 63, plankH - 1);
      for (let k = 0; k < 12; k++) {
        g.strokeStyle = `rgba(30,12,2,${0.05 + r() * 0.09})`;
        g.lineWidth = 1;
        const gx = c * 64 + r() * 60;
        g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + (r() - 0.5) * 6, y + plankH); g.stroke();
      }
    }
  }
}, [W / 2.4, L / 2.4]);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.9 });

const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3a342d, roughness: 1, envMapIntensity: 0.2 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x151412, roughness: 0.6, envMapIntensity: 0.6 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.5, envMapIntensity: 0.6 });

// ---------- estrutura ----------
box(W, 0.2, L, floorMat, 0, -0.1, CZ).receiveShadow = true;           // chão
box(W, 0.2, L, ceilMat, 0, H + 0.1, CZ);                              // teto
box(0.2, H, L, wallMat, -W / 2 - 0.1, H / 2, CZ);                     // parede esquerda
box(0.2, H, L, wallMat, W / 2 + 0.1, H / 2, CZ);                      // parede direita
box(W, H, 0.2, wallMat, 0, H / 2, 0.1);                               // entrada
box(W, H, 0.2, backMat, 0, H / 2, -L - 0.1);                          // fundo (azul-marinho)

// lambril escuro, friso de madeira e rodapé nas paredes laterais
for (const s of [-1, 1]) {
  box(0.05, 1.0, L, darkMat, s * (W / 2 - 0.025), 0.5, CZ);
  box(0.09, 0.07, L, woodMat, s * (W / 2 - 0.045), 1.03, CZ);
  box(0.12, 0.22, L, darkMat, s * (W / 2 - 0.06), 0.11, CZ);
  box(0.14, 0.14, L, woodMat, s * (W / 2 - 0.07), H - 0.07, CZ);      // cornija
}

// ---------- teto: claraboia, vigas e calhas ----------
const skyTex = canvasTex(256, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#fff8e8"); gr.addColorStop(1, "#ffefcf");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(90,70,40,.5)"; g.lineWidth = 4;
  for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  g.strokeRect(2, 2, w - 4, h - 4);
});
const sky = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, L - 5),
  new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })
);
sky.rotation.x = Math.PI / 2;
sky.position.set(0, H - 0.01, CZ);
scene.add(sky);

for (let z = -3; z > -L; z -= 6) box(W, 0.32, 0.4, woodMat, 0, H - 0.16, z);   // vigas
for (const s of [-1, 1]) box(0.08, 0.06, L - 4, darkMat, s * (W / 2 - 2.3), H - 0.04, CZ); // calhas dos focos

// ---------- luz ----------
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3b2a, 0.45));
for (let z = -4.5; z > -L; z -= 9) {
  const p = new THREE.PointLight(0xffe8c4, 40, 24, 1.5);
  p.position.set(0, H - 1, z);
  scene.add(p);
}

// ---------- tapete axadrezado ----------
const rugTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#a8212e"; g.fillRect(0, 0, w, h);
  const n = 8, cs = (w - 64) / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? "#14110f" : "#efe7d3";
      g.fillRect(32 + x * cs, 32 + y * cs, cs, cs);
    }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.9, envMapIntensity: 0.2 }));
rug.rotation.x = -Math.PI / 2;
rug.position.set(CX, 0.008, CZ);
rug.receiveShadow = true;
scene.add(rug);

// sombras de contacto falsas
const blobTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
function blob(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  scene.add(m);
}

// ---------- palavras dadá (letras recortadas) ----------
function wordPanel(text, w, h, seed = 0) {
  const tex = canvasTex(1024, Math.round(1024 * h / w), (g, cw, ch) => {
    g.clearRect(0, 0, cw, ch);
    const chars = text.split("");
    const r = rng(text.length + 7 + seed);
    const colors = ["#e63946", "#111", "#ffd23f", "#1d3557", "#2a9d8f"];
    const cell = cw / chars.length;
    chars.forEach((chr, i) => {
      g.save();
      g.translate(cell * (i + 0.5), ch / 2 + (r() - 0.5) * ch * 0.18);
      g.rotate((r() - 0.5) * 0.45);
      const sz = Math.min(ch * (0.55 + r() * 0.3), cell * 1.05);
      g.font = `${sz}px Impact, "Arial Black", sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      const m = g.measureText(chr);
      const light = r() < 0.5;
      const bg = light ? "#f1ece1" : colors[(r() * colors.length) | 0];
      g.fillStyle = bg;
      g.fillRect(-m.width / 2 - 8, -sz * 0.45, m.width + 16, sz * 0.9);
      g.fillStyle = light ? "#111" : "#f1ece1";
      g.fillText(chr, 0, 0);
      g.restore();
    });
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, envMapIntensity: 0.2 })
  );
}

// título no fundo
const titulo = wordPanel("MUSEU DADAÍSMO", 9, 1.6);
titulo.position.set(0, 3.9, -L + 0.01);
scene.add(titulo);
// atrás do visitante
const entrada = wordPanel("NÃO HÁ ARTE", 6, 1.2, 3);
entrada.position.set(0, 4.0, -0.01);
entrada.rotation.y = Math.PI;
scene.add(entrada);

// cartazes dadá nas paredes laterais, entre os quadros
function wallPoster(mesh, side, z, y = 2.4) {
  mesh.position.set(side * (W / 2 - 0.03), y, z);
  mesh.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(mesh);
}
const zMid1 = -(GAP * 1.5), zMid2 = -(GAP * 2.5);
wallPoster(wordPanel("NEIN", 3.4, 1.3, 5), -1, zMid1);
wallPoster(wordPanel("JA?", 2.6, 1.3, 9), -1, zMid2);
wallPoster(wordPanel("ARTE?", 3.8, 1.3, 2), 1, zMid2);

// poema fonético (Karawane) na parede direita
const poem = [
  "jolifanto bambla ô falli bambla", "grossiga m'pfa habla horem", "égiga goramen",
  "higo bloiko russula huju", "hollaka hollala", "anlogo bung", "blago bung", "blago bung",
  "bosso fataka", "ü üü ü", "schampa wulla wussa olobo", "hej tatta gorem",
  "eschige zunbada", "wulubu ssubudu uluwu ssubudu", "tumba ba- umf", "kusa gauma", "ba - umf",
];
const poemTex = canvasTex(768, 1000, (g, w, h) => {
  g.fillStyle = "#efe6d2"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#111"; g.lineWidth = 6; g.strokeRect(22, 22, w - 44, h - 44);
  g.textBaseline = "middle";
  const r = rng(4);
  poem.forEach((line, i) => {
    let sz = 46 + r() * 22;
    g.font = `bold ${sz}px "Courier New", monospace`;
    const maxW = w - 120;
    while (g.measureText(line).width > maxW) { sz -= 2; g.font = `bold ${sz}px "Courier New", monospace`; }
    g.fillStyle = i % 5 === 0 ? "#e63946" : i % 5 === 3 ? "#1d3557" : "#111";
    g.textAlign = "center";
    g.save();
    g.translate(w / 2 + (r() - 0.5) * 50, 70 + i * 52);
    g.rotate((r() - 0.5) * 0.08);
    g.fillText(line, 0, 0);
    g.restore();
  });
  g.fillStyle = "#555"; g.font = "italic 26px Georgia"; g.textAlign = "center";
  g.fillText("Karawane — Hugo Ball, 1916", w / 2, h - 56);
});
wallPoster(new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.25), new THREE.MeshStandardMaterial({ map: poemTex, roughness: 0.9, envMapIntensity: 0.2 })), 1, zMid1, 2.35);

// ---------- cortinas de cabaret ao fundo ----------
const curtTex = canvasTex(256, 512, (g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 0.55 + 0.45 * Math.sin(x * 0.28);
    g.fillStyle = `rgb(${Math.round(150 * v + 30)},${Math.round(18 * v)},${Math.round(26 * v)})`;
    g.fillRect(x, 0, 1, h);
  }
});
for (const s of [-1, 1]) {
  const geo = new THREE.PlaneGeometry(3, H - 0.3, 50, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 6.5) * 0.14);
  geo.computeVertexNormals();
  const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: curtTex, roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide }));
  c.position.set(s * (W / 2 - 1.8), (H - 0.3) / 2, -L + 0.2);
  scene.add(c);
}
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W - 1, 12), darkMat);
rod.rotation.z = Math.PI / 2;
rod.position.set(0, H - 0.25, -L + 0.2);
scene.add(rod);

// ---------- instalação central ("ready-made" dadaísta) ----------
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.1, 48), new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.4, envMapIntensity: 0.6 }));
plinth.position.set(CX, 0.55, CZ);
plinth.castShadow = plinth.receiveShadow = true;
scene.add(plinth);
blob(3.4, 3.4, CX, CZ);

const readymade = new THREE.Group();
const bola = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.18, metalness: 0.4 }));
const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.0, 28), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.35, metalness: 0.2 }));
cone.position.y = 0.75; cone.rotation.z = 0.5;
const aro = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 14, 48), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 }));
aro.rotation.x = Math.PI / 2.6; aro.position.y = 0.12;
const cubo = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.3 }));
cubo.position.set(0.7, -0.2, 0.2);
readymade.add(bola, cone, aro, cubo);
readymade.traverse((o) => { if (o.isMesh) o.castShadow = true; });
readymade.position.set(CX, 2.0, CZ);
scene.add(readymade);

const spotC = new THREE.SpotLight(0xfff0d0, 220, 16, 0.42, 0.55, 1.5);
spotC.position.set(2.4, H - 0.4, CZ + 2.6);
spotC.target.position.set(CX, 1.6, CZ);
spotC.castShadow = true;
spotC.shadow.mapSize.set(1024, 1024);
spotC.shadow.bias = -0.0005;
scene.add(spotC, spotC.target);

// ---------- móbile dadaísta suspenso ----------
const hung = [];   // { obj, base, phase, spin }
function hang(obj, x, y, z, spin = 0.4) {
  obj.position.set(x, y, z);
  scene.add(obj);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, H - y, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  wire.position.set(x, y + (H - y) / 2, z);
  scene.add(wire);
  hung.push({ obj, wire, y, phase: Math.random() * 6, spin });
}
const sh = (c, m = 0.3, r = 0.4) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
hang(new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), sh(0xe63946, 0.3, 0.2)), -1.5, 4.6, CZ + 0.4);
hang(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 24), sh(0xffd23f)), 1.4, 4.2, CZ - 0.6, 0.7);
hang(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 12, 40), sh(0x111111, 0.6, 0.3)), 0.2, 5.1, CZ + 1.2, 0.9);
hang(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), sh(0x2a9d8f)), -0.3, 3.9, CZ - 1.4, 0.6);
hang(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32), sh(0xf1ece1, 0.1, 0.6)), 1.8, 5.0, CZ + 0.8, 0.5);
hang(new THREE.Mesh(new THREE.OctahedronGeometry(0.32), sh(0x1d3557, 0.4, 0.3)), -2.2, 4.0, CZ - 0.9, 0.8);

// letras suspensas (D A D A / Í S M O)
function letterCard(ch, i) {
  const colors = ["#e63946", "#ffd23f", "#2a9d8f", "#1d3557", "#f1ece1"];
  const tex = canvasTex(256, 256, (g, w, h) => {
    const bg = colors[i % colors.length];
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = bg === "#f1ece1" || bg === "#ffd23f" ? "#111" : "#f1ece1";
    g.font = "200px Impact, 'Arial Black', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(ch, w / 2, h / 2 + 8);
    g.strokeStyle = "#111"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.3 }));
}
"DADA".split("").forEach((ch, i) => hang(letterCard(ch, i), -3.3 + i * 2.2, 4.9 - (i % 2) * 0.35, zMid1, 0.15));
"ÍSMO".split("").forEach((ch, i) => hang(letterCard(ch, i + 2), -3.3 + i * 2.2, 4.9 - ((i + 1) % 2) * 0.35, zMid2, 0.15));

// ---------- bancos ----------
const colliders = [];  // caixas {x0,x1,z0,z1}
function bench(x, z) {
  const g = new THREE.Group();
  box(0.7, 0.14, 2.4, new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.55, envMapIntensity: 0.7 }), 0, 0.5, 0, g);
  box(0.62, 0.05, 2.3, new THREE.MeshStandardMaterial({ color: 0x9c1f2c, roughness: 0.7, envMapIntensity: 0.3 }), 0, 0.59, 0, g);
  for (const dz of [-1, 1]) box(0.5, 0.45, 0.08, darkMat, 0, 0.22, dz * 1.0, g);
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  blob(1.5, 3.1, x, z);
  colliders.push({ x0: x - 0.35, x1: x + 0.35, z0: z - 1.2, z1: z + 1.2 });
}
bench(0, zMid1);
bench(0, zMid2);
const PLINTH = { x: CX, z: CZ, r: 0.95 };

// ---------- quadros ----------
const frames = [];   // { obra, pos }
const PROMPT_DIST = 6;

function loadArt(obra, onProgress) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { onProgress(); resolve(img); };
    img.onerror = () => { onProgress(); resolve(null); };
    img.src = obra.imagem;
  });
}

// quadro de exemplo (só aparece se a imagem não existir)
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
    g.fillRect(-s / 2, -s / 3, s, s * 0.66);
    g.restore();
  }
  g.fillStyle = "rgba(0,0,0,.55)"; g.font = "italic 26px Georgia";
  g.fillText("quadro de exemplo", 20, h - 22);
  return c;
}

function buildArt(imgs) {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 0.35, metalness: 0.3, envMapIntensity: 1 });
  const matMat = new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.9 });

  OBRAS.forEach((obra, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -(GAP * (Math.floor(i / 2) + 1));
    const img = imgs[i] || placeholderArt(i);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;

    const maxW = 3.6, maxH = 2.7;
    const s = Math.min(maxW / iw, maxH / ih);
    const pw = iw * s, ph = ih * s;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;

    const g = new THREE.Group();
    const matW = 0.1, fw = 0.1;
    box(pw + (matW + fw) * 2, ph + (matW + fw) * 2, 0.1, frameMat, 0, 0, 0, g);
    box(pw + matW * 2, ph + matW * 2, 0.11, matMat, 0, 0, 0.005, g);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, envMapIntensity: 0.15 }));
    pic.position.z = 0.062;
    g.add(pic);
    g.position.set(side * (W / 2 - 0.07), ART_Y, z);
    g.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(g);

    // placa
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.48),
      new THREE.MeshStandardMaterial({
        map: canvasTex(512, 272, (c, w, h) => {
          c.fillStyle = "#f1ece1"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#e63946"; c.fillRect(0, 0, 14, h);
          c.fillStyle = "#111"; c.textBaseline = "top";
          const long = obra.titulo.length > 40;
          c.font = long ? "bold 24px Georgia" : "bold 34px Georgia";
          wrapText(c, obra.titulo, 32, 18, w - 52, long ? 28 : 40);
          c.font = "italic 28px Georgia"; c.fillStyle = "#555";
          c.fillText(`${obra.artista}, ${obra.ano}`, 32, h - 52);
        }),
        roughness: 0.8,
      })
    );
    plaque.position.set(side * (W / 2 - 0.03), 1.45, z + pw / 2 + 0.75);
    plaque.rotation.y = g.rotation.y;
    scene.add(plaque);

    // foco na calha
    const sx = side * (W / 2 - 2.3);
    const sp = new THREE.SpotLight(0xfff2d6, 110, 14, 0.5, 0.65, 1.6);
    sp.position.set(sx, H - 0.35, z);
    sp.target.position.set(side * (W / 2), ART_Y, z);
    scene.add(sp, sp.target);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.28, 16), darkMat);
    can.position.set(sx, H - 0.22, z);
    can.rotation.z = side * 0.5;
    scene.add(can);

    frames.push({ obra, pos: new THREE.Vector3(side * (W / 2), ART_Y, z) });
  });
}

// ---------- carregamento ----------
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start");
const barFill = document.querySelector("#bar i");
let ready = false, started = false;

(async () => {
  let n = 0;
  const upd = () => {
    n++;
    barFill.style.width = `${Math.round((n / OBRAS.length) * 100)}%`;
    startBtn.textContent = `A CARREGAR… ${n}/${OBRAS.length}`;
  };
  const imgs = await Promise.all(OBRAS.map((o) => loadArt(o, upd)));
  buildArt(imgs);
  ready = true;
  startBtn.disabled = false;
  startBtn.textContent = "ENTRAR";
})();

// ---------- controlos ----------
const promptEl = document.getElementById("prompt");
const infoEl = document.getElementById("info");
const keys = new Set();
let locked = false, yaw = 0, pitch = 0, infoOpen = false, dragging = false;
let current = null;

function enter() {
  if (!ready) return;
  overlay.style.display = "none";
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
  started = true;
}
overlay.addEventListener("click", enter);

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && started) {
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
  if (k.startsWith("Arrow")) e.preventDefault();
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
const PR = 0.3;  // raio do visitante

function f_moving() { return keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD"); }

function update(dt) {
  if (started) {
    if (keys.has("ArrowLeft")) yaw += 1.8 * dt;
    if (keys.has("ArrowRight")) yaw -= 1.8 * dt;
    if (keys.has("ArrowUp")) pitch = Math.min(1.35, pitch + 1.4 * dt);
    if (keys.has("ArrowDown")) pitch = Math.max(-1.35, pitch - 1.4 * dt);
  }
  if (started && !infoOpen) {
    const sp = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.4 : 3.0) * dt;
    let f = 0, s = 0;
    if (keys.has("KeyW")) f += 1;
    if (keys.has("KeyS")) f -= 1;
    if (keys.has("KeyD")) s += 1;
    if (keys.has("KeyA")) s -= 1;
    if (f || s) {
      const len = Math.hypot(f, s);
      f /= len; s /= len;
      camera.position.x += (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
      camera.position.z += (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
    }
  }
  // paredes
  camera.position.x = Math.max(-W / 2 + MARGIN, Math.min(W / 2 - MARGIN, camera.position.x));
  camera.position.z = Math.max(-L + MARGIN, Math.min(-MARGIN, camera.position.z));
  // pedestal (círculo)
  {
    const dx = camera.position.x - PLINTH.x, dz = camera.position.z - PLINTH.z;
    const d = Math.hypot(dx, dz), R = PLINTH.r + PR;
    if (d < R) { camera.position.x = PLINTH.x + (dx / (d || 1)) * R; camera.position.z = PLINTH.z + (dz / (d || 1)) * R; }
  }
  // bancos (caixas)
  for (const c of colliders) {
    const px = camera.position.x, pz = camera.position.z;
    if (px > c.x0 - PR && px < c.x1 + PR && pz > c.z0 - PR && pz < c.z1 + PR) {
      const dl = px - (c.x0 - PR), dr = (c.x1 + PR) - px, dn = pz - (c.z0 - PR), df = (c.z1 + PR) - pz;
      const m = Math.min(dl, dr, dn, df);
      if (m === dl) camera.position.x = c.x0 - PR;
      else if (m === dr) camera.position.x = c.x1 + PR;
      else if (m === dn) camera.position.z = c.z0 - PR;
      else camera.position.z = c.z1 + PR;
    }
  }

  camera.position.y = EYE + (started && f_moving() ? Math.sin(performance.now() * 0.008) * 0.025 : 0);
  camera.rotation.set(pitch, yaw, 0);

  // quadro que o visitante está a olhar
  camera.getWorldDirection(fwd);
  let best = null, bestScore = 0;
  for (const fr of frames) {
    tmp.copy(fr.pos).sub(camera.position);
    const dist = tmp.length();
    if (dist > PROMPT_DIST) continue;
    tmp.normalize();
    const dot = tmp.dot(fwd);
    if (dot < 0.72) continue;
    const score = dot - dist * 0.05;
    if (score > bestScore) { bestScore = score; best = fr; }
  }
  current = best;
  if (infoOpen && !current) closeInfo();
  promptEl.classList.toggle("on", !!current && !infoOpen && started);

  // animações
  const t = performance.now() * 0.001;
  readymade.rotation.y += dt * 0.6;
  readymade.position.y = 2.0 + Math.sin(t * 1.5) * 0.08;
  for (const h of hung) {
    h.obj.rotation.y += dt * h.spin * 0.5;
    h.obj.position.y = h.y + Math.sin(t * 0.8 + h.phase) * 0.06;
    h.wire.scale.y = (H - h.obj.position.y) / (H - h.y);
    h.wire.position.y = h.obj.position.y + (H - h.obj.position.y) / 2;
  }
}

renderer.setAnimationLoop(() => {
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
});

// para testes
window.__museu = {
  camera, frames,
  setView(y, p) { yaw = y; pitch = p; },
  start() { started = true; overlay.style.display = "none"; },
  key: (k, on) => (on ? keys.add(k) : keys.delete(k)),
};
