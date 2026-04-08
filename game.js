// @ts-check

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const ENTITY_SHRINE = 5;
const ENTITY_RELIC = 6;
const ENTITY_SAGE = 7;

const ITEM_NAMES = {
  1: 'river shell',
  2: 'bronze relic'
};

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
  muted: '#b7a78d'
};

canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
ctx.imageSmoothingEnabled = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

const statsEl = document.getElementById('stats');
const inventoryEl = document.getElementById('inventory');
const logEl = document.getElementById('log');
const dialogueEl = document.getElementById('dialogue');
const touchControlsEl = document.getElementById('touch-controls');
const controlButtons = {
  up: document.getElementById('btn-up'),
  down: document.getElementById('btn-down'),
  left: document.getElementById('btn-left'),
  right: document.getElementById('btn-right'),
  act: document.getElementById('btn-act')
};

const world = {
  terrainCanvas: createCanvas(1, 1),
  terrainCtx: null,
  dirty: true
};

const camera = {
  x: 0,
  y: 0
};

let simulation = null;
let gameStarted = false;

function kindToCode(kind) {
  if (typeof kind === 'number') return kind;
  switch (String(kind).toLowerCase()) {
    case 'shrine': return ENTITY_SHRINE;
    case 'relic': return ENTITY_RELIC;
    case 'sage': return ENTITY_SAGE;
    default: return -1;
  }
}

function tileColor(tileId) {
  switch (tileId) {
    case 1: return PALETTE.path;
    case 2: return PALETTE.water;
    case 3: return PALETTE.forest;
    case 4: return PALETTE.mountain;
    case 5: return PALETTE.shrineFloor;
    default: return PALETTE.grass;
  }
}

function itemName(code) {
  return ITEM_NAMES[code] || `item ${code}`;
}

function updateCamera() {
  if (!simulation) return;
  const worldPixelWidth = simulation.getWorldWidth() * TILE_SIZE;
  const worldPixelHeight = simulation.getWorldHeight() * TILE_SIZE;
  camera.x = clamp(simulation.getPlayerX() * TILE_SIZE - VIEW_WIDTH / 2, 0, worldPixelWidth - VIEW_WIDTH);
  camera.y = clamp(simulation.getPlayerY() * TILE_SIZE - VIEW_HEIGHT / 2, 0, worldPixelHeight - VIEW_HEIGHT);
}

function prepareTerrainBuffer() {
  if (!simulation) return;
  world.terrainCanvas.width = simulation.getWorldWidth() * TILE_SIZE;
  world.terrainCanvas.height = simulation.getWorldHeight() * TILE_SIZE;
  world.terrainCtx = world.terrainCanvas.getContext('2d');
  world.terrainCtx.imageSmoothingEnabled = false;
  world.dirty = true;
}

function renderTerrain() {
  if (!simulation || !world.terrainCtx) return;

  const width = simulation.getWorldWidth();
  const height = simulation.getWorldHeight();
  const g = world.terrainCtx;

  g.clearRect(0, 0, world.terrainCanvas.width, world.terrainCanvas.height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileId = simulation.getTile(x, y);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      g.fillStyle = tileColor(tileId);
      g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      g.fillStyle = tileId === 2 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)';
      if (tileId === 2) g.fillRect(px + 4, py + 9, 18, 3);
      else if (tileId === 1) g.fillRect(px + 5, py + 5, 22, 2);
      else if (tileId === 5) g.fillRect(px + 6, py + 6, 20, 2);

      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
      g.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
    }
  }

  const shrineIndex = simulation.findEntity(ENTITY_SHRINE);
  if (shrineIndex >= 0) {
    const px = simulation.entityX(shrineIndex) * TILE_SIZE;
    const py = simulation.entityY(shrineIndex) * TILE_SIZE;
    g.fillStyle = '#9a7c4b';
    g.fillRect(px + 6, py + 10, 20, 10);
    g.fillStyle = '#f6e6a5';
    g.fillRect(px + 10, py + 6, 12, 6);
  }

  world.dirty = false;
}

function drawPlayer() {
  const x = simulation.getPlayerX() * TILE_SIZE - camera.x;
  const y = simulation.getPlayerY() * TILE_SIZE - camera.y;
  const facing = simulation.getPlayerFacing();

  ctx.fillStyle = 'rgba(255, 230, 140, 0.25)';
  ctx.fillRect(x - 8, y - 10, 48, 48);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x + 6, y + 28, 20, 7);
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(x + 7, y + 2, 18, 24);
  ctx.fillStyle = PALETTE.playerTrim;
  ctx.fillRect(x + 10, y + 7, 12, 12);
  ctx.fillStyle = '#f6c94c';
  ctx.fillRect(x + 4, y - 6, 24, 10);
  ctx.fillStyle = '#fff2ba';
  if (facing === 0) ctx.fillRect(x + 11, y - 2, 6, 4);
  else if (facing === 1) ctx.fillRect(x + 11, y + 24, 6, 4);
  else if (facing === 2) ctx.fillRect(x + 2, y + 10, 4, 6);
  else ctx.fillRect(x + 22, y + 10, 4, 6);
}

function drawEntities() {
  const count = simulation.entityCount();
  for (let i = 0; i < count; i++) {
    const kind = simulation.entityKind(i);
    if (kind === ENTITY_SHRINE) continue;

    const x = simulation.entityX(i) * TILE_SIZE - camera.x;
    const y = simulation.entityY(i) * TILE_SIZE - camera.y;

    if (kind === ENTITY_RELIC) {
      ctx.fillStyle = '#d5b37a';
      ctx.fillRect(x + 10, y + 10, 12, 12);
      ctx.fillStyle = '#fff1bf';
      ctx.fillRect(x + 13, y + 13, 6, 6);
    } else if (kind === ENTITY_SAGE) {
      ctx.fillStyle = 'rgba(255, 228, 120, 0.2)';
      ctx.fillRect(x - 4, y - 4, 40, 40);
      ctx.fillStyle = PALETTE.npc;
      ctx.fillRect(x + 8, y + 4, 16, 22);
      ctx.fillStyle = PALETTE.npcTrim;
      ctx.fillRect(x + 11, y + 8, 10, 10);
    }
  }
}

function draw() {
  if (!simulation) return;
  if (world.dirty) renderTerrain();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    world.terrainCanvas,
    camera.x,
    camera.y,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    0,
    0,
    VIEW_WIDTH,
    VIEW_HEIGHT
  );

  drawEntities();
  drawPlayer();
}

function drawPanel(el, html) {
  if (el) el.innerHTML = html;
}

function updateHud() {
  if (!simulation) return;

  drawPanel(statsEl, `
    <div class="panel-title">stats</div>
    <div class="stat-row"><span>dharma</span><strong>${simulation.getPlayerDharma()}</strong></div>
    <div class="stat-row"><span>vitality</span><strong>${simulation.getPlayerVitality()}</strong></div>
    <div class="stat-row"><span>position</span><strong>${simulation.getPlayerX()}, ${simulation.getPlayerY()}</strong></div>
  `);

  const inventoryItems = [];
  for (let i = 0; i < simulation.getInventoryLength(); i++) {
    inventoryItems.push(`<div>${itemName(simulation.getInventoryItem(i))}</div>`);
  }

  drawPanel(inventoryEl, `
    <div class="panel-title">inventory</div>
    <div class="inventory-list">${inventoryItems.join('')}</div>
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

function showDialogue(name, text) {
  if (!dialogueEl) return;
  dialogueEl.innerHTML = `<div class="name">${name}</div><div class="text">${text}</div>`;
  dialogueEl.classList.add('visible');
}

function closeDialogue() {
  if (dialogueEl) dialogueEl.classList.remove('visible');
}

function movePlayer(dx, dy) {
  if (!simulation) return 0;
  const moved = simulation.movePlayer(dx, dy);
  if (moved) {
    updateHud();
    draw();
  }
  return moved;
}

function generateWorld() {
  if (!simulation) throw new Error('simulation not ready');
  simulation.init();
  prepareTerrainBuffer();
  updateHud();
  draw();
}

function interact() {
  if (!simulation) return 0;
  const outcome = simulation.interact();
  if (outcome === 1) {
    log('you rest at the shrine. dharma rises and the road feels lighter.');
    updateHud();
    draw();
    return outcome;
  }
  if (outcome === 2) {
    log('you found a bronze relic.');
    updateHud();
    draw();
    return outcome;
  }
  if (outcome === 3) {
    showDialogue('path sage', 'keep the world simple. clarity is the real luxury.');
    log('path sage: keep the world simple. clarity is the real luxury.');
    return outcome;
  }

  log('nothing close enough to interact with.');
  return outcome;
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

function bindTouchControls() {
  const bindings = [
    [controlButtons.up, () => movePlayer(0, -1)],
    [controlButtons.down, () => movePlayer(0, 1)],
    [controlButtons.left, () => movePlayer(-1, 0)],
    [controlButtons.right, () => movePlayer(1, 0)],
    [controlButtons.act, () => interact()]
  ];

  for (const [button, action] of bindings) {
    if (!button) continue;
    const handler = (event) => {
      event.preventDefault();
      action();
    };
    button.addEventListener('pointerdown', handler);
    button.addEventListener('click', handler);
  }
}

function loop() {
  if (!simulation) return;
  draw();
  requestAnimationFrame(loop);
}

async function loadSimulation() {
  const response = await fetch('simulation/simulation.wasm');
  if (!response.ok) throw new Error(`failed to load wasm simulation: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;

  simulation = {
    backend: 'wasm',
    init: () => exports.init_world(),
    getWorldWidth: () => exports.world_width(),
    getWorldHeight: () => exports.world_height(),
    getTileSize: () => exports.tile_size(),
    getTile: (x, y) => exports.get_tile(x, y),
    getPlayerX: () => exports.player_x(),
    getPlayerY: () => exports.player_y(),
    getPlayerFacing: () => exports.player_facing(),
    getPlayerDharma: () => exports.player_dharma(),
    getPlayerVitality: () => exports.player_vitality(),
    getInventoryLength: () => exports.inventory_len(),
    getInventoryItem: (index) => exports.inventory_item(index),
    entityCount: () => exports.entity_count(),
    entityKind: (index) => exports.entity_kind(index),
    entityX: (index) => exports.entity_x(index),
    entityY: (index) => exports.entity_y(index),
    entitySeen: (index) => exports.entity_seen(index),
    getObjectCount: () => exports.entity_count(),
    getObjectKind: (index) => exports.entity_kind(index),
    getObjectX: (index) => exports.entity_x(index),
    getObjectY: (index) => exports.entity_y(index),
    getObjectSeen: (index) => exports.entity_seen(index),
    findEntity: (kind) => exports.find_entity(kindToCode(kind)),
    findObject: (kind) => exports.find_entity(kindToCode(kind)),
    setPlayerPosition: (x, y) => exports.set_player_position(x, y),
    movePlayer: (dx, dy) => exports.move_player(dx, dy),
    interact: () => exports.interact()
  };

  if (typeof global !== 'undefined') {
    global.simulation = simulation;
  }

  generateWorld();
  return simulation;
}

const simulationReady = loadSimulation();

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  bindTouchControls();
  log('welcome to aryavarta. explore the clean path network, the shrine, and the quiet forest.');
  loop();
}

simulationReady.then(startGame).catch((error) => {
  console.error(error);
  log('failed to load the wasm simulation.');
});

window.addEventListener('keydown', handleKeyDown);

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  global.world = world;
  global.camera = camera;
  global.TILE_SIZE = TILE_SIZE;
  global.generateWorld = generateWorld;
  global.renderTerrain = renderTerrain;
  global.draw = draw;
  global.movePlayer = movePlayer;
  global.interact = interact;
  global.updateHud = updateHud;
  global.log = log;
  global.closeDialogue = closeDialogue;
  global.loadSimulation = loadSimulation;
  global.simulationReady = simulationReady;
}
