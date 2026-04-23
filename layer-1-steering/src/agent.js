// Agent: a bilaterian body with klinokinesis motor control and an AffectState brain.
//
// The agent's life cycle each tick:
//   1. PERCEIVE  — sample raw food/toxin readings at current position.
//   2. WEIGHT    — compute effective valence using internal affect state.
//   3. DECIDE    — klinokinesis: run or tumble based on whether effective valence
//                  is improving. Tumble magnitude and speed are state-modulated.
//   4. UPDATE    — update affect state with this-tick signals (consumption, stress, etc).
//   5. MOVE      — apply movement, reflecting off walls.
//
// The agent has no memory beyond one tick's previous valence and the affect scalars.
// No value function. No world model. No prediction. Still Layer 1.

import { AffectState } from './state.js';
import { AssociativeMemory } from './learning.js';

export class Agent {
  constructor({
    x,
    y,
    heading = 0,
    baseSpeed = 2.2,
    runNoise = 0.12,      // wiggle during runs — also essential for initial discovery in flat zones
    tumbleBase = 0.5,
    tumbleScale = 1.6,
    deltaSensitivity = 8,
    eatRadius = 55,
    state = null,
    memory = null,
  } = {}) {
    this.x = x;
    this.y = y;
    this.heading = heading;

    this.baseSpeed = baseSpeed;
    this.runNoise = runNoise;
    this.tumbleBase = tumbleBase;
    this.tumbleScale = tumbleScale;
    this.deltaSensitivity = deltaSensitivity;
    this.eatRadius = eatRadius;

    this.state = state ?? new AffectState();
    this.memory = memory ?? new AssociativeMemory();

    this.prevEffective = 0;
    this.lastDelta = 0;
    this.lastFood = 0;
    this.lastToxin = 0;
    this.lastReadings = {};  // channel → reading, populated in step()
    this.consuming = false;

    this.trail = [];
    this.maxTrail = 240;
  }

  // Am I close enough to any active food source to "eat"?
  nearFood(world) {
    for (const src of world.sources) {
      if (!src.active || src.channel !== 'food') continue;
      const dx = this.x - src.x;
      const dy = this.y - src.y;
      if (dx * dx + dy * dy < this.eatRadius * this.eatRadius) return true;
    }
    return false;
  }

  step(world) {
    // 1. PERCEIVE — sample every channel present in the world. Innate channels
    // (food, toxin) keep their hardwired valence; other channels have a
    // learned valence from AssociativeMemory that gets folded in below.
    const readings = {};
    for (const ch of world.channels()) {
      readings[ch] = world.sample(this.x, this.y, ch);
    }
    this.lastReadings = readings;

    const foodReading = readings.food ?? 0;
    const toxinReading = readings.toxin ?? 0;
    this.lastFood = foodReading;
    this.lastToxin = toxinReading;
    const consuming = this.nearFood(world);
    this.consuming = consuming;

    // Fold learned valences from conditioned cues into the food/toxin streams.
    // A cue with learned valence +0.6 and reading 0.4 contributes +0.24 to
    // effective food valence — the cue has become food-like. Negative learned
    // valence contributes to the toxin side analogously.
    let learnedPositive = 0;
    let learnedNegative = 0;
    for (const [ch, reading] of Object.entries(readings)) {
      if (this.memory.isInnate(ch)) continue;
      const lv = this.memory.valenceFor(ch);
      if (lv > 0) learnedPositive += reading * lv;
      else if (lv < 0) learnedNegative += reading * (-lv);
    }

    // 2. WEIGHT — effective valence via current state, with learned cues
    // mixed into the appropriate streams.
    const effective = this.state.effectiveValence(
      foodReading + learnedPositive,
      toxinReading + learnedNegative,
    );
    const delta = effective - this.prevEffective;
    this.prevEffective = effective;
    this.lastDelta = delta;

    // 3. DECIDE — klinokinesis with state-modulated motor parameters.
    // Runs stay gentle; tumbles scale with how bad the effective drop is.
    // Wanting dampens tumble magnitude (a committed hunter doesn't randomly
    // reorient as much). Arousal amplifies run noise (aroused → more wiggling).
    let turn;
    if (delta >= 0) {
      const wigglyness = this.runNoise * (0.5 + this.state.arousal * 1.2);
      turn = (Math.random() - 0.5) * 2 * wigglyness;
    } else {
      const severity = Math.min(1, -delta * this.deltaSensitivity);
      const wantingDampen = 1 - this.state.wanting * 0.5;
      const magnitude = (this.tumbleBase + severity * this.tumbleScale) * wantingDampen;
      turn = (Math.random() - 0.5) * 2 * magnitude;
    }
    this.heading += turn;

    // 4. UPDATE — advance affect state + associative memory one tick each.
    // Associative memory conditions the novel-channel valences based on what
    // co-occurred with what (food → positive, toxin → negative, neither → extinction).
    const prevStress = this.state.stress;
    this.state.update({
      foodReading,
      toxinReading,
      consuming,
      positiveDelta: delta > 0 ? delta : 0,
      prevStress,
    });
    this.memory.update(readings, consuming, toxinReading);

    // 5. MOVE — speed is modulated by three effects:
    //   • SATIATION (liking − wanting): once liking outweighs wanting, the agent
    //       slows and lingers. Crucially, artificially pinned wanting keeps this
    //       difference ≤ 0 so the agent *cannot* satiate-stop. This is the
    //       Berridge story — the wanting system overrides the "I'm full" signal
    //       and the animal keeps eating past satiation.
    //   • AROUSAL (excited → faster)
    //   • ANHEDONIA (gives up → near stop). This is the visible "C. elegans
    //       just stops foraging" behavior from the chronic-stress section.
    // Satiation damper is aggressive (1.2×) with a 5% floor so a well-satiated
    // agent visibly *stops*, not just slows. Bennett's wording is "settles down,
    // stops hunting" — the visual should match that, not a 30%-speed wiggle.
    const satiationEffect = Math.max(0, this.state.liking - this.state.wanting);
    const speed =
      this.baseSpeed *
      Math.max(0.05, 1 - satiationEffect * 1.2) *
      (0.3 + this.state.arousal * 1.1) *
      Math.max(0.05, 1 - this.state.anhedonia * 0.95);

    let nx = this.x + Math.cos(this.heading) * speed;
    let ny = this.y + Math.sin(this.heading) * speed;

    if (nx < 0 || nx > world.width) {
      this.heading = Math.PI - this.heading;
      nx = this.x + Math.cos(this.heading) * speed;
    }
    if (ny < 0 || ny > world.height) {
      this.heading = -this.heading;
      ny = this.y + Math.sin(this.heading) * speed;
    }

    const clamped = world.clampPosition(nx, ny);
    this.x = clamped.x;
    this.y = clamped.y;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();
  }
}
