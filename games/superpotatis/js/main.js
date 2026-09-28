/* ═══════════════════════════════════════════════════════════════
   main.js — game loop, vågor, UI och rendering.

   Logiken ligger i stepGame() och rör aldrig canvas; ritandet
   ligger i draw(). Uppdelningen gör att hela spelomgångar kan
   simuleras headless i Node utan att rita en enda pixel.
   ═══════════════════════════════════════════════════════════════ */

const ST = { TITLE: 0, PLAY: 1, BREAK: 2, DEAD: 3 };

function newGame() {
  return {
    state: ST.TITLE,
    player: makePlayer(),
    zombies: [], bullets: [], parts: [], drops: [], floats: [],
    wave: 0, score: 0, killed: 0,
    queue: [], spawnT: 0, gap: 0.8,
    breakT: 0, bombFlash: 0, shake: 0,
    t: 0, paused: false
  };
}

function startWave(G, n) {
  G.wave = n;
  G.queue = waveComposition(n);
  G.gap = waveGap(n);
  G.spawnT = 0.35;
  G.state = ST.PLAY;
}

function float(G, x, y, txt, col) {
  G.floats.push({ x, y, txt, col, life: 1.1 });
}

/* ── Ett steg av spelet ──────────────────────────────────────── */
function stepGame(G, dt, input) {
  G.t += dt;
  if (G.bombFlash > 0) G.bombFlash -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - CFG.SHAKE.decay * dt);

  /* flytande text lever i alla lägen */
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i];
    f.y -= 16 * dt; f.life -= dt;
    if (f.life <= 0) G.floats.splice(i, 1);
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    updateParticle(G.parts[i], dt);
    if (G.parts[i].dead) G.parts.splice(i, 1);
  }

  if (G.state === ST.TITLE || G.state === ST.DEAD) return;

  /* paus mellan vågor */
  if (G.state === ST.BREAK) {
    G.breakT -= dt;
    updatePlayer(G.player, dt, input);
    if (G.breakT <= 0) startWave(G, G.wave + 1);
    return;
  }

  const p = G.player;
  updatePlayer(p, dt, input);

  /* ── spawna ur vågkön ── */
  if (G.queue.length) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      const type = G.queue.shift();
      const e = spawnEdge();
      G.zombies.push(makeZombie(type, e.x, e.y));
      G.spawnT = G.gap;
    }
  }

  /* ── skjuta ── */
  if (input.fire) {
    const b = tryShoot(p, input.aimX, input.aimY);
    if (b) { G.bullets.push(b); SFX.shoot(); }
  }

  /* ── specialen ── */
  if (input.special && mashReady(p)) {
    p.mash = 0;
    G.bombFlash = CFG.MASH.flash;
    G.shake = CFG.SHAKE.bomb;
    SFX.bomb();
    for (let i = G.zombies.length - 1; i >= 0; i--) {
      const z = G.zombies[i];
      killZombie(G, z, i, true);
    }
    float(G, p.x, p.y - 22, "POTATISMOS!", P(10));
  }

  /* ── skott ── */
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    updateBullet(b, dt);
    if (b.dead) { G.bullets.splice(i, 1); continue; }
    for (let j = G.zombies.length - 1; j >= 0; j--) {
      const z = G.zombies[j];
      /* Hela sträckan skottet färdats denna bildruta prövas, så en fiende
         som står klistrad på spelaren går att skjuta. */
      if (!segHitsCircle(b.px, b.py, b.x, b.y, z.x, z.y, z.r + CFG.BULLET.r)) continue;
      b.dead = true;
      const died = hurtZombie(z, CFG.BULLET.dmg);
      for (let k = 0; k < 3; k++) G.parts.push(makeParticle(b.x, b.y, P(10)));
      if (died) killZombie(G, z, j, false);
      break;
    }
    if (b.dead) G.bullets.splice(i, 1);
  }

  /* ── zombier ── */
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    updateZombie(z, dt, p, G.zombies);
    if (dist(z.x, z.y, p.x, p.y) < z.r + CFG.PLAYER.r) {
      if (hurtPlayer(p, z.dmg)) {
        SFX.hurt();
        G.shake = CFG.SHAKE.hit;
        float(G, p.x, p.y - 20, "-" + z.dmg, P(8));
        if (!p.alive) {
          G.state = ST.DEAD;
          SFX.dead();
          for (let k = 0; k < 24; k++) G.parts.push(makeParticle(p.x, p.y, P(4)));
          saveHigh(G.score);
          return;
        }
      }
    }
  }

  /* ── power-ups ── */
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const u = G.drops[i];
    updatePowerUp(u, dt);
    if (u.dead) { G.drops.splice(i, 1); continue; }
    if (dist(u.x, u.y, p.x, p.y) < CFG.POWERUP.r + CFG.PLAYER.r) {
      const msg = applyPowerUp(u.kind, p);
      float(G, u.x, u.y - 10, msg, u.kind === "butter" ? P(11) : P(9));
      SFX.pickup();
      G.drops.splice(i, 1);
    }
  }

  /* ── vågen klar? ── */
  if (!G.queue.length && !G.zombies.length && G.state === ST.PLAY) {
    G.state = ST.BREAK;
    G.breakT = CFG.WAVE.breakTime;
    SFX.wave();
  }
}

function killZombie(G, z, idx, byBomb) {
  const p = G.player;
  G.score += z.score;
  G.killed++;
  const wasFull = mashReady(p);
  if (!byBomb && addMash(p, z.charge) && !wasFull) SFX.charged();
  G.shake = Math.max(G.shake, CFG.SHAKE.kill);

  const col = z.type === "pumpkin" ? P(9) : (z.type === "peeler" ? P(11) : P(3));
  for (let k = 0; k < CFG.PARTICLES.perKill; k++) G.parts.push(makeParticle(z.x, z.y, col));
  if (!byBomb) SFX.explode();

  if (!byBomb) {
    const drop = rollDrop(p);
    if (drop) G.drops.push(makePowerUp(drop, z.x, z.y));
  }
  G.zombies.splice(idx, 1);
}

/* ── High score ──────────────────────────────────────────────── */
function loadHigh() {
  try { return parseInt(localStorage.getItem("superpotatisHigh") || "0", 10) || 0; }
  catch (e) { return 0; }
}
function saveHigh(score) {
  try {
    if (score > loadHigh()) localStorage.setItem("superpotatisHigh", String(score));
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════
   Allt nedanför är rendering och webbläsarlim.
   ═══════════════════════════════════════════════════════════════ */
if (typeof window !== "undefined") (function () {

  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  cv.width = CFG.W; cv.height = CFG.H;
  ctx.imageSmoothingEnabled = false;

  buildSprites();

  let G = newGame();
  let high = loadHigh();

  const keys = {};
  const input = { up:0, down:0, left:0, right:0, fire:0, special:0, aimX:CFG.W/2, aimY:CFG.H/2 };
  let mouseDown = false;
  let specialEdge = false, startEdge = false;

  /* ── Skalning ── */
  function fit() {
    const s = Math.max(1, Math.min(
      Math.floor(window.innerWidth / CFG.W),
      Math.floor(window.innerHeight / CFG.H),
      CFG.MAX_SCALE));
    cv.style.width = (CFG.W * s) + "px";
    cv.style.height = (CFG.H * s) + "px";
    const crt = document.getElementById("crt");
    crt.style.width = cv.style.width;
    crt.style.height = cv.style.height;
  }
  fit();
  window.addEventListener("resize", fit);

  /* ── Input ── */
  window.addEventListener("keydown", e => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) >= 0) e.preventDefault();
    if (!keys[e.code]) {
      if (e.code === "KeyX" || e.code === "Space") specialEdge = true;
      if (e.code === "Enter" || e.code === "Space") startEdge = true;
      if (e.code === "KeyP" && G.state !== ST.TITLE) { G.paused = !G.paused; SFX.blip(); }
      if (e.code === "KeyM") { SFX.toggleMute(); SFX.blip(); }
      if (e.code === "KeyR" && G.state === ST.DEAD) restart();
    }
    keys[e.code] = true;
    SFX.wake();
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; });

  cv.addEventListener("mousedown", e => {
    mouseDown = true; SFX.wake();
    if (G.state === ST.TITLE) start();
    else if (G.state === ST.DEAD) restart();
    e.preventDefault();
  });
  window.addEventListener("mouseup", () => { mouseDown = false; });
  cv.addEventListener("mousemove", e => {
    const r = cv.getBoundingClientRect();
    input.aimX = (e.clientX - r.left) * (CFG.W / r.width);
    input.aimY = (e.clientY - r.top) * (CFG.H / r.height);
  });
  cv.addEventListener("contextmenu", e => e.preventDefault());

  function readInput() {
    input.up    = (keys.KeyW || keys.ArrowUp)    ? 1 : 0;
    input.down  = (keys.KeyS || keys.ArrowDown)  ? 1 : 0;
    input.left  = (keys.KeyA || keys.ArrowLeft)  ? 1 : 0;
    input.right = (keys.KeyD || keys.ArrowRight) ? 1 : 0;

    /* Z skjuter i blickriktningen för den som hellre kör helt på tangentbord */
    if (keys.KeyZ) {
      input.fire = 1;
      input.aimX = G.player.x + G.player.face * 40;
      input.aimY = G.player.y;
    } else {
      input.fire = mouseDown ? 1 : 0;
    }
    input.special = specialEdge ? 1 : 0;
    specialEdge = false;
  }

  function start() { G = newGame(); high = loadHigh(); startWave(G, 1); SFX.blip(); }
  function restart() { start(); }

  /* ── Rendering ─────────────────────────────────────────────── */
  function drawBg() {
    ctx.fillStyle = P(1);
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    const b = bounds();
    /* asfalt med rutmönster */
    ctx.fillStyle = "#12203f";
    ctx.fillRect(0, CFG.HUD_H, CFG.W, CFG.H - CFG.HUD_H);
    ctx.fillStyle = "#16274a";
    for (let y = CFG.HUD_H; y < CFG.H; y += 20) {
      for (let x = 0; x < CFG.W; x += 20) {
        if (((x / 20 + y / 20) | 0) % 2) ctx.fillRect(x, y, 20, 20);
      }
    }
    /* skräp på marken */
    ctx.fillStyle = P(5);
    const rub = [[46,88],[300,120],[120,240],[360,230],[210,70],[70,180],[268,262]];
    rub.forEach(r => ctx.fillRect(r[0], r[1], 5, 3));
    /* arenakant */
    ctx.strokeStyle = P(5); ctx.lineWidth = 2;
    ctx.strokeRect(b.x0 - 6, b.y0 - 6, (b.x1 - b.x0) + 12, (b.y1 - b.y0) + 12);
  }

  function drawHud() {
    ctx.fillStyle = P(0);
    ctx.fillRect(0, 0, CFG.W, CFG.HUD_H);
    ctx.fillStyle = P(5);
    ctx.fillRect(0, CFG.HUD_H - 1, CFG.W, 1);

    /* hjärtan */
    for (let i = 0; i < CFG.PLAYER.maxHp; i++) {
      const on = i < G.player.hp;
      const s = SPRITES.heart;
      ctx.globalAlpha = on ? 1 : 0.22;
      ctx.drawImage(s.right, 6 + i * 9, 5);
      ctx.globalAlpha = 1;
    }

    /* Mashing Power-mätare */
    const bx = 6, by = 18, bw = 62, bh = 6;
    ctx.fillStyle = P(5); ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = P(0); ctx.fillRect(bx, by, bw, bh);
    const r = G.player.mash / CFG.MASH.max;
    const full = r >= 1;
    ctx.fillStyle = full ? ((G.t * 10 | 0) % 2 ? P(10) : P(7)) : P(9);
    ctx.fillRect(bx, by, Math.round(bw * r), bh);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "left";
    ctx.fillStyle = full ? P(10) : P(6);
    ctx.fillText(full ? "X = MOS!" : "MASHING", bx + bw + 5, by + 6);

    /* siffror */
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = "right";
    ctx.fillStyle = P(10);
    ctx.fillText(String(G.score).padStart(6, "0"), CFG.W - 6, 12);
    ctx.fillStyle = P(6);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText("HI " + String(high).padStart(6, "0"), CFG.W - 6, 22);

    ctx.textAlign = "center";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = P(7);
    ctx.fillText("WAVE " + G.wave, CFG.W / 2, 12);
    if (G.player.turbo > 0) {
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = ((G.t * 8 | 0) % 2) ? P(9) : P(10);
      ctx.fillText("TURBO " + G.player.turbo.toFixed(1), CFG.W / 2, 23);
    }
  }

  function drawEntities() {
    /* power-ups */
    G.drops.forEach(u => {
      if (u.life < CFG.POWERUP.blinkAt && ((G.t * 9 | 0) % 2)) return;
      const yy = u.y + Math.sin(u.bob) * 1.5;
      drawSprite(ctx, u.kind === "butter" ? "butter" : "turbo", u.x, yy, false, false);
    });

    /* zombier — bakersta först så de överlappar rätt */
    G.zombies.slice().sort((a, b) => a.y - b.y).forEach(z => {
      const yy = z.y + Math.sin(z.wob) * 0.8;
      drawSprite(ctx, z.sprite, z.x, yy, z.face < 0, z.hitFlash > 0);
      /* hälsostreck på tanken */
      if (z.type === "pumpkin" && z.hp < z.maxHp) {
        const w = 16;
        ctx.fillStyle = P(0); ctx.fillRect(z.x - w/2, z.y - 16, w, 2);
        ctx.fillStyle = P(11);
        ctx.fillRect(z.x - w/2, z.y - 16, Math.round(w * (z.hp / z.maxHp)), 2);
      }
    });

    /* skott */
    ctx.fillStyle = P(10);
    G.bullets.forEach(b => ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3));

    /* spelaren — blinkar när hen är osårbar */
    const p = G.player;
    if (p.alive && !(p.inv > 0 && (G.t * 14 | 0) % 2)) {
      const yy = p.y + (p.walk ? Math.sin(p.walk) * 1.2 : 0);
      drawSprite(ctx, "potato", p.x, yy, p.face < 0, p.inv > CFG.PLAYER.invuln - 0.12);
    }

    /* partiklar */
    G.parts.forEach(pt => {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.max));
      ctx.fillStyle = pt.col;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2);
    });
    ctx.globalAlpha = 1;

    /* flytande text */
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    G.floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = P(0); ctx.fillText(f.txt, f.x + 1, f.y + 1);
      ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  function centerText(txt, y, size, col, shadow) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    if (shadow !== false) { ctx.fillStyle = P(0); ctx.fillText(txt, CFG.W/2 + 1, y + 1); }
    ctx.fillStyle = col;
    ctx.fillText(txt, CFG.W / 2, y);
  }

  function drawTitle() {
    drawBg();
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    centerText("SUPERPOTATISEN", 74, 16, P(10));
    centerText("VS", 96, 8, P(7));
    centerText("ZOMBIEAPOKALYPSEN", 116, 11, P(11));

    drawSprite(ctx, "potato", CFG.W/2 - 46, 168, false, false);
    drawSprite(ctx, "zstd",   CFG.W/2 + 20, 170, true, false);
    drawSprite(ctx, "zpeel",  CFG.W/2 + 48, 172, true, false);

    if ((G.t * 2 | 0) % 2) centerText("PRESS START TO PLAY", 214, 8, P(7));
    centerText("WASD ROR SIG  -  MUS SIKTAR  -  X = MOSBOMB", 238, 5, P(6));
    centerText("HI-SCORE " + String(high).padStart(6, "0"), 256, 6, P(9));
    centerText("M = LJUD AV/PA    P = PAUS", 272, 5, P(5));
  }

  function drawDead() {
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    centerText("GAME OVER", 108, 16, P(8));
    centerText("SCORE  " + String(G.score).padStart(6, "0"), 140, 8, P(10));
    centerText("WAVE   " + String(G.wave).padStart(6, "0"), 156, 8, P(7));
    centerText("HI     " + String(loadHigh()).padStart(6, "0"), 172, 8, P(9));
    if (G.score >= loadHigh() && G.score > 0) {
      if ((G.t * 3 | 0) % 2) centerText("NYTT REKORD!", 192, 8, P(11));
    }
    if ((G.t * 2 | 0) % 2) centerText("INSERT COIN", 216, 8, P(6));
    centerText("PRESS R TO RESTART", 236, 7, P(7));
  }

  function drawBreak() {
    centerText("WAVE " + G.wave + " CLEAR!", 132, 12, P(11));
    const next = G.wave + 1;
    if ((G.t * 3 | 0) % 2) centerText("WAVE " + next + " INKOMMANDE", 156, 8, P(10));
  }

  function draw() {
    ctx.save();
    if (G.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    }

    if (G.state === ST.TITLE) {
      drawTitle();
      ctx.restore();
      return;
    }

    drawBg();
    drawEntities();

    if (G.state === ST.BREAK) drawBreak();
    if (G.state === ST.DEAD) drawDead();

    /* mosbombens blinkeffekt */
    if (G.bombFlash > 0) {
      const f = G.bombFlash / CFG.MASH.flash;
      ctx.fillStyle = ((G.t * 30 | 0) % 2) ? P(7) : P(10);
      ctx.globalAlpha = f * 0.75;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    drawHud();

    if (G.paused) {
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      centerText("PAUS", 140, 16, P(7));
      centerText("P FOR ATT FORTSATTA", 164, 6, P(6));
    }
  }

  /* ── Loopen ── */
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;

    readInput();

    if (G.state === ST.TITLE) {
      if (startEdge) start();
      G.t += dt;
    } else if (!G.paused) {
      stepGame(G, dt, input);
      if (G.state === ST.DEAD) high = loadHigh();
    } else {
      G.t += dt;
    }
    startEdge = false;

    draw();
  }
  requestAnimationFrame(frame);
})();

if (typeof module !== "undefined") {
  module.exports = { ST, newGame, startWave, stepGame, killZombie };
}
