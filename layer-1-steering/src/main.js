// Entry point. Orchestrates world, agent, renderer, UI, and scenario lifecycle.
//
// Sim loop is fixed-timestep, decoupled from rendering. Scenario changes and
// knob changes both trigger a full reset via loadScenario(). Knob values are
// synced to the URL so any playground state is shareable from a Medium blog.

import { World } from './world.js';
import { Renderer } from './renderer.js';
import { Agent } from './agent.js';
import { UI } from './ui.js';
import { SCENARIOS, getScenario, resolveKnobs } from './scenarios.js';

const canvas = document.getElementById('world');

const ui = new UI({
  cockpit:        document.getElementById('cockpit'),
  memory:         document.getElementById('memory'),
  scenarioInfo:   document.getElementById('scenario-info'),
  scenarioSelect: document.getElementById('scenario'),
  playBtn:        document.getElementById('play'),
  stepBtn:        document.getElementById('step'),
  resetBtn:       document.getElementById('reset'),
  speedInput:     document.getElementById('speed'),
  speedValue:     document.getElementById('speed-val'),
  tickStatus:     document.getElementById('tick-status'),
});

// Runtime state ---------------------------------------------------------

const world = new World({ width: canvas.width, height: canvas.height });
const renderer = new Renderer(canvas, world);

let agent = null;
let currentScenario = null;
let currentKnobs = {};
let paused = false;
let tps = 30;
let accumulator = 0;
let lastFrameAt = performance.now();
let stepOnce = false;

// URL helpers -----------------------------------------------------------

function readUrlParams() {
  const url = new URL(window.location.href);
  const out = { scenario: url.searchParams.get('scenario'), knobs: {} };
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== 'scenario') out.knobs[k] = v;
  }
  return out;
}

function writeUrlParams(scenarioId, knobs) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('scenario', scenarioId);
  for (const [k, v] of Object.entries(knobs)) url.searchParams.set(k, v);
  history.replaceState({}, '', url.toString());
}

// Scenario lifecycle ----------------------------------------------------

function loadScenario(id, knobOverrides = null) {
  const scenario = getScenario(id);
  if (scenario.notReady) {
    ui.setScenarioValue('baseline');
    loadScenario('baseline');
    return;
  }

  // Compose knobs: start from URL params on first load, then subsequent
  // loads carry forward existing values (unless caller overrides).
  const knobs = resolveKnobs(scenario, knobOverrides ?? currentKnobs ?? {});

  currentScenario = scenario;
  currentKnobs = knobs;

  agent = scenario.setup(world, Agent, knobs);
  renderer.markDirty();

  ui.renderScenario(scenario, knobs);
  ui.updateBars(agent.state);
  ui.updateMemory(agent.memory, world.channels());
  ui.updateTickStatus(0);
  world.tick = 0;

  writeUrlParams(scenario.id, knobs);
}

// Sim / render loop -----------------------------------------------------

function tickSim() {
  if (currentScenario.tick) {
    currentScenario.tick({ world, agent, renderer, tickNum: world.tick });
  }
  agent.step(world);
  world.step();
}

function frame(now) {
  const dt = now - lastFrameAt;
  lastFrameAt = now;

  if (!paused) {
    const msPerTick = 1000 / tps;
    accumulator += dt;
    if (accumulator > 500) accumulator = msPerTick;
    while (accumulator >= msPerTick) {
      tickSim();
      accumulator -= msPerTick;
    }
  } else if (stepOnce) {
    tickSim();
    stepOnce = false;
  }

  renderer.render();
  renderer.drawAgent(agent);
  ui.updateBars(agent.state);
  ui.updateMemory(agent.memory, world.channels());
  ui.updateTickStatus(world.tick);

  requestAnimationFrame(frame);
}

// Wiring ----------------------------------------------------------------

ui.onScenarioChange(id => loadScenario(id, {}));

ui.onKnobChange((key, value) => {
  const next = { ...currentKnobs, [key]: value };
  loadScenario(currentScenario.id, next);
});

ui.onPlayToggle(() => {
  paused = !paused;
  ui.updatePlayButton(paused);
});

ui.onStep(() => {
  if (!paused) { paused = true; ui.updatePlayButton(true); }
  stepOnce = true;
});

ui.onReset(() => loadScenario(currentScenario.id));

ui.onSpeedChange(val => {
  tps = val;
  ui.updateSpeedLabel(tps);
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    paused = !paused;
    ui.updatePlayButton(paused);
  }
});

// Boot ------------------------------------------------------------------

const { scenario: urlScenario, knobs: urlKnobs } = readUrlParams();
const startId = urlScenario && SCENARIOS[urlScenario] && !SCENARIOS[urlScenario].notReady
  ? urlScenario
  : 'baseline';
ui.setScenarioValue(startId);
ui.updateSpeedLabel(tps);
ui.updatePlayButton(false);
loadScenario(startId, urlKnobs);

requestAnimationFrame(frame);
