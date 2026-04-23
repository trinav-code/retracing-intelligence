# Retracing Intelligence

A five-part project that re-implements the evolution of intelligence, one breakthrough at a time, based on Max Bennett's *A Brief History of Intelligence* (2023).

Each breakthrough gets:
- A working agent, running in a shared 2D foraging world
- A Medium blog post bringing the chapter to life
- New capabilities layered on top of the previous agent — the final agent is all five stacked

The five breakthroughs map almost 1:1 onto the history of RL research:

| # | Bennett's breakthrough | Era | ML layer |
|---|---|---|---|
| 1 | Steering | Bilaterians, ~550 MYA | Reflex agent + dual-channel reward + affective state |
| 2 | Reinforcing | Early vertebrates, ~500 MYA | Temporal-difference learning |
| 3 | Simulating | Early mammals, ~200 MYA | Model-based RL / world models |
| 4 | Mentalizing | Primates, ~30 MYA | Multi-agent + theory of mind |
| 5 | Speaking | Humans, ~100 KYA | Language-grounded agents |

## Artifact model

- **One interactive playground site** (GitHub Pages) that grows with each layer
- **Five Medium blog posts**, one per breakthrough, each deep-linking into the playground
- **One final synthesis post** stitching the whole thing together

See `SCOPE.md` for the full project scope and `layer-1-steering/SCOPE.md` for the current layer's spec.
