import * as THREE from "./lib/three.module.min.js";
import { OBRAS } from "./obras.js";

// ---------- parâmetros da sala ----------
const W = 11;                        // largura
const H = 4.3;                       // altura (pé-direito baixo, como numa taberna)
const GAP = 5.5;                     // distância entre pares de quadros
const PAIRS = Math.ceil(OBRAS.length / 2);
const L = GAP * PAIRS + 8;           // comprimento (a sala vai de z=0 a z=-L)
const STAGE_D = 4.5;                 // profundidade do palco
const EYE = 1.7;
const MARGIN = 0.6;
const CX = 0, CZ = -L / 2;           // centro da sala
const ART_Y = 1.95;                  // altura do centro dos quadros

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
scene.background = new THREE.Color(0x120c07);
scene.fog = new THREE.FogExp2(0x1a120b, 0.028);   // fumo de cabaret

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
camera.position.set(-1.0, EYE, -2.2);
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

// ---------- reflexos de ambiente (dá brilho a molduras, metais, madeira) ----------
function makeEnvironment() {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(30, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x3b2c1f, side: THREE.BackSide })
  ));
  const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3.5) });
  for (const z of [-12, 0, 12]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 4), panel);
    m.position.set(0, 4.6, z);
    s.add(m);
  }
  scene.environment = pm.fromScene(s, 0.04).texture;
  pm.dispose();
}
makeEnvironment();

// ---------- texturas ----------
const wallTex = canvasTex(256, 256, (g, w, h) => {
  const r = rng(21);
  g.fillStyle = "#cdbd96"; g.fillRect(0, 0, w, h);
  for (let n = 0; n < 40; n++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(80,55,25,${0.05 + r() * 0.07})`); gr.addColorStop(1, "rgba(80,55,25,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let n = 0; n < 2500; n++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}, [L / 3, 1.2]);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, envMapIntensity: 0.3 });
const backMat = new THREE.MeshStandardMaterial({ color: 0x1a110b, roughness: 0.9, envMapIntensity: 0.2 });

const panelTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#3a2314"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#1c0f07"; g.lineWidth = 6;
  g.strokeRect(10, 14, w - 20, h - 28);
  g.strokeStyle = "rgba(255,200,140,.12)"; g.lineWidth = 2;
  g.strokeRect(16, 20, w - 32, h - 40);
  for (let n = 0; n < 40; n++) {
    g.strokeStyle = `rgba(20,8,0,${0.1 + Math.random() * 0.15})`; g.lineWidth = 1;
    const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 8, h); g.stroke();
  }
}, [L / 1.6, 1]);
const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55, envMapIntensity: 0.5 });

const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(11);
  const cols = 16, plankH = 256;
  for (let c = 0; c < cols; c++) {
    const off = Math.floor(r() * plankH);
    for (let y = -plankH + off; y < h; y += plankH) {
      g.fillStyle = `hsl(${22 + r() * 6}, ${30 + r() * 10}%, ${14 + r() * 10}%)`;
      g.fillRect(c * 64, y, 63, plankH - 1);
      for (let k = 0; k < 12; k++) {
        g.strokeStyle = `rgba(10,4,0,${0.08 + r() * 0.12})`;
        g.lineWidth = 1;
        const gx = c * 64 + r() * 60;
        g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + (r() - 0.5) * 6, y + plankH); g.stroke();
      }
    }
  }
  for (let n = 0; n < 900; n++) {   // desgaste
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 30, 2);
  }
}, [W / 2.4, L / 2.4]);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.03, envMapIntensity: 0.6 });

const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2a1d13, roughness: 1, envMapIntensity: 0.15 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x120e0b, roughness: 0.6, envMapIntensity: 0.5 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.55, envMapIntensity: 0.5 });
const tableWood = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.5, envMapIntensity: 0.6 });

// ---------- estrutura ----------
box(W, 0.2, L, floorMat, 0, -0.1, CZ).receiveShadow = true;           // chão
box(W, 0.2, L, ceilMat, 0, H + 0.1, CZ);                              // teto
box(0.2, H, L, wallMat, -W / 2 - 0.1, H / 2, CZ);                     // parede esquerda
box(0.2, H, L, wallMat, W / 2 + 0.1, H / 2, CZ);                      // parede direita
box(W, H, 0.2, wallMat, 0, H / 2, 0.1);                               // entrada
box(W, H, 0.2, backMat, 0, H / 2, -L - 0.1);                          // fundo

// lambril de madeira, friso e rodapé
for (const s of [-1, 1]) {
  box(0.06, 1.3, L, panelMat, s * (W / 2 - 0.03), 0.65, CZ);
  box(0.1, 0.07, L, woodMat, s * (W / 2 - 0.05), 1.33, CZ);
  box(0.12, 0.2, L, darkMat, s * (W / 2 - 0.06), 0.1, CZ);
  box(0.14, 0.12, L, woodMat, s * (W / 2 - 0.07), H - 0.06, CZ);      // cornija
}

// vigas de madeira no teto baixo
for (let z = -1.5; z > -L; z -= 3) box(W, 0.3, 0.3, woodMat, 0, H - 0.15, z);

// ---------- luz (quente e baixa) ----------
scene.add(new THREE.HemisphereLight(0xffd9a8, 0x2a1a0e, 0.32));

// candeeiros de papel suspensos
const lamps = [];
const lampColors = [0xff9a3c, 0xffc85a, 0xff7a3c, 0xffb347];
for (let i = 0; i < 4; i++) {
  const z = -3.2 - i * 5.2;
  const col = lampColors[i % lampColors.length];
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.3) }));
  shade.scale.y = 1.25;
  shade.position.set(0, H - 1.05, z);
  scene.add(shade);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4), darkMat);
  cord.position.set(0, H - 0.45, z);
  scene.add(cord);
  const p = new THREE.PointLight(col, 16, 11, 1.5);
  p.position.set(0, H - 1.1, z);
  scene.add(p);
  lamps.push({ light: p, base: 16, phase: Math.random() * 10 });
}

// sombras de contacto falsas
const blobTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
function blob(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  scene.add(m);
  return m;
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
      if (chr === " ") return;
      g.save();
      g.translate(cell * (i + 0.5), ch / 2 + (r() - 0.5) * ch * 0.18);
      g.rotate((r() - 0.5) * 0.45);
      const sz = Math.min(ch * (0.55 + r() * 0.3), cell * 1.05);
      g.font = `${sz}px Impact, "Arial Black", sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      const m = g.measureText(chr);
      const light = r() < 0.5;
      g.fillStyle = light ? "#f1ece1" : colors[(r() * colors.length) | 0];
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

function paperPoster(lines, w, h, tilt = 0) {
  const pxW = 600, pxH = Math.round(600 * h / w);
  const tex = canvasTex(pxW, pxH, (g, cw, ch) => {
    g.fillStyle = "#e9dfc6"; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = "#111"; g.lineWidth = 6; g.strokeRect(14, 14, cw - 28, ch - 28);
    let y = 40;
    g.textAlign = "center"; g.textBaseline = "top";
    for (const l of lines) {
      g.fillStyle = l.c || "#111";
      g.font = `${l.s}px ${l.f || "Impact, 'Arial Black', sans-serif"}`;
      let sz = l.s;
      while (g.measureText(l.t).width > cw - 60 && sz > 10) { sz -= 2; g.font = `${sz}px ${l.f || "Impact, 'Arial Black', sans-serif"}`; }
      g.fillText(l.t, cw / 2, y);
      y += sz * 1.25;
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, envMapIntensity: 0.2 }));
  m.userData.tilt = tilt;
  return m;
}

function wallPoster(mesh, side, z, y = ART_Y) {
  mesh.position.set(side * (W / 2 - 0.03), y, z);
  mesh.rotation.set(0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0);
  mesh.rotateZ(mesh.userData.tilt || 0);
  scene.add(mesh);
}

const zMid1 = -(GAP * 1.5), zMid2 = -(GAP * 2.5);

wallPoster(wordPanel("DADA", 1.9, 0.85, 5), -1, zMid1, 2.1);
wallPoster(paperPoster([
  { t: "CABARET", s: 82, c: "#e63946" },
  { t: "VOLTAIRE", s: 82 },
  { t: "ZÜRICH · 1916", s: 36, f: "Georgia, serif", c: "#1d3557" },
  { t: "Spiegelgasse 1", s: 28, f: "italic Georgia, serif", c: "#555" },
], 1.7, 2.3, -0.03), -1, zMid2, 2.0);
wallPoster(paperPoster([
  { t: "SOIRÉE", s: 90, c: "#1d3557" },
  { t: "DADA", s: 110, c: "#e63946" },
  { t: "musique · poésie", s: 30, f: "italic Georgia, serif" },
  { t: "danse · bruit", s: 30, f: "italic Georgia, serif" },
], 1.7, 2.3, 0.04), 1, zMid2, 2.0);

// poema fonético (Karawane) na parede direita
const poem = [
  "jolifanto bambla ô falli bambla", "grossiga m'pfa habla horem", "égiga goramen",
  "higo bloiko russula huju", "hollaka hollala", "anlogo bung", "blago bung", "blago bung",
  "bosso fataka", "ü üü ü", "schampa wulla wussa olobo", "hej tatta gorem",
  "eschige zunbada", "wulubu ssubudu uluwu ssubudu", "tumba ba- umf", "kusa gauma", "ba - umf",
];
const poemTex = canvasTex(768, 1000, (g, w, h) => {
  g.fillStyle = "#e9dfc6"; g.fillRect(0, 0, w, h);
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
wallPoster(new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.28), new THREE.MeshStandardMaterial({ map: poemTex, roughness: 0.9, envMapIntensity: 0.2 })), 1, zMid1, 2.05);

// letreiro à entrada (voltado para dentro da sala, para quem olha para trás)
const entrada = wordPanel("MUSEU DADAÍSMO", 5.4, 0.9, 3);
entrada.position.set(0, 3.5, -0.01);
entrada.rotation.y = Math.PI;
scene.add(entrada);

// ---------- bandeirolas de papel ----------
const flagCols = [0xe63946, 0xffd23f, 0x2a9d8f, 0x1d3557, 0xf1ece1, 0xf4a261];
function bunting(z, sag = 0.4) {
  const y0 = H - 0.35, x0 = -W / 2 + 0.3, x1 = W / 2 - 0.3;
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = x0 + (x1 - x0) * t;
    pts.push(new THREE.Vector3(x, y0 - sag * (1 - Math.pow(2 * t - 1, 2)), z));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x111111 })));
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  tri.computeVertexNormals();
  for (let i = 2; i < N; i += 2) {
    const m = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: flagCols[(i / 2) % flagCols.length], side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.copy(pts[i]);
    m.rotation.z = (Math.random() - 0.5) * 0.2;
    scene.add(m);
  }
}
bunting(-4.6, 0.45);
bunting(-9.8, 0.5);
bunting(-15.0, 0.4);

// ---------- palco ----------
const STAGE_Z0 = -L, STAGE_Z1 = -L + STAGE_D;   // do fundo até à frente do palco
const STAGE_H = 0.5, STAGE_W = 8.4;
const stage = box(STAGE_W, STAGE_H, STAGE_D, new THREE.MeshStandardMaterial({ color: 0x2c1b0f, roughness: 0.6, envMapIntensity: 0.5 }), 0, STAGE_H / 2, -L + STAGE_D / 2);
stage.receiveShadow = true;
// "tábuas" no topo do palco
const stageTex = floorTex.clone();
stageTex.repeat.set(STAGE_W / 2.4, STAGE_D / 2.4);
stageTex.needsUpdate = true;
const stageTop = box(STAGE_W, 0.02, STAGE_D, new THREE.MeshStandardMaterial({ map: stageTex, roughness: 0.5, envMapIntensity: 0.6 }), 0, STAGE_H + 0.011, -L + STAGE_D / 2);
stageTop.receiveShadow = true;
box(STAGE_W, 0.08, 0.1, woodMat, 0, STAGE_H, STAGE_Z1);           // rebordo frontal

// frente de palco: pórtico e letreiro
box(W, 1.1, 0.3, darkMat, 0, H - 0.55, STAGE_Z1 + 0.1);
box(0.7, H, 0.3, darkMat, -W / 2 + 0.35, H / 2, STAGE_Z1 + 0.1);
box(0.7, H, 0.3, darkMat, W / 2 - 0.35, H / 2, STAGE_Z1 + 0.1);
const sign = wordPanel("CABARET VOLTAIRE", 6.4, 0.7, 8);
sign.position.set(0, H - 0.7, STAGE_Z1 + 0.26);
scene.add(sign);

// cortinas de veludo atrás do palco
const curtTex = canvasTex(256, 512, (g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 0.55 + 0.45 * Math.sin(x * 0.28);
    g.fillStyle = `rgb(${Math.round(150 * v + 30)},${Math.round(18 * v)},${Math.round(26 * v)})`;
    g.fillRect(x, 0, 1, h);
  }
});
for (const s of [-1, 1]) {
  const geo = new THREE.PlaneGeometry(4.2, H - 0.5, 50, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 6.5) * 0.13);
  geo.computeVertexNormals();
  const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: curtTex, roughness: 0.85, envMapIntensity: 0.25, side: THREE.DoubleSide }));
  c.position.set(s * 2.65, (H - 0.5) / 2, -L + 0.25);
  scene.add(c);
}
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 8.4, 12), darkMat);
rod.rotation.z = Math.PI / 2;
rod.position.set(0, H - 0.55, -L + 0.25);
scene.add(rod);

// candeeiros de pé no palco (luz de ribalta)
for (const s of [-1, 1]) {
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa24a).multiplyScalar(1.6) }));
  foot.position.set(s * 2.6, STAGE_H + 0.1, STAGE_Z1 - 0.2);
  scene.add(foot);
}
const footLight = new THREE.PointLight(0xff9040, 5, 7, 1.6);
footLight.position.set(0, STAGE_H + 0.35, STAGE_Z1 - 0.5);
scene.add(footLight);

// ---------- Hugo Ball no Cabaret Voltaire, 1916 (recorte da fotografia do Karawane) ----------
const hugo = new THREE.Group();
const hugoParts = {};
const HUGO_H = 2.35;                       // altura real do traje, com o chapéu
const hugoTex = new THREE.TextureLoader().load("obras/hugo-ball-recorte.png", (t) => {
  const asp = t.image.width / t.image.height;
  hugoMesh.scale.set(HUGO_H * asp, HUGO_H, 1);
  hugoMesh.position.y = HUGO_H / 2;
});
hugoTex.colorSpace = THREE.SRGBColorSpace;
hugoTex.anisotropy = 8;
const hugoMat = new THREE.MeshStandardMaterial({
  map: hugoTex, color: 0x7a7a7a, emissiveMap: hugoTex, emissive: 0xffffff, emissiveIntensity: 0.22,
  roughness: 0.9, metalness: 0, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, envMapIntensity: 0.1,
});
const hugoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hugoMat);
hugoMesh.scale.set(HUGO_H * 0.34, HUGO_H, 1);
hugoMesh.position.y = HUGO_H / 2;
hugoMesh.castShadow = true;
hugo.add(hugoMesh);
hugoParts.mesh = hugoMesh;
hugo.position.set(0, STAGE_H, -L + 2.8);
scene.add(hugo);
blob(1.3, 0.6, 0, -L + 2.8).position.y = STAGE_H + 0.015;

// estantes de partitura, com folhas do poema (Ball lia o poema nelas)
const sheetTex = canvasTex(256, 192, (g, w, h) => {
  g.fillStyle = "#f4efe2"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#333";
  const r = rng(6);
  for (let i = 0; i < 9; i++) g.fillRect(24, 22 + i * 17, 60 + r() * 150, 4);
});
for (const s of [-1, 1]) {
  const g = new THREE.Group();
  // tripé
  for (let k = 0; k < 3; k++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), darkMat);
    const a = k * 2.094;
    leg.position.set(Math.sin(a) * 0.14, 0.42, Math.cos(a) * 0.14);
    leg.rotation.set(Math.cos(a) * 0.17, 0, -Math.sin(a) * 0.17);
    g.add(leg);
  }
  box(0.025, 0.62, 0.025, darkMat, 0, 1.17, 0, g);
  const rack = box(0.7, 0.02, 0.18, darkMat, 0, 1.32, 0.02, g);
  rack.rotation.x = -0.35;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9, side: THREE.DoubleSide }));
  sheet.position.set(0, 1.58, 0); sheet.rotation.x = -0.28;
  g.add(sheet);
  g.position.set(s * 1.45, STAGE_H, -L + 3.0);
  g.rotation.y = -s * 0.4;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}

const spotC = new THREE.SpotLight(0xffe2b0, 160, 12, 0.5, 0.5, 1.5);
spotC.position.set(0, H - 0.3, STAGE_Z1 + 2.4);
spotC.target.position.set(0, 1.4, -L + 2.8);
spotC.castShadow = true;
spotC.shadow.mapSize.set(1024, 1024);
spotC.shadow.bias = -0.0005;
scene.add(spotC, spotC.target);

// ---------- mesas, cadeiras e velas ----------
const circles = [];      // colisões circulares {x,z,r}
const boxes = [];        // colisões em caixa {x0,x1,z0,z1}
const candles = [];

function chair(x, z, ry) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.55, envMapIntensity: 0.5 });
  box(0.42, 0.05, 0.42, m, 0, 0.45, 0, g);
  box(0.42, 0.5, 0.04, m, 0, 0.72, -0.2, g);
  box(0.04, 0.45, 0.04, m, -0.18, 0.22, 0.18, g);
  box(0.04, 0.45, 0.04, m, 0.18, 0.22, 0.18, g);
  box(0.04, 0.45, 0.04, m, -0.18, 0.22, -0.18, g);
  box(0.04, 0.45, 0.04, m, 0.18, 0.22, -0.18, g);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(g);
}

function table(x, z, seed) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28), tableWood);
  top.position.y = 0.76; g.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.74, 12), darkMat);
  leg.position.y = 0.37; g.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), darkMat);
  foot.position.y = 0.015; g.add(foot);
  // vela
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xf3eadb, roughness: 0.8 }));
  wax.position.set(0.05, 0.85, 0.03); g.add(wax);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb04a).multiplyScalar(2.2) }));
  flame.scale.y = 1.7; flame.position.set(0.05, 0.935, 0.03); g.add(flame);
  candles.push({ flame, phase: seed * 2.1 });
  // copo e garrafa
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x1e5a3a, roughness: 0.15, metalness: 0.2 }));
  bottle.position.set(-0.18, 0.92, -0.05); g.add(bottle);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xcfd9e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 }));
  glass.position.set(0.1, 0.83, -0.15); g.add(glass);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, 0, z);
  scene.add(g);
  blob(1.6, 1.6, x, z);
  for (let k = 0; k < 3; k++) {
    const a = seed + k * 2.1;
    chair(x + Math.sin(a) * 0.82, z + Math.cos(a) * 0.82, a + Math.PI);
  }
  circles.push({ x, z, r: 1.15 });
}
table(-1.9, zMid1 + 0.2, 1.0);
table(1.9, zMid1 - 0.2, 2.3);
table(-1.9, zMid2 + 0.2, 3.7);
table(1.9, zMid2 - 0.2, 5.1);

// ---------- bar à entrada ----------
{
  const bx = W / 2 - 0.55, bz = -3.2, len = 3.4;
  box(0.8, 1.05, len, woodMat, bx, 0.525, bz);
  box(0.95, 0.06, len + 0.1, tableWood, bx - 0.04, 1.08, bz);
  // prateleira com garrafas na parede
  box(0.25, 0.05, len - 0.2, woodMat, W / 2 - 0.15, 1.9, bz);
  box(0.25, 0.05, len - 0.2, woodMat, W / 2 - 0.15, 2.45, bz);
  const bc = [0x1e5a3a, 0x7a3e12, 0x1d3557, 0x8c1c13, 0xb8893a, 0x2a2a2a];
  const r = rng(8);
  for (let i = 0; i < 12; i++) {
    for (const [yy, sc] of [[1.93, 1], [2.48, 0.9]]) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34 * sc, 10), new THREE.MeshStandardMaterial({ color: bc[(r() * bc.length) | 0], roughness: 0.2, metalness: 0.2 }));
      bt.position.set(W / 2 - 0.15, yy + 0.19 * sc, bz - len / 2 + 0.3 + i * ((len - 0.6) / 11));
      scene.add(bt);
    }
  }
  const bl = new THREE.PointLight(0xffa850, 5, 5, 1.6);
  bl.position.set(W / 2 - 0.9, 2.2, bz);
  scene.add(bl);
  boxes.push({ x0: bx - 0.55, x1: W / 2, z0: bz - len / 2 - 0.1, z1: bz + len / 2 + 0.1 });
  blob(1.2, len + 0.5, bx, bz);
}
boxes.push({ x0: -STAGE_W / 2, x1: STAGE_W / 2, z0: -L, z1: STAGE_Z1 });   // palco

// ---------- quadros ----------
const frames = [];   // { obra, pos }
const PROMPT_DIST = 6.2;

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
  const gilt = new THREE.MeshStandardMaterial({ color: 0x9a7430, roughness: 0.4, metalness: 0.75, envMapIntensity: 1.2 });
  const matMat = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.9 });

  OBRAS.forEach((obra, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -(GAP * (Math.floor(i / 2) + 1));
    const img = imgs[i] || placeholderArt(i);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;

    const maxW = 2.7, maxH = 2.1;
    const s = Math.min(maxW / iw, maxH / ih);
    const pw = iw * s, ph = ih * s;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;

    const g = new THREE.Group();
    const matW = 0.07, fw = 0.11;
    box(pw + (matW + fw) * 2, ph + (matW + fw) * 2, 0.1, gilt, 0, 0, 0, g);
    box(pw + matW * 2, ph + matW * 2, 0.11, matMat, 0, 0, 0.005, g);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, envMapIntensity: 0.15 }));
    pic.position.z = 0.062;
    g.add(pic);
    g.position.set(side * (W / 2 - 0.07), ART_Y, z);
    g.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(g);

    // placa
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.43),
      new THREE.MeshStandardMaterial({
        map: canvasTex(512, 272, (c, w, h) => {
          c.fillStyle = "#e9dfc6"; c.fillRect(0, 0, w, h);
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
    plaque.position.set(side * (W / 2 - 0.03), 1.55, z + pw / 2 + 0.72);
    plaque.rotation.y = g.rotation.y;
    scene.add(plaque);

    // foco
    const sx = side * (W / 2 - 1.6);
    const sp = new THREE.SpotLight(0xffe6c0, 70, 10, 0.55, 0.7, 1.6);
    sp.position.set(sx, H - 0.25, z);
    sp.target.position.set(side * (W / 2), ART_Y, z);
    scene.add(sp, sp.target);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.22, 14), darkMat);
    can.position.set(sx, H - 0.14, z);
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
  // mesas (círculos)
  for (const c of circles) {
    const dx = camera.position.x - c.x, dz = camera.position.z - c.z;
    const d = Math.hypot(dx, dz), R = c.r + PR;
    if (d < R) { camera.position.x = c.x + (dx / (d || 1)) * R; camera.position.z = c.z + (dz / (d || 1)) * R; }
  }
  // palco e bar (caixas)
  for (const c of boxes) {
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

  // animações: velas e candeeiros a tremeluzir
  const tt = performance.now() * 0.001;
  // Hugo Ball: leve balanço a recitar
  hugo.rotation.y = Math.sin(tt * 0.6) * 0.07;
  hugoMesh.scale.y = HUGO_H * (1 + Math.sin(tt * 1.7) * 0.004);
  for (const c of candles) c.flame.scale.set(1, 1.7 + Math.sin(tt * 9 + c.phase) * 0.25 + Math.sin(tt * 23 + c.phase) * 0.12, 1);
  for (const l of lamps) l.light.intensity = l.base * (1 + Math.sin(tt * 2.1 + l.phase) * 0.05 + Math.sin(tt * 7.3 + l.phase) * 0.03);
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
