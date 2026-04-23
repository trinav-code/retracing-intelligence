# Layer 1 — Steering

## What this layer covers

Breakthrough #1 from Bennett's book: the mechanisms bilaterians (~550 MYA) evolved to achieve purposeful movement without planning or prediction.

## Bennett's claims we're testing

Each of these maps to a specific experiment and a specific section of the blog.

| # | Claim (book) | Experiment | Demo |
|---|---|---|---|
| 1 | Klinokinesis (compare gradient now vs. before, turn if not improving) works without a map | **Baseline foraging** | Bilaterian agent beats random walk, matches simple gradient-follower |
| 2 | Valence is weighed against internal state — hungry C. elegans cross toxic barriers, fed ones don't | **Copper test** | Same agent, same world, toggle `hunger` → different decision |
| 3 | Wanting (dopamine) and liking (serotonin) are separable (Berridge rats) | **Berridge rat** | Pin dopamine high → agent keeps pursuing past satiation despite low "liking" signal |
| 4 | Affect is a *persistent state*, not a stimulus-response reflex (the "one whiff of food" example) | **Persistent affect** | Stateful agent finds fading food source; stateless agent wanders off |
| 5 | Inescapable threat → chronic stress → serotonin flattens → anhedonia / giving up | **Chronic stress** | Put agent in inescapable stressor, watch arousal drop, foraging stop |
| 6 | Classical conditioning: a previously neutral cue inherits valence when repeatedly paired with a valenced one (Pavlov, even in worms) | **Pavlov's worm** | Novel odor + food pairings → agent eventually chases odor alone |

## Agent spec

### Body
- Bilateral: has a heading (forward direction), can go forward or turn
- Position in 2D continuous space

### Senses
- Smell/taste gradients at current position (per odor channel)
- Can compare current reading to the reading one tick ago (short-term memory of ~1 step)

### Internal state (scalars)
- `hunger` — rises over time, falls when food consumed
- `arousal` — persistent, decays slowly; elevated by novel stimuli
- `stress` — rises with negative valence, drives adrenaline response
- `wanting` (dopamine) — spikes during pursuit of positive gradients
- `liking` (serotonin) — spikes on consumption of food, dampens `wanting`
- `opioid` — releases after acute stressor ends, restores normal valence weighting
- Per-odor *learned valence* (starts at 0 for neutral odors, gets updated by associative learning)

### Policy (pure reflex + neuromodulator gating)
- Sample valence-weighted gradient; compare to previous tick
- If improving → continue forward (biased by `wanting`)
- If not improving → turn randomly (biased by `arousal`)
- `hunger` and `stress` globally scale how much positive vs. negative valence is weighed
- **No value function. No world model. No prediction of future states.**

### Learning (Layer 1 only — tuning reflexes, not predicting)
- **Habituation** — repeated exposure to a stimulus without consequence decays its response
- **Sensitization** — stimuli that precede strongly negative valence get boosted response
- **Classical conditioning** — neutral odor repeatedly paired with valenced one takes on that valence (decayed over time without reinforcement)

## World spec

- 2D continuous plate, bounded
- Food sources emit positive-valence odor gradients (exponential falloff)
- Toxin sources emit negative-valence gradients (e.g., the "copper barrier")
- Scenarios can place food, toxins, and neutral-cue emitters anywhere; can toggle them on/off mid-run
- One tick = one agent decision; visual framerate independent of tick rate

## Scope boundaries — what's explicitly OUT

- No reward prediction error (that's Layer 2)
- No value function V(s) or Q(s,a) (that's Layer 2)
- No learned model of the environment (that's Layer 3)
- No planning / lookahead / tree search (that's Layer 3)
- No other agents in the world (that's Layer 4)
- No symbolic communication (that's Layer 5)

If a mechanism feels tempting and it's not on the included list, it belongs to a later layer.

## What the blog will argue

Two things:

1. **Modern RL's single-scalar reward is a simplification that biology never made.** Even 550-million-year-old brains used at least two reward channels plus a modulatory state machine. The wanting/liking split isn't historical trivia — it actually prevents failure modes that plague standard RL agents (never-satisfied agents, reward hacking).
2. **You get a *lot* of intelligent-looking behavior before learning proper even enters the picture.** Our agent can't predict. It can't remember where food was yesterday. It can still forage, weigh cost against benefit, recover from stress, and — with classical conditioning — even learn what the world's cues mean. Prediction is Breakthrough #2's contribution; everything we're demoing is what it looks like *without* it.

## Playground UX

Single HTML page, URL-param scenario routing:
- Dropdown to switch scenarios (baseline / copper / berridge / persistence / chronic-stress / pavlov)
- Sliders / knobs to tune agent internals live (dopamine, serotonin, hunger, stress thresholds)
- Pause / step / reset controls
- Inline panel showing the agent's internal state in real time (bars for hunger, arousal, wanting, liking, stress)
- "Reset with current settings" vs "Reset to defaults"

## Build order

1. World + renderer (static environment, no agent yet)
2. Agent body + klinokinesis (baseline foraging works)
3. Internal state + dual-channel reward (wanting/liking)
4. Scenario infrastructure (scenario definitions, URL routing, UI controls)
5. Scenarios 1–5 (baseline through chronic stress)
6. Associative learning (habituation, sensitization, classical conditioning)
7. Scenario 6 (Pavlov's worm)
8. Polish UI, record GIFs, draft blog
