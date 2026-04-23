// Renderer: draws a World onto a canvas.
//
// Gradients are drawn as a per-pixel heatmap, cached to an offscreen canvas.
// Sources in Layer 1 scenarios are mostly static, so the cache is rebuilt
// only when sources change (callers must invalidate via markDirty()).
//
// Each channel gets a color. Food = green, toxin = red, neutral cues get
// assigned distinct colors from a palette so Pavlov's new odors show up.

import { CHANNEL } from './world.js';

const BASE_COLORS = {
  [CHANNEL.FOOD]:  [ 80, 200, 120],  // green
  [CHANNEL.TOXIN]: [220,  70,  70],  // red
};

// Palette for neutral/novel odor channels (cycled in insertion order).
const NEUTRAL_PALETTE = [
  [ 90, 160, 230],  // blue
  [210, 180,  90],  // amber
  [180, 120, 220],  // violet
  [230, 140, 180],  // pink
];

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;

    // Offscreen cache for the gradient heatmap.
    this.bg = document.createElement('canvas');
    this.bg.width = canvas.width;
    this.bg.height = canvas.height;
    this.bgCtx = this.bg.getContext('2d');

    this.dirty = true;
    this.channelColors = new Map();
  }

  markDirty() { this.dirty = true; }

  colorFor(channel) {
    if (BASE_COLORS[channel]) return BASE_COLORS[channel];
    if (!this.channelColors.has(channel)) {
      const idx = this.channelColors.size % NEUTRAL_PALETTE.length;
      this.channelColors.set(channel, NEUTRAL_PALETTE[idx]);
    }
    return this.channelColors.get(channel);
  }

  // Rebuild the cached gradient field. O(W * H * channels) — called only on change.
  rebuildBackground() {
    const { width, height } = this.bg;
    const img = this.bgCtx.createImageData(width, height);
    const data = img.data;
    const channels = this.world.channels();

    // For each pixel: accumulate color contributions from each channel,
    // weighted by field strength. Clamp and write RGBA.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 12, g = 14, b = 20; // background tone (matches panel bg-ish)

        for (const ch of channels) {
          const v = this.world.sample(x, y, ch);
          if (v === 0) continue;
          // Map intensity into a 0..1 alpha for color mixing.
          // abs(v) because toxin channel uses negative-valence red regardless of sign.
          const a = Math.min(1, Math.abs(v));
          const [cr, cg, cb] = this.colorFor(ch);
          r = r + (cr - r) * a;
          g = g + (cg - g) * a;
          b = b + (cb - b) * a;
        }

        const i = (y * width + x) * 4;
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }

    this.bgCtx.putImageData(img, 0, 0);
    this.dirty = false;
  }

  drawSources() {
    const ctx = this.ctx;
    for (const src of this.world.sources) {
      if (!src.active) continue;
      const [r, g, b] = this.colorFor(src.channel);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(src.x, src.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawAgent(agent) {
    const ctx = this.ctx;

    // State-driven halo. The agent's dominant affective signal paints it:
    //   wanting → orange (pursuit)
    //   liking  → green  (satiation)
    //   stress  → red    (alarm)
    // Size and alpha both scale with the strength. Subtle, not flashy —
    // but watching the halo shift tells the whole behavioral story at a glance.
    const s = agent.state;
    const candidates = [
      { v: s.wanting, color: [255, 107,  53] },
      { v: s.liking,  color: [ 62, 213, 152] },
      { v: s.stress,  color: [231,  76,  60] },
    ];
    let dominant = candidates[0];
    for (const c of candidates) if (c.v > dominant.v) dominant = c;

    if (dominant.v > 0.12) {
      const [r, g, b] = dominant.color;
      const alpha = Math.min(0.55, dominant.v * 0.65);
      const radius = 14 + dominant.v * 14;
      const grad = ctx.createRadialGradient(agent.x, agent.y, 0, agent.x, agent.y, radius);
      grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
      grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trail: faint white line showing the recent path. Helps the viewer
    // see klinokinesis — the wiggle during runs, the sharp corners on tumbles.
    if (agent.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1;
      ctx.moveTo(agent.trail[0].x, agent.trail[0].y);
      for (let i = 1; i < agent.trail.length; i++) {
        ctx.lineTo(agent.trail[i].x, agent.trail[i].y);
      }
      ctx.stroke();
    }

    // Body: a chevron pointing in the heading direction. Bilateral and
    // obviously directional — which is the whole point of the breakthrough.
    const size = 8;
    ctx.save();
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.heading);
    ctx.fillStyle = '#f2f3f5';
    ctx.strokeStyle = '#0f1116';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  render() {
    if (this.dirty) this.rebuildBackground();
    this.ctx.drawImage(this.bg, 0, 0);
    this.drawSources();
  }
}
