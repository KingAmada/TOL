export const WORLD = {
  platformCount: 16,
  coreHeight: 369,
  rootThickness: 5,
  baseRadius: 184.5,
  coreRadius: 34.5,
  rampWidth: 7,
  apartmentRadius: 84.5,
  stadiumRadius: 150
};

WORLD.voidRadius = WORLD.coreRadius + WORLD.rampWidth;

export const EDGE_THICKNESS = 1.6;

const rawClearances = [15, 15, 15, 15, 15, 18, 18, 18, 18, 18, 20, 20, 20, 20, 20, 20];
const totalRoot = WORLD.platformCount * WORLD.rootThickness;
const totalClear = WORLD.coreHeight - totalRoot;
const clearanceScale = totalClear / rawClearances.reduce((a, b) => a + b, 0);

export const floorClearances = rawClearances.map((value) => value * clearanceScale);
export const floorY = [0];

for (let i = 0; i < WORLD.platformCount; i++) {
  floorY.push(floorY[i] + floorClearances[i] + WORLD.rootThickness);
}

export const getFloorY = (index) => floorY[Math.min(index, WORLD.platformCount)];
export const TOP_Y = getFloorY(WORLD.platformCount);
