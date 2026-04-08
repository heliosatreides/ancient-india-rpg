const assert = require('assert');
const fs = require('fs');

const mainCalls = {
  fillRect: [],
  drawImage: [],
  fillText: [],
  clearRect: []
};
const terrainCalls = {
  fillRect: [],
  drawImage: [],
  clearRect: []
};

function makeCtx(calls) {
  return {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    imageSmoothingEnabled: true,
    fillRect: (...args) => calls.fillRect.push(args),
    drawImage: (...args) => calls.drawImage.push(args),
    fillText: (...args) => calls.fillText ? calls.fillText.push(args) : null,
    clearRect: (...args) => calls.clearRect.push(args),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    arc: () => {}
  };
}

const mainCanvas = {
  width: 0,
  height: 0,
  getContext: () => makeCtx(mainCalls)
};
const terrainCanvas = {
  width: 0,
  height: 0,
  getContext: () => makeCtx(terrainCalls)
};

const statsEl = { innerHTML: '' };
const inventoryEl = { innerHTML: '' };
const logEl = {
  innerHTML: '',
  scrollTop: 0,
  scrollHeight: 0,
  appendChild(node) {
    this.innerHTML += node.textContent || '';
    this.scrollHeight += 1;
  }
};
const dialogueEl = {
  innerHTML: '',
  classList: {
    _visible: false,
    add(cls) { if (cls === 'visible') this._visible = true; },
    remove(cls) { if (cls === 'visible') this._visible = false; },
    contains(cls) { return cls === 'visible' ? this._visible : false; }
  }
};

const mockEl = () => ({
  innerHTML: '',
  textContent: '',
  appendChild: () => {},
  addEventListener: () => {},
  scrollTop: 0,
  scrollHeight: 0,
  classList: { contains: () => false, add: () => {}, remove: () => {} },
  querySelector: () => mockEl(),
  querySelectorAll: () => []
});

global.requestAnimationFrame = () => 0;
global.window = { addEventListener: () => {}, requestAnimationFrame: () => 0 };
global.document = {
  getElementById: (id) => {
    if (id === 'world') return mainCanvas;
    if (id === 'stats') return statsEl;
    if (id === 'inventory') return inventoryEl;
    if (id === 'log') return logEl;
    if (id === 'dialogue') return dialogueEl;
    return mockEl();
  },
  createElement: (tag) => {
    if (tag === 'canvas') return terrainCanvas;
    return mockEl();
  }
};

const source = fs.readFileSync('game.js', 'utf8');
eval(source);

try {
  assert(global.world, 'world not exported');
  assert(global.player, 'player not exported');
  assert(global.generateWorld, 'generateWorld not exported');
  assert(global.renderTerrain, 'renderTerrain not exported');
  console.log('PASS: exports available');
} catch (e) {
  console.error('FAIL: exports -', e.message);
  process.exit(1);
}

try {
  assert(global.world.tiles instanceof Uint8Array, 'tiles should be typed');
  assert.strictEqual(global.world.tiles.length, global.world.width * global.world.height, 'tile grid size mismatch');
  const uniqueTiles = new Set(global.world.tiles);
  assert(uniqueTiles.size <= 6, 'terrain should stay simple and readable');
  assert(global.world.terrainCanvas, 'terrain buffer missing');
  assert(global.world.terrainCanvas.width > 0 && global.world.terrainCanvas.height > 0, 'terrain canvas size invalid');
  console.log('PASS: typed terrain');
} catch (e) {
  console.error('FAIL: typed terrain -', e.message);
  process.exit(1);
}

try {
  mainCalls.fillRect.length = 0;
  mainCalls.drawImage.length = 0;
  global.world.dirty = true;
  global.draw();
  assert(mainCalls.drawImage.length >= 1, 'main canvas should use cached terrain drawImage');
  assert(mainCalls.drawImage.some((call) => call[0] === global.world.terrainCanvas), 'terrain buffer not used on main canvas');
  assert(mainCalls.fillRect.some((call) => call[2] >= 40 && call[3] >= 40), 'player highlight too small');
  console.log('PASS: cached terrain render');
} catch (e) {
  console.error('FAIL: cached terrain render -', e.message);
  process.exit(1);
}

try {
  const shrine = global.world.objects.find((obj) => obj.type === 'shrine');
  assert(shrine, 'shrine missing');
  global.player.x = shrine.x;
  global.player.y = shrine.y;
  const dharmaBefore = global.player.dharma;
  global.interact();
  assert(global.player.dharma > dharmaBefore, 'shrine should raise dharma');
  assert(statsEl.innerHTML.includes('dharma'), 'stats panel should render');
  assert(inventoryEl.innerHTML.includes('river shell'), 'inventory panel should render');
  console.log('PASS: shrine interaction');
} catch (e) {
  console.error('FAIL: shrine interaction -', e.message);
  process.exit(1);
}

console.log('All tests passed.');
