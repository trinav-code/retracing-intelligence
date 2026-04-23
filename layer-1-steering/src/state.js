// AffectState: the bilaterian's internal scalar state.
//
// Seven neuromodulator-like variables, all in [0, 1]:
//   hunger    — need-for-food pressure. Rises over time, drops while consuming.
//   liking    — serotonin analog. Spikes on consumption. Damps pursuit when high.
//   wanting   — dopamine analog. Builds during approach to positive gradients,
//                gated by drive. Drops on acquisition. Dissociable from liking
//                under artificial boost (this is Berridge's point).
//   stress    — adrenaline analog. Rises near negative stimuli, decays in safety.
//   arousal   — overall energy/engagement. Persistent, decays toward baseline.
//   opioid    — released when stress drops sharply (acute stress resolution).
//                Temporarily boosts positive valence, dulls negative.
//   anhedonia — sustained-stress failure mode. Builds slowly under chronic stress,
//                flattens valence across the board, suppresses arousal and liking gain.
//                This is the book's "C. elegans gives up" / human depression analog.
//
// The state exposes two things the agent needs:
//   1) update(signals) — step the state one tick given this-tick observations
//   2) effectiveValence(food, toxin) — the state-weighted "how do I feel about here?"
//
// State values are PINNABLE. Scenarios can pin(key, value) to override natural dynamics —
// this is how the Berridge rat demo works (pin wanting=1 forever).

const clamp01 = v => Math.max(0, Math.min(1, v));

export class AffectState {
  constructor(init = {}) {
    this.hunger    = init.hunger    ?? 0.7;  // start a bit hungry — keeps baseline demo interesting
    this.liking    = init.liking    ?? 0.0;
    this.wanting   = init.wanting   ?? 0.0;
    this.stress    = init.stress    ?? 0.0;
    this.arousal   = init.arousal   ?? 0.4;
    this.opioid    = init.opioid    ?? 0.0;
    this.anhedonia = init.anhedonia ?? 0.0;

    // External overrides. Anything in here is forced each tick after update().
    this.pinned = {};
  }

  pin(key, value)   { this.pinned[key] = value; }
  unpin(key)        { delete this.pinned[key]; }
  unpinAll()        { this.pinned = {}; }
  isPinned(key)     { return key in this.pinned; }

  // Step the state one tick. `signals` carries this-tick observations from the agent.
  // Keys: foodReading, toxinReading, consuming (bool), positiveDelta (>=0), prevStress.
  update(signals) {
    const {
      foodReading = 0,
      toxinReading = 0,
      consuming = false,
      positiveDelta = 0,
      prevStress = this.stress,
    } = signals;

    // --- hunger ---------------------------------------------------------
    // Rises slowly, drops while consuming. Consumption only reduces hunger
    // meaningfully when there's hunger left to satisfy — an already-full
    // agent can "stay at food" without perpetually driving hunger negative.
    if (consuming) {
      this.hunger = clamp01(this.hunger - 0.02);
    } else {
      this.hunger = clamp01(this.hunger + 0.0006);
    }

    // --- liking (serotonin) --------------------------------------------
    // Spikes on consumption. Saturates (less gain as liking approaches 1).
    // Always decays. Once consumption stops, decay wins and liking falls.
    // Anhedonia directly suppresses the consumption-driven gain — this is
    // the "food doesn't feel good anymore" experience from chronic stress.
    if (consuming && this.hunger > 0.02) {
      const saturating = 1 - this.liking;
      const anhedoniaDamp = 1 - this.anhedonia;
      this.liking = clamp01(this.liking + 0.06 * saturating * anhedoniaDamp);
    }
    this.liking = clamp01(this.liking - 0.006);

    // --- wanting (dopamine) --------------------------------------------
    // Fires during PURSUIT, drops on ACQUISITION, and is gated by DRIVE.
    //
    // Bennett (and Schultz's dopamine neuron recordings) are explicit:
    // dopamine fires in anticipation of reward, then falls once the reward
    // is received. And natural dopamine is gated by motivational state —
    // a satiated animal does not show dopamine spikes just because food
    // exists in the environment. The Berridge dissociation (want ≠ like)
    // only appears under *artificial* boost, not natural dynamics.
    //
    // Gating on drive also breaks a feedback loop: without it, wanting
    // contributes to effectiveValence, which generates positive deltas
    // from the agent's own wiggle, which feed wanting back up.
    if (consuming) {
      this.wanting = clamp01(this.wanting - 0.025);
    } else {
      const drive = Math.max(0, this.hunger - this.liking);
      // Anhedonia shuts down the positive-valence system wholesale. If the
      // book's "nothing feels good anymore" is to mean anything, dopamine
      // has to be unable to fire under high anhedonia — not just eventually
      // decay. Scale the build rate so at max anhedonia it cannot rise.
      const anhedoniaDamp = 1 - this.anhedonia;
      if (positiveDelta > 0 && foodReading > 0.08 && drive > 0.1) {
        this.wanting = clamp01(this.wanting + 0.04 * drive * anhedoniaDamp);
      } else {
        this.wanting = clamp01(this.wanting - 0.015);
      }
    }

    // --- stress (adrenaline) -------------------------------------------
    // Rises in the presence of strong negative stimuli; decays faster when
    // the agent is in a clearly safe space (small residual toxin reading).
    if (toxinReading > 0.2) {
      this.stress = clamp01(this.stress + 0.02);
    } else if (toxinReading < 0.05) {
      this.stress = clamp01(this.stress - 0.02);  // clean getaway → faster relief
    } else {
      this.stress = clamp01(this.stress - 0.006);
    }

    // --- opioid ---------------------------------------------------------
    // "Acute stress resolved" detector. Fires a burst when stress crosses
    // downward through a relief threshold — i.e. the agent *was* in danger
    // and is now clearly safe. This is the biologically-correct trigger
    // (opioid marks escape, not gradual calming), and it means the bar
    // stays at 0 in scenarios without a stressor, as expected.
    const reliefThreshold = 0.25;
    if (prevStress > reliefThreshold && this.stress <= reliefThreshold) {
      this.opioid = clamp01(this.opioid + 0.6);
    }
    this.opioid = clamp01(this.opioid - 0.02);

    // --- arousal --------------------------------------------------------
    // Persistent "how much energy am I spending" scalar. Baseline-seeks,
    // but is boosted by hunger (drive), stress (danger), consumption events.
    // Key property: it persists past the stimulus (the "pilot-in-the-dark"
    // example from the book). Anhedonia drags the target downward — when the
    // stressor won't end, even the drive to move dims.
    const target = (0.2 + this.hunger * 0.5 + this.stress * 0.4) * (1 - this.anhedonia * 0.9);
    this.arousal = clamp01(this.arousal + (target - this.arousal) * 0.02);

    // --- anhedonia (chronic-stress failure mode) -----------------------
    // Builds slowly when stress is sustained above a threshold; decays when
    // the agent gets extended relief. This is a slow variable by design —
    // a few seconds of stress shouldn't flip it. Bennett's framing is that
    // anhedonia is what happens when the stress system is stuck "on."
    if (this.stress > 0.5) {
      this.anhedonia = clamp01(this.anhedonia + 0.004);
    } else if (this.stress < 0.1) {
      this.anhedonia = clamp01(this.anhedonia - 0.002);
    }

    // Apply any external pins last, so scenarios always win.
    this.applyPins();
  }

  applyPins() {
    for (const key of Object.keys(this.pinned)) {
      this[key] = clamp01(this.pinned[key]);
    }
  }

  // Effective (state-weighted) valence at a position given raw readings.
  //
  //   foodWeight  = max(0, hunger - liking)   // hungry → food matters; satiated → it doesn't
  //                  + wanting                 // dopamine drives pursuit regardless of need
  //                  + opioid * 0.3            // relief temporarily boosts positives
  //
  //   toxinWeight = 1                          // innate aversion baseline
  //                  + stress                  // stress amplifies danger signal
  //                  - opioid * 0.6            // relief dulls negatives
  //
  // This is the formula that makes the blog's experiments work:
  //   - Copper test needs hunger × (food vs toxin) tradeoff
  //   - Berridge needs wanting to keep pursuit alive past satiation
  //   - Chronic stress will extend this by adding an anhedonia term (Layer 1 task #5)
  effectiveValence(foodReading, toxinReading) {
    const foodWeight  = Math.max(0, this.hunger - this.liking) + this.wanting + this.opioid * 0.3;
    const toxinWeight = Math.max(0, 1 + this.stress - this.opioid * 0.6);
    // Anhedonia flattens valence across the board — positives feel less positive,
    // negatives less negative. That is the book's "numbness" description.
    const anhedoniaGain = 1 - this.anhedonia * 0.85;
    return anhedoniaGain * (foodReading * foodWeight - toxinReading * toxinWeight);
  }

  snapshot() {
    return {
      hunger:    this.hunger,
      liking:    this.liking,
      wanting:   this.wanting,
      stress:    this.stress,
      arousal:   this.arousal,
      opioid:    this.opioid,
      anhedonia: this.anhedonia,
    };
  }
}
