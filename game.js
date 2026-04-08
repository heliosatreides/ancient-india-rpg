const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const TILE = 16;
canvas.width = Math.floor(960 / TILE);
canvas.height = Math.floor(540 / TILE);

// Colors inspired by ancient Indian art
const PALETTE = {
  grass: '#2e2619',
  water: '#2a4a6b',
  forest: '#1a2614',
  mountain: '#4a4538',
  path: '#5c4d3a',
  player: '#d4a56a',
  npc: '#e6c45a',
  text: '#f5e6c8'
};

// Game state
const player = {
  x: 10, y: 8,
  dharma: 50,
  wealth: 10,
  health: 100,
  energy: 100,
  inventory: ['rudraksha mala'],
  quests: [
    { id: 1, title: 'first steps', desc: 'explore the world', completed: false }
  ],
  facing: 'down'
};
const world = {
  width: canvas.width,
  height: canvas.height,
  tiles: [], // generated below
  npcs: [],
  objects: []
};

// Generate a simple map with varied terrain
function generateMap() {
  const map = [];
  for (let y = 0; y < world.height; y++) {
    const row = [];
    for (let x = 0; x < world.width; x++) {
      // Create some water bodies
      if ((x > 5 && x < 10 && y > 5 && y < 10) ||
          (x > 40 && x < 48 && y > 12 && y < 18)) {
        row.push('water');
      } else if ((x === 0 || x === world.width-1) || (y === 0 || y === world.height-1)) {
        row.push('mountain');
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

  // Add a few NPCs
  const npc_names = ['sadhu', 'merchant', 'brahmin', 'kshatriya', 'shramana', 'deer', 'monkey', 'peacock'];
  for (let i = 0; i < 8; i++) {
    world.npcs.push({
      x: Math.floor(Math.random() * (world.width-4)) + 2,
      y: Math.floor(Math.random() * (world.height-4)) + 2,
      name: npc_names[i],
      dialog: getDialogFor(npc_names[i]),
      quest: Math.random() < 0.4 ? generateQuest() : null
    });
  }
  // Add some interactive objects
  world.objects = [
    { x: 12, y: 12, type: 'temple', name: 'ancient temple' },
    { x: 25, y: 18, type: 'shrine', name: 'dharma shrine' },
    { x: 32, y: 9, type: 'chest', name: 'hidden chest' }
  ];
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
      ' seek knowledge, not just wealth.'
    ],
    kshatriya: [
      'strength protects the weak.',
      "a warrior's honor is his life.",
      'i have faced many battles; each teaches humility.'
    ],
    shramana: [
      'non-violence is the supreme virtue.',
      ' desire is the root of suffering.',
      'walk the middle way.'
    ],
    deer: [
      'gentle sounds of the forest...',
      'be still, friend.'
    ],
    monkey: [
      ' bananas!',
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

function generateQuest() {
  const quests = [
    { title: 'lost artifact', desc: 'find the ancient bell near the temple', reward: 'dharma +20' },
    { title: 'strange omens', desc: 'investigate the glowing pond in the forest', reward: 'health +15' }
  ];
  return quests[Math.floor(Math.random() * quests.length)];
}

function draw() {
  // Background
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw tiles with simple shading
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[y][x];
      let color = PALETTE.grass;
      if (tile === 'water') color = PALETTE.water;
      else if (tile === 'forest') color = PALETTE.forest;
      else if (tile === 'mountain') color = PALETTE.mountain;
      else if (tile === 'path') color = PALETTE.path;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);

      // Add subtle texture pattern for tiles
      if (tile === 'forest') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        if ((x+y)%3 === 0) ctx.fillRect(x, y, 1, 1);
      } else if (tile === 'water') {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        if ((x+y)%4 === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Draw objects
  for (const obj of world.objects) {
    ctx.fillStyle = '#b87333';
    ctx.fillRect(obj.x, obj.y, 1, 1);
    ctx.fillStyle = '#e6c45a';
    ctx.fillRect(obj.x+0.25, obj.y+0.25, 0.5, 0.5);
  }

  // Draw NPCs
  for (const npc of world.npcs) {
    ctx.fillStyle = PALETTE.npc;
    ctx.fillRect(npc.x, npc.y, 1, 1);
    // small "halo"
    ctx.fillStyle = 'rgba(230,196,90,0.3)';
    ctx.fillRect(npc.x-0.5, npc.y-0.5, 2, 2);
  }

  // Draw player
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(player.x, player.y, 1, 1);
  // simple facing indicator
  ctx.fillStyle = '#ffcc00';
  const offsets = { up: [0,-0.5], down: [0,0.5], left: [-0.5,0], right: [0.5,0] };
  const [ox, oy] = offsets[player.facing] || [0,0.5];
  ctx.fillRect(player.x+ox, player.y+oy, 0.7, 0.7);
}

const logEl = document.getElementById('log');
const statsEl = document.getElementById('stats');
const dialogueEl = document.getElementById('dialogue');

function log(msg, type='info') {
  const p = document.createElement('p');
  p.className = 'log-entry' + (type==='important' ? ' log-important' : type==='danger' ? ' log-danger' : '');
  p.innerHTML = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}
function updateStats() {
  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">dharma</span><span class="stat-value">${player.dharma}</span></div>
    <div class="stat-row"><span class="stat-label">wealth</span><span class="stat-value">${player.wealth}</span></div>
    <div class="stat-row"><span class="stat-label">health</span><span class="stat-value">${player.health}</span></div>
    <div class="stat-row"><span class="stat-label">energy</span><span class="stat-value">${player.energy}</span></div>
    <div style="margin-top:4px; font-size:11px; color:#a68b6c;">pos: ${Math.floor(player.x)},${Math.floor(player.y)}</div>
  `;
}

function showDialogue(name, text, choices=null) {
  dialogueEl.querySelector('.name').textContent = name;
  dialogueEl.querySelector('.text').innerHTML = text;
  const choicesDiv = dialogueEl.querySelector('.choices');
  if (choices) {
    choicesDiv.innerHTML = '';
    for (const c of choices) {
      const btn = document.createElement('button');
      btn.textContent = c.label;
      btn.onclick = () => { choiceMade(c.action); };
      choicesDiv.appendChild(btn);
    }
    dialogueEl.classList.add('visible');
  } else {
    dialogueEl.classList.remove('visible');
  }
}
function closeDialogue() { dialogueEl.classList.remove('visible'); }

function interact() {
  const px = Math.round(player.x), py = Math.round(player.y);
  // Check NPCs
  for (const npc of world.npcs) {
    if (Math.abs(npc.x - px) <= 1 && Math.abs(npc.y - py) <= 1) {
      const choices = npc.quest && !player.quests.find(q=>q.id===npc.quest.id) ? [
        {label: 'accept quest', action: ()=>acceptQuest(npc.quest)},
        {label: 'dismiss', action: closeDialogue}
      ] : null;
      showDialogue(npc.name, npc.dialog, choices);
      return;
    }
  }
  // Check objects
  for (const obj of world.objects) {
    if (Math.abs(obj.x - px) <= 1 && Math.abs(obj.y - py) <= 1) {
      if (obj.type === 'temple') {
        player.dharma = Math.min(100, player.dharma + 15);
        player.health = Math.min(100, player.health + 10);
        log(`you pray at the ${obj.name}. dharma and health increase.`, 'important');
      } else if (obj.type === 'shrine') {
        player.dharma += 10;
        log(`you honor the ${obj.name}. dharma increases.`, 'important');
      } else if (obj.type === 'chest') {
        if (!obj.opened) {
          obj.opened = true;
          const gold = Math.floor(Math.random()*12)+5;
          player.wealth += gold;
          log(`you found a hidden chest with ${gold} gold coins!`, 'important');
        } else {
          log('the chest is empty.');
        }
      }
      updateStats();
      return;
    }
  }
  // Random encounter if on foot
  if (Math.random() < 0.15) {
    const events = [
      () => { player.wealth += 3; log('you find some coins on the path.', 'important'); },
      () => { player.health -= 8; log('a snake bites you! health -8', 'danger'); },
      () => { const gain = 5; player.dharma += gain; log(`a wandering sadhu blesses you. dharma +${gain}`, 'important'); },
      () => { const gain = 8; player.energy += gain; player.health = Math.min(100, player.health+gain); log(`you drink from a holy well. energy +${gain}, health +${gain}`, 'important'); }
    ];
    events[Math.floor(Math.random()*events.length)]();
    updateStats();
  } else {
    log('you look around...');
  }
}

function acceptQuest(quest) {
  player.quests.push({ ...quest, active: true, progress: 0 });
  log(`quest accepted: ${quest.title}`, 'important');
  closeDialogue();
  updateStats();
}

// Movement
let lastMove = 0;
function handleKey(e) {
  if (dialogueEl.classList.contains('visible')) {
    if (e.key === 'Escape') closeDialogue();
    return;
  }
  const now = Date.now();
  if (now - lastMove < 60) return;
  lastMove = now;
  const speed = 1;
  let dx = 0, dy = 0;
  if (e.key === 'arrowup' || e.key === 'w') { dy = -speed; player.facing = 'up'; }
  else if (e.key === 'arrowdown' || e.key === 's') { dy = speed; player.facing = 'down'; }
  else if (e.key === 'arrowleft' || e.key === 'a') { dx = -speed; player.facing = 'left'; }
  else if (e.key === 'arrowright' || e.key === 'd') { dx = speed; player.facing = 'right'; }
  else if (e.key === ' ') { interact(); return; }
  else return;
  e.preventDefault();

  const nx = player.x + dx, ny = player.y + dy;
  if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) return;
  const tile = world.tiles[Math.floor(ny)][Math.floor(nx)];
  if (tile === 'mountain') return;

  // Simple NPC collision
  for (const npc of world.npcs) {
    if (Math.abs(npc.x - nx) < 0.8 && Math.abs(npc.y - ny) < 0.8) return;
  }

  player.x = nx; player.y = ny;
  draw();
  updateStats();
}

window.addEventListener('keydown', handleKey);

// Init
generateMap();
draw();
updateStats();
log('welcome to aryavarta. arrow keys or wasd to move. space to interact.');
