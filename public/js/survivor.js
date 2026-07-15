/* ============================================================
 * TORNEO DE CEL — survivor.js (v0.4 "neon edition")
 * Aliens 8-bit en oleadas con:
 *  - Chips de energía: los aliens los sueltan al morir y hay que
 *    RECOGERLOS para subir de arma → moverse importa.
 *  - Apuntado manual con mouse en desktop (crosshair + boost al
 *    mantener clic). En touch: joystick + auto-aim al más cercano.
 *  - Paleta neón que cambia con cada stage + flash de transición.
 *  - Sprites pixel-art animados con glow pre-horneado, estela del
 *    jugador, partículas de muerte y screen shake.
 *
 * Estructuras:
 *  player  = { x, y, r, hp, maxHp, speed, iTimer }
 *  enemy   = { x, y, r, hp, type, speed, zigT, animT }
 *  bullet  = { x, y, vx, vy, r }
 *  chip    = { x, y, vx, vy, ttl }
 * ============================================================ */

'use strict';

class SurvivorGame {
  constructor(canvas, { onGameOver } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver || (() => {});
    this.W = 360;
    this.H = 640;

    this.ENEMY_TYPES = {
      grunt:  { hp: 1, speed: 42, r: 10, score: 10, minStage: 1 },
      runner: { hp: 1, speed: 78, r: 8,  score: 15, minStage: 2, zigzag: true },
      tank:   { hp: 4, speed: 24, r: 16, score: 40, minStage: 4 }
    };
    this.STAGE_SECONDS = 15;
    this.COMBO_WINDOW = 2.5;

    /* ---- Temas neón: uno por stage, rotan ---- */
    this.THEMES = [
      { bg: '#050514', grid: 'rgba(63,210,255,0.09)',  accent: '#3fd2ff', name: 'CYAN' },
      { bg: '#0f0418', grid: 'rgba(255,110,199,0.11)', accent: '#ff6ec7', name: 'PINK' },
      { bg: '#03140a', grid: 'rgba(63,255,142,0.11)',  accent: '#3fff8e', name: 'LIME' },
      { bg: '#170504', grid: 'rgba(255,159,63,0.11)',  accent: '#ff9f3f', name: 'HEAT' },
      { bg: '#0b0b1c', grid: 'rgba(200,220,255,0.12)', accent: '#c8dcff', name: 'GHOST' }
    ];

    /* ---- Sprites 8-bit: strings por fila (0=vacío, letra=color), 2 frames ---- */
    this.SPRITE_DEFS = {
      grunt: {
        palette: { a: '#3fff8e', b: '#0d7a3c', c: '#eaffef' },
        glow: '#3fff8e',
        frames: [
          ['00a00a00', '0aaaaaa0', 'aacaacaa', 'aaaaaaaa', 'a0aaaa0a', 'a0a00a0a', '000aa000', '00a00a00'],
          ['00a00a00', '0aaaaaa0', 'aacaacaa', 'aaaaaaaa', '0aaaaaa0', '0a0aa0a0', '0a0000a0', 'a000000a']
        ]
      },
      runner: {
        palette: { a: '#3fd2ff', b: '#0d4a7a', c: '#ffffff' },
        glow: '#3fd2ff',
        frames: [
          ['00aaaa00', '0aaccaa0', 'aaaaaaaa', '0a0aa0a0', '00a00a00', '0a0000a0'],
          ['00aaaa00', '0aaccaa0', 'aaaaaaaa', '00aaaa00', '0a0aa0a0', 'a00aa00a']
        ]
      },
      tank: {
        palette: { a: '#ff6ec7', b: '#7a0d4a', c: '#ffe1f2' },
        glow: '#ff6ec7',
        frames: [
          ['00aaaaaa00', '0aaaaaaaa0', 'aabaaaabaa', 'aacaaaacaa', 'aaaaaaaaaa', 'aaaaaaaaaa', '0aabbbbaa0', '0a0aaaa0a0', '00a0aa0a00', '0aa0000aa0'],
          ['00aaaaaa00', '0aaaaaaaa0', 'aabaaaabaa', 'aacaaaacaa', 'aaaaaaaaaa', 'aaaaaaaaaa', '0aabbbbaa0', '0aa0aa0aa0', '00aa00aa00', '0a000000a0']
        ]
      },
      player: {
        palette: { a: '#f2f2f2', b: '#3fd2ff', c: '#666a77' },
        glow: '#ffffff',
        frames: [
          ['00aaaa00', '0aaaaaa0', '0abbbba0', '0aaaaaa0', '0caaaac0', 'ccaaaacc', '0caaaac0', '00c00c00'],
          ['00aaaa00', '0aaaaaa0', '0abbbba0', '0aaaaaa0', '0caaaac0', 'ccaaaacc', '0caaaac0', '0c0000c0']
        ]
      }
    };
  }

  /* ---------------- Ciclo de vida ---------------- */

  start() {
    this._reset();
    this._bakeSprites();
    this._bindInput();
    this._last = performance.now();
    this._running = true;
    const loop = (now) => {
      if (!this._running) return;
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this.update(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._unbindInput();
  }

  _reset() {
    this.player = { x: this.W / 2, y: this.H / 2, r: 10, hp: 100, maxHp: 100, speed: 145, iTimer: 0 };
    this.enemies = [];
    this.bullets = [];
    this.chips = [];
    this.particles = [];
    this.trail = [];
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.stage = 1;
    this.stageBannerT = 0;
    this.flashT = 0;
    this.shakeT = 0;
    this.spawnT = 0;
    this.fireT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.noDamageT = 0;
    this.bonusFlash = 0;
    this.weaponLv = 1;
    this.chipsCollected = 0;
    this.chipsTotal = 0;
    this.weaponFlash = 0;
    this.state = 'play';
    this.overT = 0;
    this._reported = false;
    this.keys = {};
    this.joy = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.aim = { x: this.W / 2, y: 0, mouse: false };
    this.boost = false;
    this.best = TDCStorage.get('tdc_best_survivor', 0);
  }

  _theme() {
    return this.THEMES[(this.stage - 1) % this.THEMES.length];
  }

  /* ---- Pre-hornea sprites con glow en canvases (drawImage barato) ---- */
  _bakeSprites() {
    this.sprites = {};
    const PX = { grunt: 2.6, runner: 2.4, tank: 3.4, player: 2.8 };
    for (const [name, def] of Object.entries(this.SPRITE_DEFS)) {
      const px = PX[name];
      this.sprites[name] = def.frames.map((rows) => {
        const pad = 10;
        const c = document.createElement('canvas');
        c.width = Math.ceil(rows[0].length * px) + pad * 2;
        c.height = Math.ceil(rows.length * px) + pad * 2;
        const g = c.getContext('2d');
        g.shadowColor = def.glow;
        g.shadowBlur = 7;
        rows.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '0') continue;
            g.fillStyle = def.palette[ch] || def.palette.a;
            g.fillRect(pad + x * px, pad + y * px, px + 0.5, px + 0.5);
          }
        });
        return c;
      });
    }
    // Bala neón
    const b = document.createElement('canvas');
    b.width = b.height = 18;
    const bg = b.getContext('2d');
    bg.shadowColor = '#ffd23f';
    bg.shadowBlur = 8;
    bg.fillStyle = '#fff7d0';
    bg.fillRect(6, 6, 6, 6);
    this.bulletSprite = b;
    // Chip de energía (diamante)
    const ch = document.createElement('canvas');
    ch.width = ch.height = 20;
    const cg = ch.getContext('2d');
    cg.translate(10, 10);
    cg.rotate(Math.PI / 4);
    cg.shadowColor = '#ffd23f';
    cg.shadowBlur = 7;
    cg.fillStyle = '#ffd23f';
    cg.fillRect(-4, -4, 8, 8);
    cg.fillStyle = '#fff7d0';
    cg.fillRect(-2, -2, 4, 4);
    this.chipSprite = ch;
  }

  /* ---------------- Input ----------------
   * Touch → joystick flotante + auto-aim al alien más cercano.
   * Mouse → apuntas con el cursor (crosshair); mantener clic
   *         acelera la cadencia (boost). WASD/flechas mueven.  */
  _bindInput() {
    this._onKeyDown = (e) => { this.keys[e.key.toLowerCase()] = true; };
    this._onKeyUp = (e) => { this.keys[e.key.toLowerCase()] = false; };
    this._onPDown = (e) => {
      e.preventDefault();
      const p = this._pos(e);
      if (e.pointerType === 'touch') {
        this.joy = { active: true, ox: p.x, oy: p.y, dx: 0, dy: 0, id: e.pointerId };
      } else {
        this.aim = { x: p.x, y: p.y, mouse: true };
        this.boost = true;
      }
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    };
    this._onPMove = (e) => {
      const p = this._pos(e);
      if (e.pointerType === 'touch') {
        if (!this.joy.active || e.pointerId !== this.joy.id) return;
        const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
        const len = Math.hypot(dx, dy);
        const max = 50;
        const k = len > max ? max / len : 1;
        this.joy.dx = dx * k;
        this.joy.dy = dy * k;
      } else {
        this.aim = { x: p.x, y: p.y, mouse: true };
      }
    };
    this._onPUp = (e) => {
      if (e.pointerType === 'touch') {
        if (e.pointerId === this.joy.id) this.joy = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
      } else {
        this.boost = false;
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('pointerdown', this._onPDown);
    this.canvas.addEventListener('pointermove', this._onPMove);
    this.canvas.addEventListener('pointerup', this._onPUp);
    this.canvas.addEventListener('pointercancel', this._onPUp);
  }

  _unbindInput() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('pointerdown', this._onPDown);
    this.canvas.removeEventListener('pointermove', this._onPMove);
    this.canvas.removeEventListener('pointerup', this._onPUp);
    this.canvas.removeEventListener('pointercancel', this._onPUp);
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * this.W / r.width,
      y: (e.clientY - r.top) * this.H / r.height
    };
  }

  _moveVector() {
    let dx = 0, dy = 0;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;
    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      return { x: dx / len, y: dy / len };
    }
    if (this.joy.active) {
      const len = Math.hypot(this.joy.dx, this.joy.dy);
      if (len > 8) return { x: this.joy.dx / len, y: this.joy.dy / len };
    }
    return { x: 0, y: 0 };
  }

  /* ---------------- Dificultad ---------------- */

  _spawnInterval() {
    return Math.max(0.25, 1.15 * Math.pow(0.87, this.stage - 1));
  }

  _speedFactor() {
    return 1 + 0.06 * (this.stage - 1);
  }

  _pickEnemyType() {
    const roll = Math.random();
    if (this.stage >= 4 && roll < 0.15) return 'tank';
    if (this.stage >= 2 && roll < 0.45) return 'runner';
    return 'grunt';
  }

  _spawnEnemy() {
    if (this.enemies.length >= 120) return;
    const type = this._pickEnemyType();
    const spec = this.ENEMY_TYPES[type];
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * this.W; y = -20; }
    else if (side === 1) { x = this.W + 20; y = Math.random() * this.H; }
    else if (side === 2) { x = Math.random() * this.W; y = this.H + 20; }
    else { x = -20; y = Math.random() * this.H; }
    this.enemies.push({
      x, y, type,
      r: spec.r,
      hp: spec.hp,
      speed: spec.speed * this._speedFactor(),
      zigT: Math.random() * Math.PI * 2,
      animT: Math.random()
    });
  }

  /* ---------------- Arma ----------------
   * Sube SOLO recogiendo chips: nv2 más rápido · nv3 doble cañón ·
   * nv4 más rápido · nv5+ triple abanico. Boost con clic sostenido. */

  _chipsNeeded() {
    return 8 + 4 * (this.weaponLv - 1);
  }

  _fireInterval() {
    const base = 0.34 * Math.pow(0.88, this.weaponLv - 1);
    return Math.max(0.12, base) * (this.boost ? 0.72 : 1);
  }

  _aimVector() {
    const p = this.player;
    if (this.aim.mouse) {
      const d = Math.hypot(this.aim.x - p.x, this.aim.y - p.y) || 1;
      return { x: (this.aim.x - p.x) / d, y: (this.aim.y - p.y) / d };
    }
    // Auto-aim (touch): alien más cercano en rango
    let target = null, bestD = 420;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; target = e; }
    }
    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
      return { x: (target.x - p.x) / d, y: (target.y - p.y) / d };
    }
    const mv = this._moveVector();
    return (mv.x || mv.y) ? mv : { x: 0, y: -1 };
  }

  _fire() {
    const p = this.player;
    const a = this._aimVector();
    const SPEED = 330;
    const shots = [];
    if (this.weaponLv >= 3) {
      const px = -a.y * 5, py = a.x * 5;
      shots.push({ ox: px, oy: py, ang: 0 });
      shots.push({ ox: -px, oy: -py, ang: 0 });
    } else {
      shots.push({ ox: 0, oy: 0, ang: 0 });
    }
    if (this.weaponLv >= 5) {
      shots.push({ ox: 0, oy: 0, ang: 0.22 });
      shots.push({ ox: 0, oy: 0, ang: -0.22 });
    }
    for (const s of shots) {
      const cos = Math.cos(s.ang), sin = Math.sin(s.ang);
      const vx = (a.x * cos - a.y * sin) * SPEED;
      const vy = (a.x * sin + a.y * cos) * SPEED;
      this.bullets.push({ x: p.x + s.ox, y: p.y + s.oy, vx, vy, r: 3.5 });
    }
  }

  _killEnemy(index) {
    const e = this.enemies[index];
    const spec = this.ENEMY_TYPES[e.type];
    this.enemies.splice(index, 1);
    this.kills++;
    this.combo++;
    this.comboT = this.COMBO_WINDOW;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + 0.1 * Math.min(this.combo, 20);
    this.score += spec.score * mult;
    // Partículas neón del color del alien
    const glow = this.SPRITE_DEFS[e.type].glow;
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 110;
      this.particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.35 + Math.random() * 0.3, c: glow
      });
    }
    // Chips de energía (el tank suelta 3)
    const n = e.type === 'tank' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.chips.push({
        x: e.x, y: e.y,
        vx: Math.cos(ang) * 50, vy: Math.sin(ang) * 50,
        ttl: 9
      });
    }
  }

  /* ---------------- Update ---------------- */

  update(dt) {
    if (this.state === 'over') {
      this.overT += dt;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pa = this.particles[i];
        pa.life -= dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
        if (pa.life <= 0) this.particles.splice(i, 1);
      }
      if (this.overT >= 1.2 && !this._reported) {
        this._reported = true;
        this.onGameOver({
          mode: 'survivor',
          score: Math.floor(this.score),
          stats: {
            time: this.time,
            kills: this.kills,
            maxCombo: this.maxCombo,
            stage: this.stage,
            chips: this.chipsTotal,
            weaponLv: this.weaponLv
          }
        });
      }
      return;
    }

    const p = this.player;
    this.time += dt;
    this.score += 5 * dt;
    this.noDamageT += dt;

    if (this.noDamageT >= 10) {
      this.noDamageT -= 10;
      this.score += 100;
      this.bonusFlash = 1.5;
    }
    if (this.bonusFlash > 0) this.bonusFlash -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.weaponFlash > 0) this.weaponFlash -= dt;

    // Stage up → nuevo tema + flash
    const newStage = Math.floor(this.time / this.STAGE_SECONDS) + 1;
    if (newStage > this.stage) {
      this.stage = newStage;
      this.stageBannerT = 2;
      this.flashT = 0.5;
    }
    if (this.stageBannerT > 0) this.stageBannerT -= dt;

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    // Movimiento + estela
    const mv = this._moveVector();
    p.x = Math.max(p.r, Math.min(this.W - p.r, p.x + mv.x * p.speed * dt));
    p.y = Math.max(p.r, Math.min(this.H - p.r, p.y + mv.y * p.speed * dt));
    if (p.iTimer > 0) p.iTimer -= dt;
    if (mv.x || mv.y) this.trail.push({ x: p.x, y: p.y, life: 0.3 });
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    // Spawning
    this.spawnT += dt;
    while (this.spawnT >= this._spawnInterval()) {
      this.spawnT -= this._spawnInterval();
      this._spawnEnemy();
    }

    // Autofire (hacia el mouse o auto-aim)
    this.fireT += dt;
    while (this.fireT >= this._fireInterval()) {
      this.fireT -= this._fireInterval();
      this._fire();
    }

    // Balas
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > this.W + 10 || b.y < -10 || b.y > this.H + 10) {
        this.bullets.splice(i, 1);
      }
    }

    // Enemigos persiguen (runner con zigzag)
    for (const e of this.enemies) {
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      let vx = (p.x - e.x) / d, vy = (p.y - e.y) / d;
      if (this.ENEMY_TYPES[e.type].zigzag) {
        e.zigT += dt * 6;
        const perp = Math.sin(e.zigT) * 0.7;
        const nvx = vx + -vy * perp, nvy = vy + vx * perp;
        const nl = Math.hypot(nvx, nvy) || 1;
        vx = nvx / nl; vy = nvy / nl;
      }
      e.x += vx * e.speed * dt;
      e.y += vy * e.speed * dt;
      e.animT += dt;
    }

    // Chips: dispersión, imán y recolección
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      c.ttl -= dt;
      c.vx *= 0.9; c.vy *= 0.9;
      const d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      if (d < 55) {
        c.vx += (p.x - c.x) / d * 600 * dt;
        c.vy += (p.y - c.y) / d * 600 * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (d < p.r + 6) {
        this.chips.splice(i, 1);
        this.chipsCollected++;
        this.chipsTotal++;
        this.score += 15 * (1 + 0.1 * Math.min(this.combo, 20));
        if (this.chipsCollected >= this._chipsNeeded()) {
          this.chipsCollected = 0;
          this.weaponLv++;
          this.weaponFlash = 1.5;
        }
      } else if (c.ttl <= 0) {
        this.chips.splice(i, 1);
      }
    }

    // Partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i];
      pa.life -= dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.life <= 0) this.particles.splice(i, 1);
    }

    // Balas ↔ aliens
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          this.bullets.splice(i, 1);
          e.hp--;
          if (e.hp <= 0) this._killEnemy(j);
          break;
        }
      }
    }

    // Aliens ↔ jugador (i-frames + knockback + shake)
    if (p.iTimer <= 0) {
      for (const e of this.enemies) {
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
          p.hp -= 10;
          p.iTimer = 0.8;
          this.noDamageT = 0;
          this.combo = 0;
          this.shakeT = 0.35;
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
          e.x += (e.x - p.x) / d * 40;
          e.y += (e.y - p.y) / d * 40;
          if (p.hp <= 0) {
            p.hp = 0;
            this.state = 'over';
            this.overT = 0;
            const final = Math.floor(this.score);
            if (final > this.best) {
              this.best = final;
              TDCStorage.set('tdc_best_survivor', this.best);
            }
          }
          break;
        }
      }
    }
  }

  /* ---------------- Render ---------------- */

  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const p = this.player;
    const theme = this._theme();

    ctx.save();
    if (this.shakeT > 0) {
      const k = this.shakeT * 14;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }

    // Fondo del tema + grid
    ctx.fillStyle = theme.bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Estela del jugador
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.9;
      ctx.fillStyle = theme.accent;
      const s = 4 + t.life * 8;
      ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // Chips (parpadean al expirar)
    for (const c of this.chips) {
      if (c.ttl < 2 && Math.floor(c.ttl * 8) % 2 === 0) continue;
      ctx.drawImage(this.chipSprite, c.x - 10, c.y - 10);
    }

    // Balas
    for (const b of this.bullets) {
      ctx.drawImage(this.bulletSprite, b.x - 9, b.y - 9);
    }

    // Aliens (2 frames de animación)
    for (const e of this.enemies) {
      const img = this.sprites[e.type][Math.floor(e.animT * 6) % 2];
      ctx.drawImage(img, e.x - img.width / 2, e.y - img.height / 2);
    }

    // Partículas
    for (const pa of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pa.life * 2.2));
      ctx.fillStyle = pa.c;
      ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Jugador + cañón orientado al aim
    const blink = p.iTimer > 0 && Math.floor(p.iTimer * 10) % 2 === 0;
    if (!blink) {
      const a = this._aimVector();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(a.y, a.x));
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 6;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(4, -2.5, 14, 5);
      ctx.restore();
      const mv = this._moveVector();
      const img = this.sprites.player[(mv.x || mv.y) ? Math.floor(this.time * 8) % 2 : 0];
      ctx.drawImage(img, p.x - img.width / 2, p.y - img.height / 2);
    }

    // Crosshair (solo con mouse)
    if (this.aim.mouse && this.state === 'play') {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5;
      const ax = this.aim.x, ay = this.aim.y, s = this.boost ? 10 : 7;
      ctx.beginPath();
      ctx.moveTo(ax - s, ay); ctx.lineTo(ax - 3, ay);
      ctx.moveTo(ax + 3, ay); ctx.lineTo(ax + s, ay);
      ctx.moveTo(ax, ay - s); ctx.lineTo(ax, ay - 3);
      ctx.moveTo(ax, ay + 3); ctx.lineTo(ax, ay + s);
      ctx.stroke();
    }

    // Joystick virtual (touch)
    if (this.joy.active) {
      ctx.beginPath();
      ctx.arc(this.joy.ox, this.joy.oy, 50, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.joy.ox + this.joy.dx, this.joy.oy + this.joy.dy, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    }

    // Flash de cambio de stage
    if (this.flashT > 0) {
      ctx.globalAlpha = this.flashT * 0.5;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    this._renderHUD(ctx, theme);

    if (this.state === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff3f6e';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(
        Math.floor(this.time) + 's · ' + this.kills + ' aliens · arma nv' + this.weaponLv + ' · ' + Math.floor(this.score) + ' pts',
        W / 2, H / 2 + 20
      );
    }
  }

  _renderHUD(ctx, theme) {
    const { W } = this;
    const p = this.player;

    // Vida con glow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 12, 124, 18);
    ctx.fillStyle = p.hp > 30 ? '#3fff8e' : '#ff3f6e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fillRect(12, 14, 120 * p.hp / p.maxHp, 14);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 14, 120, 14);

    // Progreso de arma (chips)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 34, 124, 10);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(12, 36, 120 * this.chipsCollected / this._chipsNeeded(), 6);
    ctx.strokeStyle = '#665511';
    ctx.strokeRect(12, 36, 120, 6);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ARMA NV' + this.weaponLv, 12, 54);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(Math.floor(this.time) + 's', W / 2, 26);
    ctx.fillStyle = theme.accent;
    ctx.font = '10px monospace';
    ctx.fillText('STAGE ' + this.stage + ' · ' + theme.name, W / 2, 42);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('SCORE ' + Math.floor(this.score), W - 12, 22);
    ctx.fillStyle = theme.accent;
    ctx.font = '12px monospace';
    ctx.fillText('KILLS ' + this.kills, W - 12, 40);

    if (this.combo >= 3) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff9f3f';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('COMBO x' + (1 + 0.1 * Math.min(this.combo, 20)).toFixed(1), 12, 70);
    }
    if (this.bonusFlash > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3fff8e';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('+100 SIN DAÑO', W / 2, 62);
    }
    if (this.weaponFlash > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f';
      ctx.shadowBlur = 8;
      ctx.font = 'bold 22px monospace';
      ctx.fillText('WEAPON UP! NV' + this.weaponLv, W / 2, this.H / 2 - 90);
      ctx.shadowBlur = 0;
    }
    if (this.stageBannerT > 0 && this.state === 'play') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.stageBannerT);
      ctx.fillStyle = theme.accent;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 34px monospace';
      ctx.fillText('STAGE ' + this.stage, this.W / 2, this.H / 2 - 50);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // Hint inicial
    if (this.time < 6 && this.state === 'play') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px monospace';
      ctx.fillText('recoge los chips ◆ para subir tu arma', this.W / 2, this.H - 24);
    }
  }
}
