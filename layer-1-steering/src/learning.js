// AssociativeMemory: the agent's Layer-1 learning apparatus.
//
// Each odor/cue channel has a *learned valence* in [-1, 1] that starts at 0
// and updates based on what the cue co-occurs with:
//
//   • CLASSICAL CONDITIONING — cue + food consumption → learned valence rises.
//     Eventually the cue alone drives pursuit (Pavlov's dog / worm).
//   • SENSITIZATION         — cue + strong toxin → learned valence falls.
//     Cue becomes aversive on its own.
//   • HABITUATION           — cue present but no valenced outcome → learned
//     valence decays toward 0. You stop responding to things that don't matter.
//
// These are not three mechanisms — they are one update rule. That is the point
// Bennett makes at the end of the Steering chapter: primitive learning is
// associative and reflex-tuning, not predictive. No value function, no model.
//
// Innate channels (food, toxin) are explicitly excluded from conditioning —
// their valence is hardwired and not learnable at Layer 1.

const INNATE = new Set(['food', 'toxin']);

// Conditioning rate is fast (strong response per pairing); extinction is slow
// (resistant to unlearning). This asymmetry matters: real Pavlov-conditioned
// responses are established in dozens of pairings and extinguish over hundreds
// of unpaired trials. With symmetric rates, the hours of "cue present without
// food" between pairings would wipe out each trial's gain before the next.
const ALPHA_POS      = 0.04;     // conditioning rate — cue + food
const ALPHA_NEG      = 0.04;     // conditioning rate — cue + toxin
const DECAY          = 0.0003;   // extinction rate — cue present, no outcome
const CUE_THRESHOLD  = 0.15;     // below this, we treat the cue as absent
const TOXIN_SIGNAL   = 0.30;     // toxin reading above this counts as a pairing event

export class AssociativeMemory {
  constructor() {
    this.learned = {};  // channel → learned valence [-1, 1]
  }

  // Step the memory one tick.
  //   readings      : map { channel → reading } at the agent's current position
  //   consuming     : bool — is the agent currently consuming food?
  //   toxinReading  : number — current toxin reading (the pairing event for sensitization)
  update(readings, consuming, toxinReading) {
    for (const [ch, reading] of Object.entries(readings)) {
      if (INNATE.has(ch)) continue;         // food/toxin valence is hardwired
      if (reading < CUE_THRESHOLD) continue; // cue not meaningfully present

      const current = this.learned[ch] ?? 0;
      let next;

      if (consuming) {
        // Positive pairing: cue + food acquisition → approach toward 1.
        next = current + ALPHA_POS * (1 - current);
      } else if (toxinReading > TOXIN_SIGNAL) {
        // Negative pairing: cue + threat → approach toward -1.
        next = current - ALPHA_NEG * (1 + current);
      } else {
        // Extinction: cue present without consequence → fade toward 0.
        next = current * (1 - DECAY);
      }

      this.learned[ch] = next;
    }
  }

  valenceFor(channel) {
    return this.learned[channel] ?? 0;
  }

  snapshot() {
    return { ...this.learned };
  }

  isInnate(channel) {
    return INNATE.has(channel);
  }
}
