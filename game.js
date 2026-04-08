// @ts-check

/**
 * Clean, typed, tile-based engine.
 * The core world is a Uint8Array, static terrain is cached once, and the
 * gameplay layer only draws the camera slice plus a handful of entities.
 */

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const WORLD_WIDTH = 96;
const WORLD_HEIGHT = 64;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
ctx.imageSmoothingEnabled = false;

/** @typedef {0|1|2|3|4|5} TileId */
/** @typedef {{x:number, y:number, type:string, name:string, seen?:boolean, reward?:string}} Entity */
/** @typedef {{x:number, y:number, facing:'up'|'down'|'left'|'right', dharma:number, vitality:number, inventory:string[], visualRadius:number}} Player */
/** @typedef {{width:number, height:number, tiles:Uint8Array, terrainCanvas: HTMLCanvasElement, terrainCtx: CanvasRenderingContext2D, dirty:boolean, npcs:Entity[], objects:Entity[]}} World */

const TILES = /** @type {const} */ ({
  grass: 0,
  path: 1,
  water: 2,
  forest: 3,
  mountain: 4,
  shrine: 5
});

const TILE_LABELS = [
  'grass',
  'path',
  'water',
  'forest',
  'mountain',
  'shrine'
];

const PALETTE = {
  grass: '#7d9b62',
  path: '#c8ad7f',
  water: '#4f7fb8',
  forest: '#3c6243',
  mountain: '#83807a',
  shrine: '#efe1b6',
  shrineFloor: '#ead79a',
  player: '#f1d7b0',
  playerTrim: '#2a1f18',
  npc: '#f0cf67',
  npcTrim: '#4f3d1f',
  text: '#f5ebd7',
  muted: '#b7a78d',
  panel: 'rgba(15, 18, 20, 0.88)'
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function indexFor(x, y) {
  return y * WORLD_WIDTH + x;
}

function createCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function makeWorld() {
  const terrainCanvas = createCanvas(WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
  const terrainCtx = terrainCanvas.getContext('2d');
  terrainCtx.imageSmoothingEnabled = false;

  /** @type {World} */
  const world = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    tiles: new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT),
    terrainCanvas,
    terrainCtx,
    dirty: true,
    npcs: [],
    objects: []
  };

  return world;
}

/** @type {World} */
const world = makeWorld();

/** @type {Player} */
const player = {
  x: Math.floor(WORLD_WIDTH / 2) - 8,
  y: Math.floor(WORLD_HEIGHT / 2) + 4,
  facing: 'down',
  dharma: 52,
  vitality: 100,
  inventory: ['river shell'],
  visualRadius: 24
};

const camera = {
  x: 0,
  y: 0
};

const statsEl = document.getElementById('stats');
const inventoryEl = document.getElementById('inventory');
const logEl = document.getElementById('log');
const dialogueEl = document.getElementById('dialogue');

function setTile(x, y, tileId) {
  world.tiles[indexFor(x, y)] = tileId;
}

function getTile(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return TILES.mountain;
  return world.tiles[indexFor(x, y)];
}

function tileName(tileId) {
  return TILE_LABELS[tileId] || 'grass';
}

function generateWorld() {
  world.npcs = [];
  world.objects = [];

  const centerX = Math.floor(WORLD_WIDTH / 2);
  const centerY = Math.floor(WORLD_HEIGHT / 2);
  const shrineX = centerX + 3;
  const shrineY = centerY + 1;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      let tile = TILES.grass;

      const border = x === 0 || y === 0 || x === WORLD_WIDTH - 1 || y === WORLD_HEIGHT - 1;
      const lake = Math.abs(x - 18) + Math.abs(y - 15) < 10 || (x > 75 && y < 18 && Math.abs(x - 83) + Math.abs(y - 10) < 12);
      const riverBand = Math.abs(y - (centerY + Math.sin(x / 8) * 3)) < 2.2;
      const forestWest = x < 18 && y > 30 && y < 52;
      const forestEast = x > 66 && y > 36 && y < 58;
      const pathA = (x > 12 && x < centerX + 2 && Math.abs(y - (centerY + 2)) <= 1) || (y > 12 && y < centerY + 2 && Math.abs(x - (centerX - 8)) <= 1);
      const pathB = (x > centerX - 2 && x < shrineX + 10 && Math.abs(y - shrineY) <= 1);

      if (border) tile = TILES.mountain;
      else if (lake || riverBand) tile = TILES.water;
      else if (forestWest || forestEast) tile = TILES.forest;
      else if (pathA || pathB) tile = TILES.path;
      else if (Math.abs(x - shrineX) <= 1 && Math.abs(y - shrineY) <= 1) tile = TILES.shrine;

      setTile(x, y, tile);
    }
  }

  world.objects.push(
    { x: shrineX, y: shrineY, type: 'shrine', name: 'quiet shrine', reward: 'dharma' },
    { x: centerX - 6, y: centerY - 2, type: 'relic', name: 'bronze relic', reward: 'relic' }
  );

  world.npcs.push({
    x: centerX + 10,
    y: centerY + 5,
    type: 'sage',
    name: 'path sage',
    reward: 'wisdom'
  });

  world.dirty = true;
}

function terrainColor(tileId) {
  switch (tileId) {
    case TILES.path: return PALETTE.path;
    case TILES.water: return PALETTE.water;
    case TILES.forest: return PALETTE.forest;
    case TILES.mountain: return PALETTE.mountain;
    case TILES.shrine: return PALETTE.shrineFloor;
    default: return PALETTE.grass;
  }
}

function renderTerrain() {
  const g = world.terrainCtx;
  g.clearRect(0, 0, world.terrainCanvas.width, world.terrainCanvas.height);
  g.imageSmoothingEnabled = false;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tileId = getTile(x, y);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      g.fillStyle = terrainColor(tileId);
      g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // subtle depth without visual noise
      g.fillStyle = tileId === TILES.water ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)';
      if (tileId === TILES.water) {
        g.fillRect(px + 4, py + 9, 18, 3);
      } else if (tileId === TILES.path) {
        g.fillRect(px + 5, py + 5, 22, 2);
      } else if (tileId === TILES.shrine) {
        g.fillRect(px + 6, py + 6, 20, 2);
      }

      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
      g.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
    }
  }

  // shrine structure baked into the buffer for a cleaner, performance-friendly world.
  const shrine = world.objects.find((o) => o.type === 'shrine');
  if (shrine) {
    const px = shrine.x * TILE_SIZE;
    const py = shrine.y * TILE_SIZE;
    g.fillStyle = '#9a7c4b';
    g.fillRect(px + 6, py + 10, 20, 10);
    g.fillStyle = '#f6e6a5';
    g.fillRect(px + 10, py + 6, 12, 6);
  }

  world.dirty = false;
}

function updateCamera() {
  const worldPixelWidth = WORLD_WIDTH * TILE_SIZE;
  const worldPixelHeight = WORLD_HEIGHT * TILE_SIZE;
  camera.x = clamp(player.x * TILE_SIZE - VIEW_WIDTH / 2, 0, worldPixelWidth - VIEW_WIDTH);
  camera.y = clamp(player.y * TILE_SIZE - VIEW_HEIGHT / 2, 0, worldPixelHeight - VIEW_HEIGHT);
}

function drawPanelText(el, html) {
  if (el) el.innerHTML = html;
}

function updateHud() {
  drawPanelText(statsEl, `
    <div class="panel-title">stats</div>
    <div class="stat-row"><span>dharma</span><strong>${player.dharma}</strong></div>
    <div class="stat-row"><span>vitality</span><strong>${player.vitality}</strong></div>
    <div class="stat-row"><span>position</span><strong>${player.x}, ${player.y}</strong></div>
  `);

  drawPanelText(inventoryEl, `
    <div class="panel-title">inventory</div>
    <div class="inventory-list">${player.inventory.map((item) => `<div>${item}</div>`).join('')}</div>
  `);
}

function log(message) {
  if (!logEl) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = message;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function pointToScreen(x, y) {
  return {
    x: Math.round(x * TILE_SIZE - camera.x),
    y: Math.round(y * TILE_SIZE - camera.y)
  };
}

function drawPlayer() {
  const p = pointToScreen(player.x, player.y);

  // outer glow and shadow create a crisp silhouette.
  ctx.fillStyle = 'rgba(255, 230, 140, 0.25)';
  ctx.fillRect(p.x - 8, p.y - 10, 48, 48);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(p.x + 6, p.y + 28, 20, 7);

  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(p.x + 7, p.y + 2, 18, 24);
  ctx.fillStyle = PALETTE.playerTrim;
  ctx.fillRect(p.x + 10, p.y + 7, 12, 12);
  ctx.fillStyle = '#f6c94c';
  ctx.fillRect(p.x + 4, p.y - 6, 24, 10);

  // orientation marker, compact and readable.
  ctx.fillStyle = '#fff2ba';
  if (player.facing === 'up') ctx.fillRect(p.x + 11, p.y - 2, 6, 4);
  else if (player.facing === 'down') ctx.fillRect(p.x + 11, p.y + 24, 6, 4);
  else if (player.facing === 'left') ctx.fillRect(p.x + 2, p.y + 10, 4, 6);
  else ctx.fillRect(p.x + 22, p.y + 10, 4, 6);
}

function drawNpc(npc) {
  const p = pointToScreen(npc.x, npc.y);
  ctx.fillStyle = 'rgba(255, 228, 120, 0.2)';
  ctx.fillRect(p.x - 4, p.y - 4, 40, 40);
  ctx.fillStyle = PALETTE.npc;
  ctx.fillRect(p.x + 8, p.y + 4, 16, 22);
  ctx.fillStyle = PALETTE.npcTrim;
  ctx.fillRect(p.x + 11, p.y + 8, 10, 10);
}

function drawObjects() {
  for (const obj of world.objects) {
    const p = pointToScreen(obj.x, obj.y);
    if (obj.type === 'relic') {
      ctx.fillStyle = '#d5b37a';
      ctx.fillRect(p.x + 10, p.y + 10, 12, 12);
      ctx.fillStyle = '#fff1bf';
      ctx.fillRect(p.x + 13, p.y + 13, 6, 6);
    }
  }
}

function draw() {
  if (world.dirty) renderTerrain();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(world.terrainCanvas, camera.x, camera.y, VIEW_WIDTH, VIEW_HEIGHT, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  drawObjects();
  for (const npc of world.npcs) drawNpc(npc);
  drawPlayer();
}

function canWalk(x, y) {
  const tile = getTile(x, y);
  return tile !== TILES.water && tile !== TILES.mountain;
}

function movePlayer(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!canWalk(nx, ny)) return;

  player.x = nx;
  player.y = ny;
  if (dx < 0) player.facing = 'left';
  else if (dx > 0) player.facing = 'right';
  else if (dy < 0) player.facing = 'up';
  else if (dy > 0) player.facing = 'down';
  draw();
  updateHud();
}

function addItem(item) {
  if (!player.inventory.includes(item)) player.inventory.push(item);
  updateHud();
}

function interact() {
  for (const obj of world.objects) {
    const close = Math.abs(obj.x - player.x) <= 1 && Math.abs(obj.y - player.y) <= 1;
    if (!close) continue;

    if (obj.type === 'shrine') {
      player.dharma = Math.min(100, player.dharma + 12);
      player.vitality = Math.min(100, player.vitality + 6);
      log('you rest at the shrine. dharma rises and the road feels lighter.');
      updateHud();
      draw();
      return;
    }

    if (obj.type === 'relic' && !obj.seen) {
      obj.seen = true;
      addItem('bronze relic');
      player.dharma = Math.min(100, player.dharma + 4);
      log('you found a bronze relic.');
      draw();
      return;
    }
  }

  for (const npc of world.npcs) {
    const close = Math.abs(npc.x - player.x) <= 1 && Math.abs(npc.y - player.y) <= 1;
    if (!close) continue;

    if (dialogueEl) {
      dialogueEl.innerHTML = `
        <div class="name">${npc.name}</div>
        <div class="text">keep the world simple. clarity is the real luxury.</div>
      `;
      dialogueEl.classList.add('visible');
    }
    log(`${npc.name}: keep the world simple. clarity is the real luxury.`);
    return;
  }

  log('nothing close enough to interact with.');
}

function closeDialogue() {
  if (dialogueEl) dialogueEl.classList.remove('visible');
}

function handleKeyDown(event) {
  const key = String(event.key || '').toLowerCase();
  if (dialogueEl && dialogueEl.classList.contains('visible') && key === 'escape') {
    closeDialogue();
    return;
  }

  if (key === 'arrowup' || key === 'w') movePlayer(0, -1);
  else if (key === 'arrowdown' || key === 's') movePlayer(0, 1);
  else if (key === 'arrowleft' || key === 'a') movePlayer(-1, 0);
  else if (key === 'arrowright' || key === 'd') movePlayer(1, 0);
  else if (key === ' ') interact();
}

function loop() {
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', handleKeyDown);

generateWorld();
updateHud();
log('welcome to aryavarta. explore the clean path network, the shrine, and the quiet forest.');
loop();

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  global.world = world;
  global.player = player;
  global.camera = camera;
  global.TILE_SIZE = TILE_SIZE;
  global.generateWorld = generateWorld;
  global.renderTerrain = renderTerrain;
  global.draw = draw;
  global.movePlayer = movePlayer;
  global.interact = interact;
  global.updateHud = updateHud;
  global.addItem = addItem;
  global.getTile = getTile;
  global.canWalk = canWalk;
  global.log = log;
}
