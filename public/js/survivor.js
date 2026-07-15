/* ============================================================
 * TORNEO DE CEL — survivor.js (v0.5 "arsenal edition")
 * Novedades sobre la v0.4 neón:
 *  - Alien SHOOTER (stage 3+): mantiene distancia, te dispara
 *    proyectiles; sus balas se esquivan o se bloquean con escudo.
 *  - ITEMS: los aliens sueltan drops además de chips:
 *      escudo (+1 carga, máx 3, bloquea un golpe cada una)
 *      botiquín (+25 vida) · rapid fire (8 s de cadencia doble)
 *      bomba (limpia enemigos y balas cercanas) · caja de arma
 *      (sube el nivel de arma al instante). El tank siempre
 *      suelta un item.
 *
 * Estructuras:
 *  enemy   = { x, y, r, hp, type, speed, zigT, animT, fireT?, strafeDir? }
 *  ebullet = { x, y, vx, vy, r }          (balas enemigas)
 *  item    = { x, y, vx, vy, ttl, type }
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
      grunt:   { hp: 1, speed: 42, r: 10, score: 10, minStage: 1 },
      runner:  { hp: 1, speed: 78, r: 8,  score: 15, minStage: 2, zigzag: true },
      shooter: { hp: 2, speed: 55, r: 9,  score: 25, minStage: 3, ranged: true },
      tank:    { hp: 4, speed: 24, r: 16, score: 40, minStage: 4 }
    };
    this.STAGE_SECONDS = 15;
    this.COMBO_WINDOW = 2.5;

    /* Tabla de drops de items (pesos) */
    this.ITEM_TABLE = [
      { type: 'med',    w: 28 },
      { type: 'shield', w: 28 },
      { type: 'rapid',  w: 22 },
      { type: 'nuke',   w: 12 },
      { type: 'crate',  w: 10 }
    ];
    this.ITEM_DROP_CHANCE = 0.07; // por kill normal (tank: 100%)

    /* ---- Temas neón: uno por stage, rotan ---- */
    this.THEMES = [
      { bg: '#050514', grid: 'rgba(63,210,255,0.09)',  accent: '#3fd2ff', name: 'CYAN' },
      { bg: '#0f0418', grid: 'rgba(255,110,199,0.11)', accent: '#ff6ec7', name: 'PINK' },
      { bg: '#03140a', grid: 'rgba(63,255,142,0.11)',  accent: '#3fff8e', name: 'LIME' },
      { bg: '#170504', grid: 'rgba(255,159,63,0.11)',  accent: '#ff9f3f', name: 'HEAT' },
      { bg: '#0b0b1c', grid: 'rgba(200,220,255,0.12)', accent: '#c8dcff', name: 'GHOST' }
    ];

    /* ---- Sprites 8-bit (0=vacío, letra=color), 2 frames ---- */
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
      shooter: {
        palette: { a: '#b26eff', b: '#4a0d7a', c: '#ffe1ff', d: '#ff3f6e' },
        glow: '#b26eff',
        frames: [
          ['000aa000', '00aaaa00', '0acaaca0', '0aaaaaa0', 'aa0dd0aa', '0a0dd0a0', '00a00a00', '0a0000a0'],
          ['000aa000', '00aaaa00', '0acaaca0', '0aaaaaa0', 'aa0dd0aa', '0a0dd0a0', '0a0aa0a0', 'a000000a']
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

    /* ---- Iconos de items (8x8) ---- */
    this.ITEM_DEFS = {
      med:    { glow: '#3fff8e', palette: { a: '#ffffff', b: '#ff3f6e' },
                grid: ['0bbbbbb0','bbbaabbb','bbbaabbb','baaaaaab','baaaaaab','bbbaabbb','bbbaabbb','0bbbbbb0'] },
      shield: { glow: '#3fd2ff', palette: { a: '#3fd2ff', b: '#bfeaff' },
                grid: ['0aaaaaa0','abbbbbba','abbbbbba','abbbbbba','0abbbba0','0abbbba0','00abba00','000aa000'] },
      rapid:  { glow: '#ffd23f', palette: { a: '#ffd23f', b: '#fff7d0' },
                grid: ['0000ba00','000baa00','00baa000','0baaaa00','00aaab00','000ab000','00ab0000','0ab00000'] },
      nuke:   { glow: '#ff9f3f', palette: { a: '#ff9f3f', b: '#3a3a4a', c: '#fff7d0' },
                grid: ['0000c000','000ca000','00bbbb00','0bbbbbb0','bbbabbbb','bbbbbbbb','0bbbbbb0','00bbbb00'] },
      crate:  { glow: '#b26eff', palette: { a: '#b26eff', b: '#e1c8ff' },
                grid: ['aaaaaaaa','a00bb00a','a0bbbb0a','abb00bba','a00bb00a','a00bb00a','a000000a','aaaaaaaa'] }
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
    this.ebullets = [];
    this.chips = [];
    this.items = [];
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
    this.shield = 0;
    this.rapidT = 0;
    this.itemsTotal = 0;
    this.pickupMsg = '';
    this.pickupT = 0;
    this.nukeFx = null;
    this._nukeActive = false;
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

  /* ---- Pre-hornea sprites con glow (drawImage barato) ---- */
  _bakeSprites() {
    const bake = (rows, palette, glow, px) => {
      const pad = 10;
      const c = document.createElement('canvas');
      c.width = Math.ceil(rows[0].length * px) + pad * 2;
      c.height = Math.ceil(rows.length * px) + pad * 2;
      const g = c.getContext('2d');
      g.shadowColor = glow;
      g.shadowBlur = 7;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '0') continue;
          g.fillStyle = palette[ch] || palette.a;
          g.fillRect(pad + x * px, pad + y * px, px + 0.5, px + 0.5);
        }
      });
      return c;
    };

    this.sprites = {};
    const PX = { grunt: 2.6, runner: 2.4, shooter: 2.5, tank: 3.4, player: 2.8 };
    for (const [name, def] of Object.entries(this.SPRITE_DEFS)) {
      this.sprites[name] = def.frames.map((rows) => bake(rows, def.palette, def.glow, PX[name]));
    }
    this.itemSprites = {};
    for (const [name, def] of Object.entries(this.ITEM_DEFS)) {
      this.itemSprites[name] = bake(def.grid, def.palette, def.glow, 2.2);
    }
    // Bala del jugador
    const b = document.createElement('canvas');
    b.width = b.height = 18;
    const bg = b.getContext('2d');
    bg.shadowColor = '#ffd23f';
    bg.shadowBlur = 8;
    bg.fillStyle = '#fff7d0';
    bg.fillRect(6, 6, 6, 6);
    this.bulletSprite = b;
    // Bala enemiga (roja, distinta a todo)
    const eb = document.createElement('canvas');
    eb.width = eb.height = 18;
    const ebg = eb.getContext('2d');
    ebg.shadowColor = '#ff3f6e';
    ebg.shadowBlur = 8;
    ebg.fillStyle = '#ff8fae';
    ebg.beginPath();
    ebg.arc(9, 9, 3.5, 0, Math.PI * 2);
    ebg.fill();
    this.ebulletSprite = eb;
    // Chip de energía
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

  /* ---------------- Input (igual que v0.4) ---------------- */
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

  /* ---------------- Dificultad y spawning ---------------- */

  _spawnInterval() {
    return Math.max(0.25, 1.15 * Math.pow(0.87, this.stage - 1));
  }

  _speedFactor() {
    return 1 + 0.06 * (this.stage - 1);
  }

  _pickEnemyType() {
    const roll = Math.random();
    if (this.stage >= 4 && roll < 0.12) return 'tank';
    if (this.stage >= 3 && roll < 0.30) return 'shooter';
    if (this.stage >= 2 && roll < 0.60) return 'runner';
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
      animT: Math.random(),
      fireT: 1 + Math.random() * 1.5,
      strafeDir: Math.random() < 0.5 ? 1 : -1
    });
  }

  /* ---------------- Arma del jugador ---------------- */

  _chipsNeeded() {
    return 8 + 4 * (this.weaponLv - 1);
  }

  _fireInterval() {
    const base = 0.34 * Math.pow(0.88, this.weaponLv - 1);
    let interval = Math.max(0.12, base);
    if (this.boost) interval *= 0.72;
    if (this.rapidT > 0) interval *= 0.55; // item rapid fire
    return Math.max(0.07, interval);
  }

  _aimVector() {
    const p = this.player;
    if (this.aim.mouse) {
      const d = Math.hypot(this.aim.x - p.x, this.aim.y - p.y) || 1;
      return { x: (this.aim.x - p.x) / d, y: (this.aim.y - p.y) / d };
    }
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
      this.bullets.push({
        x: p.x + s.ox, y: p.y + s.oy,
        vx: (a.x * cos - a.y * sin) * SPEED,
        vy: (a.x * sin + a.y * cos) * SPEED,
        r: 3.5
      });
    }
  }

  /* ---------------- Daño al jugador (escudo → vida) ---------------- */
  _hitPlayer(srcX, srcY) {
    const p = this.player;
    if (p.iTimer > 0) return;
    this.noDamageT = 0;
    this.combo = 0;
    this.shakeT = 0.35;
    if (this.shield > 0) {
      this.shield--;
      p.iTimer = 0.5;
      this.pickupMsg = 'ESCUDO -1';
      this.pickupT = 0.8;
      return;
    }
    p.hp -= 10;
    p.iTimer = 0.8;
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
  }

  /* ---------------- Kills, chips e items ---------------- */

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
    // Chips (el tank suelta 3)
    const n = e.type === 'tank' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.chips.push({
        x: e.x, y: e.y,
        vx: Math.cos(ang) * 50, vy: Math.sin(ang) * 50,
        ttl: 9
      });
    }
    // Drop de item (suprimido durante la bomba para no inundar)
    if (!this._nukeActive) {
      const drop = e.type === 'tank' || Math.random() < this.ITEM_DROP_CHANCE;
      if (drop && this.items.length < 6) this._spawnItem(e.x, e.y);
    }
  }

  _spawnItem(x, y) {
    let total = 0;
    for (const it of this.ITEM_TABLE) total += it.w;
    let r = Math.random() * total;
    let type = 'med';
    for (const it of this.ITEM_TABLE) {
      if (r < it.w) { type = it.type; break; }
      r -= it.w;
    }
    const ang = Math.random() * Math.PI * 2;
    this.items.push({
      x, y,
      vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40,
      ttl: 10, type
    });
  }

  _applyItem(type) {
    const p = this.player;
    if (type === 'med') {
      p.hp = Math.min(p.maxHp, p.hp + 25);
      this.pickupMsg = '+25 VIDA';
    } else if (type === 'shield') {
      this.shield = Math.min(3, this.shield + 1);
      this.pickupMsg = '+ESCUDO (' + this.shield + '/3)';
    } else if (type === 'rapid') {
      this.rapidT = 8;
      this.pickupMsg = 'RAPID FIRE!';
    } else if (type === 'crate') {
      this.weaponLv++;
      this.weaponFlash = 1.5;
      this.chipsCollected = 0;
      this.pickupMsg = 'ARMA NV' + this.weaponLv + '!';
    } else if (type === 'nuke') {
      this._detonate();
      this.pickupMsg = 'BOOM!';
    }
    this.itemsTotal++;
    this.pickupT = 1.5;
    this.score += 20;
  }

  /* Bomba: elimina enemigos en radio 150 y limpia balas enemigas */
  _detonate() {
    const p = this.player;
    this.nukeFx = { r: 10, t: 0.5 };
    this.shakeT = 0.5;
    this._nukeActive = true;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - p.x, e.y - p.y) < 150) this._killEnemy(i);
    }
    this._nukeActive = false;
    this.ebullets.length = 0;
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
            weaponLv: this.weaponLv,
            items: this.itemsTotal
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
    if (this.rapidT > 0) this.rapidT -= dt;
    if (this.pickupT > 0) this.pickupT -= dt;
    if (this.nukeFx) {
      this.nukeFx.t -= dt;
      this.nukeFx.r += 500 * dt;
      if (this.nukeFx.t <= 0) this.nukeFx = null;
    }

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

    // Autofire
    this.fireT += dt;
    while (this.fireT >= this._fireInterval()) {
      this.fireT -= this._fireInterval();
      this._fire();
    }

    // Balas del jugador
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > this.W + 10 || b.y < -10 || b.y > this.H + 10) {
        this.bullets.splice(i, 1);
      }
    }

    // Enemigos: persecución / zigzag / francotirador
    for (const e of this.enemies) {
      const spec = this.ENEMY_TYPES[e.type];
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      let vx = (p.x - e.x) / d, vy = (p.y - e.y) / d;

      if (spec.ranged) {
        if (d > 170) {
          // acercarse
        } else if (d < 120) {
          vx = -vx; vy = -vy; // retroceder
        } else {
          const sx = -vy * e.strafeDir, sy = vx * e.strafeDir;
          vx = sx; vy = sy;
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 320 && this.ebullets.length < 40) {
          const bd = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          const SPEED = 140 + 6 * (this.stage - 1);
          this.ebullets.push({
            x: e.x, y: e.y,
            vx: (p.x - e.x) / bd * SPEED,
            vy: (p.y - e.y) / bd * SPEED,
            r: 4
          });
          e.fireT = 1.7 + Math.random() * 0.9;
        }
      } else if (spec.zigzag) {
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

    // Balas enemigas → jugador
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > this.W + 10 || b.y < -10 || b.y > this.H + 10) {
        this.ebullets.splice(i, 1);
        continue;
      }
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
        this.ebullets.splice(i, 1);
        this._hitPlayer(b.x, b.y);
        if (this.state === 'over') return;
      }
    }

    // Chips: imán y recolección
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

    // Items: imán suave y recolección
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.ttl -= dt;
      it.vx *= 0.9; it.vy *= 0.9;
      const d = Math.hypot(p.x - it.x, p.y - it.y) || 1;
      if (d < 45) {
        it.vx += (p.x - it.x) / d * 500 * dt;
        it.vy += (p.y - it.y) / d * 500 * dt;
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (d < p.r + 8) {
        this.items.splice(i, 1);
        this._applyItem(it.type);
      } else if (it.ttl <= 0) {
        this.items.splice(i, 1);
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

    // Balas del jugador ↔ aliens
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

    // Aliens ↔ jugador (contacto)
    if (p.iTimer <= 0) {
      for (const e of this.enemies) {
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
          e.x += (e.x - p.x) / d * 40;
          e.y += (e.y - p.y) / d * 40;
          this._hitPlayer(e.x, e.y);
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

    ctx.fillStyle = theme.bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.9;
      ctx.fillStyle = theme.accent;
      const s = 4 + t.life * 8;
      ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    for (const c of this.chips) {
      if (c.ttl < 2 && Math.floor(c.ttl * 8) % 2 === 0) continue;
      ctx.drawImage(this.chipSprite, c.x - 10, c.y - 10);
    }
    for (const it of this.items) {
      if (it.ttl < 2.5 && Math.floor(it.ttl * 8) % 2 === 0) continue;
      const img = this.itemSprites[it.type];
      const bob = Math.sin(this.time * 5 + it.x) * 2;
      ctx.drawImage(img, it.x - img.width / 2, it.y - img.height / 2 + bob);
    }

    for (const b of this.bullets) ctx.drawImage(this.bulletSprite, b.x - 9, b.y - 9);
    for (const b of this.ebullets) ctx.drawImage(this.ebulletSprite, b.x - 9, b.y - 9);

    for (const e of this.enemies) {
      const img = this.sprites[e.type][Math.floor(e.animT * 6) % 2];
      ctx.drawImage(img, e.x - img.width / 2, e.y - img.height / 2);
    }

    for (const pa of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pa.life * 2.2));
      ctx.fillStyle = pa.c;
      ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (this.nukeFx) {
      ctx.globalAlpha = Math.max(0, this.nukeFx.t * 2);
      ctx.strokeStyle = '#ff9f3f';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ff9f3f';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.nukeFx.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    const blink = p.iTimer > 0 && Math.floor(p.iTimer * 10) % 2 === 0;
    if (!blink) {
      const a = this._aimVector();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(a.y, a.x));
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 6;
      ctx.fillStyle = this.rapidT > 0 ? '#ffd23f' : theme.accent;
      ctx.fillRect(4, -2.5, 14, 5);
      ctx.restore();
      const mv2 = this._moveVector();
      const img = this.sprites.player[(mv2.x || mv2.y) ? Math.floor(this.time * 8) % 2 : 0];
      ctx.drawImage(img, p.x - img.width / 2, p.y - img.height / 2);
    }
    if (this.shield > 0) {
      ctx.strokeStyle = '#3fd2ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#3fd2ff';
      ctx.shadowBlur = 8;
      const rot = this.time * 1.5;
      for (let s = 0; s < this.shield; s++) {
        const a0 = rot + (s * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, a0, a0 + Math.PI * 2 / 3 - 0.5);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

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
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        Math.floor(this.time) + 's · ' + this.kills + ' aliens · arma nv' + this.weaponLv + ' · ' + Math.floor(this.score) + ' pts',
        W / 2, H / 2 + 20
      );
    }
  }

  _renderHUD(ctx, theme) {
    const { W } = this;
    const p = this.player;

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

    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < this.shield ? '#3fd2ff' : 'rgba(63,210,255,0.15)';
      ctx.fillRect(140 + s * 10, 16, 7, 10);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 34, 124, 10);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(12, 36, 120 * this.chipsCollected / this._chipsNeeded(), 6);
    ctx.strokeStyle = '#665511';
    ctx.strokeRect(12, 36, 120, 6);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    let armaTxt = 'ARMA NV' + this.weaponLv;
    if (this.rapidT > 0) armaTxt += ' ⚡' + Math.ceil(this.rapidT);
    ctx.fillText(armaTxt, 12, 54);

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
    if (this.pickupT > 0) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.pickupT);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 8;
      ctx.font = 'bold 18px monospace';
      ctx.fillText(this.pickupMsg, W / 2, this.H / 2 + 60);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
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
    if (this.time < 6 && this.state === 'play') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px monospace';
      ctx.fillText('recoge chips ◆ e items para sobrevivir', this.W / 2, this.H - 24);
    }
  }
}
