/* ═══════════════════════════════════════════════════════════════
   sprites.js — all pixelkonst, ritad som teckenrutnät.

   Varje tecken är en pixel: 0–9 och a–f slår upp en färg i PICO,
   punkt (.) är genomskinligt. Rutnäten bakas EN gång till varsin
   liten canvas vid start och kopieras sedan med drawImage — att
   rita tusentals fillRect per bildruta skulle sänka bildfrekvensen.
   ═══════════════════════════════════════════════════════════════ */

const SPRITE_DATA = {

  /* ── Superpotatisen: brun kropp, röd mantel, gult SP-märke ── */
  potato: [
    "....444444....",
    "..4444444444..",
    ".444444444444.",
    ".444444444444.",
    ".447744477444.",
    ".447044470444.",
    "84444444444448",
    "84444444444448",
    "84444aaaa44448",
    "84444a99a44448",
    "84444aaaa44448",
    "84444444444448",
    ".444444444444.",
    "..4444444444..",
    "....444444....",
    ".....4..4....."
  ],

  /* ── Standardzombie: mörkgrön, glödande röda ögon ── */
  zstd: [
    "....3333....",
    "..33333333..",
    ".3333333333.",
    ".3388338833.",
    ".3333333333.",
    ".3300003333.",
    "..33333333..",
    ".b33333333b.",
    "bb33333333bb",
    "..33333333..",
    "..33333333..",
    "..333..333..",
    "..333..333..",
    "..33....33.."
  ],

  /* ── Röten Potatisskalare: ljusgrön, snabb, skinnig ── */
  zpeel: [
    "...bbbb...",
    "..bbbbbb..",
    ".bbbbbbbb.",
    ".b88bb88b.",
    ".bbbbbbbb.",
    ".bb0000bb.",
    "..bbbbbb..",
    "abbbbbbbba",
    "..bbbbbb..",
    "..bb..bb..",
    "..bb..bb..",
    "..b....b.."
  ],

  /* ── Mögligt Zombie-pumpahuvud: orange huvud, grön tankkropp ── */
  zpump: [
    ".......33.......",
    "...9999999999...",
    "..999999999999..",
    ".99999999999999.",
    ".99988899888999.",
    ".99999999999999.",
    ".99000000000099.",
    ".99999999999999.",
    "..999999999999..",
    "...3333333333...",
    "..333333333333..",
    ".33333333333333.",
    "3333333333333333",
    ".33333333333333.",
    "..333333333333..",
    "..3333....3333..",
    "..3333....3333..",
    "..333......333.."
  ],

  /* ── Power-up: Smör & Salt ── */
  butter: [
    ".........",
    ".aaaaaaa.",
    ".a9a9a9a.",
    ".aa999aa.",
    ".a9a9a9a.",
    ".aaaaaaa.",
    "..7...7..",
    ".........",
    "........."
  ],

  /* ── Power-up: Fritös-Turbo ── */
  turbo: [
    "....99...",
    "...99....",
    "..99.....",
    ".9999999.",
    "...aaa...",
    "..aa.....",
    ".aa......",
    "aa.......",
    "........."
  ],

  /* ── HUD-hjärta ── */
  heart: [
    ".88.88.",
    "8888888",
    "8888888",
    ".88888.",
    "..888..",
    "...8..."
  ]
};

/* ── Bakning ─────────────────────────────────────────────────── */
const SPRITES = {};

function bakeSprite(rows, white) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const idx = parseInt(ch, 16);
      if (isNaN(idx)) continue;
      g.fillStyle = white ? "#FFF1E8" : PICO[idx];
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function flipCanvas(src) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

function buildSprites() {
  for (const name in SPRITE_DATA) {
    const rows = SPRITE_DATA[name];
    const base = bakeSprite(rows, false);
    SPRITES[name] = {
      w: base.width,
      h: base.height,
      right: base,
      left: flipCanvas(base),
      /* helvit kopia — används som träffblink i stället för en
         andra uppsättning handritade sprites */
      flash: bakeSprite(rows, true)
    };
  }
}

/* Ritar centrerat på (x, y). flip vänder horisontellt, hit ritar
   den vita blinkvarianten. */
function drawSprite(ctx, name, x, y, flip, hit) {
  const s = SPRITES[name];
  if (!s) return;
  const img = hit ? s.flash : (flip ? s.left : s.right);
  ctx.drawImage(img, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}

if (typeof module !== "undefined") {
  module.exports = { SPRITE_DATA, SPRITES, buildSprites, drawSprite };
}
