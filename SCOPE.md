# Retracing Intelligence — Project Scope

## Mission

Re-implement the five breakthroughs of intelligence from Bennett's *A Brief History of Intelligence*, one at a time, in a single shared 2D foraging world. Each layer adds the specific mechanism that breakthrough introduced. The agents run side-by-side by the end, so readers can literally watch evolution happen.

## Design principles

1. **Fidelity to the book first, clever engineering second.** Every mechanism we add has to map to a specific claim Bennett makes. If we can't tie it to the book, it doesn't go in.
2. **Same world across all layers.** The 2D foraging environment stays consistent so agents are directly comparable. New layers add new *capabilities*, not new worlds.
3. **Each layer is a strict superset of the previous.** A Layer-3 agent contains everything a Layer-1 agent has, plus what Layer 2 added, plus its own new mechanism.
4. **Non-tech readers first.** The blogs are about the book. The tech exists to demonstrate the book's claims, not to be the point.
5. **Vanilla stack, no frameworks.** Single HTML file per experiment where possible. Zero build step. The codebase should be readable by a motivated non-programmer.

## Artifact model

- **`playground/`** — one interactive canvas site, hosted on GitHub Pages. Grows with each layer. URL params deep-link to specific scenarios.
- **`layer-N-<name>/`** — one directory per breakthrough, containing:
  - `SCOPE.md` — what this layer covers, what's explicitly out of scope
  - `src/` — the agent, world, and scenario code for this layer
  - `drafts/blog.md` — the Medium blog draft
  - `assets/` — GIFs, screenshots, diagrams for the blog
- **Medium posts** — one per layer + one final synthesis. Each links into the playground.

## The five layers

### Layer 1 — Steering (bilaterians)
Reflex agent with bilateral body, klinokinesis, valence tagging, affective state (valence × arousal), dopamine/serotonin dual-channel reward, stress/opioid dynamics, and primitive associative learning (habituation, sensitization, classical conditioning). **No prediction, no value function, no world model.**

### Layer 2 — Reinforcing (early vertebrates)
Adds temporal-difference learning. Dopamine upgrades from "fires during pursuit" to "fires on reward prediction error" (Schultz's monkey experiments). Model-free RL.

### Layer 3 — Simulating (early mammals)
Adds an internal world model. Agent learns to predict next-state from current-state and rolls out imagined trajectories before acting. Dreamer / MuZero territory.

### Layer 4 — Mentalizing (primates)
Adds theory of mind. Agent's world model extends to include *other agents'* internal states. Multi-agent environment, opponent modeling.

### Layer 5 — Speaking (humans)
Adds a symbolic/linguistic channel. Agents compress experiences into tokens and communicate. LLM integration likely lives here.

## What's explicitly out of scope

- Claims not in the book. We're bringing the book to life, not expanding on it.
- Matching state-of-the-art performance. Our agents should be *legible*, not competitive.
- Biological realism beyond what the book asserts. We're implementing Bennett's abstraction, not a full neural simulation.
- Production-quality software. This is a blog companion, not a library.

## Success criteria

The project succeeds if:
1. Every book claim tested has a visible, reproducible demo
2. A reader who finishes all five blogs understands the book's thesis more deeply than by reading alone
3. The playground is self-contained enough that a reader can explore it without instructions
