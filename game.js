const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const TILE = 16;

canvas.width = 960;
canvas.height = 540;
if ('imageSmoothingEnabled' in ctx) {
  ctx.imageSmoothingEnabled = false;
}

const supportsImages = typeof Image !== 'undefined';
const assetPaths = {
  background: 'assets/images/backgrounds/ancient_indian_landscape.jpg',
  terrain: 'assets/images/tiles/kenney_terrain_atlas.png',
  props: 'assets/images/objects/kenney_props_atlas.png',
  characters: 'assets/images/characters/rpg_characters.png'
};

function loadImage(src) {
  if (!supportsImages) return null;
  const img = new Image();
  img.__loaded = false;
  img.onload = () => {
    img.__loaded = true;
    if (typeof draw === 'function') draw();
  };
  img.onerror = () => {
    img.__loaded = false;
    if (typeof draw === 'function') draw();
  };
  img.src = src;
  return img;
}

const assets = {
  background: loadImage(assetPaths.background),
  terrain: loadImage(assetPaths.terrain),
  props: loadImage(assetPaths.props),
  characters: loadImage(assetPaths.characters)
};

const TILE_ATLAS_COLUMNS = 6;
const TILE_ATLAS_SIZE = 64;
const TILE_VARIANTS = {
  grass: [0, 1, 2, 3, 4, 5],
  path: [6, 7, 8, 9],
  forest: [10],
  mountain: [11],
  water: [12, 13, 14, 16, 17],
  temple_floor: [15]
};

const PROP_ATLAS = {
  chest: 0,
  temple: 1,
  shrine: 2,
  barrel: 3,
  tree: 4,
  archway: 5
};

const PALETTE = {
  player: '#d4a56a',
  npc: '#e6c45a',
  text: '#f5e6c8',
  grass: '#2e2619',
  water: '#2a4a6b',
  forest: '#1a2614',
  mountain: '#4a4538',
  path: '#5c4d3a',
  temple_floor: '#7c6d52',
  chest: '#b87333',
  shrine: '#d7c27a',
  barrel: '#8b5a2b',
  tree: '#3c7a40'
};

const player = {
  x: 10,
  y: 8,
  dharma: 50,
  wealth: 10,
  health: 100,
  energy: 100,
  inventory: ['rudraksha mala'],
  quests: [
    { id: 1, title: 'first steps', desc: 'explore the world', completed: false }
  ],
  facing: 'down',
  spriteIndex: 0,
  walkFrame: 1
};

const world = {
  width: Math.floor(canvas.width / TILE),
  height: Math.floor(canvas.height / TILE),
  tiles: [],
  npcs: [],
  objects: []
};

const logEl = document.getElementById('log');
const statsEl = document.getElementById('stats');
const inventoryEl = document.getElementById('inventory') || document.getElementById('controls');
const dialogueEl = document.getElementById('dialogue');

function spriteReady(img) {
  return !!(img && img.__loaded);
}

function atlasSourceRect(index, columns = TILE_ATLAS_COLUMNS, size = TILE_ATLAS_SIZE) {
  return {
    sx: (index % columns) * size,
    sy: Math.floor(index / columns) * size,
    sw: size,
    sh: size
  };
}

function tileVariant(type, x, y) {
  const variants = TILE_VARIANTS[type] || TILE_VARIANTS.grass;
  const choice = variants[(x * 7 + y * 13) % variants.length];
  return choice;
}

function drawAtlasCell(image, index, dx, dy, dw = TILE, dh = TILE, columns = TILE_ATLAS_COLUMNS, size = TILE_ATLAS_SIZE) {
  const { sx, sy, sw, sh } = atlasSourceRect(index, columns, size);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

function fillTile(type, x, y) {
  const color = PALETTE[type] || PALETTE.grass;
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function drawTile(type, x, y) {
  if (spriteReady(assets.terrain)) {
    drawAtlasCell(assets.terrain, tileVariant(type, x, y), x * TILE, y * TILE);
    return;
  }
  fillTile(type, x, y);
}

function drawObject(obj) {
  const atlasIndex = PROP_ATLAS[obj.sprite || obj.type];
  if (spriteReady(assets.props) && typeof atlasIndex === 'number') {
    const src = atlasSourceRect(atlasIndex, 3, 64);
    ctx.drawImage(assets.props, src.sx, src.sy, src.sw, src.sh, obj.x * TILE, obj.y * TILE, TILE, TILE);
    return;
  }

  ctx.fillStyle = PALETTE[obj.type] || PALETTE.chest;
  ctx.fillRect(obj.x * TILE, obj.y * TILE, TILE, TILE);
}

function characterSourceRect(spriteIndex, facing, frame = 1) {
  const blockWidth = 3 * 64;
  const blockHeight = 4 * 64;
  const blockCol = spriteIndex % 5;
  const blockRow = Math.floor(spriteIndex / 5);
  const rowMap = { down: 0, left: 1, right: 2, up: 3 };
  const row = rowMap[facing] ?? 0;
  return {
    sx: blockCol * blockWidth + frame * 64,
    sy: blockRow * blockHeight + row * 64,
    sw: 64,
    sh: 64
  };
}

function drawCharacter(entity, fallbackColor, outlineColor) {
  const dx = entity.x * TILE;
  const dy = entity.y * TILE;
  if (spriteReady(assets.characters)) {
    const frame = entity.walkFrame ?? 1;
    const src = characterSourceRect(entity.spriteIndex || 0, entity.facing || 'down', frame);
    ctx.drawImage(assets.characters, src.sx, src.sy, src.sw, src.sh, dx, dy, TILE, TILE);
    return;
  }

  ctx.fillStyle = fallbackColor;
  ctx.fillRect(dx, dy, TILE, TILE);
  ctx.fillStyle = outlineColor;
  const offset = entity.facing === 'up' ? [6, 2] : entity.facing === 'left' ? [2, 6] : entity.facing === 'right' ? [10, 6] : [6, 10];
  ctx.fillRect(dx + offset[0], dy + offset[1], 4, 4);
}

function generateQuest() {
  const quests = [
    { title: 'lost artifact', desc: 'find the ancient bell near the temple', reward: 'dharma +20' },
    { title: 'strange omens', desc: 'investigate the glowing pond in the forest', reward: 'health +15' }
  ];
  return quests[Math.floor(Math.random() * quests.length)];
}

function getDialogFor(name) {
  const dialogs = {
    sadhu: [
      'seek truth within.',
      'dharma is the highest wealth.',
      'even the mightiest warrior needs peace.'
    ],
    merchant: [
      'fine spices and silks from the west!',
      'gold speaks louder than words.',
      'many come seeking, few find what they need.'
    ],
    brahmin: [
      'the vedas guide the righteous path.',
      'perform your duty without attachment.',
      'seek knowledge, not just wealth.'
    ],
    kshatriya: [
      'strength protects the weak.',
      "a warrior's honor is his life.",
      'i have faced many battles; each teaches humility.'
    ],
    shramana: [
      'non-violence is the supreme virtue.',
      'desire is the root of suffering.',
      'walk the middle way.'
    ],
    deer: [
      'gentle sounds of the forest...',
      'be still, friend.'
    ],
    monkey: [
      'bananas!',
      'too much curiosity...',
      'swing from branch to branch!'
    ],
    peacock: [
      'i dance for the rain.',
      'my feathers catch the sun.',
      'beauty is a blessing and a burden.'
    ]
  };
  const list = dialogs[name] || ['...'];
  return list[Math.floor(Math.random() * list.length)];
}

function generateMap() {
  const map = [];
  world.npcs = [];
  world.objects = [];
  for (let y = 0; y < world.height; y++) {
    const row = [];
    for (let x = 0; x < world.width; x++) {
      if ((x > 5 && x < 10 && y > 5 && y < 10) || (x > 40 && x < 48 && y > 12 && y < 18)) {
        row.push('water');
      } else if (x === 0 || x === world.width - 1 || y === 0 || y === world.height - 1) {
        row.push('mountain');
      } else if (x > 10 && x < 16 && y > 10 && y < 14) {
        row.push('temple_floor');
      } else if (Math.random() < 0.15) {
        row.push('forest');
      } else if (Math.sin(x * 0.3) + Math.cos(y * 0.3) > 1.2) {
        row.push('path');
      } else {
        row.push('grass');
      }
    }
    map.push(row);
  }
  world.tiles = map;

  const npcNames = ['sadhu', 'merchant', 'brahmin', 'kshatriya', 'shramana', 'deer', 'monkey', 'peacock'];
  for (let i = 0; i < 8; i++) {
    world.npcs.push({
      x: Math.floor(Math.random() * (world.width - 4)) + 2,
      y: Math.floor(Math.random() * (world.height - 4)) + 2,
      name: npcNames[i],
      spriteIndex: i,
      facing: ['down', 'left', 'right', 'up'][i % 4],
      walkFrame: 1,
      dialog: getDialogFor(npcNames[i]),
      quest: Math.random() < 0.4 ? generateQuest() : null
    });
  }

  world.objects = [
    { x: 12, y: 12, type: 'temple', sprite: 'temple', name: 'ancient temple' },
    { x: 25, y: 18, type: 'shrine', sprite: 'shrine', name: 'dharma shrine' },
    { x: 32, y: 9, type: 'chest', sprite: 'chest', name: 'hidden chest' }
  ];
}

function countInventory() {
  const counts = new Map();
  for (const item of player.inventory) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return counts;
}

function inventorySummary() {
  const counts = countInventory();
  const parts = [];
  for (const [name, qty] of counts.entries()) {
    parts.push(qty > 1 ? `${name} ×${qty}` : name);
  }
  return parts.length ? parts.join(', ') : 'empty';
}

function renderInventory() {
  if (!inventoryEl) return;
  const counts = countInventory();
  const items = Array.from(counts.entries());
  const rows = items.map(([name, qty]) => `<div class="inventory-entry"><span>${name}</span><span>${qty}</span></div>`).join('');
  inventoryEl.innerHTML = `
    <div class="inventory-title">inventory</div>
    <div class="inventory-summary">${inventorySummary()}</div>
    <div class="inventory-list">${rows || '<div class="inventory-entry empty">empty</div>'}</div>
  `;
}

function updateStats() {
  if (!statsEl) return;
  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">dharma</span><span class="stat-value">${player.dharma}</span></div>
    <div class="stat-row"><span class="stat-label">wealth</span><span class="stat-value">${player.wealth}</span></div>
    <div class="stat-row"><span class="stat-label">health</span><span class="stat-value">${player.health}</span></div>
    <div class="stat-row"><span class="stat-label">energy</span><span class="stat-value">${player.energy}</span></div>
    <div class="stat-row"><span class="stat-label">inventory</span><span class="stat-value">${inventorySummary()}</span></div>
    <div style="margin-top:4px; font-size:11px; color:#a68b6c;">pos: ${Math.floor(player.x)},${Math.floor(player.y)}</div>
  `;
  renderInventory();
}

function log(msg, type = 'info') {
  if (!logEl) return;
  const p = document.createElement('p');
  p.className = 'log-entry' + (type === 'important' ? ' log-important' : type === 'danger' ? ' log-danger' : '');
  p.innerHTML = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

function showDialogue(name, text, choices = null) {
  if (!dialogueEl) return;
  dialogueEl.querySelector('.name').textContent = name;
  dialogueEl.querySelector('.text').innerHTML = text;
  const choicesDiv = dialogueEl.querySelector('.choices');
  if (choices) {
    choicesDiv.innerHTML = '';
    for (const c of choices) {
      const btn = document.createElement('button');
      btn.textContent = c.label;
      btn.onclick = () => c.action();
      choicesDiv.appendChild(btn);
    }
    dialogueEl.classList.add('visible');
  } else {
    dialogueEl.classList.remove('visible');
  }
}

function closeDialogue() {
  if (dialogueEl) dialogueEl.classList.remove('visible');
}

function addItem(item) {
  if (!item) return false;
  player.inventory.push(item);
  updateStats();
  return true;
}

function removeItem(item) {
  const idx = player.inventory.indexOf(item);
  if (idx === -1) return false;
  player.inventory.splice(idx, 1);
  updateStats();
  return true;
}

function acceptQuest(quest) {
  player.quests.push({ ...quest, active: true, progress: 0 });
  log(`quest accepted: ${quest.title}`, 'important');
  closeDialogue();
  updateStats();
}

function interact() {
  const px = Math.round(player.x);
  const py = Math.round(player.y);

  for (const npc of world.npcs) {
    if (Math.abs(npc.x - px) <= 1 && Math.abs(npc.y - py) <= 1) {
      const choices = npc.quest && !player.quests.find((q) => q.id === npc.quest.id) ? [
        { label: 'accept quest', action: () => acceptQuest(npc.quest) },
        { label: 'dismiss', action: closeDialogue }
      ] : null;
      showDialogue(npc.name, npc.dialog, choices);
      return;
    }
  }

  for (const obj of world.objects) {
    if (Math.abs(obj.x - px) <= 1 && Math.abs(obj.y - py) <= 1) {
      if (obj.type === 'temple') {
        player.dharma = Math.min(100, player.dharma + 15);
        player.health = Math.min(100, player.health + 10);
        addItem('prayer beads');
        log(`you pray at the ${obj.name}. dharma and health increase.`, 'important');
      } else if (obj.type === 'shrine') {
        player.dharma += 10;
        addItem('sacred leaf');
        log(`you honor the ${obj.name}. dharma increases.`, 'important');
      } else if (obj.type === 'chest') {
        if (!obj.opened) {
          obj.opened = true;
          const gold = Math.floor(Math.random() * 12) + 5;
          player.wealth += gold;
          addItem('ancient relic');
          log(`you found a hidden chest with ${gold} gold coins!`, 'important');
        } else {
          log('the chest is empty.');
        }
      }
      updateStats();
      return;
    }
  }

  if (Math.random() < 0.15) {
    const events = [
      () => { player.wealth += 3; log('you find some coins on the path.', 'important'); },
      () => { player.health -= 8; log('a snake bites you! health -8', 'danger'); },
      () => { const gain = 5; player.dharma += gain; log(`a wandering sadhu blesses you. dharma +${gain}`, 'important'); },
      () => { const gain = 8; player.energy += gain; player.health = Math.min(100, player.health + gain); log(`you drink from a holy well. energy +${gain}, health +${gain}`, 'important'); }
    ];
    events[Math.floor(Math.random() * events.length)]();
    updateStats();
  } else {
    log('you look around...');
  }
}

let lastMove = 0;
function handleKey(e) {
  if (dialogueEl && dialogueEl.classList.contains('visible')) {
    if (e.key === 'Escape') closeDialogue();
    return;
  }

  const now = Date.now();
  if (now - lastMove < 60) return;
  lastMove = now;

  const key = e.key.toLowerCase();
  const speed = 1;
  let dx = 0;
  let dy = 0;
  if (key === 'arrowup' || key === 'w') { dy = -speed; player.facing = 'up'; }
  else if (key === 'arrowdown' || key === 's') { dy = speed; player.facing = 'down'; }
  else if (key === 'arrowleft' || key === 'a') { dx = -speed; player.facing = 'left'; }
  else if (key === 'arrowright' || key === 'd') { dx = speed; player.facing = 'right'; }
  else if (key === ' ' || key === 'spacebar' || key === 'space') { interact(); return; }
  else return;

  e.preventDefault();
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) return;
  const tile = world.tiles[Math.floor(ny)][Math.floor(nx)];
  if (tile === 'mountain') return;

  for (const npc of world.npcs) {
    if (Math.abs(npc.x - nx) < 0.8 && Math.abs(npc.y - ny) < 0.8) return;
  }

  player.x = nx;
  player.y = ny;
  player.walkFrame = (player.walkFrame + 1) % 3;
  draw();
  updateStats();
}

function drawBackground() {
  if (spriteReady(assets.background)) {
    const bgW = assets.background.width || canvas.width;
    const bgH = assets.background.height || canvas.height;
    ctx.drawImage(assets.background, 0, 0, bgW, bgH, 0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = '#2e2619';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      drawTile(world.tiles[y][x], x, y);
    }
  }

  for (const obj of world.objects) {
    drawObject(obj);
  }

  for (const npc of world.npcs) {
    drawCharacter(npc, PALETTE.npc, '#ffea90');
  }

  drawCharacter(player, PALETTE.player, '#ffcc00');
}

window.addEventListener('keydown', handleKey);

generateMap();
draw();
updateStats();
log('welcome to aryavarta. arrow keys or wasd to move. space to interact.');

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  global.player = player;
  global.world = world;
  global.assets = assets;
  global.TILE = TILE;
  global.generateMap = generateMap;
  global.getDialogFor = getDialogFor;
  global.generateQuest = generateQuest;
  global.interact = interact;
  global.updateStats = updateStats;
  global.log = log;
  global.draw = draw;
  global.addItem = addItem;
  global.removeItem = removeItem;
  global.inventorySummary = inventorySummary;
  global.getInventorySummary = inventorySummary;
}
