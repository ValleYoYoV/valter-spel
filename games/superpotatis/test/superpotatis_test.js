/* Headless-test av Superpotatisen vs Zombieapokalypsen.
   Slår ihop de fem js-filerna till ett skript och kör det i en vm-kontext
   UTAN `window` — då hoppas webbläsardelen i main.js över och ljudet blir
   tyst, men all spellogik går att driva. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..", "js");
const FILES = ["config.js", "sprites.js", "sound.js", "entities.js", "main.js"];

let src = FILES.map(f => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n;\n");
src += `
globalThis.__T = {
  CFG, PICO, P, waveComposition, waveGap,
  SPRITE_DATA, SPRITES, buildSprites, drawSprite,
  bounds, dist, segHitsCircle, makePlayer, updatePlayer, tryShoot, hurtPlayer,
  makeBullet, updateBullet, makeZombie, updateZombie, hurtZombie, spawnEdge,
  makePowerUp, updatePowerUp, rollDrop, applyPowerUp,
  makeParticle, updateParticle, addMash, mashReady,
  ST, newGame, startWave, stepGame
};`;

/* ── Stubbar: document finns (för sprite-bakning), window gör INTE det ── */
const noop = () => {};
function fakeCanvas() {
  const px = [];
  const c = {
    width: 0, height: 0, __px: px,
    getContext: () => ({
      set fillStyle(v) { this._f = v; },
      get fillStyle() { return this._f; },
      fillRect(x, y, w, h) { px.push([x, y, this._f]); },
      drawImage: noop, translate: noop, scale: noop,
      imageSmoothingEnabled: false
    })
  };
  return c;
}
const sandbox = {
  document: { createElement: fakeCanvas, getElementById: () => null },
  localStorage: { getItem: () => null, setItem: noop },
  Math, JSON, Date, console, parseInt, isNaN
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const T = sandbox.__T;
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  → " + extra : "")); }
}
const IN = (o) => Object.assign({ up:0,down:0,left:0,right:0,fire:0,special:0,aimX:200,aimY:200 }, o || {});

console.log("\n── 1. Pixelkonsten ──");
let sprBad = [];
const VALID = /^[0-9a-f.]$/;
Object.keys(T.SPRITE_DATA).forEach(name => {
  const rows = T.SPRITE_DATA[name];
  if (!rows.length) { sprBad.push(name + ": tom"); return; }
  const w = rows[0].length;
  rows.forEach((row, i) => {
    if (row.length !== w)
      sprBad.push(name + " rad " + i + ": " + row.length + " tecken, forsta raden har " + w);
    for (const ch of row)
      if (!VALID.test(ch)) sprBad.push(name + " rad " + i + ": ogiltigt tecken '" + ch + "'");
  });
  if (!rows.some(r => r.replace(/\./g, "").length)) sprBad.push(name + ": helt genomskinlig");
});
check("alla sprites är rektangulära med giltiga färger", sprBad.length === 0,
      sprBad.slice(0, 6).join(" | "));

const sizes = {};
Object.keys(T.SPRITE_DATA).forEach(n => {
  sizes[n] = T.SPRITE_DATA[n][0].length + "x" + T.SPRITE_DATA[n].length;
});
console.log("     storlekar:", JSON.stringify(sizes));

/* varje zombietyp i CFG måste peka på en sprite som finns */
let refBad = [];
Object.keys(T.CFG.ZOMBIES).forEach(k => {
  if (!T.SPRITE_DATA[T.CFG.ZOMBIES[k].sprite]) refBad.push(k + " → " + T.CFG.ZOMBIES[k].sprite);
});
check("alla zombietyper har en sprite", refBad.length === 0, refBad.join(", "));

T.buildSprites();
check("bakningen ger alla sprites", Object.keys(T.SPRITES).length === Object.keys(T.SPRITE_DATA).length);
const potatoPx = T.SPRITES.potato.right.__px.length;
const expectPx = T.SPRITE_DATA.potato.join("").replace(/\./g, "").length;
check("potatisen bakas pixel för pixel", potatoPx === expectPx, potatoPx + " vs " + expectPx);

console.log("\n── 2. Spelaren ──");
let p = T.makePlayer();
check("börjar med fullt HP", p.hp === T.CFG.PLAYER.maxHp);
const b = T.bounds();
for (let i = 0; i < 600; i++) T.updatePlayer(p, 1/60, IN({ left: 1, up: 1 }));
check("går inte ut genom hörnet", p.x >= b.x0 - 0.01 && p.y >= b.y0 - 0.01,
      "x=" + p.x.toFixed(1) + " y=" + p.y.toFixed(1));
p = T.makePlayer();
for (let i = 0; i < 600; i++) T.updatePlayer(p, 1/60, IN({ right: 1, down: 1 }));
check("fastnar inte i nedre högra hörnet", p.x <= b.x1 + 0.01 && p.y <= b.y1 + 0.01,
      "x=" + p.x.toFixed(1) + " y=" + p.y.toFixed(1));

/* diagonal får inte vara snabbare än rakt fram */
function travel(inp) {
  const q = T.makePlayer(); q.x = 200; q.y = 160;
  const sx = q.x, sy = q.y;
  for (let i = 0; i < 30; i++) T.updatePlayer(q, 1/60, IN(inp));
  return T.dist(sx, sy, q.x, q.y);
}
const straight = travel({ right: 1 }), diag = travel({ right: 1, down: 1 });
check("diagonalt är inte snabbare än rakt", Math.abs(straight - diag) < 0.6,
      "rakt=" + straight.toFixed(2) + " diag=" + diag.toFixed(2));

console.log("\n── 3. Skjutande ──");
p = T.makePlayer(); p.x = 200; p.y = 160;
const shot = T.tryShoot(p, 300, 160);
check("första skottet går iväg", !!shot);
check("skottet är riktat mot målet", shot.dx > 0.99 && Math.abs(shot.dy) < 0.01,
      "dx=" + shot.dx.toFixed(2) + " dy=" + shot.dy.toFixed(2));
check("riktningen är normaliserad", Math.abs(Math.hypot(shot.dx, shot.dy) - 1) < 0.001);
check("kan inte spamma direkt", T.tryShoot(p, 300, 160) === null);
T.updatePlayer(p, T.CFG.PLAYER.fireRate + 0.01, IN());
check("går att skjuta igen efter nedkylning", !!T.tryShoot(p, 300, 160));

p = T.makePlayer(); p.turbo = 5;
T.tryShoot(p, 300, 160);
check("turbon ger kortare nedkylning", Math.abs(p.cool - T.CFG.PLAYER.turboRate) < 1e-9,
      "cool=" + p.cool);

console.log("\n── 4. Zombier ──");
const z = T.makeZombie("std", 300, 160);
const pl = T.makePlayer(); pl.x = 100; pl.y = 160;
const d0 = T.dist(z.x, z.y, pl.x, pl.y);
for (let i = 0; i < 60; i++) T.updateZombie(z, 1/60, pl, [z]);
check("zombien går mot spelaren", T.dist(z.x, z.y, pl.x, pl.y) < d0 - 10,
      "fore=" + d0.toFixed(1) + " efter=" + T.dist(z.x, z.y, pl.x, pl.y).toFixed(1));

const tank = T.makeZombie("pumpkin", 0, 0);
const fast = T.makeZombie("peeler", 0, 0);
check("pumpahuvudet är tåligare än skalaren", tank.hp > fast.hp && tank.speed < fast.speed);
let hits = 0;
while (!tank.dead && hits < 99) { T.hurtZombie(tank, T.CFG.BULLET.dmg); hits++; }
check("pumpahuvudet dör efter rätt antal skott", hits === T.CFG.ZOMBIES.pumpkin.hp, hits + " skott");

/* två zombier på samma punkt ska knuffa isär sig */
const a1 = T.makeZombie("std", 200, 160), a2 = T.makeZombie("std", 201, 160);
const far = T.makePlayer(); far.x = 200; far.y = 290;
for (let i = 0; i < 40; i++) { T.updateZombie(a1, 1/60, far, [a1, a2]); T.updateZombie(a2, 1/60, far, [a1, a2]); }
check("zombier klumpar inte ihop sig", T.dist(a1.x, a1.y, a2.x, a2.y) > 2,
      "avstand=" + T.dist(a1.x, a1.y, a2.x, a2.y).toFixed(2));

console.log("\n── 5. Skada & osårbarhet ──");
p = T.makePlayer();
check("träff tar HP", T.hurtPlayer(p, 1) === true && p.hp === T.CFG.PLAYER.maxHp - 1);
check("andra träffen studsar på osårbarheten", T.hurtPlayer(p, 1) === false);
T.updatePlayer(p, T.CFG.PLAYER.invuln + 0.01, IN());
check("osårbarheten tar slut", T.hurtPlayer(p, 1) === true);
p.hp = 1; p.inv = 0;
T.hurtPlayer(p, 5);
check("HP går inte under noll", p.hp === 0 && p.alive === false);

console.log("\n── 6. Power-ups ──");
p = T.makePlayer(); p.hp = 2;
check("smör läker", T.applyPowerUp("butter", p) === "+1 HP" && p.hp === 3);
p.hp = T.CFG.PLAYER.maxHp;
T.applyPowerUp("butter", p);
check("HP kapas vid max", p.hp === T.CFG.PLAYER.maxHp);
T.applyPowerUp("turbo", p);
check("turbon sätter en timer", p.turbo === T.CFG.PLAYER.turboTime);

p.hp = T.CFG.PLAYER.maxHp;
let butterAtFull = 0;
for (let i = 0; i < 4000; i++) if (T.rollDrop(p) === "butter") butterAtFull++;
check("smör tappas aldrig vid fullt HP", butterAtFull === 0, butterAtFull + " gånger");
p.hp = 1;
let any = 0;
for (let i = 0; i < 4000; i++) if (T.rollDrop(p)) any++;
check("droppar faller ibland", any > 200 && any < 1200, any + "/4000");

console.log("\n── 7. Mashing Power ──");
p = T.makePlayer();
check("mätaren börjar tom", p.mash === 0 && !T.mashReady(p));
let n = 0;
while (!T.mashReady(p) && n < 999) { T.addMash(p, T.CFG.ZOMBIES.std.charge); n++; }
check("full efter rimligt många kills", n > 3 && n < 40, n + " kills");
check("mätaren kapas vid max", p.mash === T.CFG.MASH.max);

console.log("\n── 8. Vågor ──");
const w1 = T.waveComposition(1), w9 = T.waveComposition(9);
check("våg 9 är större än våg 1", w9.length > w1.length, w1.length + " vs " + w9.length);
check("våg 1 har bara standardzombier", w1.every(t => t === "std"), [...new Set(w1)].join(","));
let pumpBefore = 0;
for (let i = 0; i < 200; i++) if (T.waveComposition(3).includes("pumpkin")) pumpBefore++;
check("pumpahuvuden dyker inte upp före våg 4", pumpBefore === 0, pumpBefore + " gånger");
let pumpAfter = 0;
for (let i = 0; i < 200; i++) if (T.waveComposition(7).includes("pumpkin")) pumpAfter++;
check("pumpahuvuden finns i våg 7", pumpAfter > 150, pumpAfter + "/200");
check("spawngapet krymper men bottnar", T.waveGap(1) > T.waveGap(9) &&
      T.waveGap(99) >= T.CFG.WAVE.minGap - 1e-9,
      T.waveGap(1).toFixed(2) + " → " + T.waveGap(9).toFixed(2) + " → " + T.waveGap(99).toFixed(2));

console.log("\n── 8b. Skott på nära håll ──");
/* REGRESSION: en zombie som står exakt ovanpå spelaren måste gå att skjuta.
   Tidigare föddes skottet 8 px ut — utanför skalarens 7 px träffradie — så
   den blev helt odödlig och vågen kunde aldrig ta slut. */
check("sträckprövningen träffar en cirkel man startar inuti",
      T.segHitsCircle(0, 0, 4, 0, 0, 0, 7) === true);
check("sträckprövningen missar det den ska missa",
      T.segHitsCircle(0, 0, 4, 0, 40, 40, 7) === false);

["std", "peeler", "pumpkin"].forEach(type => {
  const g = T.newGame();
  T.startWave(g, 1);
  g.queue = [];
  g.player.inv = 1e9;
  g.player.x = 200; g.player.y = 160;
  g.zombies = [T.makeZombie(type, 200, 160)];        // exakt ovanpå spelaren
  let steps = 0;
  while (g.zombies.length && steps++ < 3000) {
    T.stepGame(g, 1/60, IN({ fire: 1, aimX: 340, aimY: 160 }));
  }
  check("en " + type + " som står på spelaren går att döda",
        g.zombies.length === 0, steps + " steg");
});

/* och den motsatta fällan: skott ska inte hoppa förbi en fiende mellan
   två bildrutor vid låg bildfrekvens */
const gt = T.newGame();
T.startWave(gt, 1); gt.queue = []; gt.player.inv = 1e9;
gt.player.x = 20; gt.player.y = 160;
gt.zombies = [T.makeZombie("peeler", 300, 160)];
gt.zombies[0].speed = 0;
let st = 0;
while (gt.zombies.length && st++ < 400) T.stepGame(gt, 1/20, IN({ fire: 1, aimX: 399, aimY: 160 }));
check("skott tunnlar inte förbi vid låg bildfrekvens", gt.zombies.length === 0, st + " steg");

console.log("\n── 9. Mosbomben ──");
let G = T.newGame();
T.startWave(G, 5);
for (let i = 0; i < 400; i++) T.stepGame(G, 1/60, IN());   // låt några spawna
const beforeZ = G.zombies.length;
G.player.mash = T.CFG.MASH.max;
G.player.inv = 99;                                          // överlev testet
T.stepGame(G, 1/60, IN({ special: 1 }));
check("det fanns zombier att spränga", beforeZ > 0, beforeZ + " st");
check("bomben rensar skärmen", G.zombies.length === 0, G.zombies.length + " kvar");
check("mätaren nollställs", G.player.mash === 0);
check("poäng räknas för bombade", G.score > 0, "score=" + G.score);

console.log("\n── 10. Hela omgångar ──");
G = T.newGame();
T.startWave(G, 1);
G.player.inv = 1e9;                                         // odödlig botspelare
let guard = 0, maxWave = 1;
while (G.wave < 6 && guard++ < 200000) {
  const inp = IN({ fire: 1, aimX: G.zombies.length ? G.zombies[0].x : 200,
                          aimY: G.zombies.length ? G.zombies[0].y : 200 });
  G.player.inv = 1e9;
  T.stepGame(G, 1/60, inp);
  if (G.wave > maxWave) maxWave = G.wave;
}
check("botten tar sig till våg 6 utan krasch", maxWave >= 6, "nadde vag " + maxWave);
check("poäng samlas", G.score > 0, "score=" + G.score);
check("inga zombier läcker utanför planen", G.zombies.every(z =>
  z.x > b.x0 - 60 && z.x < b.x1 + 60 && z.y > b.y0 - 60 && z.y < b.y1 + 60));

/* spelare som står stilla utan att skjuta ska dö */
G = T.newGame();
T.startWave(G, 3);
guard = 0;
while (G.state !== T.ST.DEAD && guard++ < 200000) T.stepGame(G, 1/60, IN());
check("en passiv spelare dör", G.state === T.ST.DEAD, "state=" + G.state);
check("död spelare har noll HP", G.player.hp === 0);

/* vågen ska ta slut och gå vidare */
G = T.newGame();
T.startWave(G, 1);
G.queue = [];
G.zombies = [];
T.stepGame(G, 1/60, IN());
check("tom våg går till paus", G.state === T.ST.BREAK, "state=" + G.state);
for (let i = 0; i < 400; i++) T.stepGame(G, 1/60, IN());
check("pausen startar nästa våg", G.wave === 2 && G.state === T.ST.PLAY,
      "wave=" + G.wave + " state=" + G.state);

console.log("\n════════════════════════");
console.log(pass + " OK, " + fail + " FAIL");
process.exit(fail ? 1 : 0);
