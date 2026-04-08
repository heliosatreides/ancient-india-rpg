const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const Stats = {};

// Resize internal resolution to fixed retro size
canvas.width = 320;
canvas.height = 180;

// World state
const player = {
  x: 160, y: 90,
  dharma: 50, // 0-100
  wealth: 10,
  health: 100,
  inventory: ['rudraksha mala']
};
const world = {
  map: Array(20).fill().map(()=>Array(20).fill('grass')),
  npcs: []
};
const logEl = document.getElementById('log');
const statsEl = document.getElementById('stats');

function log(msg) {
  const p = document.createElement('p');
  p.textContent = `> ${msg}`;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
  updateStats();
}

function updateStats() {
  statsEl.innerHTML = `
    dharma: ${player.dharma}<br>
    wealth: ${player.wealth}<br>
    health: ${player.health}<br>
    location: ${Math.floor(player.x)},${Math.floor(player.y)}
  `;
}

function draw() {
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // Draw world tiles
  ctx.fillStyle = '#2e2619';
  for(let y=0;y<20;y++) {
    for(let x=0;x<20;x++) {
      ctx.fillRect(x*16, y*16, 16, 16);
    }
  }
  // Draw player
  ctx.fillStyle = '#d4a56a';
  ctx.fillRect(player.x-4, player.y-4, 8, 8);
}

function handleKey(e) {
  const speed = 2;
  switch(e.key) {
    case 'arrowup': case 'w': player.y -= speed; break;
    case 'arrowdown': case 's': player.y += speed; break;
    case 'arrowleft': case 'a': player.x -= speed; break;
    case 'arrowright': case 'd': player.x += speed; break;
    case ' ': player.interact(); break;
  }
  player.x = Math.max(0, Math.min(canvas.width, player.x));
  player.y = Math.max(0, Math.min(canvas.height, player.y));
  draw();
}

function interact() {
  // Random encounter placeholder
  if(Math.random() < 0.3) {
    const actions = [
      () => { player.dharma += 5; log('you help a wandering sadhu. dharma increases.'); },
      () => { player.wealth -= 1; log('a thief takes some coins. wealth decreases.'); },
      () => { player.health -= 10; log('a wild beast attacks! health -10.'); }
    ];
    actions[Math.floor(Math.random()*actions.length)]();
  } else {
    log('you look around but find nothing of interest.');
  }
  updateStats();
}

window.addEventListener('keydown', handleKey);
draw();
log('welcome to aryavarta. use arrow keys to move. space to interact.');
updateStats();
