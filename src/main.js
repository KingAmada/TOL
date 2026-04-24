import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Sky } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/objects/Sky.js";
import { EDGE_THICKNESS, getFloorY, TOP_Y, WORLD } from "./world-config.js";
import { zoneFloorIndexMap, zones } from "./zones.js";

const app = document.getElementById("app");
const loader = document.getElementById("loader");
const zonePanel = document.getElementById("zonePanel");
const walkHint = document.getElementById("walkHint");
const distanceBar = document.getElementById("distanceBar");
const elevationBar = document.getElementById("elevationBar");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 800, 3500);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); 
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.clippingPlanes = [];
app.appendChild(renderer.domElement);

const SKY_LAYER = 1;
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 30000);
camera.position.set(420, 220, 420);
camera.layers.enable(SKY_LAYER);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ssao = new SSAOPass(scene, camera, innerWidth, innerHeight);
ssao.kernelRadius = 18;
ssao.minDistance = 0.006;
ssao.maxDistance = 0.16;
composer.addPass(ssao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.42, 0.94);
composer.addPass(bloom);
const smaa = new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
composer.addPass(smaa);
composer.addPass(new OutputPass());

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.055;
orbit.maxDistance = 5000;
orbit.minDistance = 40;

const pointerLock = new PointerLockControls(camera, renderer.domElement);
const clock = new THREE.Clock();
const eagleClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const eagleFloorClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let currentView = "orbit";
let currentFloor = 4;
let groundDistance = 500; 
let groundElevation = 'ground'; 
let currentSeason = "summer";
let renderQuality = "realistic";
const moveState = { f:false, b:false, l:false, r:false };
const eagleFloorVisuals = new Map();
const eagleSharedVisuals = [];
const droneHiddenVisuals = [];
const eagleHiddenVisuals = [];
const eagleEnvironmentVisuals = [];
const billionaireWeather = {
  snow: null,
  rain: null,
  leaves: null
};

function registerEagleFloorVisual(floor, object) {
  if (!eagleFloorVisuals.has(floor)) eagleFloorVisuals.set(floor, []);
  eagleFloorVisuals.get(floor).push(object);
}

function registerEagleSharedVisual(object) {
  eagleSharedVisuals.push(object);
}

function registerDroneHiddenVisual(object) {
  droneHiddenVisuals.push(object);
}

function registerEagleHiddenVisual(object) {
  eagleHiddenVisuals.push(object);
}

function registerEagleEnvironmentVisual(object) {
  eagleEnvironmentVisuals.push(object);
}

function applyEagleVisibility() {
  const visible = new Set(eagleFloorVisuals.get(currentFloor) || []);
  for (const objects of eagleFloorVisuals.values()) {
    for (const object of objects) object.visible = visible.has(object);
  }
  for (const object of eagleSharedVisuals) object.visible = false;
  for (const object of eagleHiddenVisuals) object.visible = false;
  for (const object of eagleEnvironmentVisuals) object.visible = true;
}

function applyDroneVisibility() {
  for (const [floor, objects] of eagleFloorVisuals.entries()) {
    const floorVisible = floor <= currentFloor;
    for (const object of objects) object.visible = floorVisible;
  }
  for (const object of eagleSharedVisuals) object.visible = true;
  for (const object of droneHiddenVisuals) object.visible = false;
}

function resetEagleVisibility() {
  for (const objects of eagleFloorVisuals.values()) {
    for (const object of objects) object.visible = true;
  }
  for (const object of eagleSharedVisuals) object.visible = true;
  for (const object of droneHiddenVisuals) object.visible = true;
  for (const object of eagleHiddenVisuals) object.visible = true;
  for (const object of eagleEnvironmentVisuals) object.visible = true;
}

const root = new THREE.Group();
scene.add(root);

const sky = new Sky();
sky.scale.setScalar(15000);
sky.layers.set(SKY_LAYER);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms["turbidity"].value = 7;
skyUniforms["rayleigh"].value = 1.2;
skyUniforms["mieCoefficient"].value = 0.005;
skyUniforms["mieDirectionalG"].value = 0.84;
const sunVector = new THREE.Vector3();

const hemi = new THREE.HemisphereLight(0xaed8ff, 0x1a2028, 0.75);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.22);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(240, 480, 200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); 
sun.shadow.camera.left = -900;
sun.shadow.camera.right = 900;
sun.shadow.camera.top = 900;
sun.shadow.camera.bottom = -900;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 2400;
sun.shadow.bias = -0.00008;
sun.shadow.normalBias = 0.035;
scene.add(sun);

const gBox = new THREE.BoxGeometry(1, 1, 1);
const gRoundedBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
const gCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const gCone = new THREE.ConeGeometry(1, 1, 4);
gCone.rotateY(Math.PI / 4);
gCone.translate(0, 0.5, 0); 
const gSphere = new THREE.SphereGeometry(1, 8, 8);
const gWin = new THREE.BoxGeometry(0.7, 0.9, 0.06);

const treeTrunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.1, 5);
treeTrunkGeo.translate(0, 1.05, 0);
const treeCrownGeo = new THREE.SphereGeometry(1.1, 7, 7);
treeCrownGeo.translate(0, 2.4, 0);

// Restored perfectly flat ring geometry
function createSurfaceRing(innerR, outerR, y, mat, yOffset = 0) {
  const geo = new THREE.RingGeometry(innerR, outerR, 128);
  const mesh = addShadow(new THREE.Mesh(geo, mat), false, true);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y + yOffset;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return mesh;
}

function setSky(elevation, rayleigh, azimuth, fogColor, fogDensity, exposure, bloomStrength, hemiIntensity, ambientIntensity, sunIntensity, sunColor) {
  skyUniforms["rayleigh"].value = rayleigh;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunVector.setFromSphericalCoords(1, phi, theta);
  skyUniforms["sunPosition"].value.copy(sunVector);

  scene.background.setHex(fogColor);
  scene.fog.color.setHex(fogColor);
  scene.fog.near = 800;
  scene.fog.far = 3500;
  renderer.toneMappingExposure = exposure;
  bloom.strength = bloomStrength * (renderQuality === "realistic" ? 0.52 : 0.34);
  hemi.intensity = hemiIntensity;
  ambient.intensity = ambientIntensity * 0.42;
  sun.intensity = sunIntensity * 1.18;
  sun.color.setHex(sunColor);
  sun.position.copy(sunVector).multiplyScalar(700);
}

function setTheme(theme) {
  document.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("active", b.dataset.theme === theme));
  if (theme === "day") {
    setSky(12, 2.4, 60, 0xcbe7ff, 0.00015, 1.08, 0.18, 1.1, 0.35, 2.4, 0xfffaf0);
  } else if (theme === "sunset") {
    setSky(5, 1.8, 8, 0xe0936b, 0.0002, 1.02, 0.32, 0.95, 0.28, 2.0, 0xffba7c);
  } else {
    setSky(1, 0.8, 2, 0x091320, 0.0004, 0.95, 0.45, 0.75, 0.22, 1.2, 0xc9d8ff);
  }
  updateSkyScreenTheme(theme);
}

function setRenderQuality(quality) {
  renderQuality = quality;
  const realistic = quality === "realistic";
  renderer.setPixelRatio(Math.min(devicePixelRatio, realistic ? 1.75 : 1.15));
  composer.setPixelRatio(Math.min(devicePixelRatio, realistic ? 1.35 : 1));
  ssao.enabled = realistic;
  smaa.enabled = realistic;
  bloom.enabled = true;
  sun.shadow.mapSize.set(realistic ? 2048 : 1024, realistic ? 2048 : 1024);
  scene.environment = realistic ? architecturalEnvironment : skyCaptureTarget.texture;

  document.querySelectorAll("[data-quality]").forEach((button) => {
    button.classList.toggle("active", realistic);
    button.textContent = realistic ? "Realistic" : "Fast";
    button.dataset.quality = realistic ? "realistic" : "fast";
  });

  camera.updateProjectionMatrix();
  composer.setSize(innerWidth, innerHeight);
  ssao.setSize(innerWidth, innerHeight);
  smaa.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
}

function makeCanvasTexture(draw, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  t.userData.canvas = c;
  t.userData.ctx = ctx;
  return t;
}

const terrainTex = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = "#566348";
  ctx.fillRect(0,0,s,s);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random()*s, y = Math.random()*s;
    const g = 70 + Math.random()*50;
    ctx.fillStyle = `rgb(${40+Math.random()*30},${g},${35+Math.random()*20})`;
    ctx.fillRect(x,y,1+Math.random()*2,1+Math.random()*2);
  }
  for (let i = 0; i < 700; i++) {
    ctx.strokeStyle = `rgba(100,90,70,${0.04+Math.random()*0.06})`;
    ctx.beginPath();
    ctx.moveTo(Math.random()*s, Math.random()*s);
    ctx.lineTo(Math.random()*s, Math.random()*s);
    ctx.stroke();
  }
});
terrainTex.repeat.set(40,40);
const groundTerrainMaterial = new THREE.MeshStandardMaterial({
  color: 0x58674b,
  map: terrainTex,
  bumpMap: terrainTex,
  bumpScale: 0.42,
  roughness: 1
});

const asphaltTex = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = "#31363d";
  ctx.fillRect(0,0,s,s);
  for (let i=0;i<18000;i++){
    const v = 42 + Math.random()*30;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 1, 1);
  }
}, 512);
asphaltTex.repeat.set(4,4);

const concreteTex = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = "#aeb4bb";
  ctx.fillRect(0,0,s,s);
  for (let i=0;i<22000;i++){
    const v = 150 + Math.random()*42;
    ctx.fillStyle = `rgba(${v},${v+2},${v+5},${0.16 + Math.random()*0.22})`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 1 + Math.random()*2, 1 + Math.random()*2);
  }
  for (let i=0;i<72;i++){
    ctx.strokeStyle = `rgba(72,78,86,${0.025 + Math.random()*0.035})`;
    ctx.beginPath();
    ctx.moveTo(Math.random()*s, Math.random()*s);
    ctx.lineTo(Math.random()*s, Math.random()*s);
    ctx.stroke();
  }
}, 512);
concreteTex.repeat.set(6, 6);

const facadeTexFine = makeCanvasTexture((ctx,s)=>{
  ctx.fillStyle = "#d8dde2";
  ctx.fillRect(0,0,s,s);
  for(let y=0;y<s;y+=32){
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0,y,s,2);
    ctx.fillStyle = "rgba(65,72,82,0.12)";
    ctx.fillRect(0,y+30,s,1);
  }
  for(let x=0;x<s;x+=48){
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x,0,2,s);
    ctx.fillStyle = "rgba(58,64,72,0.10)";
    ctx.fillRect(x+46,0,1,s);
  }
  for (let i=0;i<9000;i++){
    const v = 190 + Math.random()*42;
    ctx.fillStyle = `rgba(${v},${v},${v},0.12)`;
    ctx.fillRect(Math.random()*s, Math.random()*s, 1, 1);
  }
}, 512);
facadeTexFine.repeat.set(2.4, 3.2);

const skyCaptureTarget = new THREE.WebGLCubeRenderTarget(256);
skyCaptureTarget.texture.mapping = THREE.CubeReflectionMapping;
const skyCaptureCamera = new THREE.CubeCamera(1, 25000, skyCaptureTarget);
skyCaptureCamera.layers.set(SKY_LAYER);
scene.add(skyCaptureCamera);
let architecturalEnvironment = skyCaptureTarget.texture;
scene.environment = architecturalEnvironment;

new RGBELoader()
  .setDataType(THREE.HalfFloatType)
  .load(
    "https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr",
    (texture) => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      architecturalEnvironment = pmrem.fromEquirectangular(texture).texture;
      scene.environment = renderQuality === "realistic" ? architecturalEnvironment : skyCaptureTarget.texture;
      texture.dispose();
      pmrem.dispose();
    },
    undefined,
    () => {
      architecturalEnvironment = skyCaptureTarget.texture;
    }
  );

const skyScreenMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uSkyCube: { value: skyCaptureTarget.texture }
  },
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform samplerCube uSkyCube;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    void main() {
      vec3 n = normalize(vWorldNormal);
      if (n.y > -0.15) discard;

      vec3 sampleDir = normalize(vWorldPos - cameraPosition);
      gl_FragColor = textureCube(uSkyCube, sampleDir);
    }
  `,
  side: THREE.DoubleSide,
  fog: false,
  toneMapped: false,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});

function updateSkyScreenTheme() {
  skyScreenMaterial.uniforms.uSkyCube.value = skyCaptureTarget.texture;
}

const materials = {
  trunk: new THREE.MeshPhysicalMaterial({ color: 0x8993a2, roughness: 0.52, metalness: 0.72 }),
  slab: new THREE.MeshPhysicalMaterial({ color: 0x858e9c, map: concreteTex, bumpMap: concreteTex, bumpScale: 0.09, roughness: 0.82, metalness: 0.28 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xd3d9e2, roughness: 0.26, metalness: 0.82 }),
  asphalt: new THREE.MeshStandardMaterial({
    color: 0x343941,
    roughness: 0.98,
    map: asphaltTex,
    bumpMap: asphaltTex,
    bumpScale: 0.055,
    side: THREE.DoubleSide
  }),
  lane: new THREE.MeshStandardMaterial({ color: 0xe9edf3, roughness: 0.75, side: THREE.DoubleSide }),
  grass: new THREE.MeshStandardMaterial({ color: 0x4a8b3f, roughness: 1, side: THREE.DoubleSide }),
  grassDeep: new THREE.MeshStandardMaterial({ color: 0x2b6d31, roughness: 1, side: THREE.DoubleSide }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xb8bcc3, map: concreteTex, bumpMap: concreteTex, bumpScale: 0.075, roughness: 0.94 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x8fb6cf, roughness: 0.09, metalness: 0.12, transmission: 0.08, thickness: 0.8, transparent: true, opacity: 0.78, envMapIntensity: 1.5 }),
  windowGlass: new THREE.MeshPhysicalMaterial({ color: 0x9fc7e1, roughness: 0.025, metalness: 0.08, transmission: 0.26, thickness: 0.42, transparent: true, opacity: 0.86, envMapIntensity: 1.65 }),
  whiteFacade: new THREE.MeshStandardMaterial({ color: 0xf2f5f8, map: facadeTexFine, bumpMap: facadeTexFine, bumpScale: 0.045, roughness: 0.88 }),
  warmFacade: new THREE.MeshStandardMaterial({ color: 0xdfd5c8, map: facadeTexFine, bumpMap: facadeTexFine, bumpScale: 0.04, roughness: 0.93 }),
  stoneFacade: new THREE.MeshStandardMaterial({ color: 0xb6afa5, map: concreteTex, bumpMap: concreteTex, bumpScale: 0.11, roughness: 0.96 }),
  sandFacade: new THREE.MeshStandardMaterial({ color: 0xe5ddd0, map: facadeTexFine, bumpMap: facadeTexFine, bumpScale: 0.04, roughness: 0.92 }),
  sageFacade: new THREE.MeshStandardMaterial({ color: 0xcfd9cf, map: facadeTexFine, bumpMap: facadeTexFine, bumpScale: 0.04, roughness: 0.92 }),
  roofTerracotta: new THREE.MeshStandardMaterial({ color: 0xa3533d, roughness: 0.95 }),
  roofSlate: new THREE.MeshStandardMaterial({ color: 0x4a5563, roughness: 0.95 }),
  roofCharcoal: new THREE.MeshStandardMaterial({ color: 0x323945, roughness: 0.96 }),
  roofCopper: new THREE.MeshStandardMaterial({ color: 0x8d694f, roughness: 0.92 }),
  treeTrunk: new THREE.MeshStandardMaterial({ color: 0x5d4330, roughness: 1 }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x245129, roughness: 1 }),
  lit: new THREE.MeshBasicMaterial({ color: 0xffefad }),
  neonPink: new THREE.MeshBasicMaterial({ color: 0xff4fd8 }),
  neonCyan: new THREE.MeshBasicMaterial({ color: 0x58efff }),
  sand: new THREE.MeshStandardMaterial({ color: 0xdcc28d, roughness: 1, side: THREE.DoubleSide }),
  skyScreen: skyScreenMaterial
};

const billionaireSeasonMaterials = {
  grass: materials.grass.clone(),
  grassDeep: materials.grassDeep.clone(),
  hedge: materials.hedge.clone(),
  treeTrunk: materials.treeTrunk.clone()
};

const seasonPalettes = {
  winter: {
    grass: 0xdfe6ea,
    grassDeep: 0xc7d0d8,
    hedge: 0xaeb8c2,
    treeTrunk: 0x66584b,
    terrain: 0xc5ccd3
  },
  spring: {
    grass: 0x74b85a,
    grassDeep: 0x4b8d3d,
    hedge: 0x3b7a31,
    treeTrunk: 0x624632,
    terrain: 0x6e8b58
  },
  summer: {
    grass: 0x4a8b3f,
    grassDeep: 0x2b6d31,
    hedge: 0x245129,
    treeTrunk: 0x5d4330,
    terrain: 0x58674b
  },
  autumn: {
    grass: 0x8a8a45,
    grassDeep: 0x8d5c2f,
    hedge: 0x74522b,
    treeTrunk: 0x5f4330,
    terrain: 0x7a6a4c
  }
};

for (const mat of [materials.asphalt, materials.lane]) {
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -4;
}

function setSeason(season) {
  currentSeason = season;
  document.querySelectorAll("[data-season]").forEach(b => b.classList.toggle("active", b.dataset.season === season));
  const palette = seasonPalettes[season] || seasonPalettes.summer;
  billionaireSeasonMaterials.grass.color.setHex(palette.grass);
  billionaireSeasonMaterials.grassDeep.color.setHex(palette.grassDeep);
  billionaireSeasonMaterials.hedge.color.setHex(palette.hedge);
  billionaireSeasonMaterials.treeTrunk.color.setHex(palette.treeTrunk);
}

const waterUniforms = {
  uTime: { value: 0 },
  uColorA: { value: new THREE.Color("#2b92c5") },
  uColorB: { value: new THREE.Color("#8ad7ff") },
};
const waterMaterial = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;
    void main(){
      vUv = uv;
      vec3 p = position;
      float wave = sin((p.x * 0.06) + uTime * 1.4) * 0.10 + cos((p.z * 0.09) + uTime * 1.8) * 0.08;
      p.y += wave;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    void main(){
      float ripple = sin(vUv.x*30.0 + uTime*2.0)*0.08 + cos(vUv.y*26.0 - uTime*1.6)*0.08;
      float fakeReflect = smoothstep(0.0, 0.9, 1.0 - vUv.y) * 0.28;
      vec3 col = mix(uColorA, uColorB, vUv.y + ripple + fakeReflect);
      col += vec3(.22,.26,.30) * fakeReflect;
      gl_FragColor = vec4(col, 0.80);
    }
  `
});

function addShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function buildGroundTerrain() {
  const ground = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry(32000, 32000, 1, 1),
    groundTerrainMaterial
  ), false, true);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  ground.matrixAutoUpdate = false; ground.updateMatrix();
  root.add(ground);
  registerEagleSharedVisual(ground);
  registerEagleEnvironmentVisual(ground);

  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x3a4659, roughness: 0.95, metalness: 0.05 });
  const skylineCount = 420;
  const skyline = new THREE.InstancedMesh(gBox, skylineMat, skylineCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < skylineCount; i++) {
    const a = (i / skylineCount) * Math.PI * 2;
    const r = 2400 + Math.random() * 1400;
    const h = 20 + Math.random() * 220;
    const w = 12 + Math.random() * 28;
    const d = 12 + Math.random() * 28;
    dummy.position.set(Math.cos(a) * r, h / 2 - 1.2, Math.sin(a) * r);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    skyline.setMatrixAt(i, dummy.matrix);
  }
  skyline.instanceMatrix.needsUpdate = true;
  root.add(skyline);
  registerEagleSharedVisual(skyline);
  registerEagleEnvironmentVisual(skyline);
}

function buildRunwayAirport() {
  const runwayCenterX = WORLD.baseRadius + 3050;
  const runway = addShadow(new THREE.Mesh(new THREE.BoxGeometry(70, 0.45, 4600), materials.asphalt), false, true);
  runway.position.set(runwayCenterX, -0.85, 0);
  runway.matrixAutoUpdate = false; runway.updateMatrix();
  root.add(runway);

  const dashCount = Math.floor(4400 / 24);
  const dashes = new THREE.InstancedMesh(gBox, materials.lane, dashCount);
  let idx = 0;
  const dummy = new THREE.Object3D();
  for (let z = -2200; z < 2200; z += 24) {
    dummy.position.set(runwayCenterX, -0.58, z);
    dummy.scale.set(8, 0.08, 1);
    dummy.updateMatrix();
    if(idx < dashCount) dashes.setMatrixAt(idx++, dummy.matrix);
  }
  root.add(dashes);

  const eCount = Math.floor(4400 / 60) * 2;
  const marks = new THREE.InstancedMesh(gBox, materials.lane, eCount);
  idx = 0;
  for (let z = -2200; z < 2200; z += 60) {
    dummy.position.set(runwayCenterX - 28, -0.57, z);
    dummy.scale.set(1.4, 0.08, 8);
    dummy.updateMatrix();
    if(idx < eCount) marks.setMatrixAt(idx++, dummy.matrix);
    
    dummy.position.set(runwayCenterX + 28, -0.57, z);
    dummy.updateMatrix();
    if(idx < eCount) marks.setMatrixAt(idx++, dummy.matrix);
  }
  root.add(marks);

  const taxiInnerX = WORLD.baseRadius + 10;
  const taxiWidth = 32;
  const taxiCurve = addShadow(new THREE.Mesh(new THREE.RingGeometry(taxiInnerX, taxiInnerX + taxiWidth, 96, 1, Math.PI / 2, Math.PI), materials.asphalt), false, true);
  taxiCurve.rotation.x = -Math.PI / 2;
  taxiCurve.position.y = -0.84;
  taxiCurve.matrixAutoUpdate = false; taxiCurve.updateMatrix();
  root.add(taxiCurve);

  const taxiCenterZ = taxiInnerX + taxiWidth / 2;
  const topConn = addShadow(new THREE.Mesh(new THREE.BoxGeometry(runwayCenterX, 0.4, taxiWidth), materials.asphalt), false, true);
  topConn.position.set(runwayCenterX / 2, -0.84, taxiCenterZ);
  topConn.matrixAutoUpdate = false; topConn.updateMatrix();
  root.add(topConn);
  
  const botConn = addShadow(new THREE.Mesh(new THREE.BoxGeometry(runwayCenterX, 0.4, taxiWidth), materials.asphalt), false, true);
  botConn.position.set(runwayCenterX / 2, -0.84, -taxiCenterZ);
  botConn.matrixAutoUpdate = false; botConn.updateMatrix();
  root.add(botConn);

  const terminal = new THREE.Group();
  const terminalBase = addShadow(new THREE.Mesh(gBox, materials.concrete));
  terminalBase.scale.set(180, 18, 56);
  terminalBase.position.set(runwayCenterX - 220, 9, -180);
  terminalBase.matrixAutoUpdate = false; terminalBase.updateMatrix();
  terminal.add(terminalBase);

  const terminalGlass = addShadow(new THREE.Mesh(gBox, materials.glass), false, false);
  terminalGlass.scale.set(150, 10, 50);
  terminalGlass.position.set(runwayCenterX - 220, 20, -180);
  terminalGlass.matrixAutoUpdate = false; terminalGlass.updateMatrix();
  terminal.add(terminalGlass);

  for (let i = 0; i < 5; i++) {
    const gate = addShadow(new THREE.Mesh(gBox, materials.concrete));
    gate.scale.set(32, 4, 8);
    gate.position.set(runwayCenterX - 160 + i * 36, 12, -138);
    gate.matrixAutoUpdate = false; gate.updateMatrix();
    terminal.add(gate);
  }
  root.add(terminal);

  function makeAircraft(scale = 1) {
    const g = new THREE.Group();
    const fuselage = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(2.8*scale, 18*scale, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.7 })));
    fuselage.rotation.z = Math.PI / 2;
    g.add(fuselage);

    const wing = addShadow(new THREE.Mesh(new THREE.BoxGeometry(22*scale, .5*scale, 4.2*scale), new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.75 })));
    g.add(wing);

    const tailWing = addShadow(new THREE.Mesh(new THREE.BoxGeometry(7*scale, .35*scale, 2.2*scale), new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.75 })));
    tailWing.position.set(-8*scale, 2.2*scale, 0);
    g.add(tailWing);

    const fin = addShadow(new THREE.Mesh(new THREE.BoxGeometry(.5*scale, 5*scale, 2.2*scale), new THREE.MeshStandardMaterial({ color: 0x2c5aa0, roughness: 0.72 })));
    fin.position.set(-9.2*scale, 4*scale, 0);
    g.add(fin);

    for (const x of [-5.5, 5.5]) {
      const engine = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(1.3*scale,1.3*scale,3.5*scale,16), new THREE.MeshStandardMaterial({ color: 0x7e8793, roughness: 0.55, metalness: 0.3 })));
      engine.rotation.z = Math.PI/2;
      engine.position.set(x*scale, -1.5*scale, 0);
      g.add(engine);
    }
    return g;
  }

  for (let i = 0; i < 3; i++) {
    const p = makeAircraft(1.3);
    p.position.set(runwayCenterX - 160 + i * 48, 2.8, -118);
    p.rotation.y = Math.PI / 2;
    root.add(p);
  }
  const taxiPlane = makeAircraft(1.4);
  taxiPlane.position.set(runwayCenterX - 40, 2.8, taxiCenterZ);
  taxiPlane.rotation.y = 0;
  root.add(taxiPlane);

  dynamic.taxiPlane = { mesh: taxiPlane, z: taxiCenterZ, runwayCenterX };
  registerEagleSharedVisual(runway);
  registerEagleSharedVisual(dashes);
  registerEagleSharedVisual(marks);
  registerEagleSharedVisual(taxiCurve);
  registerEagleSharedVisual(topConn);
  registerEagleSharedVisual(botConn);
  registerEagleSharedVisual(terminal);
  registerEagleSharedVisual(taxiPlane);
}

function buildCoreAndPlatforms() {
  const core = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(WORLD.coreRadius, WORLD.coreRadius, TOP_Y + 40, 64),
    materials.trunk
  ));
  core.position.y = (TOP_Y + 40) / 2;
  core.matrixAutoUpdate = false; core.updateMatrix();
  root.add(core);
  registerEagleSharedVisual(core);
  registerDroneHiddenVisual(core);

  // FIXED: Platform slabs are now completely flat on top.
  const points = [];
  points.push(new THREE.Vector2(WORLD.voidRadius, 0));
  points.push(new THREE.Vector2(WORLD.voidRadius, -WORLD.rootThickness));
  points.push(new THREE.Vector2(WORLD.apartmentRadius, -WORLD.rootThickness));
  
  for (let i = 0; i <= 80; i++) {
    const x = i / 80;
    const r = WORLD.apartmentRadius + x * (WORLD.baseRadius - WORLD.apartmentRadius);
    const thickness = EDGE_THICKNESS + (WORLD.rootThickness - EDGE_THICKNESS) * Math.pow(1 - x, 2);
    points.push(new THREE.Vector2(r, -thickness));
  }
  points.push(new THREE.Vector2(WORLD.baseRadius, 0));
  points.push(new THREE.Vector2(WORLD.voidRadius, 0));

  const slabGeo = new THREE.LatheGeometry(points, 128);

  for (let i = 0; i <= WORLD.platformCount; i++) {
    const y = getFloorY(i);
    if (i === WORLD.platformCount) {
      const topDisk = addShadow(new THREE.Mesh(
        new THREE.CylinderGeometry(WORLD.stadiumRadius, WORLD.stadiumRadius, 1.2, 96),
        materials.slab
      ), false, true);
      topDisk.position.y = y + 0.6;
      topDisk.matrixAutoUpdate = false; topDisk.updateMatrix();
      root.add(topDisk);
      registerEagleFloorVisual(i, topDisk);
      registerEagleHiddenVisual(topDisk);

      const stadiumSkyBottom = new THREE.Mesh(
        new THREE.CylinderGeometry(WORLD.stadiumRadius, WORLD.stadiumRadius, 1.2, 96),
        materials.skyScreen
      );
      stadiumSkyBottom.position.y = y + 0.6;
      stadiumSkyBottom.renderOrder = 3;
      stadiumSkyBottom.matrixAutoUpdate = false; stadiumSkyBottom.updateMatrix();
      root.add(stadiumSkyBottom);
      registerEagleFloorVisual(i, stadiumSkyBottom);
      registerEagleHiddenVisual(stadiumSkyBottom);

      const stadiumEdgeScreen = new THREE.Mesh(
        new THREE.CylinderGeometry(WORLD.stadiumRadius, WORLD.stadiumRadius, 1.2, 96, 1, true),
        materials.skyScreen
      );
      stadiumEdgeScreen.position.y = y + 0.6;
      stadiumEdgeScreen.renderOrder = 3;
      stadiumEdgeScreen.matrixAutoUpdate = false; stadiumEdgeScreen.updateMatrix();
      root.add(stadiumEdgeScreen);
      registerEagleFloorVisual(i, stadiumEdgeScreen);
      registerEagleHiddenVisual(stadiumEdgeScreen);
      continue;
    }
    const slab = addShadow(new THREE.Mesh(slabGeo, materials.slab), false, true);
    slab.position.y = y;
    slab.matrixAutoUpdate = false; slab.updateMatrix();
    root.add(slab);
    registerEagleFloorVisual(i, slab);
    registerEagleHiddenVisual(slab);

    if (i > 0) {
      const slabSky = new THREE.Mesh(slabGeo, materials.skyScreen);
      slabSky.position.y = y;
      slabSky.renderOrder = 3;
      slabSky.matrixAutoUpdate = false; slabSky.updateMatrix();
      root.add(slabSky);
      registerEagleFloorVisual(i, slabSky);
      registerEagleHiddenVisual(slabSky);
    }

    const edgeScreen = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD.baseRadius, WORLD.baseRadius, EDGE_THICKNESS + 0.08, 180, 1, true),
      materials.skyScreen
    );
    edgeScreen.position.y = y - EDGE_THICKNESS / 2 + 0.02;
    edgeScreen.renderOrder = 3;
    edgeScreen.matrixAutoUpdate = false; edgeScreen.updateMatrix();
    root.add(edgeScreen);
    registerEagleFloorVisual(i, edgeScreen);
    registerEagleHiddenVisual(edgeScreen);
  }
}

function buildHuggingApartmentRing() {
  const gapAngle = 0.16;
  const shape1 = new THREE.Shape();
  shape1.absarc(0, 0, WORLD.apartmentRadius, gapAngle, Math.PI - gapAngle, false);
  shape1.lineTo(WORLD.voidRadius * Math.cos(Math.PI - gapAngle), WORLD.voidRadius * Math.sin(Math.PI - gapAngle));
  shape1.absarc(0, 0, WORLD.voidRadius, Math.PI - gapAngle, gapAngle, true);
  shape1.lineTo(WORLD.apartmentRadius * Math.cos(gapAngle), WORLD.apartmentRadius * Math.sin(gapAngle));

  const shape2 = new THREE.Shape();
  shape2.absarc(0, 0, WORLD.apartmentRadius, Math.PI + gapAngle, Math.PI * 2 - gapAngle, false);
  shape2.lineTo(WORLD.voidRadius * Math.cos(Math.PI * 2 - gapAngle), WORLD.voidRadius * Math.sin(Math.PI * 2 - gapAngle));
  shape2.absarc(0, 0, WORLD.voidRadius, Math.PI * 2 - gapAngle, Math.PI + gapAngle, true);
  shape2.lineTo(WORLD.apartmentRadius * Math.cos(Math.PI + gapAngle), WORLD.apartmentRadius * Math.sin(Math.PI + gapAngle));

  const facadeTex = makeCanvasTexture((ctx,s)=>{
    ctx.fillStyle = "#77a7c6";
    ctx.fillRect(0,0,s,s);
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, "#dff3ff");
    grad.addColorStop(0.2, "#9fd3f2");
    grad.addColorStop(0.48, "#4d88b4");
    grad.addColorStop(0.74, "#6aa7d0");
    grad.addColorStop(1, "#d4ebf8");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,s,s);

    ctx.fillStyle = "rgba(235,244,250,0.96)";
    for(let x=0;x<s;x+=16) ctx.fillRect(x,0,2,s);

    ctx.fillStyle = "rgba(230,239,247,0.92)";
    for(let y=0;y<s;y+=18) ctx.fillRect(0,y,s,2);

    ctx.fillStyle = "rgba(26,54,80,0.28)";
    for(let x=2;x<s;x+=16) ctx.fillRect(x,2,12,s-4);

    ctx.fillStyle = "rgba(205,235,252,0.78)";
    for(let y=3;y<s;y+=18){
      for(let x=3;x<s;x+=16){
        ctx.fillRect(x,y,11,11);
      }
    }

    ctx.fillStyle = "rgba(255,240,174,0.34)";
    for(let y=3;y<s;y+=54){
      for(let x=3;x<s;x+=48){
        ctx.fillRect(x,y,11,11);
      }
    }
  }, 1024);
  facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
  facadeTex.repeat.set(20, 12);

  const condoMat = new THREE.MeshStandardMaterial({
    color: 0xe1f2ff,
    map: facadeTex,
    roughness: 0.08,
    metalness: 0.34,
    envMap: skyCaptureTarget.texture,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide
  });

  const balconyMat = new THREE.MeshStandardMaterial({ color: 0xd9e3ee, roughness: 0.5, metalness: 0.25 });
  const apartmentArcSpans = [
    [gapAngle, Math.PI - gapAngle],
    [Math.PI + gapAngle, Math.PI * 2 - gapAngle]
  ];

  for (let i = 1; i < WORLD.platformCount; i++) {
    const y = getFloorY(i);
    const height = getFloorY(i+1) - y - WORLD.rootThickness;

    const geo1 = new THREE.ExtrudeGeometry(shape1, { depth: height, curveSegments: 64, bevelEnabled: false });
    geo1.rotateX(-Math.PI / 2);
    const geo2 = new THREE.ExtrudeGeometry(shape2, { depth: height, curveSegments: 64, bevelEnabled: false });
    geo2.rotateX(-Math.PI / 2);

    const condo1 = addShadow(new THREE.Mesh(geo1, condoMat), true, false);
    condo1.position.y = y;
    condo1.matrixAutoUpdate = false; condo1.updateMatrix();
    const condo2 = addShadow(new THREE.Mesh(geo2, condoMat), true, false);
    condo2.position.y = y;
    condo2.matrixAutoUpdate = false; condo2.updateMatrix();
    root.add(condo1, condo2);
    registerEagleFloorVisual(i, condo1);
    registerEagleFloorVisual(i, condo2);
    registerEagleHiddenVisual(condo1);
    registerEagleHiddenVisual(condo2);

    const windowRows = Math.max(3, Math.floor(height / 2.55));
    const outerCount = 42;
    const innerCount = 30;
    const totalWindowSlots = apartmentArcSpans.length * windowRows * (outerCount + innerCount);
    const litWindows = new THREE.InstancedMesh(gWin, materials.lit, totalWindowSlots);
    const darkWindows = new THREE.InstancedMesh(gWin, materials.windowGlass, totalWindowSlots);
    let litIdx = 0;
    let darkIdx = 0;
    const dummy = new THREE.Object3D();

    apartmentArcSpans.forEach(([start, end]) => {
      const outerStep = (end - start) / outerCount;
      const innerStep = (end - start) / innerCount;

      for (let row = 0; row < windowRows; row++) {
        const wy = y + 1.6 + row * ((height - 3.2) / Math.max(1, windowRows - 1));

        for (let col = 0; col < outerCount; col++) {
          const theta = start + outerStep * (col + 0.5);
          dummy.position.set((WORLD.apartmentRadius + 0.2) * Math.cos(theta), wy, (WORLD.apartmentRadius + 0.2) * Math.sin(theta));
          dummy.rotation.set(0, -theta + Math.PI / 2, 0);
          dummy.scale.set(0.94, 1.28, 1);
          dummy.updateMatrix();
          if (Math.random() > 0.66) litWindows.setMatrixAt(litIdx++, dummy.matrix);
          else darkWindows.setMatrixAt(darkIdx++, dummy.matrix);
        }

        for (let col = 0; col < innerCount; col++) {
          const theta = start + innerStep * (col + 0.5);
          dummy.position.set((WORLD.voidRadius - 0.2) * Math.cos(theta), wy, (WORLD.voidRadius - 0.2) * Math.sin(theta));
          dummy.rotation.set(0, -theta - Math.PI / 2, 0);
          dummy.scale.set(0.88, 1.14, 1);
          dummy.updateMatrix();
          if (Math.random() > 0.72) litWindows.setMatrixAt(litIdx++, dummy.matrix);
          else darkWindows.setMatrixAt(darkIdx++, dummy.matrix);
        }
      }
    });

    litWindows.count = litIdx;
    darkWindows.count = darkIdx;
    litWindows.instanceMatrix.needsUpdate = true;
    darkWindows.instanceMatrix.needsUpdate = true;
    root.add(litWindows, darkWindows);
    registerEagleFloorVisual(i, litWindows);
    registerEagleFloorVisual(i, darkWindows);
    registerEagleHiddenVisual(litWindows);
    registerEagleHiddenVisual(darkWindows);

    const balconyLevels = Math.max(2, Math.floor(height / 3.8));
    for (let b = 1; b <= balconyLevels; b++) {
      const by = y + (b / (balconyLevels + 1)) * height;
      const ring1 = new THREE.Mesh(new THREE.RingGeometry(WORLD.apartmentRadius - 1.2, WORLD.apartmentRadius + 0.9, 128, 1, gapAngle, Math.PI - gapAngle * 2), balconyMat);
      ring1.rotation.x = -Math.PI / 2;
      ring1.position.y = by;
      ring1.matrixAutoUpdate = false; ring1.updateMatrix();
      root.add(ring1);
      registerEagleFloorVisual(i, ring1);
      registerEagleHiddenVisual(ring1);

      const ring2 = new THREE.Mesh(new THREE.RingGeometry(WORLD.apartmentRadius - 1.2, WORLD.apartmentRadius + 0.9, 128, 1, Math.PI + gapAngle, Math.PI - gapAngle * 2), balconyMat);
      ring2.rotation.x = -Math.PI / 2;
      ring2.position.y = by;
      ring2.matrixAutoUpdate = false; ring2.updateMatrix();
      root.add(ring2);
      registerEagleFloorVisual(i, ring2);
      registerEagleHiddenVisual(ring2);
    }
  }
}

function buildHelixRamps() {
  const turnsPerFloor = 2;
  const maxTheta = WORLD.platformCount * turnsPerFloor * 2 * Math.PI;
  const rampCenterR = WORLD.coreRadius + WORLD.rampWidth / 2;

  const createRamp = (offset, color) => {
    const segments = 1800;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = t * maxTheta + offset;
      const floorFloat = t * WORLD.platformCount;
      const cf = Math.floor(floorFloat);
      const nf = Math.min(cf + 1, WORLD.platformCount);
      const fraction = floorFloat - cf;
      const y = getFloorY(cf) + fraction * (getFloorY(nf) - getFloorY(cf));
      const inR = rampCenterR - WORLD.rampWidth / 2;
      const outR = rampCenterR + WORLD.rampWidth / 2;
      positions.push(inR * Math.cos(theta), y, inR * Math.sin(theta));
      positions.push(outR * Math.cos(theta), y, outR * Math.sin(theta));
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      indices.push(b, b+1, b+2, b+1, b+3, b+2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const ramp = addShadow(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2e3440, roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide
    })));
    ramp.matrixAutoUpdate = false; ramp.updateMatrix();
    root.add(ramp);
    registerEagleSharedVisual(ramp);
    registerDroneHiddenVisual(ramp);

    const edgePtsA = [];
    const edgePtsB = [];
    for (let i = 0; i <= segments; i += 8) {
      const t = i / segments;
      const theta = t * maxTheta + offset;
      const floorFloat = t * WORLD.platformCount;
      const cf = Math.floor(floorFloat);
      const nf = Math.min(cf + 1, WORLD.platformCount);
      const fraction = floorFloat - cf;
      const y = getFloorY(cf) + fraction * (getFloorY(nf) - getFloorY(cf)) + 0.4;
      const inR = rampCenterR - WORLD.rampWidth / 2;
      const outR = rampCenterR + WORLD.rampWidth / 2;
      edgePtsA.push(new THREE.Vector3(inR * Math.cos(theta), y, inR * Math.sin(theta)));
      edgePtsB.push(new THREE.Vector3(outR * Math.cos(theta), y, outR * Math.sin(theta)));
    }
    const lineA = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePtsA), new THREE.LineBasicMaterial({ color, transparent:true, opacity:.95 }));
    const lineB = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePtsB), new THREE.LineBasicMaterial({ color, transparent:true, opacity:.95 }));
    lineA.matrixAutoUpdate = false; lineA.updateMatrix();
    lineB.matrixAutoUpdate = false; lineB.updateMatrix();
    root.add(lineA, lineB);
    registerDroneHiddenVisual(lineA);
    registerDroneHiddenVisual(lineB);
  };

  createRamp(0, 0x5fe8ff);
  createRamp(Math.PI, 0xff4adf);
}

function createTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = addShadow(new THREE.Mesh(treeTrunkGeo, materials.treeTrunk));
  const crown = addShadow(new THREE.Mesh(treeCrownGeo, materials.grassDeep));
  trunk.scale.setScalar(scale);
  crown.scale.setScalar(scale);
  trunk.matrixAutoUpdate = false; trunk.updateMatrix();
  crown.matrixAutoUpdate = false; crown.updateMatrix();
  g.add(trunk, crown);
  return g;
}

function plantSceneScatterInstanced(parent, y, innerR, outerR, count, sizeRange = [0.8, 1.3]) {
  const trunks = new THREE.InstancedMesh(treeTrunkGeo, materials.treeTrunk, count);
  const crowns = new THREE.InstancedMesh(treeCrownGeo, materials.grassDeep, count);
  trunks.castShadow = true; crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    const s = THREE.MathUtils.lerp(sizeRange[0], sizeRange[1], Math.random());
    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0); 
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
  }
  trunks.matrixAutoUpdate = false; crowns.matrixAutoUpdate = false;
  parent.add(trunks, crowns);
}

function plantSceneScatterInstancedWithMaterials(parent, y, innerR, outerR, count, trunkMaterial, crownMaterial, sizeRange = [0.8, 1.3]) {
  const trunks = new THREE.InstancedMesh(treeTrunkGeo, trunkMaterial, count);
  const crowns = new THREE.InstancedMesh(treeCrownGeo, crownMaterial, count);
  trunks.castShadow = true;
  crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    const s = THREE.MathUtils.lerp(sizeRange[0], sizeRange[1], Math.random());
    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
  }
  trunks.matrixAutoUpdate = false;
  crowns.matrixAutoUpdate = false;
  parent.add(trunks, crowns);
}

function createBillionaireWeatherPoints(count, palette, size, areaTop = 44) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const state = [];

  for (let i = 0; i < count; i++) {
    const radius = 96 + Math.random() * 88;
    const angle = Math.random() * Math.PI * 2;
    const y = 4 + Math.random() * areaTop;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    color.setHex(palette[Math.floor(Math.random() * palette.length)]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    state.push({
      radius,
      angle,
      y,
      speedY: 4 + Math.random() * 5,
      drift: (Math.random() - 0.5) * 0.8,
      spin: (Math.random() - 0.5) * 0.6
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  points.position.y = 2;
  return { points, state, positions };
}

function updateBillionaireWeather(dt) {
  const resetParticle = (particle, i, top) => {
    particle.angle = Math.random() * Math.PI * 2;
    particle.radius = 96 + Math.random() * 88;
    particle.y = top;
    particle.drift = (Math.random() - 0.5) * 0.8;
    particle.spin = (Math.random() - 0.5) * 0.6;
  };

  const updateSystem = (system, config) => {
    if (!system) return;
    system.points.visible = config.visible;
    if (!config.visible) return;

    for (let i = 0; i < system.state.length; i++) {
      const particle = system.state[i];
      particle.y -= particle.speedY * dt * config.fallMultiplier;
      particle.angle += (particle.drift * dt * config.driftMultiplier) + (particle.spin * dt * config.spinMultiplier);
      if (particle.y < 0) resetParticle(particle, i, config.top);

      system.positions[i * 3] = Math.cos(particle.angle) * particle.radius;
      system.positions[i * 3 + 1] = particle.y;
      system.positions[i * 3 + 2] = Math.sin(particle.angle) * particle.radius;
    }
    system.points.geometry.attributes.position.needsUpdate = true;
  };

  updateSystem(billionaireWeather.snow, {
    visible: currentSeason === "winter",
    top: 42,
    fallMultiplier: 0.8,
    driftMultiplier: 1.8,
    spinMultiplier: 1.2
  });
  updateSystem(billionaireWeather.rain, {
    visible: currentSeason === "summer",
    top: 46,
    fallMultiplier: 5.5,
    driftMultiplier: 0.15,
    spinMultiplier: 0
  });
  updateSystem(billionaireWeather.leaves, {
    visible: currentSeason === "autumn",
    top: 34,
    fallMultiplier: 1.5,
    driftMultiplier: 2.6,
    spinMultiplier: 2.4
  });
}

function addStreetLightsInstanced(parent, y, radius, count) {
  const posts = new THREE.InstancedMesh(gCyl, new THREE.MeshStandardMaterial({ color: 0x6d7786, roughness: 0.4, metalness: 0.78 }), count);
  const lamps = new THREE.InstancedMesh(gSphere, materials.lit, count);
  const dummy = new THREE.Object3D();
  
  for(let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    dummy.position.set(radius * Math.cos(a), y + 2.25, radius * Math.sin(a));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.11, 4.5, 0.11);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);

    dummy.position.set(radius * Math.cos(a), y + 4.6, radius * Math.sin(a));
    dummy.scale.set(0.24, 0.24, 0.24);
    dummy.updateMatrix();
    lamps.setMatrixAt(i, dummy.matrix);
  }
  posts.matrixAutoUpdate = false; lamps.matrixAutoUpdate = false;
  parent.add(posts, lamps);
}

function addRoadRing(parent, y, r, width = 7, laneWidth = 0.14) {
  const road = createSurfaceRing(r - width/2, r + width/2, y, materials.asphalt, 0.085);
  parent.add(road);
  if (width >= 6) {
    const lane = createSurfaceRing(r - laneWidth / 2, r + laneWidth / 2, y, materials.lane, 0.11);
    parent.add(lane);
  }
}

function addRadialRoad(parent, y, angle, innerR, outerR, width = 5.6) {
  const segments = 16;
  const pos = [];
  const indices = [];
  const hw = width / 2;
  for (let i = 0; i <= segments; i++) {
      const r = innerR + (i/segments)*(outerR - innerR);
      pos.push(r, 0.09, -hw);
      pos.push(r, 0.09, hw);
  }
  for (let i = 0; i < segments; i++) {
      const a = i * 2;
      indices.push(a, a+1, a+2, a+1, a+3, a+2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const road = addShadow(new THREE.Mesh(geo, materials.asphalt), false, true);
  road.position.y = y;
  road.rotation.y = -angle;
  road.matrixAutoUpdate = false; road.updateMatrix();
  parent.add(road);

  const lanePos = [];
  for (let i = 0; i <= segments; i++) {
      const r = innerR + (i/segments)*(outerR - innerR);
      lanePos.push(r, 0.14, -0.07);
      lanePos.push(r, 0.14, 0.07);
  }
  const laneGeo = new THREE.BufferGeometry();
  laneGeo.setAttribute('position', new THREE.Float32BufferAttribute(lanePos, 3));
  laneGeo.setIndex(indices);
  laneGeo.computeVertexNormals();
  const lane = new THREE.Mesh(laneGeo, materials.lane);
  lane.position.y = y;
  lane.rotation.y = -angle;
  lane.matrixAutoUpdate = false; lane.updateMatrix();
  parent.add(lane);
}

function createBuilding(kind = "residential", h = 12, w = 8, d = 8) {
  const g = new THREE.Group();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const facadePools = {
    residential: [materials.whiteFacade, materials.warmFacade, materials.stoneFacade, materials.sandFacade, materials.sageFacade],
    warm: [materials.warmFacade, materials.sandFacade, materials.whiteFacade],
    stone: [materials.stoneFacade, materials.sageFacade, materials.whiteFacade],
    villa: [materials.whiteFacade, materials.warmFacade, materials.sandFacade, materials.sageFacade],
    glass: [materials.glass]
  };
  const roofPools = {
    residential: [materials.roofSlate, materials.roofTerracotta, materials.roofCharcoal],
    warm: [materials.roofTerracotta, materials.roofCopper, materials.roofSlate],
    stone: [materials.roofSlate, materials.roofCharcoal],
    villa: [materials.roofTerracotta, materials.roofSlate, materials.roofCopper, materials.roofCharcoal],
    glass: [materials.concrete]
  };
  const facadeMat = pick(facadePools[kind] || facadePools.residential);
  const roofMat = pick(roofPools[kind] || roofPools.residential);

  const body = addShadow(new THREE.Mesh(gRoundedBox, facadeMat));
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  body.matrixAutoUpdate = false; body.updateMatrix();
  g.add(body);

  const winMat = Math.random() > .4 ? materials.lit : materials.windowGlass;
  const panelDepth = d / 2 + 0.03;
  const rows = Math.max(1, Math.floor(h / 3));
  const cols = Math.max(1, Math.floor(w / 3));
  const hasBack = h > 7;
  const totalWins = rows * cols * (hasBack ? 2 : 1);

  if (totalWins > 0 && kind !== "glass") {
    const wins = new THREE.InstancedMesh(gWin, winMat, totalWins);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const wy = 1.3 + r * ((h - 2.6) / Math.max(1, rows - 1));
      for (let c = 0; c < cols; c++) {
        const wx = -w/2 + 0.8 + c * ((w - 1.6) / Math.max(1, cols - 1));
        dummy.position.set(wx, wy, panelDepth);
        dummy.updateMatrix();
        wins.setMatrixAt(idx++, dummy.matrix);
        if (hasBack) {
          dummy.position.set(wx, wy, -panelDepth);
          dummy.updateMatrix();
          wins.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    wins.matrixAutoUpdate = false;
    g.add(wins);
  }

  if (h >= 9 && kind !== "glass") {
    const balconyCount = Math.max(1, Math.floor(h / 5));
    const bSlabs = new THREE.InstancedMesh(gBox, materials.concrete, balconyCount);
    const bRails = new THREE.InstancedMesh(gBox, materials.windowGlass, balconyCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < balconyCount; i++) {
      const by = 3 + i * ((h - 4) / balconyCount);
      dummy.position.set(0, by, d/2 + 0.62);
      dummy.scale.set(w * 0.82, 0.12, 1.4);
      dummy.updateMatrix();
      bSlabs.setMatrixAt(i, dummy.matrix);

      dummy.position.set(0, by + 0.38, d/2 + 1.25);
      dummy.scale.set(w * 0.82, 0.65, 0.05);
      dummy.updateMatrix();
      bRails.setMatrixAt(i, dummy.matrix);
    }
    bSlabs.matrixAutoUpdate = false; bRails.matrixAutoUpdate = false;
    g.add(bSlabs, bRails);
  }

  if (kind === "villa") {
    const upper = addShadow(new THREE.Mesh(gBox, materials.windowGlass), false, false);
    upper.scale.set(w * .62, h * .45, d * .52);
    upper.position.set(0, h + (h * .45)/2 - 0.2, 0);
    upper.matrixAutoUpdate = false; upper.updateMatrix();
    g.add(upper);

    const terrace = new THREE.Mesh(gBox, materials.concrete);
    terrace.scale.set(w*.75, .16, d*.56);
    terrace.position.set(0, h + 0.1, 0);
    terrace.matrixAutoUpdate = false; terrace.updateMatrix();
    g.add(terrace);
  } else if (kind !== "glass") {
    if (Math.random() > 0.42) {
      const roof = addShadow(new THREE.Mesh(gCone, roofMat));
      roof.scale.set(Math.max(w, d) * 0.7, Math.max(1.8, h * 0.18), Math.max(w, d) * 0.7);
      roof.position.y = h;
      roof.matrixAutoUpdate = false; roof.updateMatrix();
      g.add(roof);
    } else {
      const flatRoof = new THREE.Mesh(gBox, roofMat);
      flatRoof.scale.set(w * 1.02, 0.24, d * 1.02);
      flatRoof.position.y = h + 0.1;
      flatRoof.matrixAutoUpdate = false; flatRoof.updateMatrix();
      g.add(flatRoof);

      const parapet = new THREE.Mesh(gBox, materials.concrete);
      parapet.scale.set(w * 0.96, 0.32, d * 0.96);
      parapet.position.y = h + 0.34;
      parapet.matrixAutoUpdate = false; parapet.updateMatrix();
      g.add(parapet);
    }
  }

  return g;
}

function createArcBuilding(kind = "glass", h = 12, innerR = 96, outerR = 116, thetaStart = 0, thetaLength = Math.PI / 4) {
  const g = new THREE.Group();
  let facadeMat = materials.whiteFacade;
  let roofMat = materials.roofSlate;

  if (kind === "warm") { facadeMat = materials.warmFacade; roofMat = materials.roofTerracotta; }
  if (kind === "stone") { facadeMat = materials.stoneFacade; roofMat = materials.roofSlate; }
  if (kind === "glass") { facadeMat = materials.glass; roofMat = materials.concrete; }

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, thetaStart, thetaStart + thetaLength, false);
  shape.lineTo(innerR * Math.cos(thetaStart + thetaLength), innerR * Math.sin(thetaStart + thetaLength));
  shape.absarc(0, 0, innerR, thetaStart + thetaLength, thetaStart, true);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 36 });
  const body = addShadow(new THREE.Mesh(bodyGeo, facadeMat));
  body.rotation.x = -Math.PI / 2;
  body.matrixAutoUpdate = false; body.updateMatrix();
  g.add(body);

  const roofShape = new THREE.Shape();
  roofShape.absarc(0, 0, outerR - 1.2, thetaStart + 0.02, thetaStart + thetaLength - 0.02, false);
  roofShape.lineTo((innerR + 1.2) * Math.cos(thetaStart + thetaLength - 0.02), (innerR + 1.2) * Math.sin(thetaStart + thetaLength - 0.02));
  roofShape.absarc(0, 0, innerR + 1.2, thetaStart + thetaLength - 0.02, thetaStart + 0.02, true);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.32, bevelEnabled: false, curveSegments: 24 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = h;
  roof.matrixAutoUpdate = false; roof.updateMatrix();
  g.add(roof);

  return g;
}

function addCarsOnFloor(parent, y, roadRadius, count, colorPalette) {
  const carGeo = new THREE.BoxGeometry(2.2, 0.85, 1.1);
  const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.2 });
  const cars = new THREE.InstancedMesh(carGeo, carMat, count);
  cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(cars);

  const state = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    state.push({ angle, speed: 0.15 + Math.random() * 0.2, radius: roadRadius + (Math.random() > 0.5 ? 0.7 : -0.7) });
    color.set(colorPalette[Math.floor(Math.random() * colorPalette.length)]);
    cars.setColorAt(i, color);
    dummy.position.set(Math.cos(angle)*roadRadius, y + 0.55, Math.sin(angle)*roadRadius);
    dummy.rotation.y = -angle + Math.PI/2;
    dummy.updateMatrix();
    cars.setMatrixAt(i, dummy.matrix);
  }
  cars.instanceColor.needsUpdate = true;
  dynamic.cars.push({ mesh: cars, state, y });
}

function addPeopleOnFloor(parent, y, ringR, count) {
  const geo = new THREE.CapsuleGeometry(0.18, 0.72, 3, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8c7b2, roughness: 1 });
  const people = new THREE.InstancedMesh(geo, mat, count);
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(people);

  const state = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0x2d6cdf,0xd9465f,0x1f8a5c,0xe59e2e,0x5b6170,0xffffff];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const localR = ringR + (Math.random() - 0.5) * 5;
    state.push({ angle, speed: 0.03 + Math.random() * 0.05, radius: localR });
    col.setHex(palette[Math.floor(Math.random()*palette.length)]);
    people.setColorAt(i, col);
    dummy.position.set(Math.cos(angle)*localR, y + 0.45, Math.sin(angle)*localR);
    dummy.rotation.y = -angle + Math.PI/2;
    dummy.updateMatrix();
    people.setMatrixAt(i, dummy.matrix);
  }
  people.instanceColor.needsUpdate = true;
  dynamic.people.push({ mesh: people, state, y });
}

function getPlotEnvelope(floor, ringR, spacing) {
  const tangentialPlot = Math.max(5.5, spacing - 4.8);
  const radialPlot = ringR < 100 ? 9 : ringR < 120 ? 10 : ringR < 138 ? 11 : ringR < 154 ? 12 : 13;

  if (floor <= 2) return { kindPool: ["glass", "stone"], h: [10, 18], w: [5.5, Math.min(7.2, tangentialPlot)], d: [5.5, 7.2] };
  if (floor <= 5) return { kindPool: ["warm", "stone"], h: [4.5, 7], w: [6.2, Math.min(8.8, tangentialPlot)], d: [7, Math.min(9.5, radialPlot)] };
  if (floor === 6) return { kindPool: ["glass", "warm"], h: [9, 15], w: [7.5, Math.min(10.5, tangentialPlot)], d: [7.5, Math.min(10.5, radialPlot)] };
  if (floor <= 8) return { kindPool: ["villa"], h: [4.6, 6.4], w: [8.2, Math.min(10.5, tangentialPlot)], d: [8.8, Math.min(11.5, radialPlot)] };
  if (floor === 9) return { kindPool: ["white", "warm"], h: [7.5, 10.5], w: [8.5, Math.min(11.5, tangentialPlot)], d: [8, Math.min(10.5, radialPlot)] };
  if (floor === 10 || floor === 11) return { kindPool: ["villa"], h: [6.2, 8.8], w: [9.5, Math.min(12, tangentialPlot)], d: [9.5, Math.min(12, radialPlot)] };
  if (floor === 12) return { kindPool: ["glass"], h: [16, 24], w: [6.5, Math.min(9.2, tangentialPlot)], d: [6.5, Math.min(9.2, radialPlot)] };
  return { kindPool: ["glass"], h: [10, 16], w: [6.8, Math.min(9.4, tangentialPlot)], d: [6.8, Math.min(9.4, radialPlot)] };
}

function randomInRange([min, max]) {
  return min + Math.random() * Math.max(0, max - min);
}

function placePolarObject(parent, object, y, radius, angle, yawOffset = Math.PI / 2) {
  object.position.set(Math.cos(angle) * radius, y + 0.1, Math.sin(angle) * radius);
  object.rotation.y = -angle + yawOffset;
  parent.add(object);
}

function angleBlocked(angle, ringR, blockerAngles, clearance) {
  return blockerAngles.some(blocker => {
    let d = Math.abs(angle - blocker);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d * ringR < clearance;
  });
}

function ringBlocked(radius, depth, roadRadii, roadWidth, extraClearance = 2) {
  const halfDepth = depth / 2 + extraClearance;
  return roadRadii.some(roadR => Math.abs(radius - roadR) < roadWidth / 2 + halfDepth);
}

function plotBlocked(angle, ringR, width, depth, blockerAngles, roadWidth, extraClearance = 4) {
  const tangentialHalf = width / 2 + extraClearance;
  return angleBlocked(angle, ringR, blockerAngles, roadWidth / 2 + tangentialHalf);
}

function angularDistance(a, b) {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function boundaryBlocked(radius, depth, innerBoundary, outerBoundary, extraClearance = 4) {
  return radius - depth / 2 < innerBoundary + extraClearance || radius + depth / 2 > outerBoundary - extraClearance;
}

function plotOverlapsPlaced(angle, ringR, width, depth, plots, tangentialClearance = 2.4, radialClearance = 2.8) {
  return plots.some(plot => {
    const meanR = (ringR + plot.ringR) * 0.5;
    const tangentialDistance = angularDistance(angle, plot.angle) * meanR;
    const radialDistance = Math.abs(ringR - plot.ringR);
    return tangentialDistance < (width + plot.width) / 2 + tangentialClearance &&
      radialDistance < (depth + plot.depth) / 2 + radialClearance;
  });
}

function plotEnvelopeBlocked(angle, ringR, plotWidth, plotDepth, {
  blockerAngles = [],
  radialRoadWidth = 6,
  radialClearance = 6,
  roadRadii = [],
  ringRoadWidth = 8,
  ringClearance = 3,
  innerBoundary = WORLD.apartmentRadius + 8,
  outerBoundary = WORLD.baseRadius - 7,
  boundaryClearance = 4.5,
  placedPlots = [],
  ignoreBlockers = false,
  ignoreRoads = false,
  ignoreBoundaries = false,
  ignoreNeighbors = false,
  neighborTangentialClearance = 2.4,
  neighborRadialClearance = 2.8
}) {
  if (!ignoreBlockers && plotBlocked(angle, ringR, plotWidth, plotDepth, blockerAngles, radialRoadWidth, radialClearance)) return true;
  if (!ignoreRoads && ringBlocked(ringR, plotDepth, roadRadii, ringRoadWidth, ringClearance)) return true;
  if (!ignoreBoundaries && boundaryBlocked(ringR, plotDepth, innerBoundary, outerBoundary, boundaryClearance)) return true;
  if (!ignoreNeighbors && placedPlots && plotOverlapsPlaced(angle, ringR, plotWidth, plotDepth, placedPlots, neighborTangentialClearance, neighborRadialClearance)) return true;
  return false;
}

function populateRingBuildings(parent, y, {
  ringR,
  targetCount,
  widthRange,
  depthRange,
  heightRange,
  kindPicker,
  roadRadii = [],
  ringRoadWidth = 8,
  blockerAngles = [],
  radialRoadWidth = 6,
  ringClearance = 4.8,
  radialClearance = 7.5,
  minGapPad = 0.06,
  attemptMultiplier = 22,
  angleJitter = 0.7,
  buildObject,
  placedPlots = null,
  plotWidthPad = 4.5,
  plotDepthPad = 5.5,
  ignoreBlockers = false,
  ignoreRoads = false,
  ignoreBoundaries = false,
  ignoreNeighbors = false,
  innerBoundary = WORLD.apartmentRadius + 8,
  outerBoundary = WORLD.baseRadius - 7,
  boundaryClearance = 4.5,
  neighborTangentialClearance = 2.4,
  neighborRadialClearance = 2.8
}) {
  const attempts = Math.max(targetCount * attemptMultiplier, targetCount + 24);
  const placedAngles = [];
  const phase = Math.random() * Math.PI * 2;
  let placed = 0;
  const tryPlace = (a, w, d, h, attempt) => {
    const plotWidth = w + plotWidthPad;
    const plotDepth = d + plotDepthPad;

    if (plotEnvelopeBlocked(a, ringR, plotWidth, plotDepth, {
      blockerAngles,
      radialRoadWidth,
      radialClearance,
      roadRadii,
      ringRoadWidth,
      ringClearance,
      innerBoundary,
      outerBoundary,
      boundaryClearance,
      placedPlots,
      ignoreBlockers,
      ignoreRoads,
      ignoreBoundaries,
      ignoreNeighbors,
      neighborTangentialClearance,
      neighborRadialClearance
    })) return false;

    const minGap = Math.max(plotWidth, plotDepth) / ringR + minGapPad;
    if (placedAngles.some(existing => angularDistance(a, existing) < minGap)) return false;

    const kind = typeof kindPicker === "function" ? kindPicker({ index: placed, attempt, angle: a, width: w, depth: d, height: h }) : kindPicker;
    const obj = buildObject ? buildObject({ kind, h, w, d, angle: a, ringR, index: placed, attempt }) : createBuilding(kind, h, w, d);
    placePolarObject(parent, obj, y, ringR, a);
    placedAngles.push(a);
    if (placedPlots) placedPlots.push({ angle: a, ringR, width: plotWidth, depth: plotDepth });
    placed++;
    return true;
  };

  for (let i = 0; i < attempts && placed < targetCount; i++) {
    const baseAngle = phase + (i / attempts) * Math.PI * 2;
    const a = baseAngle + (Math.random() - 0.5) * ((Math.PI * 2 / attempts) * angleJitter);
    const h = randomInRange(heightRange);
    const w = randomInRange(widthRange);
    const d = randomInRange(depthRange);
    tryPlace(a, w, d, h, i);
  }

  if (placed < targetCount) {
    const backfillAttempts = Math.max(targetCount * 6, 80);
    for (let i = 0; i < backfillAttempts && placed < targetCount; i++) {
      const a = phase + (i / backfillAttempts) * Math.PI * 2 + (Math.random() - 0.5) * ((Math.PI * 2 / backfillAttempts) * 1.15);
      const h = randomInRange(heightRange);
      const w = randomInRange(widthRange) * 0.84;
      const d = randomInRange(depthRange) * 0.84;
      tryPlace(a, w, d, h, attempts + i);
    }
  }

  return placed;
}

function buildEducationFloorLayout(parent, y) {
  const campusGreen = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.grassDeep, 0.05);
  parent.add(campusGreen);
  const plotRegistry = [];

  addRoadRing(parent, y, 114, 7.5);
  addRoadRing(parent, y, 154, 7.5);
  radialAnglesForCampus().forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 12, WORLD.baseRadius - 10, 6.4));

  const sportsField = new THREE.Mesh(gBox, materials.grass);
  sportsField.scale.set(62, 0.1, 30);
  sportsField.position.set(0, y + 0.08, 120);
  sportsField.matrixAutoUpdate = false; sportsField.updateMatrix();
  parent.add(sportsField);

  const track = new THREE.Mesh(new THREE.RingGeometry(26, 31, 64), materials.lane);
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, y + 0.1, 120);
  track.matrixAutoUpdate = false; track.updateMatrix();
  parent.add(track);

  const campusBuildings = [
    { label: "Primary", kind: "warm", h: 8, w: 18, d: 14, r: 88, a: -1.15 },
    { label: "Secondary", kind: "white", h: 10, w: 20, d: 16, r: 88, a: -0.58 },
    { label: "Library", kind: "stone", h: 12, w: 22, d: 16, r: 62, a: -0.05 },
    { label: "Research", kind: "glass", h: 22, w: 18, d: 18, r: 104, a: 0.58 },
    { label: "Skills", kind: "warm", h: 9, w: 18, d: 14, r: 104, a: 1.06 },
    { label: "University", kind: "glass", h: 26, w: 30, d: 20, r: 76, a: 2.1 },
    { label: "Sports", kind: "white", h: 12, w: 28, d: 16, r: 122, a: 1.57 },
    { label: "Play Arena", kind: "warm", h: 7, w: 16, d: 14, r: 126, a: 2.72 }
  ];

  for (const b of campusBuildings) {
    const obj = createBuilding(b.kind, b.h, b.w, b.d);
    placePolarObject(parent, obj, y, b.r, b.a);
    plotRegistry.push({ angle: b.a, ringR: b.r, width: b.w, depth: b.d });
  }

  [
    { ringR: 92, targetCount: 60, kinds: ["white", "warm"] },
    { ringR: 118, targetCount: 72, kinds: ["white", "stone"] },
    { ringR: 146, targetCount: 84, kinds: ["white", "warm"] },
    { ringR: 172, targetCount: 96, kinds: ["white", "stone"] }
  ].forEach(({ ringR, targetCount, kinds }) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount,
      widthRange: [6.8, 9.4],
      depthRange: [6.8, 9.6],
      heightRange: [6.4, 10.8],
      kindPicker: () => kinds[Math.floor(Math.random() * kinds.length)],
      roadRadii: [114, 154],
      ringRoadWidth: 7.5,
      blockerAngles: radialAnglesForCampus(),
      radialRoadWidth: 6.4,
      plotWidthPad: 0.2,
      plotDepthPad: 0.2,
      ignoreBlockers: true,
      ignoreRoads: true,
      ignoreBoundaries: true,
      ignoreNeighbors: true,
      ringClearance: 0,
      radialClearance: 0,
      minGapPad: 0.002,
      attemptMultiplier: 80,
      angleJitter: 0.98,
      placedPlots: plotRegistry,
      boundaryClearance: 0,
      neighborTangentialClearance: 0,
      neighborRadialClearance: 0
    });
  });

  plantSceneScatterInstanced(parent, y, 84, 180, 120, [0.7, 1.15]);
  addPeopleOnFloor(parent, y, 110, 24);
  addPeopleOnFloor(parent, y, 154, 18);
}

function radialAnglesForCampus() {
  return [-1.25, -0.2, 0.95, 2.2];
}

function buildCommerceFloorLayout(parent, y) {
  const plaza = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.concrete, 0.05);
  parent.add(plaza);

  const roadRadii = [102, 136, 168];
  roadRadii.forEach(r => addRoadRing(parent, y, r, 8));
  const radialAngles = [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
  radialAngles.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 6, WORLD.baseRadius - 6, 7));

  const innerPlaza = new THREE.Mesh(new THREE.CircleGeometry(44, 48), materials.concrete);
  innerPlaza.rotation.x = -Math.PI / 2;
  innerPlaza.position.y = y + 0.08;
  innerPlaza.matrixAutoUpdate = false; innerPlaza.updateMatrix();
  parent.add(innerPlaza);

  const fountain = new THREE.Mesh(new THREE.CircleGeometry(18, 40), waterMaterial);
  fountain.rotation.x = -Math.PI / 2;
  fountain.position.y = y + 0.12;
  fountain.matrixAutoUpdate = false; fountain.updateMatrix();
  parent.add(fountain);

  const anchorBuildings = [
    { kind: "glass", h: 28, w: 30, d: 24, r: 82, a: Math.PI / 4 },
    { kind: "glass", h: 26, w: 28, d: 22, r: 82, a: Math.PI * 3 / 4 },
    { kind: "warm", h: 18, w: 34, d: 20, r: 82, a: Math.PI * 5 / 4 },
    { kind: "glass", h: 24, w: 32, d: 20, r: 82, a: Math.PI * 7 / 4 }
  ];

  for (const b of anchorBuildings) {
    const obj = createBuilding(b.kind, b.h, b.w, b.d);
    placePolarObject(parent, obj, y, b.r, b.a);
  }

  [
    { kind: "glass", h: 16, inner: 92, outer: 118, start: -0.42, len: 0.84 },
    { kind: "glass", h: 15, inner: 92, outer: 118, start: Math.PI - 0.42, len: 0.84 },
    { kind: "warm", h: 13, inner: 142, outer: 166, start: Math.PI / 2 - 0.52, len: 1.04 },
    { kind: "glass", h: 14, inner: 142, outer: 166, start: Math.PI * 1.5 - 0.52, len: 1.04 }
  ].forEach(c => {
    const arc = createArcBuilding(c.kind, c.h, c.inner, c.outer, c.start, c.len);
    arc.position.y = y + 0.1;
    parent.add(arc);
  });

  const mallRings = [118, 152, 176];
  mallRings.forEach((ringR, ringIdx) => {
    const targetCount = ringIdx === 2 ? 40 : ringIdx === 1 ? 34 : 30;
    const candidateCount = targetCount * 2;
    let placed = 0;
    for (let i = 0; i < candidateCount && placed < targetCount; i++) {
      const a = (i / candidateCount) * Math.PI * 2 + (ringIdx % 2) * (Math.PI / candidateCount);
      const w = ringIdx === 2 ? 12 + Math.random() * 4 : 10 + Math.random() * 3;
      const d = ringIdx === 2 ? 8.5 + Math.random() * 2.5 : 7.5 + Math.random() * 2;
      if (plotBlocked(a, ringR, w, d, radialAngles, 7, 6)) continue;
      if (ringBlocked(ringR, d, roadRadii, 8, 2.5)) continue;
      const obj = createBuilding(ringIdx === 2 ? "warm" : "glass", 11 + ringIdx * 2 + Math.random() * 6, w, d);
      placePolarObject(parent, obj, y, ringR, a);
      placed++;
    }
  });

  addStreetLightsInstanced(parent, y, 102, 18);
  addStreetLightsInstanced(parent, y, 136, 22);
  addStreetLightsInstanced(parent, y, 168, 24);
  addCarsOnFloor(parent, y, 102, 18, [0xffffff,0x111111,0xd02f39,0x2a67d1,0x23a56a,0xd3a01e]);
  addCarsOnFloor(parent, y, 136, 20, [0xffffff,0x111111,0xd02f39,0x2a67d1,0x23a56a,0xd3a01e]);
  addCarsOnFloor(parent, y, 168, 26, [0xffffff,0x111111,0xd02f39,0x2a67d1,0x23a56a,0xd3a01e]);
  addPeopleOnFloor(parent, y, 58, 18);
  addPeopleOnFloor(parent, y, 126, 30);
  addPeopleOnFloor(parent, y, 162, 28);
}

function buildUrbanBaseLayout(parent, y, floor) {
  const civicBase = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.concrete, 0.05);
  parent.add(civicBase);
  const plotRegistry = [];

  const roadRadii = [98, 132, 166];
  roadRadii.forEach(r => addRoadRing(parent, y, r, 8));
  const radialAngles = [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
  radialAngles.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 5, WORLD.baseRadius - 4, 6.4));

  const blockRings = [90, 114, 148, 178];
  blockRings.forEach((ringR, idx) => {
    const safeRingR = ringR + (idx % 2 === 0 ? -3 : 3);
    populateRingBuildings(parent, y, {
      ringR: safeRingR,
      targetCount: [72, 84, 96, 110][idx],
      widthRange: [6.4, 8.8],
      depthRange: [6.4, 8.6],
      heightRange: [8 + idx * 2, 14 + idx * 2],
      kindPicker: () => idx < 2 ? (Math.random() > 0.5 ? "stone" : "warm") : "glass",
      roadRadii,
      ringRoadWidth: 8,
      blockerAngles: radialAngles,
      radialRoadWidth: 6.4,
      ringClearance: 3.1,
      radialClearance: 5.8,
      minGapPad: 0.08,
      attemptMultiplier: 18,
      angleJitter: 0.95
      ,
      placedPlots: plotRegistry,
      boundaryClearance: 3.2,
      neighborTangentialClearance: 1.6,
      neighborRadialClearance: 1.8
    });
  });

  addCarsOnFloor(parent, y, 132, 18, [0xffffff,0x111111,0xd02f39,0x2a67d1,0x23a56a,0xd3a01e]);
  addPeopleOnFloor(parent, y, 96, floor === 1 ? 24 : 18);
}

function buildFamilySuburbsLayout(parent, y) {
  const greenBase = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.grass, 0.05);
  parent.add(greenBase);
  const plotRegistry = [];

  const roadRadii = [118, 160];
  roadRadii.forEach(r => addRoadRing(parent, y, r, 7));
  const crescentAngles = [-1.2, -0.45, 0.5, 1.35, 2.4];
  crescentAngles.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 10, WORLD.baseRadius - 8, 5.8));

  const suburbRings = [94, 122, 150, 178];
  suburbRings.forEach((ringR, idx) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount: [60, 72, 84, 96][idx],
      widthRange: [6.2, 8.0],
      depthRange: [6.8, 8.6],
      heightRange: [4.8, 7.0],
      kindPicker: () => Math.random() > 0.5 ? "warm" : "stone",
      roadRadii,
      ringRoadWidth: 7,
      blockerAngles: crescentAngles,
      radialRoadWidth: 5.8,
      plotWidthPad: 0.15,
      plotDepthPad: 0.15,
      ignoreBlockers: true,
      ignoreRoads: true,
      ignoreBoundaries: true,
      ignoreNeighbors: true,
      ringClearance: 0,
      radialClearance: 0,
      minGapPad: 0.002,
      attemptMultiplier: 96,
      angleJitter: 1.0,
      placedPlots: plotRegistry,
      boundaryClearance: 0,
      neighborTangentialClearance: 0,
      neighborRadialClearance: 0,
      buildObject: ({ kind, h, w, d }) => {
        const obj = createBuilding(kind, h, w, d);
        const lawn = new THREE.Mesh(gBox, materials.grass);
        lawn.scale.set(w + 0.35, 0.08, d + 0.35);
        lawn.position.y = 0.04;
        lawn.matrixAutoUpdate = false; lawn.updateMatrix();
        obj.add(lawn);
        return obj;
      }
    });
  });

  plantSceneScatterInstanced(parent, y, 90, 182, 80, [0.7, 1.1]);
  addPeopleOnFloor(parent, y, 118, 14);
}

function buildLuxuryEstatesLayout(parent, y) {
  const lawn = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.grassDeep, 0.05);
  parent.add(lawn);
  const plotRegistry = [];
  const roadRadii = [120, 168];
  addRoadRing(parent, y, 120, 8);
  addRoadRing(parent, y, 168, 8);

  [92, 114, 136, 158, 178].forEach((ringR, idx) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount: [52, 64, 76, 88, 100][idx],
      widthRange: [7.4, 9.4],
      depthRange: [7.8, 9.8],
      heightRange: [5.2, 7.4],
      kindPicker: "villa",
      roadRadii,
      ringRoadWidth: 8,
      blockerAngles: [],
      radialRoadWidth: 0,
      plotWidthPad: 0.15,
      plotDepthPad: 0.15,
      ignoreBlockers: true,
      ignoreRoads: true,
      ignoreBoundaries: true,
      ignoreNeighbors: true,
      ringClearance: 0,
      radialClearance: 0,
      minGapPad: 0.002,
      attemptMultiplier: 100,
      angleJitter: 1.0,
      placedPlots: plotRegistry,
      boundaryClearance: 0,
      neighborTangentialClearance: 0,
      neighborRadialClearance: 0,
      buildObject: ({ h, w, d }) => {
        const villa = createBuilding("villa", h, w, d);
        const lawnPad = new THREE.Mesh(gBox, materials.grass);
        lawnPad.scale.set(w + 0.3, 0.08, d + 0.3);
        lawnPad.position.y = 0.04;
        lawnPad.matrixAutoUpdate = false; lawnPad.updateMatrix();
        villa.add(lawnPad);
        if (Math.random() > 0.35) {
          const pool = new THREE.Mesh(gBox, waterMaterial);
          pool.scale.set(5.8, 0.12, 8.2);
          pool.position.set(0, 0.09, -4.8);
          pool.matrixAutoUpdate = false; pool.updateMatrix();
          villa.add(pool);
        }
        return villa;
      }
    });
  });

  plantSceneScatterInstanced(parent, y, 96, 184, 90, [0.8, 1.25]);
  addCarsOnFloor(parent, y, 120, 10, [0xffffff,0x111111,0x102030,0xd3a01e]);
}

function buildDiplomaticFloorLayout(parent, y) {
  const stoneCourt = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.concrete, 0.05);
  parent.add(stoneCourt);
  const plotRegistry = [];
  [116, 160].forEach(r => addRoadRing(parent, y, r, 8));
  const axes = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  axes.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 8, WORLD.baseRadius - 8, 7));

  const embassies = [
    { r: 94, a: Math.PI / 4, kind: "white", h: 14, w: 22, d: 16 },
    { r: 94, a: Math.PI * 3 / 4, kind: "stone", h: 13, w: 20, d: 16 },
    { r: 94, a: Math.PI * 5 / 4, kind: "white", h: 14, w: 22, d: 16 },
    { r: 94, a: Math.PI * 7 / 4, kind: "stone", h: 13, w: 20, d: 16 },
    { r: 126, a: 0, kind: "villa", h: 9, w: 16, d: 16 },
    { r: 126, a: Math.PI / 2, kind: "villa", h: 9, w: 16, d: 16 },
    { r: 126, a: Math.PI, kind: "villa", h: 9, w: 16, d: 16 },
    { r: 126, a: Math.PI * 1.5, kind: "villa", h: 9, w: 16, d: 16 },
    { r: 160, a: Math.PI / 4, kind: "villa", h: 9, w: 18, d: 18 },
    { r: 160, a: Math.PI * 3 / 4, kind: "villa", h: 9, w: 18, d: 18 },
    { r: 160, a: Math.PI * 5 / 4, kind: "villa", h: 9, w: 18, d: 18 },
    { r: 160, a: Math.PI * 7 / 4, kind: "villa", h: 9, w: 18, d: 18 }
  ];
  embassies.forEach(b => {
    placePolarObject(parent, createBuilding(b.kind, b.h, b.w, b.d), y, b.r, b.a);
    plotRegistry.push({ angle: b.a, ringR: b.r, width: b.w, depth: b.d });
  });
  [
    { ringR: 100, targetCount: 60, kinds: ["white", "stone"] },
    { ringR: 126, targetCount: 72, kinds: ["villa", "white"] },
    { ringR: 146, targetCount: 84, kinds: ["villa", "stone"] },
    { ringR: 170, targetCount: 96, kinds: ["villa", "white"] }
  ].forEach(({ ringR, targetCount, kinds }) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount,
      widthRange: [8.6, 10.8],
      depthRange: [8.8, 10.9],
      heightRange: [8.2, 10.5],
      kindPicker: () => kinds[Math.floor(Math.random() * kinds.length)],
      roadRadii: [116, 160],
      ringRoadWidth: 8,
      blockerAngles: axes,
      radialRoadWidth: 7,
      plotWidthPad: 0.2,
      plotDepthPad: 0.2,
      ignoreBlockers: true,
      ignoreRoads: true,
      ignoreBoundaries: true,
      ignoreNeighbors: true,
      ringClearance: 0,
      radialClearance: 0,
      minGapPad: 0.002,
      attemptMultiplier: 84,
      angleJitter: 0.92,
      placedPlots: plotRegistry,
      boundaryClearance: 0,
      neighborTangentialClearance: 0,
      neighborRadialClearance: 0
    });
  });
  addStreetLightsInstanced(parent, y, 116, 16);
}

function buildSkyMansionsLayout(parent, y) {
  const stonePad = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.concrete, 0.05);
  parent.add(stonePad);
  const plotRegistry = [];
  const roadRadii = [126, 172];
  addRoadRing(parent, y, 126, 8);
  addRoadRing(parent, y, 172, 8);
  [94, 116, 138, 160, 178].forEach((ringR, idx) => {
    const safeRingR = ringR + (idx % 2 === 0 ? -3 : 3);
    populateRingBuildings(parent, y, {
      ringR: safeRingR,
      targetCount: [56, 68, 80, 92, 104][idx],
      widthRange: [8.6, 10.8],
      depthRange: [8.8, 10.9],
      heightRange: [7.8, 10.8],
      kindPicker: "villa",
      roadRadii,
      ringRoadWidth: 8,
      blockerAngles: [0, Math.PI / 2, Math.PI, Math.PI * 1.5],
      radialRoadWidth: 7,
      plotWidthPad: 0.2,
      plotDepthPad: 0.2,
      ignoreBlockers: true,
      ignoreRoads: true,
      ignoreBoundaries: true,
      ignoreNeighbors: true,
      ringClearance: 0,
      radialClearance: 0,
      minGapPad: 0.002,
      attemptMultiplier: 88,
      angleJitter: 0.95,
      placedPlots: plotRegistry,
      boundaryClearance: 0,
      neighborTangentialClearance: 0,
      neighborRadialClearance: 0
    });
  });
  addPeopleOnFloor(parent, y, 126, 10);
}

function buildCorporateFloorLayout(parent, y) {
  const podium = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.concrete, 0.05);
  parent.add(podium);
  const plotRegistry = [];
  [104, 144].forEach(r => addRoadRing(parent, y, r, 8));
  const spokes = Array.from({ length: 6 }, (_, i) => i * Math.PI / 3);
  spokes.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 6, WORLD.baseRadius - 8, 6.5));
  const towers = [
    { r: 82, a: 0.1, h: 34, w: 12, d: 12 },
    { r: 82, a: 2.08, h: 28, w: 14, d: 12 },
    { r: 82, a: 4.18, h: 32, w: 12, d: 14 },
    { r: 132, a: 1.05, h: 24, w: 14, d: 14 },
    { r: 132, a: 3.15, h: 26, w: 16, d: 14 },
    { r: 132, a: 5.25, h: 22, w: 14, d: 16 }
  ];
  towers.forEach(t => {
    placePolarObject(parent, createBuilding("glass", t.h, t.w, t.d), y, t.r, t.a);
    plotRegistry.push({ angle: t.a, ringR: t.r, width: t.w, depth: t.d });
  });
  [
    { ringR: 96, targetCount: 30 },
    { ringR: 122, targetCount: 38 },
    { ringR: 156, targetCount: 46 },
    { ringR: 176, targetCount: 56 }
  ].forEach(({ ringR, targetCount }) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount,
      widthRange: [6.2, 8.6],
      depthRange: [6.2, 8.8],
      heightRange: [12, 22],
      kindPicker: "glass",
      roadRadii: [104, 144],
      ringRoadWidth: 8,
      blockerAngles: spokes,
      radialRoadWidth: 6.5,
      ringClearance: 2.5,
      radialClearance: 5.8,
      minGapPad: 0.06,
      attemptMultiplier: 16,
      angleJitter: 0.98,
      placedPlots: plotRegistry,
      boundaryClearance: 2.8,
      neighborTangentialClearance: 1.5,
      neighborRadialClearance: 1.8
    });
  });
  addCarsOnFloor(parent, y, 104, 12, [0xffffff,0x111111,0xd02f39,0x2a67d1,0x23a56a,0xd3a01e]);
}

function buildEntertainmentFloorLayout(parent, y) {
  const darkPad = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.asphalt, 0.05);
  parent.add(darkPad);
  const plotRegistry = [];
  const roadRadii = [108, 142, 170];
  roadRadii.forEach(r => addRoadRing(parent, y, r, 8));
  const entertainmentSpokes = Array.from({ length: 6 }, (_, i) => i * Math.PI / 3 + Math.PI / 6);
  entertainmentSpokes.forEach(a => addRadialRoad(parent, y, a, WORLD.apartmentRadius + 8, WORLD.baseRadius - 6, 6.8));

  [
    { kind: "glass", h: 14, inner: 94, outer: 120, start: -0.38, len: 0.76 },
    { kind: "warm", h: 13, inner: 94, outer: 120, start: Math.PI - 0.38, len: 0.76 },
    { kind: "glass", h: 12, inner: 146, outer: 172, start: Math.PI / 2 - 0.5, len: 1.0 },
    { kind: "warm", h: 12, inner: 146, outer: 172, start: Math.PI * 1.5 - 0.5, len: 1.0 }
  ].forEach((venue, idx) => {
    const arc = createArcBuilding(venue.kind, venue.h, venue.inner, venue.outer, venue.start, venue.len);
    arc.position.y = y + 0.1;
    const halo = new THREE.Mesh(new THREE.TorusGeometry((venue.outer - venue.inner) * 0.32, 0.2, 12, 44), idx % 2 ? materials.neonPink : materials.neonCyan);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = venue.h + 2.6;
    halo.matrixAutoUpdate = false; halo.updateMatrix();
    arc.add(halo);
    parent.add(arc);
  });

  const venueAngles = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2);
  venueAngles.forEach((a, i) => {
    const ringR = i % 2 ? 126 : 166;
    const w = i % 3 === 0 ? 16 + Math.random() * 5 : 12 + Math.random() * 4;
    const d = i % 3 === 0 ? 12 + Math.random() * 4 : 10 + Math.random() * 3;
    if (plotBlocked(a, ringR, w, d, entertainmentSpokes, 6.8, 6.5)) return;
    if (ringBlocked(ringR, d, roadRadii, 8, 2.8)) return;
    const venue = createBuilding("glass", 13 + Math.random() * 10, w, d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5 + Math.random()*2.5, 0.16, 10, 34), i % 2 ? materials.neonPink : materials.neonCyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 6 + Math.random() * 4;
    ring.matrixAutoUpdate = false; ring.updateMatrix();
    venue.add(ring);
    placePolarObject(parent, venue, y, ringR, a);
    plotRegistry.push({ angle: a, ringR, width: w, depth: d });
  });
  [
    { ringR: 118, targetCount: 36, kinds: ["glass", "warm"] },
    { ringR: 154, targetCount: 44, kinds: ["glass", "warm"] },
    { ringR: 176, targetCount: 54, kinds: ["glass", "warm"] }
  ].forEach(({ ringR, targetCount, kinds }) => {
    populateRingBuildings(parent, y, {
      ringR,
      targetCount,
      widthRange: [6.8, 10.4],
      depthRange: [6.8, 9.8],
      heightRange: [10, 18],
      kindPicker: () => kinds[Math.floor(Math.random() * kinds.length)],
      roadRadii,
      ringRoadWidth: 8,
      blockerAngles: entertainmentSpokes,
      radialRoadWidth: 6.8,
      ringClearance: 2.6,
      radialClearance: 6.2,
      minGapPad: 0.07,
      attemptMultiplier: 16,
      angleJitter: 0.98,
      placedPlots: plotRegistry,
      boundaryClearance: 2.8,
      neighborTangentialClearance: 1.5,
      neighborRadialClearance: 1.8
    });
  });
  addPeopleOnFloor(parent, y, 118, 24);
  addPeopleOnFloor(parent, y, 162, 24);
}

function buildBaseFloors() {
  for (let floor = 1; floor <= 13; floor++) {
    const y = getFloorY(floor);
    const g = new THREE.Group();
    root.add(g);
    registerEagleFloorVisual(floor, g);

    if (floor === 3) {
      const park = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.5, y, materials.grassDeep, 0.05);
      g.add(park);
      
      addRoadRing(g, y, 116, 6.5);
      addRoadRing(g, y, 152, 6.5);
      addRoadRing(g, y, 175, 6.5);
      
      plantSceneScatterInstanced(g, y, 92, 182, 430, [0.7, 1.45]);
      addPeopleOnFloor(g, y, 116, 34);
      addPeopleOnFloor(g, y, 178, 16);
      continue;
    }

    if (floor === 6) {
      buildCommerceFloorLayout(g, y);
      continue;
    }

    if (floor === 1 || floor === 2) {
      buildUrbanBaseLayout(g, y, floor);
      continue;
    }

    if (floor === 4 || floor === 5) {
      buildFamilySuburbsLayout(g, y);
      continue;
    }

    if (floor === 7 || floor === 8) {
      buildLuxuryEstatesLayout(g, y);
      continue;
    }

    if (floor === 9) {
      buildEducationFloorLayout(g, y);
      continue;
    }

    if (floor === 10) {
      buildDiplomaticFloorLayout(g, y);
      continue;
    }

    if (floor === 11) {
      buildSkyMansionsLayout(g, y);
      continue;
    }

    if (floor === 12) {
      buildCorporateFloorLayout(g, y);
      continue;
    }

    if (floor === 13) {
      buildEntertainmentFloorLayout(g, y);
      continue;
    }
  }
}

function buildLagoonFloor() {
  const y = getFloorY(14);
  const g = new THREE.Group();
  root.add(g);
  registerEagleFloorVisual(14, g);

  const sand = createSurfaceRing(WORLD.apartmentRadius + 2, 145, y, materials.sand, 0.05);
  g.add(sand);

  const water = createSurfaceRing(140, WORLD.baseRadius - 0.2, y, waterMaterial, 0.09);
  g.add(water);

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    if (Math.abs(a) < .22 || Math.abs(a - Math.PI) < .22) continue;

    const villa = createBuilding("villa", 5.2, 11, 12);
    const vr = 178;
    villa.position.set(vr * Math.cos(a), y + 0.5, vr * Math.sin(a));
    villa.rotation.y = -a + Math.PI/2;
    g.add(villa);

    const pr = 165;
    const pier = new THREE.Mesh(gBox, new THREE.MeshStandardMaterial({ color: 0x8b6a46, roughness: .95 }));
    pier.scale.set(10, .18, 3);
    pier.position.set(pr * Math.cos(a), y + 0.08, pr * Math.sin(a));
    pier.rotation.y = -a;
    pier.matrixAutoUpdate = false; pier.updateMatrix();
    g.add(pier);

    const pdr = 180;
    const poolDeck = new THREE.Mesh(gBox, materials.concrete);
    poolDeck.scale.set(7, .14, 6);
    poolDeck.position.set(pdr * Math.cos(a), y + 0.08, pdr * Math.sin(a));
    poolDeck.rotation.y = -a;
    poolDeck.matrixAutoUpdate = false; poolDeck.updateMatrix();
    g.add(poolDeck);
  }

  [-2.2, -1.5, -0.85, -0.35, 0.4, 0.95, 1.6, 2.25].forEach((a, i) => {
    const beachHome = createBuilding(i % 2 ? "warm" : "villa", 4.8 + Math.random() * 1.4, 9 + Math.random() * 2.5, 10 + Math.random() * 2.8);
    const r = i % 2 ? 120 : 132;
    beachHome.position.set(r * Math.cos(a), y + 0.1, r * Math.sin(a));
    beachHome.rotation.y = -a + Math.PI / 2;
    g.add(beachHome);
  });
  
  plantSceneScatterInstanced(g, y, 95, 178, 70, [0.75, 1.2]);
  addPeopleOnFloor(g, y, 122, 18);
  addPeopleOnFloor(g, y, 134, 12);
}

let rotatingRing;
function buildBillionairesRow() {
  const y = getFloorY(15);
  const estateCount = 36;
  rotatingRing = new THREE.Group();
  rotatingRing.position.y = y + 0.06;
  root.add(rotatingRing);
  registerEagleFloorVisual(15, rotatingRing);

  const amenityInnerR = WORLD.apartmentRadius + 10;
  const plotInnerR = WORLD.baseRadius - 50;
  const amenityOuterR = plotInnerR - 4;
  const estatePoolR = plotInnerR + 14;
  const estateRingR = plotInnerR + 36;

  const lawn = createSurfaceRing(WORLD.apartmentRadius + 2, WORLD.baseRadius - 0.2, 0, billionaireSeasonMaterials.grass, 0.04);
  rotatingRing.add(lawn);

  const promenade = createSurfaceRing(amenityInnerR, amenityInnerR + 8, 0, materials.concrete, 0.06);
  rotatingRing.add(promenade);
  const centralMeadow = createSurfaceRing(amenityInnerR + 10, amenityOuterR, 0, billionaireSeasonMaterials.grassDeep, 0.05);
  rotatingRing.add(centralMeadow);

  const golfGreen = createSurfaceRing(116, amenityOuterR - 4, 0, billionaireSeasonMaterials.grass, 0.07);
  rotatingRing.add(golfGreen);

  const pond = createSurfaceRing(121, 131, 0, waterMaterial, 0.1);
  rotatingRing.add(pond);

  const amenityAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  amenityAngles.forEach((a, idx) => {
    const park = new THREE.Group();

    const lawnPad = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.18, 36), billionaireSeasonMaterials.grass);
    lawnPad.position.y = 0.09;
    lawnPad.matrixAutoUpdate = false; lawnPad.updateMatrix();
    park.add(lawnPad);

    const pathRing = new THREE.Mesh(new THREE.RingGeometry(10, 13.5, 36), materials.lane);
    pathRing.rotation.x = -Math.PI / 2;
    pathRing.position.y = 0.12;
    pathRing.matrixAutoUpdate = false; pathRing.updateMatrix();
    park.add(pathRing);

    if (idx % 2 === 0) {
      const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.24, 28), waterMaterial);
      fountain.position.y = 0.15;
      fountain.matrixAutoUpdate = false; fountain.updateMatrix();
      park.add(fountain);
    } else {
      const pavilion = createBuilding("villa", 3.8, 8, 8);
      pavilion.scale.set(0.85, 0.8, 0.85);
      pavilion.position.y = 0.05;
      park.add(pavilion);
    }

    const benchGeo = new THREE.BoxGeometry(2.2, 0.3, 0.7);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x7f6143, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const bench = new THREE.Mesh(benchGeo, benchMat);
      const ba = (i / 6) * Math.PI * 2;
      bench.position.set(Math.cos(ba) * 11.6, 0.24, Math.sin(ba) * 11.6);
      bench.rotation.y = -ba;
      bench.matrixAutoUpdate = false; bench.updateMatrix();
      park.add(bench);
    }

    placePolarObject(rotatingRing, park, 0, 130, a, Math.PI / 2);
  });

  const hCount = estateCount;
  const hSegs = 10;
  const hedgeStartR = plotInnerR;
  const hedgeEndR = WORLD.baseRadius - 0.6;
  const hLen = (hedgeEndR - hedgeStartR) / hSegs;
  const hedgeGeo = new THREE.BoxGeometry(hLen + 0.15, 1.6, 1.3);
  const hedges = new THREE.InstancedMesh(hedgeGeo, billionaireSeasonMaterials.hedge, hCount * hSegs);
  let hIdx = 0;
  const hDummy = new THREE.Object3D();
  
  for (let i = 0; i < estateCount; i++) {
    const a = (i / estateCount) * Math.PI * 2;
    for(let s=0; s<hSegs; s++) {
      const r = hedgeStartR + s * hLen + hLen/2;
      hDummy.position.set(r * Math.cos(a), 0.8, r * Math.sin(a));
      hDummy.rotation.set(0,0,0);
      hDummy.rotation.y = -a;
      hDummy.updateMatrix();
      hedges.setMatrixAt(hIdx++, hDummy.matrix);
    }
  }
  hedges.instanceMatrix.needsUpdate = true;
  rotatingRing.add(hedges);

  for (let i = 0; i < estateCount; i++) {
    const a = ((i + 0.5) / estateCount) * Math.PI * 2;
    
    const er = estateRingR; 
    const estate = createBuilding("villa", 6.5, 13, 14);
    estate.scale.set(1.4, 1.2, 1.4);
    estate.position.set(er * Math.cos(a), 0.08, er * Math.sin(a));
    estate.rotation.y = -a + Math.PI/2;
    rotatingRing.add(estate);

    const pr = estatePoolR;
    const pool = new THREE.Mesh(gBox, waterMaterial);
    pool.scale.set(11, .15, 14);
    pool.position.set(pr * Math.cos(a), 0.08, pr * Math.sin(a));
    pool.rotation.y = -a;
    pool.matrixAutoUpdate = false; pool.updateMatrix();
    rotatingRing.add(pool);
  }

  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2 + Math.PI / 21;
    const gardenTree = new THREE.Group();
    const trunk = addShadow(new THREE.Mesh(treeTrunkGeo, billionaireSeasonMaterials.treeTrunk));
    const crown = addShadow(new THREE.Mesh(treeCrownGeo, billionaireSeasonMaterials.grassDeep));
    const scale = 0.95 + Math.random() * 0.25;
    trunk.scale.setScalar(scale);
    crown.scale.setScalar(scale);
    trunk.matrixAutoUpdate = false; trunk.updateMatrix();
    crown.matrixAutoUpdate = false; crown.updateMatrix();
    gardenTree.add(trunk, crown);
    gardenTree.position.set(Math.cos(a) * 146, 0.02, Math.sin(a) * 146);
    gardenTree.rotation.y = Math.random() * Math.PI * 2;
    rotatingRing.add(gardenTree);
  }

  plantSceneScatterInstancedWithMaterials(
    rotatingRing,
    0,
    96,
    154,
    320,
    billionaireSeasonMaterials.treeTrunk,
    billionaireSeasonMaterials.grassDeep,
    [0.72, 1.2]
  );

  billionaireWeather.snow = createBillionaireWeatherPoints(260, [0xffffff, 0xe8f2ff, 0xdfe6ea], 0.9);
  billionaireWeather.rain = createBillionaireWeatherPoints(420, [0xb8d7ff, 0x9cc7ff, 0xd8ecff], 0.45);
  billionaireWeather.leaves = createBillionaireWeatherPoints(240, [0xc96a2b, 0x9d4f24, 0xd4a53a, 0x8b5a2b], 1.2, 30);
  rotatingRing.add(billionaireWeather.snow.points, billionaireWeather.rain.points, billionaireWeather.leaves.points);
  billionaireWeather.snow.points.visible = false;
  billionaireWeather.rain.points.visible = currentSeason === "summer";
  billionaireWeather.leaves.points.visible = false;

  addPeopleOnFloor(rotatingRing, 0, 118, 16);
  addPeopleOnFloor(rotatingRing, 0, 136, 20);
  addPeopleOnFloor(rotatingRing, 0, 148, 18);
}

let hologramGroup;
function buildStadium() {
  const y = getFloorY(16);
  const g = new THREE.Group();
  root.add(g);
  registerEagleFloorVisual(16, g);

  const height = Math.max(10, TOP_Y - y);
  const steps = 20;
  const stepHeight = height / steps;
  const stepWidth = (WORLD.stadiumRadius - WORLD.voidRadius - 2) / steps;
  for (let s = 0; s < steps; s++) {
    const inner = WORLD.voidRadius + s * stepWidth;
    const outer = inner + stepWidth;
    const bowl = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), materials.concrete);
    bowl.rotation.x = -Math.PI / 2;
    bowl.position.y = y + s * stepHeight;
    bowl.matrixAutoUpdate = false; bowl.updateMatrix();
    g.add(bowl);

    const seats = new THREE.Mesh(new THREE.RingGeometry(inner + 0.35, inner + 1.2, 96), s % 2 ? materials.neonPink : materials.neonCyan);
    seats.rotation.x = -Math.PI / 2;
    seats.position.y = y + s * stepHeight + 0.18;
    seats.matrixAutoUpdate = false; seats.updateMatrix();
    g.add(seats);
  }

  const field = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.22, 60), new THREE.MeshStandardMaterial({ color: 0x2a6631, roughness: 1 }));
  field.position.set(0, y + 0.15, 0);
  field.matrixAutoUpdate = false; field.updateMatrix();
  g.add(field);

  hologramGroup = new THREE.Group();
  hologramGroup.position.set(0, y + 1.5, 0);
  const holo = new THREE.Mesh(new THREE.CylinderGeometry(16, 6, 46, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd554, transparent: true, opacity: .18, wireframe: true }));
  holo.position.y = 23;
  hologramGroup.add(holo);
  g.add(hologramGroup);
}

const clouds = [];
function buildClouds() {
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.055, depthWrite: false });
  for (let i = 0; i < 34; i++) {
    const c = new THREE.Group();
    const puffCount = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < puffCount; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(18 + Math.random()*22, 12, 12), cloudMat);
      puff.position.set((Math.random()-.5)*45, Math.random()*8, (Math.random()-.5)*24);
      puff.matrixAutoUpdate = false; puff.updateMatrix();
      c.add(puff);
    }
    c.position.set((Math.random()-.5)*3500, 120 + Math.random()*420, (Math.random()-.5)*3500);
    c.userData.speed = 1 + Math.random()*4;
    c.traverse(obj => obj.layers.set(SKY_LAYER));
    clouds.push(c);
    root.add(c);
  }
}

const dynamic = { cars: [], people: [], taxiPlane: null };

function updateDynamic(dt) {
  const dummy = new THREE.Object3D();

  for (const pack of dynamic.cars) {
    for (let i = 0; i < pack.state.length; i++) {
      const s = pack.state[i];
      s.angle += s.speed * dt;
      dummy.position.set(Math.cos(s.angle) * s.radius, pack.y + 0.55, Math.sin(s.angle) * s.radius);
      dummy.rotation.set(0, -s.angle + Math.PI/2, 0);
      dummy.updateMatrix();
      pack.mesh.setMatrixAt(i, dummy.matrix);
    }
    pack.mesh.instanceMatrix.needsUpdate = true;
  }

  for (const pack of dynamic.people) {
    for (let i = 0; i < pack.state.length; i++) {
      const s = pack.state[i];
      s.angle += s.speed * dt;
      const bob = Math.sin((s.angle * 18)) * 0.03;
      dummy.position.set(Math.cos(s.angle) * s.radius, pack.y + 0.45 + bob, Math.sin(s.angle) * s.radius);
      dummy.rotation.set(0, -s.angle + Math.PI/2, 0);
      dummy.updateMatrix();
      pack.mesh.setMatrixAt(i, dummy.matrix);
    }
    pack.mesh.instanceMatrix.needsUpdate = true;
  }

  if (dynamic.taxiPlane) {
    const p = dynamic.taxiPlane;
    p.z -= dt * 40;
    if (p.z < -2200) p.z = 2200;
    p.mesh.position.set(p.runwayCenterX, 2.8, p.z);
    p.mesh.rotation.y = Math.PI/2;
  }
}

zones.forEach((z, idx) => {
  const floorIndexMap = zoneFloorIndexMap[idx];
  const el = document.createElement("div");
  el.className = "zone";
  el.dataset.floor = floorIndexMap;
  el.innerHTML = `<span class="floor">${z[0]}</span><span class="name">${z[1]}</span><div class="desc">${z[2]}</div>`;
  el.onclick = () => teleportToFloor(floorIndexMap);
  zonePanel.appendChild(el);
});

// --- DISTANCE AND ELEVATION CONTROLS ---
document.querySelectorAll("[data-dist]").forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll("[data-dist]").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    groundDistance = parseInt(e.target.dataset.dist);
    if (currentView === "ground") {
      updateGroundCamera();
    }
  };
});

document.querySelectorAll("[data-elev]").forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll("[data-elev]").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    groundElevation = e.target.dataset.elev;
    if (currentView === "ground") {
      updateGroundCamera();
    }
  };
});

function updateGroundCamera() {
  orbit.enabled = true;
  camera.fov = 60;
  
  const totalRadius = WORLD.baseRadius + groundDistance;
  
  let camY = -1.2 + 1.75; 
  if (groundElevation === 'mid') camY = TOP_Y / 2;
  if (groundElevation === 'top') camY = TOP_Y + 50; 
  
  camera.position.set(totalRadius, camY, 0);
  
  let lookHeight = camY; 
  
  if (groundElevation === 'mid') {
    lookHeight = TOP_Y / 2; 
  } else if (groundElevation === 'top') {
    lookHeight = TOP_Y * 0.8; 
  }
  
  orbit.target.set(0, lookHeight, 0);

  if (groundElevation === 'ground') {
    orbit.maxPolarAngle = Math.PI / 2; 
    orbit.minPolarAngle = 0; 
  } else {
    orbit.maxPolarAngle = Math.PI / 2 + 0.1; 
    orbit.minPolarAngle = 0;
  }
  
  camera.updateProjectionMatrix();
  orbit.update(); 
}

function setView(view) {
  currentView = view;
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  walkHint.classList.toggle("show", view === "walk");
  
  distanceBar.style.display = (view === "ground") ? "flex" : "none";
  elevationBar.style.display = (view === "ground") ? "flex" : "none";
  
  if (view !== "walk") pointerLock.unlock();
  
  if (view === "ground") {
    renderer.clippingPlanes = [];
    resetEagleVisibility();
    updateGroundCamera();
  } else {
    orbit.maxPolarAngle = view === "eagle" ? 0.0001 : Math.PI;
    orbit.minPolarAngle = 0;
    if (view !== "eagle" && view !== "drone") resetEagleVisibility();
    teleportToFloor(currentFloor);
  }
}

function teleportToFloor(floor) {
  currentFloor = floor;
  document.querySelectorAll(".zone").forEach(z => z.classList.toggle("active", Number(z.dataset.floor) === floor));

  if (currentView === "ground") return; 

  if (currentView === "orbit") {
    pointerLock.unlock();
    orbit.enabled = true;
    camera.fov = 58;
    camera.position.set(320, getFloorY(floor) + 180, 320);
    orbit.target.set(0, getFloorY(floor) + 12, 0);
    renderer.clippingPlanes = [];
    resetEagleVisibility();
  } else if (currentView === "drone") {
    pointerLock.unlock();
    orbit.enabled = true;
    camera.fov = 58;
    const nextFloorY = floor < WORLD.platformCount ? getFloorY(floor + 1) : getFloorY(floor) + 120;
    camera.position.set(280, getFloorY(floor) + 110, 280);
    orbit.target.set(0, getFloorY(floor) + 10, 0);
    eagleClipPlane.constant = nextFloorY - 1;
    renderer.clippingPlanes = [eagleClipPlane];
    applyDroneVisibility();
  } else if (currentView === "eagle") {
    pointerLock.unlock();
    orbit.enabled = true;
    camera.fov = 42;
    const floorY = getFloorY(floor);
    camera.position.set(0, floorY + 520, 0);
    orbit.target.set(0, floorY, 0);
    orbit.minPolarAngle = 0;
    orbit.maxPolarAngle = 0.0001;
    renderer.clippingPlanes = [];
    applyEagleVisibility();
    camera.updateProjectionMatrix();
  } else {
    renderer.clippingPlanes = [];
    resetEagleVisibility();
    orbit.enabled = false;
    const y = getFloorY(floor) + 1.75;
    camera.fov = 74;
    camera.position.set(125, y, 0);
    camera.lookAt(105, y, 0);
  }
  camera.updateProjectionMatrix();
}

function updateWalk(dt) {
  if (currentView !== "walk" || !pointerLock.isLocked) return;
  const speed = 38 * dt;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize().negate();

  if (moveState.f) camera.position.addScaledVector(forward, speed);
  if (moveState.b) camera.position.addScaledVector(forward, -speed);
  if (moveState.r) camera.position.addScaledVector(right, speed);
  if (moveState.l) camera.position.addScaledVector(right, -speed);

  const dist = Math.hypot(camera.position.x, camera.position.z);
  const maxR = WORLD.baseRadius - 2.4;
  if (dist > maxR) {
    camera.position.x *= maxR / dist;
    camera.position.z *= maxR / dist;
  }

  // Floors are flat now, camera Y is strictly human eye level
  camera.position.y = getFloorY(currentFloor) + 1.75;
}

function buildWorld() {
  buildGroundTerrain();
  buildRunwayAirport();
  buildCoreAndPlatforms();
  buildHuggingApartmentRing();
  buildHelixRamps();
  buildBaseFloors();
  buildLagoonFloor();
  buildBillionairesRow();
  buildStadium();
  buildClouds();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); 
  if (orbit.enabled) orbit.update();
  updateWalk(dt);
  waterUniforms.uTime.value += dt;
  updateDynamic(dt);
  updateBillionaireWeather(dt);

  if (rotatingRing) rotatingRing.rotation.y += 0.0011;
  if (hologramGroup) hologramGroup.rotation.y -= 0.008;

  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 1800) c.position.x = -1800;
  }

  const activeClippingPlanes = renderer.clippingPlanes;
  renderer.clippingPlanes = [];
  skyCaptureCamera.position.copy(camera.position);
  skyCaptureCamera.update(renderer, scene);
  scene.environment = renderQuality === "realistic" ? architecturalEnvironment : skyCaptureTarget.texture;
  renderer.clippingPlanes = activeClippingPlanes;
  composer.render();
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  ssao.setSize(innerWidth, innerHeight);
  smaa.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
});

document.querySelectorAll("[data-theme]").forEach(btn => btn.onclick = () => setTheme(btn.dataset.theme));
document.querySelectorAll("[data-season]").forEach(btn => btn.onclick = () => setSeason(btn.dataset.season));
document.querySelectorAll("[data-view]").forEach(btn => btn.onclick = () => setView(btn.dataset.view));
document.querySelectorAll("[data-quality]").forEach(btn => {
  btn.onclick = () => setRenderQuality(renderQuality === "realistic" ? "fast" : "realistic");
});

addEventListener("keydown", (e) => {
  if (e.code === "KeyW") moveState.f = true;
  if (e.code === "KeyS") moveState.b = true;
  if (e.code === "KeyA") moveState.l = true;
  if (e.code === "KeyD") moveState.r = true;
});
addEventListener("keyup", (e) => {
  if (e.code === "KeyW") moveState.f = false;
  if (e.code === "KeyS") moveState.b = false;
  if (e.code === "KeyA") moveState.l = false;
  if (e.code === "KeyD") moveState.r = false;
});

renderer.domElement.addEventListener("click", () => {
  if (currentView === "walk") pointerLock.lock();
});

buildWorld();
setRenderQuality("realistic");
setTheme("day");
setSeason("summer");
setView("orbit");
teleportToFloor(4);
animate();

setTimeout(() => {
  loader.style.opacity = "0";
  setTimeout(() => loader.remove(), 450);
}, 300);
