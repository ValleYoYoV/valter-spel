/* ═══════════════════════════════════════════════════════════════
   entities.js — spelare, zombier, skott, partiklar och power-ups.

   Allt här är ren logik utan rendering: funktionerna rör bara
   siffror. Det gör att hela spelet kan köras headless i Node och
   testas utan webbläsare (se test/superpotatis_test.js).
   ═══════════════════════════════════════════════════════════════ */

/* Spelplanen — HUD:en högst upp är inte gångbar. */
function bounds() {
  return { x0: 10, x1: CFG.W - 10, y0: CFG.HUD_H + 10, y1: CFG.H - 10 };
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/* Korsar sträckan (x1,y1)→(x2,y2) cirkeln med centrum (cx,cy) och radie r?
   Används för skotten: en punktprövning missar en fiende som står precis
   ovanpå spelaren, eftersom skottet då redan hunnit förbi hitboxen. */
function segHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + dx * t - cx, ny = y1 + dy * t - cy;
  return nx * nx + ny * ny <= r * r;
}

/* ── Spelaren ────────────────────────────────────────────────── */
function makePlayer() {
  const b = bounds();
  return {
    x: CFG.W / 2, y: (b.y0 + b.y1) / 2,
    hp: CFG.PLAYER.maxHp,
    face: 1,                 // 1 = höger, -1 = vänster
    cool: 0,                 // tid kvar till nästa skott
    turbo: 0,                // sekunder Fritös-Turbo kvar
    inv: 0,                  // osårbarhet efter träff
    mash: 0,                 // Mashing Power 0–100
    aimX: CFG.W / 2 + 20, aimY: (b.y0 + b.y1) / 2,
    alive: true,
    walk: 0
  };
}

function updatePlayer(p, dt, input) {
  const b = bounds();
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx && dy) { const k = Math.SQRT1_2; dx *= k; dy *= k; }

  p.x = Math.max(b.x0, Math.min(b.x1, p.x + dx * CFG.PLAYER.speed * dt));
  p.y = Math.max(b.y0, Math.min(b.y1, p.y + dy * CFG.PLAYER.speed * dt));

  if (dx) p.face = dx > 0 ? 1 : -1;
  else if (p.aimX !== undefined) p.face = (p.aimX >= p.x) ? 1 : -1;

  p.walk = (dx || dy) ? p.walk + dt * 9 : 0;
  if (p.cool > 0)  p.cool  -= dt;
  if (p.inv > 0)   p.inv   -= dt;
  if (p.turbo > 0) p.turbo -= dt;
}

/* Returnerar ett skott om spelaren får skjuta just nu, annars null. */
function tryShoot(p, tx, ty) {
  if (!p.alive || p.cool > 0) return null;
  p.cool = p.turbo > 0 ? CFG.PLAYER.turboRate : CFG.PLAYER.fireRate;
  let dx = tx - p.x, dy = ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= d; dy /= d;
  p.face = dx >= 0 ? 1 : -1;
  /* Liten mynningsförskjutning — måste vara mindre än minsta fiendes
     träffradie, annars föds skottet utanför en fiende som står tätt inpå. */
  return makeBullet(p.x + dx * 4, p.y + dy * 4, dx, dy);
}

function hurtPlayer(p, dmg) {
  if (p.inv > 0 || !p.alive) return false;
  p.hp -= dmg;
  p.inv = CFG.PLAYER.invuln;
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
  return true;
}

/* ── Skott ───────────────────────────────────────────────────── */
function makeBullet(x, y, dx, dy) {
  /* px/py = var skottet var förra bildrutan. Träffprövningen sker mot
     hela sträckan däremellan, inte mot en punkt — annars kan ett skott
     hoppa förbi en fiende mellan två bildrutor. */
  return { x, y, px: x, py: y, dx, dy, life: CFG.BULLET.life, dead: false };
}

function updateBullet(b, dt) {
  b.px = b.x; b.py = b.y;
  b.x += b.dx * CFG.BULLET.speed * dt;
  b.y += b.dy * CFG.BULLET.speed * dt;
  b.life -= dt;
  const bb = bounds();
  if (b.life <= 0 || b.x < bb.x0 - 12 || b.x > bb.x1 + 12 ||
      b.y < bb.y0 - 12 || b.y > bb.y1 + 12) b.dead = true;
}

/* ── Zombier ─────────────────────────────────────────────────── */
function makeZombie(type, x, y) {
  const d = CFG.ZOMBIES[type];
  return {
    type, x, y,
    hp: d.hp, maxHp: d.hp,
    speed: d.speed, dmg: d.dmg, score: d.score, r: d.r,
    charge: d.charge, sprite: d.sprite,
    face: -1, hitFlash: 0, wob: Math.random() * 6.28, dead: false
  };
}

/* Går rakt mot spelaren, men knuffas undan från andra zombier så
   de inte lägger sig i en enda klump ovanpå varandra. */
function updateZombie(z, dt, player, others) {
  let dx = player.x - z.x, dy = player.y - z.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= d; dy /= d;

  let sx = 0, sy = 0;
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    if (o === z || o.dead) continue;
    const dd = dist(z.x, z.y, o.x, o.y);
    const want = z.r + o.r;
    if (dd > 0.01 && dd < want) {
      sx += (z.x - o.x) / dd * (want - dd) * 0.5;
      sy += (z.y - o.y) / dd * (want - dd) * 0.5;
    }
  }

  z.x += dx * z.speed * dt + sx * dt * 6;
  z.y += dy * z.speed * dt + sy * dt * 6;
  z.face = dx >= 0 ? 1 : -1;
  z.wob += dt * 6;
  if (z.hitFlash > 0) z.hitFlash -= dt;
}

function hurtZombie(z, dmg) {
  z.hp -= dmg;
  z.hitFlash = 0.09;
  if (z.hp <= 0) { z.hp = 0; z.dead = true; return true; }
  return false;
}

/* Var utanför kanten nya zombier kliver in. */
function spawnEdge() {
  const b = bounds();
  const side = (Math.random() * 4) | 0;
  if (side === 0) return { x: b.x0 + Math.random() * (b.x1 - b.x0), y: b.y0 - 14 };
  if (side === 1) return { x: b.x1 + 14, y: b.y0 + Math.random() * (b.y1 - b.y0) };
  if (side === 2) return { x: b.x0 + Math.random() * (b.x1 - b.x0), y: b.y1 + 14 };
  return { x: b.x0 - 14, y: b.y0 + Math.random() * (b.y1 - b.y0) };
}

/* ── Power-ups ───────────────────────────────────────────────── */
function makePowerUp(kind, x, y) {
  return { kind, x, y, life: CFG.POWERUP.life, dead: false, bob: Math.random() * 6.28 };
}

function updatePowerUp(u, dt) {
  u.life -= dt;
  u.bob += dt * 4;
  if (u.life <= 0) u.dead = true;
}

/* Vad en besegrad zombie eventuellt tappar. */
function rollDrop(player) {
  if (Math.random() > CFG.POWERUP.dropChance) return null;
  /* Full HP? Då är smör bortkastat — ge turbo i stället. */
  if (player.hp >= CFG.PLAYER.maxHp) return "turbo";
  return Math.random() < 0.55 ? "butter" : "turbo";
}

function applyPowerUp(kind, player) {
  if (kind === "butter") {
    const before = player.hp;
    player.hp = Math.min(CFG.PLAYER.maxHp, player.hp + 1);
    return player.hp > before ? "+1 HP" : "FULLT HP";
  }
  player.turbo = CFG.PLAYER.turboTime;
  return "FRITÖS-TURBO!";
}

/* ── Partiklar ───────────────────────────────────────────────── */
function makeParticle(x, y, col) {
  const a = Math.random() * Math.PI * 2;
  const s = CFG.PARTICLES.speed * (0.35 + Math.random() * 0.9);
  return {
    x, y, dx: Math.cos(a) * s, dy: Math.sin(a) * s,
    life: CFG.PARTICLES.life * (0.6 + Math.random() * 0.8),
    max: CFG.PARTICLES.life, col, dead: false
  };
}

function updateParticle(p, dt) {
  p.x += p.dx * dt;
  p.y += p.dy * dt;
  p.dx *= 0.92; p.dy *= 0.92;
  p.life -= dt;
  if (p.life <= 0) p.dead = true;
}

/* ── Mashing Power ───────────────────────────────────────────── */
function addMash(p, amount) {
  const before = p.mash;
  p.mash = Math.min(CFG.MASH.max, p.mash + amount);
  return before < CFG.MASH.max && p.mash >= CFG.MASH.max;  // blev precis full
}
function mashReady(p) { return p.mash >= CFG.MASH.max; }

if (typeof module !== "undefined") {
  module.exports = {
    bounds, dist, segHitsCircle, makePlayer, updatePlayer, tryShoot, hurtPlayer,
    makeBullet, updateBullet, makeZombie, updateZombie, hurtZombie, spawnEdge,
    makePowerUp, updatePowerUp, rollDrop, applyPowerUp,
    makeParticle, updateParticle, addMash, mashReady
  };
}
