const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const wasmPath = path.resolve('simulation/simulation.wasm');

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

global.fetch = async (resource) => {
  const resolved = resource.startsWith('http') ? resource : wasmPath;
  const bytes = fs.readFileSync(resolved);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
};

const source = fs.readFileSync('game.js', 'utf8');
eval(source);

(async () => {
  try {
    assert(global.simulationReady instanceof Promise, 'simulationReady promise missing');
    await global.simulationReady;
    assert(global.simulation, 'simulation bridge missing');
    assert.strictEqual(global.simulation.backend, 'wasm', 'simulation backend should be wasm');
    assert.strictEqual(typeof global.simulation.getWorldWidth, 'function', 'world width getter missing');
    assert.strictEqual(typeof global.simulation.movePlayer, 'function', 'movePlayer missing');
    console.log('PASS: wasm bridge available');
  } catch (e) {
    console.error('FAIL: wasm bridge -', e.message);
    process.exit(1);
  }

  try {
    assert.strictEqual(global.simulation.getWorldWidth(), 96, 'unexpected world width');
    assert.strictEqual(global.simulation.getWorldHeight(), 64, 'unexpected world height');
    assert(global.simulation.getTile(0, 0) >= 0, 'tile lookup failed');
    const tiles = new Set([
      global.simulation.getTile(0, 0),
      global.simulation.getTile(18, 15),
      global.simulation.getTile(40, 36)
    ]);
    assert(tiles.size >= 3, 'simulation should generate varied terrain');
    console.log('PASS: wasm world state');
  } catch (e) {
    console.error('FAIL: wasm world state -', e.message);
    process.exit(1);
  }

  try {
    const startX = global.simulation.getPlayerX();
    const startY = global.simulation.getPlayerY();
    const moved = global.simulation.movePlayer(1, 0);
    assert.strictEqual(moved, 1, 'movePlayer should succeed on walkable terrain');
    assert.strictEqual(global.simulation.getPlayerX(), startX + 1, 'player x should update in wasm');
    assert.strictEqual(global.simulation.getPlayerY(), startY, 'player y should stay put');
    console.log('PASS: wasm movement');
  } catch (e) {
    console.error('FAIL: wasm movement -', e.message);
    process.exit(1);
  }

  try {
    mainCalls.fillRect.length = 0;
    mainCalls.drawImage.length = 0;
    global.draw();
    assert(mainCalls.drawImage.length >= 1, 'main canvas should draw cached terrain');
    assert(mainCalls.drawImage.some((call) => call[0] === global.world.terrainCanvas), 'terrain buffer not used on main canvas');
    assert(mainCalls.fillRect.some((call) => call[2] >= 40 && call[3] >= 40), 'player highlight too small');
    console.log('PASS: cached terrain render');
  } catch (e) {
    console.error('FAIL: cached terrain render -', e.message);
    process.exit(1);
  }

  try {
    const shrineIndex = global.simulation.findObject('shrine');
    assert(shrineIndex >= 0, 'shrine missing');
    const shrineX = global.simulation.getObjectX(shrineIndex);
    const shrineY = global.simulation.getObjectY(shrineIndex);
    global.simulation.setPlayerPosition(shrineX, shrineY);
    const dharmaBefore = global.simulation.getPlayerDharma();
    const outcome = global.simulation.interact();
    assert.strictEqual(outcome, 1, 'shrine interaction should return shrine outcome');
    assert(global.simulation.getPlayerDharma() > dharmaBefore, 'shrine should raise dharma');
    assert(statsEl.innerHTML.includes('dharma'), 'stats panel should render');
    assert(inventoryEl.innerHTML.includes('river shell'), 'inventory panel should render');
    console.log('PASS: wasm shrine interaction');
  } catch (e) {
    console.error('FAIL: wasm shrine interaction -', e.message);
    process.exit(1);
  }

  console.log('All tests passed.');
})();
