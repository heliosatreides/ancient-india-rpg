const assert = require('assert');
const fs = require('fs');

const ctxCalls = {
  fillRect: [],
  drawImage: []
};

const ctx = {
  fillStyle: '',
  font: '',
  textAlign: '',
  imageSmoothingEnabled: true,
  fillRect: (...args) => ctxCalls.fillRect.push(args),
  drawImage: (...args) => ctxCalls.drawImage.push(args),
  clearRect: () => {}
};

const statsEl = { innerHTML: '' };
const inventoryEl = { innerHTML: '' };
const logEl = {
  innerHTML: '',
  scrollTop: 0,
  scrollHeight: 0,
  appendChild(node) {
    this.innerHTML += node.innerHTML || '';
    this.scrollHeight += 1;
  }
};

const dialogueNodes = {
  '.name': { textContent: '' },
  '.text': { innerHTML: '' },
  '.choices': {
    innerHTML: '',
    children: [],
    appendChild(node) {
      this.children.push(node);
    }
  }
};
const dialogueEl = {
  classList: {
    _visible: false,
    contains(cls) { return cls === 'visible' ? this._visible : false; },
    add(cls) { if (cls === 'visible') this._visible = true; },
    remove(cls) { if (cls === 'visible') this._visible = false; }
  },
  querySelector(sel) { return dialogueNodes[sel]; }
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

class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.complete = false;
    this.width = 0;
    this.height = 0;
    this._src = '';
  }
  set src(value) {
    this._src = value;
    this.complete = true;
  }
  get src() {
    return this._src;
  }
}

global.Image = MockImage;
global.document = {
  getElementById: (id) => {
    if (id === 'world') {
      return {
        getContext: () => ctx,
        width: 320,
        height: 180
      };
    }
    if (id === 'stats') return statsEl;
    if (id === 'inventory') return inventoryEl;
    if (id === 'log') return logEl;
    if (id === 'dialogue') return dialogueEl;
    return mockEl();
  },
  createElement: () => ({ className: '', innerHTML: '', textContent: '', onclick: null })
};
global.window = { addEventListener: () => {} };

const source = fs.readFileSync('game.js', 'utf8');
eval(source);

try {
  assert(global.player, 'player not exported');
  assert(global.world, 'world not exported');
  assert(global.assets, 'assets not exported');
  assert(typeof global.inventorySummary === 'function', 'inventorySummary not exported');
  console.log('PASS: exports available');
} catch (e) {
  console.error('FAIL: exports -', e.message);
  process.exit(1);
}

try {
  assert(Array.isArray(global.player.inventory), 'player inventory missing');
  assert(global.inventorySummary().includes('rudraksha mala'), 'inventory summary missing starter item');
  assert(inventoryEl.innerHTML.includes('rudraksha mala'), 'inventory panel not rendered');
  assert(statsEl.innerHTML.includes('inventory'), 'stats missing inventory row');
  console.log('PASS: inventory UI');
} catch (e) {
  console.error('FAIL: inventory UI -', e.message);
  process.exit(1);
}

try {
  assert(global.assets.background && global.assets.characters, 'assets missing');
  global.assets.background.onload && global.assets.background.onload();
  global.assets.characters.onload && global.assets.characters.onload();
  ctxCalls.fillRect.length = 0;
  ctxCalls.drawImage.length = 0;
  global.draw();
  assert(ctxCalls.drawImage.length > 0, 'drawImage was not used');
  const backgroundCall = ctxCalls.drawImage[0];
  assert.strictEqual(backgroundCall[1], 0, 'background draw should start at x=0');
  assert.strictEqual(backgroundCall[2], 0, 'background draw should start at y=0');
  assert.strictEqual(backgroundCall[3], 960, 'background draw should cover canvas width');
  assert.strictEqual(backgroundCall[4], 540, 'background draw should cover canvas height');
  const lastCall = ctxCalls.drawImage[ctxCalls.drawImage.length - 1];
  assert.strictEqual(lastCall[5], global.player.x * global.TILE, 'player sprite should be scaled to tile size on x');
  assert.strictEqual(lastCall[6], global.player.y * global.TILE, 'player sprite should be scaled to tile size on y');
  console.log('PASS: sprite drawing');
} catch (e) {
  console.error('FAIL: sprite drawing -', e.message);
  process.exit(1);
}

try {
  const chest = global.world.objects.find((obj) => obj.type === 'chest');
  assert(chest, 'chest missing');
  chest.opened = false;
  global.player.x = chest.x;
  global.player.y = chest.y;
  const before = global.player.inventory.length;
  global.interact();
  assert.strictEqual(global.player.inventory.length, before + 1, 'opening chest should add an inventory item');
  assert(inventoryEl.innerHTML.includes('ancient relic'), 'inventory panel should show newly found item');
  console.log('PASS: chest loot');
} catch (e) {
  console.error('FAIL: chest loot -', e.message);
  process.exit(1);
}

console.log('All tests passed.');
