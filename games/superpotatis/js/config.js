/* ═══════════════════════════════════════════════════════════════
   config.js — palett, upplösning och ALL balans på ett ställe.
   Vill du ändra hur spelet känns: ändra här, inte i logikfilerna.
   ═══════════════════════════════════════════════════════════════ */

/* PICO-8-paletten. Index 0–15, adresseras i sprite-rutnäten med
   tecknen 0–9 och a–f. Punkt (.) = genomskinligt. */
const PICO = [
  "#000000", // 0  svart
  "#1D2B53", // 1  mörkblå
  "#7E2553", // 2  mörklila
  "#008751", // 3  mörkgrön   — zombiekropp
  "#AB5236", // 4  brun       — potatis
  "#5F574F", // 5  mörkgrå
  "#C2C3C7", // 6  ljusgrå
  "#FFF1E8", // 7  vit        — ögonvitor
  "#FF004D", // 8  röd        — mantel, zombieögon
  "#FFA300", // 9  orange     — pumpahuvud
  "#FFEC27", // a  gul        — SP-märket, skott
  "#00E436", // b  ljusgrön   — snabbzombie
  "#29ADFF", // c  blå
  "#83769C", // d  lavendel
  "#FF77A8", // e  rosa
  "#FFCCAA"  // f  persika
];
const P = i => PICO[i];

const CFG = {
  /* ── Skärm ───────────────────────────────────────────── */
  W: 400, H: 300,          // intern upplösning — skalas upp med nearest-neighbor
  HUD_H: 30,               // HUD-remsan högst upp
  MAX_SCALE: 4,

  /* ── Spelaren ────────────────────────────────────────── */
  PLAYER: {
    speed: 74,
    maxHp: 5,
    fireRate: 0.22,        // sekunder mellan skott
    turboRate: 0.09,       // med Fritös-Turbo
    turboTime: 8,          // hur länge turbon håller
    invuln: 0.9,           // osårbarhet efter träff
    r: 6                   // träffradie
  },

  /* ── Skott ───────────────────────────────────────────── */
  BULLET: { speed: 260, life: 1.1, r: 2, dmg: 1 },

  /* ── Zombietyper ─────────────────────────────────────── */
  ZOMBIES: {
    std: {
      name: "Zombie",
      sprite: "zstd", speed: 26, hp: 3, dmg: 1, score: 10, r: 6, charge: 8
    },
    peeler: {
      name: "Röten Potatisskalare",
      sprite: "zpeel", speed: 56, hp: 1, dmg: 1, score: 15, r: 5, charge: 10
    },
    pumpkin: {
      name: "Mögligt Zombie-pumpahuvud",
      sprite: "zpump", speed: 14, hp: 14, dmg: 2, score: 40, r: 9, charge: 26
    }
  },

  /* ── Mashing Power (specialen) ───────────────────────── */
  MASH: {
    max: 100,              // laddas av kills, se ZOMBIES[].charge
    dmg: 999,              // rensar skärmen
    flash: 0.5             // hur länge blinkeffekten varar
  },

  /* ── Power-ups ───────────────────────────────────────── */
  POWERUP: {
    dropChance: 0.11,      // chans att en besegrad zombie tappar något
    life: 9,               // sekunder innan den försvinner
    r: 6,
    blinkAt: 3             // börjar blinka när det är så här lite kvar
  },

  /* ── Vågor ───────────────────────────────────────────── */
  WAVE: {
    breakTime: 2.6,        // paus mellan vågor
    baseBudget: 6,         // antal zombier i våg 1
    budgetGrow: 2.6,       // hur mycket fler per våg
    spawnGap: 0.75,        // sekunder mellan spawns
    gapShrink: 0.03,       // hur mycket tätare per våg
    minGap: 0.2,
    /* Vilka typer som är med från och med vilken våg, och hur
       vanliga de är (vikt). Högre våg → fler av de tunga. */
    mix: [
      { type: "std",     from: 1, weight: w => 10 },
      { type: "peeler",  from: 2, weight: w => Math.min(9, 2 + w * 0.7) },
      { type: "pumpkin", from: 4, weight: w => Math.min(6, (w - 3) * 0.9) }
    ]
  },

  /* ── Känsla ──────────────────────────────────────────── */
  SHAKE: { hit: 5, kill: 1.6, bomb: 11, decay: 12 },
  PARTICLES: { perKill: 9, life: 0.55, speed: 90 }
};

/* Hur många av varje typ en given våg ska innehålla. */
function waveComposition(wave) {
  const budget = Math.round(CFG.WAVE.baseBudget + (wave - 1) * CFG.WAVE.budgetGrow);
  const pool = [];
  CFG.WAVE.mix.forEach(m => {
    if (wave < m.from) return;
    const n = Math.max(0, Math.round(m.weight(wave)));
    for (let i = 0; i < n; i++) pool.push(m.type);
  });
  if (!pool.length) pool.push("std");
  const list = [];
  for (let i = 0; i < budget; i++) list.push(pool[(Math.random() * pool.length) | 0]);
  return list;
}

/* Spawngap krymper med vågnumret men aldrig under minGap. */
function waveGap(wave) {
  return Math.max(CFG.WAVE.minGap, CFG.WAVE.spawnGap - (wave - 1) * CFG.WAVE.gapShrink);
}

if (typeof module !== "undefined") {
  module.exports = { PICO, P, CFG, waveComposition, waveGap };
}
