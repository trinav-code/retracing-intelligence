// UI: all DOM-side rendering. Keeps main.js focused on the sim loop.
//
// Responsibilities:
//   - Build the state bars panel
//   - Update bar widths / values on each render
//   - Wire up playback controls (play/pause, step, reset, speed)
//   - Render the scenario info panel
//   - Sync scenario dropdown with URL param

const SCALAR_ROWS = [
  { key: 'hunger',    label: 'hunger',    sub: 'drive — rises over time, falls while consuming' },
  { key: 'liking',    label: 'liking',    sub: 'serotonin — spikes on consumption, damps pursuit' },
  { key: 'wanting',   label: 'wanting',   sub: 'dopamine — fires during pursuit, gated by drive' },
  { key: 'stress',    label: 'stress',    sub: 'adrenaline — rises near threat, opioid on relief' },
  { key: 'arousal',   label: 'arousal',   sub: 'energy engagement, persistent past stimulus' },
  { key: 'opioid',    label: 'opioid',    sub: 'relief — bursts when stress resolves cleanly' },
  { key: 'anhedonia', label: 'anhedonia', sub: 'chronic-stress failure mode — flattens all valence' },
];

export class UI {
  constructor({ cockpit, memory, scenarioInfo, scenarioSelect, playBtn, stepBtn, resetBtn, speedInput, speedValue, tickStatus }) {
    this.cockpit = cockpit;
    this.memoryPanel = memory;
    this.scenarioInfo = scenarioInfo;
    this.scenarioSelect = scenarioSelect;
    this.playBtn = playBtn;
    this.stepBtn = stepBtn;
    this.resetBtn = resetBtn;
    this.speedInput = speedInput;
    this.speedValue = speedValue;
    this.tickStatus = tickStatus;

    this.bars = {};
    this.buildCockpit();
  }

  buildCockpit() {
    this.cockpit.innerHTML = '';
    for (const row of SCALAR_ROWS) {
      const el = document.createElement('div');
      el.className = 'bar';
      el.dataset.scalar = row.key;
      el.innerHTML = `
        <span class="label">${row.label}</span>
        <div class="track"><div class="fill"></div></div>
        <span class="val">0.00</span>
        <span class="sub">${row.sub}</span>
      `;
      this.cockpit.appendChild(el);
      this.bars[row.key] = {
        root: el,
        fill: el.querySelector('.fill'),
        val: el.querySelector('.val'),
      };
    }
  }

  updateBars(state) {
    const snap = state.snapshot();
    for (const key of Object.keys(this.bars)) {
      const v = snap[key];
      const bar = this.bars[key];
      bar.fill.style.width = `${Math.round(v * 100)}%`;
      bar.val.textContent = v.toFixed(2);
      bar.root.classList.toggle('pinned', state.isPinned(key));
    }
  }

  // Show the learned cue valences panel. Only displayed when any cue has a
  // non-trivial learned valence — so scenarios without novel cues stay clean.
  updateMemory(memory, channelsInWorld) {
    if (!memory || !this.memoryPanel) return;
    const learned = memory.snapshot();
    const channels = (channelsInWorld ?? Object.keys(learned))
      .filter(ch => !memory.isInnate(ch));

    if (channels.length === 0) {
      this.memoryPanel.hidden = true;
      return;
    }

    // Cache rows per channel so we can update instead of rebuilding every tick.
    if (!this._memoryRows || this._memoryChannels !== channels.join(',')) {
      this._memoryChannels = channels.join(',');
      this.memoryPanel.hidden = false;
      this.memoryPanel.innerHTML = '<div class="memory-heading">Learned cue valences</div>';
      this._memoryRows = {};
      for (const ch of channels) {
        const row = document.createElement('div');
        row.className = 'memory-row';
        row.innerHTML = `
          <span class="cue">${ch}</span>
          <div class="bipolar-track"><div class="bipolar-fill"></div></div>
          <span class="val">0.00</span>
        `;
        this.memoryPanel.appendChild(row);
        this._memoryRows[ch] = {
          fill: row.querySelector('.bipolar-fill'),
          val: row.querySelector('.val'),
          cue: row.querySelector('.cue'),
        };
      }
    }

    for (const ch of channels) {
      const v = learned[ch] ?? 0;
      const row = this._memoryRows[ch];
      const pct = Math.abs(v) * 50;  // bipolar bar, half-width per side
      row.fill.style.width = `${pct}%`;
      row.fill.style.left = v >= 0 ? '50%' : `${50 - pct}%`;
      row.fill.classList.toggle('negative', v < 0);
      row.val.textContent = (v >= 0 ? '+' : '') + v.toFixed(2);
    }
  }

  renderScenario(scenario, knobValues = {}) {
    const parts = [`<h2>${scenario.title}</h2>`, `<p>${inlineMd(scenario.summary)}</p>`];
    if (scenario.watchFor) {
      parts.push(
        `<div class="watch-for"><strong>Watch for:</strong> ${inlineMd(scenario.watchFor)}</div>`
      );
    }

    const knobs = scenario.knobs ?? {};
    const knobKeys = Object.keys(knobs);
    if (knobKeys.length > 0) {
      const knobHtml = knobKeys.map(key => {
        const knob = knobs[key];
        const current = knobValues[key] ?? knob.default;
        const buttons = knob.values.map(v =>
          `<button data-knob="${key}" data-value="${v}" class="${v === current ? 'active' : ''}">${v}</button>`
        ).join('');
        return `
          <div class="knob">
            <span class="knob-label">${knob.label}</span>
            <div class="knob-toggle">${buttons}</div>
          </div>
        `;
      }).join('');
      parts.push(`<div class="scenario-knobs">${knobHtml}</div>`);
    }

    this.scenarioInfo.innerHTML = parts.join('');

    // Wire knob button clicks to the registered callback.
    this.scenarioInfo.querySelectorAll('.knob-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.knob;
        const value = btn.dataset.value;
        if (this._onKnobChange) this._onKnobChange(key, value);
      });
    });
  }

  onKnobChange(cb) { this._onKnobChange = cb; }

  setScenarioValue(id) {
    this.scenarioSelect.value = id;
  }

  updateTickStatus(tick) {
    this.tickStatus.textContent = `tick ${tick}`;
  }

  updatePlayButton(paused) {
    this.playBtn.textContent = paused ? '▶' : '⏸';
    this.playBtn.title = paused ? 'Play (space)' : 'Pause (space)';
  }

  updateSpeedLabel(tps) {
    this.speedValue.textContent = `${tps} tps`;
  }

  onScenarioChange(cb)  { this.scenarioSelect.addEventListener('change', e => cb(e.target.value)); }
  onPlayToggle(cb)      { this.playBtn.addEventListener('click', cb); }
  onStep(cb)            { this.stepBtn.addEventListener('click', cb); }
  onReset(cb)           { this.resetBtn.addEventListener('click', cb); }
  onSpeedChange(cb)     { this.speedInput.addEventListener('input', e => cb(Number(e.target.value))); }
}

// Ultra-minimal markdown: just **bold**. Keeps scenario text readable.
function inlineMd(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
