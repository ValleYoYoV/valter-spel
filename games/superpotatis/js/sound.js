/* ═══════════════════════════════════════════════════════════════
   sound.js — 8-bitars ljud genererat i realtid med Web Audio.
   Inga ljudfiler: varje effekt är oscillatorer och brus.

   Webbläsare vägrar starta ljud innan användaren klickat, så
   AudioContext skapas först vid första ljudet och väcks med
   resume() om den ligger nere.
   ═══════════════════════════════════════════════════════════════ */

const SFX = (function () {
  let ac = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  function ctx() {
    /* Utan webbläsare (t.ex. i testkörningen) finns ingen ljudmotor —
       då blir varje effekt tyst i stället för att krascha. */
    if (typeof window === "undefined") return null;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.32;
        master.connect(ac.destination);
      } catch (e) { return null; }
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }

  /* Vitt brus — grunden i explosioner och träffar. */
  function noise() {
    const a = ctx(); if (!a) return null;
    if (!noiseBuf) {
      const len = a.sampleRate * 0.6;
      noiseBuf = a.createBuffer(1, len, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }

  /* En enkel ton. slideTo != null ger en glidande tonhöjd. */
  function tone(freq, dur, type, vol, slideTo, delay) {
    const a = ctx(); if (!a || muted) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol == null ? 0.25 : vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function burst(dur, vol, cutoff, delay) {
    const a = ctx(); if (!a || muted) return;
    const src = noise(); if (!src) return;
    const t0 = a.currentTime + (delay || 0);
    const g = a.createGain();
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    g.gain.setValueAtTime(vol == null ? 0.3 : vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  return {
    /* pew — kort nedåtglidande fyrkantsvåg */
    shoot()    { tone(880, 0.08, "square", 0.16, 260); },

    /* fiende besegrad — brusknall plus ett lågt puff */
    explode()  { burst(0.22, 0.26, 1600); tone(180, 0.16, "triangle", 0.18, 60); },

    /* power-up — stigande treklang */
    pickup()   { tone(523, 0.07, "square", 0.2); tone(659, 0.07, "square", 0.2, null, 0.07);
                 tone(1046, 0.13, "square", 0.22, null, 0.14); },

    /* spelaren träffad */
    hurt()     { tone(240, 0.28, "sawtooth", 0.28, 70); burst(0.14, 0.16, 700); },

    /* Potatismos-bomben — djup dunk och långt brus */
    bomb()     { tone(90, 0.75, "sawtooth", 0.34, 28); burst(0.8, 0.34, 2600);
                 tone(150, 0.5, "square", 0.16, 40, 0.05); },

    /* mätaren full */
    charged()  { tone(784, 0.09, "square", 0.2); tone(1174, 0.18, "square", 0.22, null, 0.09); },

    /* ny våg */
    wave()     { tone(523, 0.1, "square", 0.2); tone(659, 0.1, "square", 0.2, null, 0.1);
                 tone(784, 0.1, "square", 0.2, null, 0.2); tone(1046, 0.22, "square", 0.22, null, 0.3); },

    /* game over — fallande sorgemarsch */
    dead()     { tone(392, 0.2, "square", 0.24); tone(330, 0.2, "square", 0.24, null, 0.2);
                 tone(262, 0.2, "square", 0.24, null, 0.4); tone(196, 0.6, "square", 0.26, 90, 0.6); },

    /* menyklick */
    blip()     { tone(660, 0.06, "square", 0.18); },

    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.32; return muted; },
    isMuted()    { return muted; },
    wake()       { ctx(); }
  };
})();

if (typeof module !== "undefined") { module.exports = { SFX }; }
