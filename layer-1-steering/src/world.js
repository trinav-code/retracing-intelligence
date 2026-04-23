// World: a bounded 2D plate that holds odor/valence sources.
//
// A "source" emits a scalar field that falls off exponentially with distance.
// Agents sample these fields at their current position to decide how to move.
//
// Odor channels are keyed by string so new scenarios can introduce novel odors
// (for the Pavlov experiment) without changing the core.

export const CHANNEL = {
  FOOD: 'food',      // positive innate valence
  TOXIN: 'toxin',    // negative innate valence
  // Anything else (e.g. 'odorA') is a neutral cue — no innate valence.
  // Valence for neutral channels is learned via classical conditioning (Layer 1 learning).
};

export class Source {
  constructor({ x, y, channel, strength = 1.0, radius = 80 }) {
    this.x = x;
    this.y = y;
    this.channel = channel;
    this.strength = strength; // peak value at the source position
    this.radius = radius;     // characteristic falloff distance (pixels)
    this.active = true;
  }

  // Exponential falloff: s * exp(-d / r). Smooth, asymptotes to 0,
  // keeps the gradient computable everywhere.
  sampleAt(x, y) {
    if (!this.active) return 0;
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return this.strength * Math.exp(-d / this.radius);
  }
}

export class World {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.sources = [];
    this.tick = 0;
  }

  addSource(config) {
    const src = config instanceof Source ? config : new Source(config);
    this.sources.push(src);
    return src;
  }

  removeSource(source) {
    const idx = this.sources.indexOf(source);
    if (idx >= 0) this.sources.splice(idx, 1);
  }

  clearSources() {
    this.sources.length = 0;
  }

  // Sample the summed field for a given channel at (x, y).
  // Sources on the same channel add linearly.
  sample(x, y, channel) {
    let total = 0;
    for (const src of this.sources) {
      if (src.channel === channel) total += src.sampleAt(x, y);
    }
    return total;
  }

  // Return all channels currently present in the world. Useful for
  // agents that want to sample every cue without hardcoding names.
  channels() {
    const seen = new Set();
    for (const src of this.sources) seen.add(src.channel);
    return [...seen];
  }

  // Clamp a position into world bounds.
  clampPosition(x, y) {
    return {
      x: Math.max(0, Math.min(this.width, x)),
      y: Math.max(0, Math.min(this.height, y)),
    };
  }

  inBounds(x, y) {
    return x >= 0 && x <= this.width && y >= 0 && y <= this.height;
  }

  step() {
    this.tick += 1;
  }
}
