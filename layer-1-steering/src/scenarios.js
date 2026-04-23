// Scenario registry. Each scenario sets up the world + agent for a specific
// claim from Bennett's book. The runtime selects one at a time via the dropdown
// or URL param.
//
// Scenario shape:
//   id         — matches the dropdown <option> value
//   title      — display title
//   summary    — 1–2 sentences of framing
//   watchFor   — what the viewer should look for (supports **bold**)
//   knobs?     — { knobKey: { label, values[], default } } tunable parameters
//   setup()    — (world, AgentClass, knobValues) → agent
//   tick?()    — (ctx = { world, agent, renderer, tickNum }) called each sim tick,
//                 used by scenarios that mutate the world over time (persistent affect)

import { CHANNEL } from './world.js';
import { AffectState } from './state.js';

export const SCENARIOS = {
  // ----- #1 Baseline --------------------------------------------------
  baseline: {
    id: 'baseline',
    title: 'Baseline foraging',
    summary:
      'One food source, one toxin source. The agent has no learning and no world model — ' +
      'just klinokinesis plus a six-scalar affective state. Yet the full behavioral cycle ' +
      'emerges: drive → pursue → consume → satiate → disengage → drive.',
    watchFor:
      'Watch **hunger** fall and **liking** rise as the agent eats. **Wanting** (dopamine) ' +
      'fires only when there is drive to pursue — it collapses on consumption, and stays ' +
      'low while the agent is satiated even if food is still right there.',
    setup(world, AgentClass) {
      world.clearSources();
      // Food gradient reaches across the plate (radius 220) — without this
      // the agent spends most of its time doing random walks in a zero-gradient
      // zone. Klinokinesis is an orientation mechanism, not a search one.
      // Biologically the equivalent is: the plate has a pervasive scent, and
      // the worm follows it up. Real petri dishes work this way too.
      world.addSource({ x: world.width * 0.75, y: world.height * 0.5, channel: CHANNEL.FOOD,  strength: 1.3, radius: 220 });
      world.addSource({ x: world.width * 0.25, y: world.height * 0.5, channel: CHANNEL.TOXIN, strength: 1.0, radius: 70 });
      return new AgentClass({ x: world.width * 0.5, y: world.height * 0.9, heading: -Math.PI / 2 });
    },
  },

  // ----- #2 Copper test -----------------------------------------------
  copper: {
    id: 'copper',
    title: 'Copper test (cost–benefit)',
    summary:
      'Bennett describes a classic C. elegans experiment: worms on a plate with food on one ' +
      'side and a toxic *copper barrier* between. Hungry worms will cross the barrier. Well-fed ' +
      'worms will not. Same agent, same world — internal state changes the decision.',
    watchFor:
      'Toggle the start state. **Hungry** → drive is high, effective food valence outweighs ' +
      "toxin cost → the agent pushes through and eats. **Fed** → no drive (hunger − liking ≈ 0), " +
      'so food valence is near zero and the toxin wall dominates → the agent stays safe and still.',
    knobs: {
      startState: {
        label: 'Agent starts',
        values: ['hungry', 'fed'],
        default: 'hungry',
      },
    },
    setup(world, AgentClass, knobs) {
      world.clearSources();

      // Food on the right — large radius so the scent reaches across the
      // barrier. Without this, a hungry agent has nothing to steer toward.
      world.addSource({ x: world.width * 0.88, y: world.height * 0.5, channel: CHANNEL.FOOD, strength: 1.5, radius: 170 });

      // Toxic copper barrier: three toxin sources with gaps between them.
      // The gaps matter — the book's claim is that hungry worms *cross*, not
      // that they tank the toxin head-on. Klinokinesis finds the easier path.
      const barrierX = world.width * 0.5;
      const ys = [0.2, 0.5, 0.8];
      for (const yFrac of ys) {
        world.addSource({
          x: barrierX,
          y: world.height * yFrac,
          channel: CHANNEL.TOXIN,
          strength: 0.8,
          radius: 55,
        });
      }

      // Initial state depends on the knob.
      const hungry = (knobs.startState ?? 'hungry') === 'hungry';
      const state = new AffectState({
        hunger: hungry ? 0.95 : 0.10,
        liking: hungry ? 0.00 : 0.85,
        arousal: hungry ? 0.7 : 0.25,
      });

      return new AgentClass({
        x: world.width * 0.1,
        y: world.height * 0.5,
        heading: 0,
        state,
      });
    },
  },

  // ----- #3 Berridge rat ----------------------------------------------
  berridge: {
    id: 'berridge',
    title: 'Berridge rat (want ≠ like)',
    summary:
      "Berridge's rats, given artificially elevated dopamine, ate more food while their facial " +
      'expressions showed less pleasure — even disgust. The wanting and liking systems are ' +
      "separable, but only via external manipulation. Natural dopamine is gated by drive; this experiment " +
      'bypasses the gate.',
    watchFor:
      'With **pinned** wanting: even after the agent is fully satiated (liking high, hunger 0), ' +
      'dopamine stays pegged at 1.0 and the agent keeps orbiting and "eating." With **natural** wanting: ' +
      'the agent eats, satiates, wanders off — the normal cycle. The difference is the entire claim of the experiment.',
    knobs: {
      wanting: {
        label: 'Dopamine',
        values: ['natural', 'pinned'],
        default: 'pinned',
      },
    },
    setup(world, AgentClass, knobs) {
      world.clearSources();
      world.addSource({ x: world.width * 0.7, y: world.height * 0.5, channel: CHANNEL.FOOD, strength: 1.0, radius: 95 });

      const agent = new AgentClass({
        x: world.width * 0.18,
        y: world.height * 0.5,
        heading: 0,
      });

      if ((knobs.wanting ?? 'pinned') === 'pinned') {
        agent.state.pin('wanting', 1.0);
      }
      return agent;
    },
  },

  // ----- #4 Persistent affect -----------------------------------------
  persistence: {
    id: 'persistence',
    title: 'Persistent affect (one-whiff test)',
    summary:
      'A food source emits briefly, then fades. The book: a worm that gets one whiff of food should not ' +
      'keep sprinting — it should slow down and search locally, because food is probably nearby. That ' +
      'only works if internal state **persists past the stimulus**. Otherwise the agent wanders off once the scent fades.',
    watchFor:
      'With **persistent** affect: arousal and wanting carry the agent forward, keeping it searching in the ' +
      'zone even after the food gradient collapses. With **stateless** affect: arousal is pinned low — the ' +
      'moment the scent disappears, the agent reverts to random walking and drifts away.',
    knobs: {
      affect: {
        label: 'Internal state',
        values: ['persistent', 'stateless'],
        default: 'persistent',
      },
    },
    setup(world, AgentClass, knobs) {
      world.clearSources();

      // A brief food source in the middle-right. Fades over time via scenario.tick.
      world.addSource({
        x: world.width * 0.6,
        y: world.height * 0.5,
        channel: CHANNEL.FOOD,
        strength: 0.85,
        radius: 70,
      });

      const agent = new AgentClass({
        x: world.width * 0.2,
        y: world.height * 0.5,
        heading: 0,
      });

      if ((knobs.affect ?? 'persistent') === 'stateless') {
        // Strip the agent of persistent affect. Arousal, wanting, and liking
        // are all clamped so they can't carry information between ticks.
        agent.state.pin('arousal', 0.2);
        agent.state.pin('wanting', 0.0);
        agent.state.pin('liking',  0.0);
      }
      return agent;
    },
    tick({ world, renderer, tickNum }) {
      // Fade the food source after a grace period, so the agent has time to
      // notice it before it vanishes. After t=120 ticks, decay 1.5%/tick.
      const food = world.sources.find(s => s.channel === 'food' && s.active);
      if (!food) return;
      if (tickNum > 120 && food.strength > 0) {
        food.strength *= 0.985;
        if (food.strength < 0.02) {
          food.strength = 0;
          food.active = false;
        }
        renderer.markDirty();
      }
    },
  },

  // ----- #5 Chronic stress / anhedonia --------------------------------
  'chronic-stress': {
    id: 'chronic-stress',
    title: 'Chronic stress → anhedonia',
    summary:
      'Bennett: when stress cannot be escaped, serotonin flattens, valence dulls across the board, ' +
      "arousal drops — the animal gives up. C. elegans stops foraging; humans call it depression. " +
      'Here the whole plate is soaked in a toxic background, with food reachable but only through stress. ' +
      'Watch the agent try, then slowly stop trying.',
    watchFor:
      'Early on: normal foraging, but **stress** rises and stays elevated because there is no safe zone. ' +
      'Over time, **anhedonia** climbs — slowly, by design. As it does, **arousal** sags, **liking** gain ' +
      'collapses, and the behavioral drive fades. The agent hovers or stops. This is the failure mode of the ' +
      'Layer 1 toolkit, and the book is explicit that it looks like giving up.',
    setup(world, AgentClass) {
      world.clearSources();

      // Food source, still reachable.
      world.addSource({ x: world.width * 0.8, y: world.height * 0.35, channel: CHANNEL.FOOD, strength: 1.0, radius: 75 });

      // Toxic background — several overlapping toxin sources so there's no
      // clean safe space to retreat to. The key property for this scenario
      // is that stress can't get cleanly back to 0.
      const toxins = [
        { x: 0.25, y: 0.30, r: 110 },
        { x: 0.40, y: 0.75, r: 120 },
        { x: 0.65, y: 0.70, r: 105 },
        { x: 0.80, y: 0.15, r:  90 },
        { x: 0.15, y: 0.80, r: 100 },
      ];
      for (const t of toxins) {
        world.addSource({
          x: world.width * t.x,
          y: world.height * t.y,
          channel: CHANNEL.TOXIN,
          strength: 0.65,
          radius: t.r,
        });
      }

      return new AgentClass({
        x: world.width * 0.45,
        y: world.height * 0.5,
        heading: 0,
        state: new AffectState({ hunger: 0.7, arousal: 0.5 }),
      });
    },
  },

  // ----- #6 Pavlov's worm --------------------------------------------
  pavlov: {
    id: 'pavlov',
    title: "Pavlov's worm (classical conditioning)",
    summary:
      'A novel odor — call it **odorA** — is always present in the middle of the plate. Food appears at ' +
      'the same spot periodically (60 ticks on, 140 ticks off). With every pairing, the agent learns that ' +
      'odorA goes with food. After enough pairings, the odor alone drives pursuit — even during the phases ' +
      'when no food is present. This is classical conditioning without prediction: the cue does not *predict* ' +
      'food, its **valence itself is rewritten** to feel food-like.',
    watchFor:
      'Open the **Learned cue valences** panel below. odorA starts at 0. After a few food pairings it ' +
      'climbs toward +1. Once it is high enough, watch the agent: during the no-food phase, it still ' +
      'hovers at the odor zone instead of wandering off. That is the "dog salivating at the bell."',
    setup(world, AgentClass) {
      world.clearSources();
      const cx = world.width * 0.65;
      const cy = world.height * 0.5;
      // Persistent novel odor — always on, never paired with toxin. Wide
      // radius so the agent can detect it across most of the plate (needed
      // for the "it still seeks the odor zone" demonstration later).
      world.addSource({ x: cx, y: cy, channel: 'odorA', strength: 1.0, radius: 250 });
      // Food, co-located. Starts ON for the first pairing; scenario.tick cycles it.
      // Very wide radius means the priming phase reliably pulls the agent in.
      world.addSource({ x: cx, y: cy, channel: CHANNEL.FOOD, strength: 1.5, radius: 300 });
      return new AgentClass({
        x: world.width * 0.3,
        y: world.height * 0.5,
        heading: 0,
      });
    },
    tick({ world, renderer, tickNum }) {
      const food = world.sources.find(s => s.channel === 'food');
      if (!food) return;

      // Priming phase (first 400 ticks): food is continuously on. This gives
      // every agent a reliable first pairing event — without it, stochastic
      // klinokinesis means some runs never find food during a brief 80-tick
      // window, and the whole demo fails on some refreshes.
      const PRIMING = 400;
      if (tickNum < PRIMING) {
        if (!food.active) {
          food.active = true;
          food.strength = 1.3;
          renderer.markDirty();
        }
        return;
      }

      // Pairing cycle after priming: 50 ticks food on / 350 ticks food off.
      // Short on-phase → agent only partially satiates (hunger doesn't fully
      // crash, liking peaks lower). Long off-phase → hunger rises back above
      // the residual liking, so drive (hunger − liking) returns positive and
      // the learned odorA valence actually drives pursuit. Without this, the
      // agent stays "sort of full" the whole cycle and never chases the cue —
      // which is biologically accurate but hides the whole demo.
      const phase = (tickNum - PRIMING) % 400;
      if (phase === 0 && !food.active) {
        food.active = true;
        food.strength = 1.3;
        renderer.markDirty();
      } else if (phase === 50 && food.active) {
        food.active = false;
        renderer.markDirty();
      }
    },
  },
};

export function getScenario(id) {
  return SCENARIOS[id] ?? SCENARIOS.baseline;
}

// Return default knob values for a given scenario, keyed by knob name.
export function defaultKnobs(scenario) {
  const out = {};
  for (const [key, knob] of Object.entries(scenario.knobs ?? {})) {
    out[key] = knob.default;
  }
  return out;
}

// Merge user-supplied values (from URL params) over defaults, dropping any
// that aren't valid for this scenario.
export function resolveKnobs(scenario, supplied) {
  const out = defaultKnobs(scenario);
  for (const [key, knob] of Object.entries(scenario.knobs ?? {})) {
    if (supplied[key] !== undefined && knob.values.includes(supplied[key])) {
      out[key] = supplied[key];
    }
  }
  return out;
}
