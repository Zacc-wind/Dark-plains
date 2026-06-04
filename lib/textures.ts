// Create pixelated texture patterns for different tile types

export function createGrassTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Base grass color
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, 0, 32, 32);
  
  // Add darker grass patches (pixelated style)
  ctx.fillStyle = '#388E3C';
  const patches = [
    [2, 3], [5, 7], [8, 2], [12, 15], [18, 8], [22, 20], [28, 12],
    [4, 18], [15, 5], [20, 25], [10, 28], [25, 4]
  ];
  patches.forEach(([x, y]) => {
    ctx.fillRect(x, y, 2, 2);
  });
  
  // Add lighter grass highlights
  ctx.fillStyle = '#66BB6A';
  const highlights = [
    [6, 12], [14, 22], [24, 6], [3, 26], [19, 16], [11, 8]
  ];
  highlights.forEach(([x, y]) => {
    ctx.fillRect(x, y, 1, 1);
  });
  
  return canvas;
}

export function createRoadTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Base road color (gray)
  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(0, 0, 32, 32);
  
  // Add darker road cracks/stones
  ctx.fillStyle = '#757575';
  const stones = [
    [3, 5, 3, 3], [10, 2, 2, 2], [18, 8, 4, 3], [8, 15, 3, 2],
    [22, 12, 2, 3], [15, 22, 3, 3], [5, 25, 2, 2], [28, 6, 2, 2],
    [12, 28, 3, 2], [25, 20, 2, 3]
  ];
  stones.forEach(([x, y, w, h]) => {
    ctx.fillRect(x, y, w, h);
  });
  
  // Add lighter road highlights
  ctx.fillStyle = '#BDBDBD';
  const highlights = [
    [7, 10], [16, 5], [24, 18], [4, 20], [20, 28], [11, 12]
  ];
  highlights.forEach(([x, y]) => {
    ctx.fillRect(x, y, 1, 1);
  });
  
  return canvas;
}

export function createWaterTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Base water color
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(0, 0, 32, 32);
  
  // Add darker water patches (waves)
  ctx.fillStyle = '#1976D2';
  const waves = [
    [2, 4, 6, 2], [10, 8, 8, 2], [20, 2, 5, 1],
    [5, 14, 7, 2], [15, 18, 6, 2], [3, 24, 9, 2],
    [22, 22, 5, 1], [12, 28, 8, 2]
  ];
  waves.forEach(([x, y, w, h]) => {
    ctx.fillRect(x, y, w, h);
  });
  
  // Add lighter water highlights (sparkles)
  ctx.fillStyle = '#64B5F6';
  const sparkles = [
    [8, 3], [18, 7], [4, 12], [24, 15], [12, 20], [28, 25], [6, 28]
  ];
  sparkles.forEach(([x, y]) => {
    ctx.fillRect(x, y, 2, 1);
  });
  
  return canvas;
}

export function createSandTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Base sand color
  ctx.fillStyle = '#FDD835';
  ctx.fillRect(0, 0, 32, 32);
  
  // Add darker sand grains
  ctx.fillStyle = '#F9A825';
  const grains = [
    [3, 2], [7, 5], [12, 3], [18, 7], [23, 4], [28, 6],
    [5, 12], [10, 15], [16, 11], [22, 14], [27, 17],
    [4, 22], [9, 25], [15, 20], [20, 24], [26, 28],
    [2, 28], [8, 30], [14, 27], [19, 29], [25, 26]
  ];
  grains.forEach(([x, y]) => {
    ctx.fillRect(x, y, 1, 1);
  });
  
  return canvas;
}

// Icon drawing functions
export function drawForestIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Tree trunk
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x + size/2 - 3, y + size - 8, 6, 8);
  
  // Tree foliage (three circles in pyramid)
  ctx.fillStyle = '#1B5E20';
  ctx.fillRect(x + size/2 - 8, y + size/2 - 4, 16, 12);
  ctx.fillRect(x + size/2 - 6, y + size/2 - 10, 12, 6);
  ctx.fillRect(x + size/2 - 4, y + size/2 - 14, 8, 4);
  
  // Highlight
  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(x + size/2 - 2, y + size/2 - 8, 4, 4);
}

export function drawMountainIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Mountain base
  ctx.fillStyle = '#5D4037';
  
  // Draw mountain shape (triangle-ish)
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + 4);
  ctx.lineTo(x + size - 4, y + size - 4);
  ctx.lineTo(x + 4, y + size - 4);
  ctx.closePath();
  ctx.fill();
  
  // Mountain shadow
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + 4);
  ctx.lineTo(x + size - 4, y + size - 4);
  ctx.lineTo(x + size/2, y + size/2);
  ctx.closePath();
  ctx.fill();
  
  // Snow cap
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + size/2 - 4, y + 6, 8, 6);
  ctx.fillRect(x + size/2 - 2, y + 4, 4, 2);
}

export function drawFarmIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Barn body
  ctx.fillStyle = '#D32F2F';
  ctx.fillRect(x + 6, y + size/2, size - 12, size/2 - 4);
  
  // Barn roof
  ctx.fillStyle = '#B71C1C';
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + 6);
  ctx.lineTo(x + size - 4, y + size/2);
  ctx.lineTo(x + 4, y + size/2);
  ctx.closePath();
  ctx.fill();
  
  // Door
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(x + size/2 - 2, y + size - 8, 4, 6);
  
  // Silo
  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(x + size - 8, y + size/2 + 2, 4, size/2 - 6);
  ctx.fillStyle = '#757575';
  ctx.fillRect(x + size - 9, y + size/2, 6, 2);
}

export function drawHuntingLodgeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Cabin body
  ctx.fillStyle = '#6D4C41';
  ctx.fillRect(x + 5, y + size/2 + 2, size - 10, size/2 - 6);
  
  // Roof
  ctx.fillStyle = '#4E342E';
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + 5);
  ctx.lineTo(x + size - 3, y + size/2 + 2);
  ctx.lineTo(x + 3, y + size/2 + 2);
  ctx.closePath();
  ctx.fill();
  
  // Antlers above cabin
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + size/2 - 4, y + 8);
  ctx.lineTo(x + size/2 - 6, y + 4);
  ctx.moveTo(x + size/2 + 4, y + 8);
  ctx.lineTo(x + size/2 + 6, y + 4);
  ctx.stroke();
}

export function drawWindmillIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Windmill tower
  ctx.fillStyle = '#EEEEEE';
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + 6);
  ctx.lineTo(x + size/2 + 4, y + size - 4);
  ctx.lineTo(x + size/2 - 4, y + size - 4);
  ctx.closePath();
  ctx.fill();
  
  // Center hub
  ctx.fillStyle = '#424242';
  ctx.fillRect(x + size/2 - 2, y + size/2 - 2, 4, 4);
  
  // Blades (4 directions)
  ctx.fillStyle = '#FFF9C4';
  // Blade 1 (top-right)
  ctx.fillRect(x + size/2, y + size/2 - 8, 2, 8);
  ctx.fillRect(x + size/2, y + size/2 - 8, 6, 2);
  // Blade 2 (bottom-left)
  ctx.fillRect(x + size/2 - 2, y + size/2, 2, 8);
  ctx.fillRect(x + size/2 - 8, y + size/2 + 6, 8, 2);
}

export function drawCrabTrapIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Crab body
  ctx.fillStyle = '#FF6F00';
  ctx.fillRect(x + size/2 - 4, y + size/2, 8, 6);
  
  // Crab eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + size/2 - 2, y + size/2 + 1, 1, 1);
  ctx.fillRect(x + size/2 + 1, y + size/2 + 1, 1, 1);
  
  // Crab claws
  ctx.fillStyle = '#FF6F00';
  ctx.fillRect(x + size/2 - 7, y + size/2 + 2, 3, 2);
  ctx.fillRect(x + size/2 + 4, y + size/2 + 2, 3, 2);
  ctx.fillRect(x + size/2 - 8, y + size/2, 2, 2);
  ctx.fillRect(x + size/2 + 6, y + size/2, 2, 2);
  
  // Trap/basket
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + size/2 - 6, y + size/2 + 8, 12, 8);
  ctx.strokeRect(x + size/2 - 4, y + size/2 + 10, 8, 4);
}

export function drawFishingDockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Dock posts
  ctx.fillStyle = '#6D4C41';
  ctx.fillRect(x + 8, y + size - 12, 2, 10);
  ctx.fillRect(x + size - 10, y + size - 12, 2, 10);
  
  // Dock platform
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x + 6, y + size - 14, size - 12, 3);
  
  // Fishing rod
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + size/2, y + size - 14);
  ctx.lineTo(x + size/2 + 6, y + 6);
  ctx.stroke();
  
  // Fishing line
  ctx.strokeStyle = '#90CAF9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + size/2 + 6, y + 6);
  ctx.lineTo(x + size/2 + 8, y + size/2);
  ctx.stroke();
  
  // Fish on line
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(x + size/2 + 7, y + size/2, 3, 2);
}

export function drawGraniteQuarryIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Large rock/boulder
  ctx.fillStyle = '#757575';
  ctx.fillRect(x + 6, y + size/2 - 2, 12, 10);
  ctx.fillRect(x + 8, y + size/2 - 6, 8, 4);
  
  // Rock highlights
  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(x + 8, y + size/2 - 2, 4, 4);
  
  // Rock shadows
  ctx.fillStyle = '#424242';
  ctx.fillRect(x + 14, y + size/2 + 2, 4, 6);
  
  // Pickaxe
  ctx.strokeStyle = '#6D4C41';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + size - 6, y + size - 8);
  ctx.lineTo(x + size - 10, y + size - 4);
  ctx.stroke();
  
  // Pickaxe head
  ctx.fillStyle = '#616161';
  ctx.fillRect(x + size - 12, y + size - 10, 4, 2);
}

export function drawCoffeePlantationIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Coffee plant stem
  ctx.fillStyle = '#33691E';
  ctx.fillRect(x + size/2 - 1, y + 10, 2, size - 14);
  
  // Leaves (left)
  ctx.fillStyle = '#558B2F';
  ctx.fillRect(x + size/2 - 6, y + 12, 5, 3);
  ctx.fillRect(x + size/2 - 5, y + 16, 4, 3);
  
  // Leaves (right)
  ctx.fillRect(x + size/2 + 1, y + 12, 5, 3);
  ctx.fillRect(x + size/2 + 1, y + 16, 4, 3);
  
  // Coffee beans (red cherries)
  ctx.fillStyle = '#C62828';
  ctx.fillRect(x + size/2 - 4, y + 14, 2, 2);
  ctx.fillRect(x + size/2 + 2, y + 14, 2, 2);
  ctx.fillRect(x + size/2 - 3, y + 18, 2, 2);
  ctx.fillRect(x + size/2 + 1, y + 18, 2, 2);
  
  // Basket at bottom
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x + size/2 - 4, y + size - 6, 8, 4);
}

export function drawTownIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 24) {
  // Town is 4x4 tiles, so size will be larger
  // Draw multiple buildings for a town feel
  
  // Main building (castle/town hall) - center back
  ctx.fillStyle = '#BDBDBD';
  ctx.fillRect(x + size/2 - 16, y + 8, 32, size - 16);
  
  // Tower tops
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(x + size/2 - 16, y + 8);
  ctx.lineTo(x + size/2, y - 4);
  ctx.lineTo(x + size/2 + 16, y + 8);
  ctx.closePath();
  ctx.fill();
  
  // Left building
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x + 4, y + size/2 + 8, size/2 - 4, size/2 - 12);
  ctx.fillStyle = '#6D4C41';
  ctx.fillRect(x + 4, y + size/2 + 8, size/2 - 4, 6);
  
  // Right building
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x + size - size/2, y + size/2 + 8, size/2 - 4, size/2 - 12);
  ctx.fillStyle = '#6D4C41';
  ctx.fillRect(x + size - size/2, y + size/2 + 8, size/2 - 4, 6);
  
  // Windows on main building
  ctx.fillStyle = '#FFEB3B';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillRect(x + size/2 - 12 + i * 8, y + 16 + j * 8, 3, 4);
    }
  }
  
  // Tower flags
  ctx.fillStyle = '#F44336';
  ctx.fillRect(x + size/2 - 2, y - 8, 4, 8);
  ctx.fillRect(x + size/2, y - 6, 8, 4);
  
  // Door
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(x + size/2 - 6, y + size - 12, 12, 8);
}

export interface TextureCache {
  grass: CanvasPattern | null;
  road: CanvasPattern | null;
  water: CanvasPattern | null;
  sand: CanvasPattern | null;
}

export function createTexturePatterns(ctx: CanvasRenderingContext2D): TextureCache {
  return {
    grass: ctx.createPattern(createGrassTexture(), 'repeat'),
    road: ctx.createPattern(createRoadTexture(), 'repeat'),
    water: ctx.createPattern(createWaterTexture(), 'repeat'),
    sand: ctx.createPattern(createSandTexture(), 'repeat'),
  };
}
