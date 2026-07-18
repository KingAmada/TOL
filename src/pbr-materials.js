import * as THREE from "three";

const PBR_ROOT = "./assets/pbr";

function configureTexture(texture, renderer, repeat, color = false) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function loadTextureSet(loader, renderer, id, repeat, { ao = false } = {}) {
  const base = `${PBR_ROOT}/${id}/${id}_1K-JPG`;
  const load = (suffix, color = false) => configureTexture(
    loader.load(`${base}_${suffix}.jpg`),
    renderer,
    repeat,
    color
  );
  const displacement = load("Displacement");
  const set = {
    map: load("Color", true),
    roughnessMap: load("Roughness"),
    normalMap: load("NormalGL"),
    bumpMap: displacement
  };
  if (ao) {
    set.aoMap = load("AmbientOcclusion");
    // Most scene primitives only expose uv0. Three's texture channel lets the AO
    // map use that same, correctly tiled UV set without duplicating attributes.
    set.aoMap.channel = 0;
  }
  return set;
}

function physical(params) {
  return new THREE.MeshPhysicalMaterial(params);
}

export function createPBRMaterialLibrary(renderer) {
  const loader = new THREE.TextureLoader();
  const concrete = loadTextureSet(loader, renderer, "Concrete034", [3.2, 3.2]);
  const asphalt = loadTextureSet(loader, renderer, "Asphalt010", [5, 5]);
  const plaster = loadTextureSet(loader, renderer, "Plaster001", [2.4, 3.2]);
  const urbanFacade = loadTextureSet(loader, renderer, "Facade018A", [1.5, 2]);
  const metal = loadTextureSet(loader, renderer, "Metal009", [2.2, 5]);
  const grass = loadTextureSet(loader, renderer, "Grass005", [7, 7], { ao: true });
  const travertine = loadTextureSet(loader, renderer, "Travertine009", [2.2, 2.8], { ao: true });

  const glassImperfection = metal.roughnessMap.clone();
  glassImperfection.repeat.set(0.75, 2.6);
  glassImperfection.needsUpdate = true;

  const makeGlass = ({ color, roughness, transmission, opacity, envMapIntensity, attenuationColor }) => physical({
    color,
    roughness,
    roughnessMap: glassImperfection,
    metalness: 0,
    transmission,
    thickness: 0.55,
    ior: 1.52,
    specularIntensity: 1,
    specularColor: 0xffffff,
    clearcoat: 0.42,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity,
    attenuationColor,
    attenuationDistance: 8,
    envMapIntensity,
    depthWrite: false,
    side: THREE.FrontSide
  });

  const nightMaterials = [];
  const emissive = (color, intensity = 0.12, roughness = 0.72) => {
    const material = physical({
      color: new THREE.Color(color).multiplyScalar(0.25),
      emissive: color,
      emissiveIntensity: intensity,
      roughness,
      toneMapped: true
    });
    material.userData.dayIntensity = intensity;
    material.userData.sunsetIntensity = Math.max(0.55, intensity * 4);
    material.userData.nightIntensity = Math.max(2.4, intensity * 18);
    nightMaterials.push(material);
    return material;
  };

  const materials = {
    trunk: physical({
      color: 0x9da4ad,
      ...metal,
      roughness: 0.48,
      metalness: 0.82,
      normalScale: new THREE.Vector2(0.32, 0.32),
      bumpScale: 0.015
    }),
    slab: physical({
      color: 0xaeb3b8,
      ...concrete,
      roughness: 0.86,
      metalness: 0.04,
      normalScale: new THREE.Vector2(0.58, 0.58),
      bumpScale: 0.045
    }),
    rim: physical({
      color: 0xc7cdd3,
      ...metal,
      roughness: 0.3,
      metalness: 0.88,
      normalScale: new THREE.Vector2(0.22, 0.22),
      bumpScale: 0.01
    }),
    brushedMetal: physical({
      color: 0xaeb7c2,
      ...metal,
      roughness: 0.36,
      metalness: 0.92,
      normalScale: new THREE.Vector2(0.34, 0.34),
      bumpScale: 0.012
    }),
    bronzeMetal: physical({
      color: 0x8f6c4d,
      ...metal,
      roughness: 0.4,
      metalness: 0.9,
      normalScale: new THREE.Vector2(0.28, 0.28),
      bumpScale: 0.01
    }),
    asphalt: physical({
      color: 0x777b80,
      ...asphalt,
      roughness: 0.94,
      metalness: 0,
      normalScale: new THREE.Vector2(0.72, 0.72),
      bumpScale: 0.045,
      side: THREE.DoubleSide
    }),
    asphaltWear: physical({
      color: 0x444b51,
      ...asphalt,
      roughness: 0.72,
      normalScale: new THREE.Vector2(0.38, 0.38),
      bumpScale: 0.025,
      transparent: true,
      opacity: 0.33,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -5,
      side: THREE.DoubleSide
    }),
    oilStain: physical({
      color: 0x172027,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.36,
      clearcoatRoughness: 0.3,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    lane: physical({ color: 0xe5e1d4, roughness: 0.8, side: THREE.DoubleSide }),
    laneWorn: physical({ color: 0xc9c2ac, roughness: 0.9, transparent: true, opacity: 0.52, side: THREE.DoubleSide }),
    grass: physical({
      color: 0x84a87b,
      ...grass,
      roughness: 1,
      normalScale: new THREE.Vector2(0.72, 0.72),
      bumpScale: 0.04,
      side: THREE.DoubleSide
    }),
    grassDeep: physical({
      color: 0x557858,
      ...grass,
      roughness: 1,
      normalScale: new THREE.Vector2(0.82, 0.82),
      bumpScale: 0.05,
      side: THREE.DoubleSide
    }),
    concrete: physical({
      color: 0xbabec2,
      ...concrete,
      roughness: 0.9,
      normalScale: new THREE.Vector2(0.64, 0.64),
      bumpScale: 0.05
    }),
    curtainWall: physical({
      color: 0x91aab3,
      roughness: 0.17,
      roughnessMap: glassImperfection,
      metalness: 0.08,
      ior: 1.5,
      specularIntensity: 1,
      clearcoat: 0.48,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.9,
      side: THREE.DoubleSide
    }),
    luxuryGlass: makeGlass({
      color: 0x9fc5d1,
      roughness: 0.075,
      transmission: 0.2,
      opacity: 0.82,
      envMapIntensity: 2.25,
      attenuationColor: 0xb8dbe2
    }),
    corporateGlass: makeGlass({
      color: 0x7896a6,
      roughness: 0.11,
      transmission: 0.12,
      opacity: 0.88,
      envMapIntensity: 2.05,
      attenuationColor: 0x8db7c5
    }),
    retailGlass: makeGlass({
      color: 0xc6d7d4,
      roughness: 0.055,
      transmission: 0.32,
      opacity: 0.72,
      envMapIntensity: 2.35,
      attenuationColor: 0xd6e6df
    }),
    smokedGlass: makeGlass({
      color: 0x556572,
      roughness: 0.135,
      transmission: 0.06,
      opacity: 0.9,
      envMapIntensity: 1.85,
      attenuationColor: 0x6f8791
    }),
    windowGlass: makeGlass({
      color: 0xa7bdc5,
      roughness: 0.095,
      transmission: 0.16,
      opacity: 0.82,
      envMapIntensity: 2.05,
      attenuationColor: 0xb9d1d5
    }),
    whiteFacade: physical({
      color: 0xf2f0ea,
      ...plaster,
      roughness: 0.91,
      normalScale: new THREE.Vector2(0.5, 0.5),
      bumpScale: 0.035
    }),
    warmFacade: physical({
      color: 0xe0cdbc,
      ...plaster,
      roughness: 0.92,
      normalScale: new THREE.Vector2(0.5, 0.5),
      bumpScale: 0.04
    }),
    sandFacade: physical({
      color: 0xe9dcc8,
      ...plaster,
      roughness: 0.93,
      normalScale: new THREE.Vector2(0.48, 0.48),
      bumpScale: 0.035
    }),
    sageFacade: physical({
      color: 0xcbd5c9,
      ...plaster,
      roughness: 0.92,
      normalScale: new THREE.Vector2(0.5, 0.5),
      bumpScale: 0.04
    }),
    stoneFacade: physical({
      color: 0xe4d5bd,
      ...travertine,
      roughness: 0.7,
      normalScale: new THREE.Vector2(0.52, 0.52),
      bumpScale: 0.035
    }),
    compositeFacade: physical({
      color: 0x8b9199,
      ...metal,
      roughness: 0.44,
      metalness: 0.7,
      normalScale: new THREE.Vector2(0.24, 0.24),
      bumpScale: 0.012
    }),
    brickFacade: physical({
      color: 0xd7c6bb,
      ...urbanFacade,
      roughness: 0.78,
      normalScale: new THREE.Vector2(0.58, 0.58),
      bumpScale: 0.04
    }),
    mullion: physical({ color: 0x1e2730, ...metal, roughness: 0.32, metalness: 0.9, bumpScale: 0.008 }),
    seal: physical({ color: 0x10161b, roughness: 0.72 }),
    edgeDirt: physical({ color: 0x2f3435, roughness: 1, transparent: true, opacity: 0.26 }),
    interiorDark: physical({ color: 0x101820, roughness: 0.96, metalness: 0.02 }),
    roofTerracotta: physical({ color: 0xa35d45, ...plaster, roughness: 0.94, normalScale: new THREE.Vector2(0.45, 0.45), bumpScale: 0.03 }),
    roofSlate: physical({ color: 0x4a5563, ...travertine, roughness: 0.86, normalScale: new THREE.Vector2(0.4, 0.4), bumpScale: 0.025 }),
    roofCharcoal: physical({ color: 0x353b42, ...travertine, roughness: 0.9, normalScale: new THREE.Vector2(0.38, 0.38), bumpScale: 0.025 }),
    roofCopper: physical({ color: 0x8c674e, ...metal, roughness: 0.52, metalness: 0.62, bumpScale: 0.012 }),
    treeTrunk: physical({ color: 0x775a46, roughness: 1 }),
    hedge: physical({ color: 0x315d37, ...grass, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8), bumpScale: 0.035 }),
    lit: emissive(0xffd98a, 0.08, 0.62),
    warmExterior: emissive(0xffc06b, 0.04, 0.52),
    roadLamp: emissive(0xffe0a0, 0.05, 0.48),
    neonPink: emissive(0xff4fd8, 0.18, 0.36),
    neonCyan: emissive(0x58efff, 0.18, 0.36),
    sand: physical({ color: 0xdcc28d, roughness: 1, side: THREE.DoubleSide }),
    paver: physical({ color: 0xc7c0b5, ...travertine, roughness: 0.82, normalScale: new THREE.Vector2(0.45, 0.45), bumpScale: 0.025 })
  };

  // Backwards-compatible alias used by existing terminal and arc-building code.
  materials.glass = materials.corporateGlass;

  return { materials, nightMaterials };
}
