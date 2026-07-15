/* ============================================================
 * TORNEO DE CEL — penales.js (v0.2 "street edition")
 * Modo Penales arcade con escenario callejero, carta de jugador
 * estilo FIFA (los stats afectan el gameplay) y HUD estilo Doom:
 * la cara del jugador vive abajo, se tensa al tirar, sonríe con
 * gol y llora si falla.
 *
 * Flujo por penal: AIM → POWER → SHOT → RESULT
 *
 * Efecto de los stats de la carta:
 *   POT → el portero ataja menos tus tiros fuertes
 *   PRE → ventana de tiro "perfect" más ancha
 *   SER → barra de potencia más lenta (menos presión de timing)
 *   PIC → el portero predice menos tu lado
 * ============================================================ */

'use strict';

class PenalesGame {
  constructor(canvas, { onGameOver, player } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver || (() => {});
    this.player = player || ROSTER[0];
    this.W = 360;
    this.H = 640;

    this.TOTAL_KICKS = 5;
    this.COLS = 3;
    this.ROWS = 2;
    this.goal = { x: 45, y: 105, w: 270, h: 125 }; // los postes pisan el pasto en y=230
    this.PANEL_Y = 556; // HUD estilo Doom abajo

    // ---- Stats de la carta → parámetros de gameplay ----
    const s = this.player.stats;
    this.winLo = Math.max(72, 85 - Math.round((s.PRE - 60) / 3)); // PRE 60→85, 93→74
    this.potFactor = 1 - (s.POT - 60) / 250;   // multiplica prob. de atajada
    this.serFactor = 1 + (s.SER - 60) / 250;   // multiplica periodo de la barra
    this.picFactor = 1 - (s.PIC - 60) / 200;   // multiplica predicción del portero

    // ---- Escenografía precalculada (determinista, no parpadea) ----
    this.buildings = [
      { x: 0, w: 70, h: 72, c: '#e2795f' }, { x: 70, w: 55, h: 95, c: '#68b7c9' },
      { x: 125, w: 60, h: 60, c: '#d9a441' }, { x: 185, w: 65, h: 100, c: '#8a6fc9' },
      { x: 250, w: 55, h: 78, c: '#5fae6b' }, { x: 305, w: 55, h: 88, c: '#c95f8a' }
    ];
    this.flagColors = ['#ff3f6e', '#ffd23f', '#3fd2ff', '#3fff8e', '#b26eff', '#ff9f3f'];
    this.graffiti = [
      { x: 24, y: 196, r: 15, c: '#ffd23f', smiley: true },
      { x: 330, y: 200, r: 13, c: '#ff6ec7', smiley: true },
      { x: 60, y: 205, w: 40, h: 14, c: '#3fd2ff' },
      { x: 255, y: 208, w: 46, h: 12, c: '#3fff8e' },
      { x: 150, y: 238, w: 60, h: 10, c: '#b26eff' }
    ];
    this.clouds = [{ x: 30, y: 30, s: 1 }, { x: 190, y: 16, s: 1.5 }, { x: 290, y: 44, s: 0.8 }];
  }

  /* ---------------- Ciclo de vida ---------------- */

  start() {
    this._reset();
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
    this.kicksTaken = 0;
    this.score = 0;
    this.goals = 0;
    this.perfects = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.history = [];
    this.shots = [];
    this.particles = [];
    this.best = TDCStorage.get('tdc_best_penales', 0);

    this.state = 'aim';
    this.sel = { col: 1, row: 0 };
    this.power = 0;
    this.powerT = 0;
    this._powerArmedAt = 0;
    this.shotT = 0;
    this.resultT = 0;
    this.animT = 0;
    this.currentShot = null;
    this._reported = false;
    this.ball = { x: this.W / 2, y: 478 };
    this.keeper = { x: this.W / 2, y: 0 };
  }

  /* ---------------- Input ---------------- */

  _bindInput() {
    this._onPointer = (e) => {
      e.preventDefault();
      const p = this._pos(e);
      if (this.state === 'aim') {
        const z = this._zoneAt(p.x, p.y);
        if (z) { this.sel = z; this._confirmAim(); }
      } else if (this.state === 'power') {
        if (performance.now() - this._powerArmedAt > 200) this._lockPower();
      }
    };
    this._onKey = (e) => {
      if (this.state === 'aim') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 6) {
          this.sel = { col: (n - 1) % 3, row: n <= 3 ? 0 : 1 };
          this._confirmAim();
        } else if (e.key === 'ArrowLeft') this.sel.col = Math.max(0, this.sel.col - 1);
        else if (e.key === 'ArrowRight') this.sel.col = Math.min(2, this.sel.col + 1);
        else if (e.key === 'ArrowUp') this.sel.row = 0;
        else if (e.key === 'ArrowDown') this.sel.row = 1;
        else if (e.key === 'Enter' || e.key === ' ') this._confirmAim();
      } else if (this.state === 'power') {
        if (e.key === 'Enter' || e.key === ' ') this._lockPower();
      }
    };
    this.canvas.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('keydown', this._onKey);
  }

  _unbindInput() {
    this.canvas.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('keydown', this._onKey);
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * this.W / r.width,
      y: (e.clientY - r.top) * this.H / r.height
    };
  }

  _zoneRect(col, row) {
    const w = this.goal.w / this.COLS;
    const h = this.goal.h / this.ROWS;
    return { x: this.goal.x + col * w, y: this.goal.y + row * h, w, h };
  }

  _zoneAt(x, y) {
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const r = this._zoneRect(col, row);
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { col, row };
      }
    }
    return null;
  }

  _confirmAim() {
    this.state = 'power';
    this.powerT = 0;
    this._powerArmedAt = performance.now();
  }

  _lockPower() {
    this._resolveShot(this.sel.col, this.sel.row, this.power);
  }

  /* ---------------- IA del portero ----------------
   * Predicción base 25% +8% por gol de racha, reducida por la
   * picardía (PIC) del jugador. Si no predice, se sesga hacia la
   * columna que más usas (premia variar el tiro). */
  _keeperGuess(shotCol) {
    const difficulty = Math.min(this.streak, 5);
    const predictP = (0.25 + 0.08 * difficulty) * this.picFactor;
    let col;
    if (Math.random() < predictP) {
      col = shotCol;
    } else {
      const counts = [1, 1, 1];
      for (const c of this.history) counts[c]++;
      const total = counts[0] + counts[1] + counts[2];
      const r = Math.random() * total;
      col = r < counts[0] ? 0 : r < counts[0] + counts[1] ? 1 : 2;
    }
    const row = Math.random() < 0.5 ? 0 : 1;
    return { col, row };
  }

  /* ---------------- Resolución del tiro ----------------
   * Calidad según potencia (la ventana perfect depende de PRE):
   *   < 40         → weak
   *   40..winLo    → good
   *   winLo..95    → perfect
   *   > 95         → wild (palo o fuera)                        */
  _resolveShot(col, row, power) {
    const keeper = this._keeperGuess(col);
    let quality, result;

    if (power > 95) quality = 'wild';
    else if (power >= this.winLo) quality = 'perfect';
    else if (power >= 40) quality = 'good';
    else quality = 'weak';

    if (quality === 'wild') {
      result = Math.random() < 0.6 ? 'post' : 'off';
    } else if (keeper.col !== col) {
      result = (quality === 'weak' && Math.random() < 0.15 * this.potFactor) ? 'save' : 'goal';
    } else if (keeper.row === row) {
      const corner = row === 0 && col !== 1;
      if (quality === 'perfect' && corner) result = 'goal'; // escuadra imparable
      else if (quality === 'perfect') result = Math.random() < 0.5 * this.potFactor ? 'save' : 'goal';
      else result = 'save';
    } else {
      const baseSaveP = quality === 'perfect' ? 0.1 : quality === 'good' ? 0.35 : 0.7;
      result = Math.random() < baseSaveP * this.potFactor ? 'save' : 'goal';
    }

    /* Puntos: gol 100 · perfect +50 · escuadra +25 · racha x1→x2 */
    let points = 0;
    if (result === 'goal') {
      let base = 100;
      if (quality === 'perfect') base += 50;
      if (row === 0 && col !== 1) base += 25;
      const mult = 1 + 0.25 * Math.min(this.streak, 4);
      points = Math.round(base * mult);
      this.score += points;
      this.goals++;
      this.streak++;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
      if (quality === 'perfect') this.perfects++;
    } else {
      this.streak = 0;
    }

    this.history.push(col);
    this.currentShot = { col, row, power, quality, keeper, result, points };
    this.shots.push(this.currentShot);

    // Preparar animación del balón y del portero
    this.state = 'shot';
    this.shotT = 0;
    this._ballFrom = { x: this.W / 2, y: 478 };
    const zr = this._zoneRect(col, row);
    this._ballTo = { x: zr.x + zr.w / 2, y: zr.y + zr.h / 2 };
    if (result === 'post') {
      this._ballTo = {
        x: this.goal.x + (col === 0 ? 2 : col === 2 ? this.goal.w - 2 : this.goal.w / 2),
        y: this.goal.y + 4
      };
    }
    if (result === 'off') {
      this._ballTo = { x: this._ballTo.x + (col === 0 ? -55 : col === 2 ? 55 : 20), y: this.goal.y - 42 };
    }
    const kzr = this._zoneRect(keeper.col, keeper.row);
    this._keeperTo = { x: kzr.x + kzr.w / 2, row: keeper.row };
  }

  _spawnConfetti() {
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: this._ballTo.x + (Math.random() - 0.5) * 40,
        y: this._ballTo.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 140,
        vy: -60 - Math.random() * 120,
        life: 1 + Math.random() * 0.5,
        c: this.flagColors[i % this.flagColors.length]
      });
    }
  }

  /* ---------------- Update ---------------- */

  update(dt) {
    this.animT += dt;

    // Confetti (siempre se actualiza)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy += 300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.state === 'power') {
      // Onda triangular; más racha → más rápida; SER la frena
      const difficulty = Math.min(this.streak, 5);
      const period = Math.max(0.6, (1.2 - 0.08 * difficulty) * this.serFactor);
      this.powerT += dt;
      const phase = (this.powerT % period) / period;
      this.power = (phase < 0.5 ? phase * 2 : (1 - phase) * 2) * 100;
    } else if (this.state === 'shot') {
      this.shotT += dt;
      const t = Math.min(this.shotT / 0.55, 1);
      const ease = 1 - Math.pow(1 - t, 2);
      this.ball.x = this._ballFrom.x + (this._ballTo.x - this._ballFrom.x) * ease;
      this.ball.y = this._ballFrom.y + (this._ballTo.y - this._ballFrom.y) * ease;
      this.keeper.x = this.W / 2 + (this._keeperTo.x - this.W / 2) * ease;
      this.keeper.y = this._keeperTo.row === 0 ? -32 * ease : 8 * ease;
      if (t >= 1) {
        this.state = 'result';
        this.resultT = 0;
        if (this.currentShot.result === 'goal') this._spawnConfetti();
      }
    } else if (this.state === 'result') {
      this.resultT += dt;
      if (this.resultT >= 1.3) this._nextKick();
    } else if (this.state === 'over') {
      this.resultT += dt;
      if (this.resultT >= 1.2 && !this._reported) {
        this._reported = true;
        this.onGameOver({
          mode: 'penales',
          score: this.score,
          stats: {
            goals: this.goals,
            perfects: this.perfects,
            maxStreak: this.maxStreak,
            kicks: this.TOTAL_KICKS
          }
        });
      }
    }
  }

  _nextKick() {
    this.kicksTaken++;
    if (this.kicksTaken >= this.TOTAL_KICKS) {
      this.state = 'over';
      this.resultT = 0;
      if (this.score > this.best) {
        this.best = this.score;
        TDCStorage.set('tdc_best_penales', this.best);
      }
      return;
    }
    this.state = 'aim';
    this.ball = { x: this.W / 2, y: 478 };
    this.keeper = { x: this.W / 2, y: 0 };
    this.currentShot = null;
  }

  /* ================= RENDER ================= */

  render() {
    const ctx = this.ctx;
    this._drawSky(ctx);
    this._drawBuildings(ctx);
    this._drawWall(ctx);
    this._drawGround(ctx);
    this._drawGoal(ctx);
    this._drawZones(ctx);
    this._drawKeeper(ctx);
    this._drawBall(ctx);
    this._drawParticles(ctx);
    this._drawBunting(ctx);
    this._drawMessages(ctx);
    this._drawPowerBar(ctx);
    this._drawPanel(ctx);
    if (this.state === 'over') this._drawGameOver(ctx);
  }

  /* ---- Cielo, sol y nubes ---- */
  _drawSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, '#5aa8e8');
    g.addColorStop(1, '#a8d8f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, 170);
    // Sol
    ctx.fillStyle = '#ffeaa0';
    ctx.beginPath();
    ctx.arc(322, 30, 18, 0, Math.PI * 2);
    ctx.fill();
    // Nubes pixel (derivan lento)
    ctx.fillStyle = '#ffffff';
    for (const c of this.clouds) {
      const cx = ((c.x + this.animT * 5) % (this.W + 100)) - 50;
      ctx.fillRect(cx, c.y, 44 * c.s, 10 * c.s);
      ctx.fillRect(cx + 8 * c.s, c.y - 6 * c.s, 26 * c.s, 8 * c.s);
    }
  }

  /* ---- Edificios de barrio con ventanas ---- */
  _drawBuildings(ctx) {
    const base = 165;
    for (const b of this.buildings) {
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, base - b.h, b.w, b.h);
      // Techo
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x, base - b.h, b.w, 5);
      // Ventanas
      ctx.fillStyle = 'rgba(20,20,40,0.55)';
      for (let wy = base - b.h + 12; wy < base - 12; wy += 18) {
        for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) {
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
      // Toldo en algunos
      if (b.h < 80) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(b.x + 4, base - 18, b.w - 8, 6);
      }
    }
  }

  /* ---- Barda con graffiti detrás de la portería ---- */
  _drawWall(ctx) {
    ctx.fillStyle = '#b8bec8';
    ctx.fillRect(0, 165, this.W, 65);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 165, this.W, 5);
    // Líneas de bloques
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = 180; y < 230; y += 14) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    // Graffiti
    for (const gf of this.graffiti) {
      if (gf.smiley) {
        ctx.fillStyle = gf.c;
        ctx.beginPath();
        ctx.arc(gf.x, gf.y, gf.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(gf.x - 6, gf.y - 5, 3, 5);
        ctx.fillRect(gf.x + 3, gf.y - 5, 3, 5);
        ctx.fillRect(gf.x - 6, gf.y + 4, 12, 3);
      } else {
        ctx.fillStyle = gf.c;
        ctx.fillRect(gf.x, gf.y, gf.w, gf.h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(gf.x + 3, gf.y + 3, gf.w - 6, 3);
      }
    }
  }

  /* ---- Pasto + tierra estilo cascarita ---- */
  _drawGround(ctx) {
    // Pasto (donde está la portería)
    ctx.fillStyle = '#3e9e4e';
    ctx.fillRect(0, 230, this.W, 72);
    ctx.fillStyle = '#379147';
    for (let x = 0; x < this.W; x += 40) ctx.fillRect(x, 230, 20, 72);
    // Línea de gol
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(this.goal.x - 8, 231, this.goal.w + 16, 3);
    // Tierra del foreground
    ctx.fillStyle = '#8a5a35';
    ctx.fillRect(0, 302, this.W, this.PANEL_Y - 302);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 302, this.W, 5);
    // Moteado determinista (no parpadea entre frames)
    for (let i = 0; i < 70; i++) {
      const sx = (i * 53) % this.W;
      const sy = 310 + ((i * 97) % (this.PANEL_Y - 320));
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(sx, sy, 3, 3);
    }
    // Punto de penal
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(this.W / 2, 486, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- Portería con red ---- */
  _drawGoal(ctx) {
    const g = this.goal;
    // Red (romboide sutil)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 14; i++) {
      const gx = g.x + (g.w / 14) * i;
      ctx.beginPath(); ctx.moveTo(gx, g.y); ctx.lineTo(gx, g.y + g.h); ctx.stroke();
    }
    for (let i = 0; i <= 7; i++) {
      const gy = g.y + (g.h / 7) * i;
      ctx.beginPath(); ctx.moveTo(g.x, gy); ctx.lineTo(g.x + g.w, gy); ctx.stroke();
    }
    // Postes y travesaño (con sombra para volumen)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(g.x - 5, g.y - 5, 5, g.h + 10);
    ctx.fillRect(g.x + g.w, g.y - 5, 5, g.h + 10);
    ctx.fillRect(g.x - 5, g.y - 5, g.w + 10, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(g.x - 5, g.y - 5, 2, g.h + 10);
    ctx.fillRect(g.x + g.w + 3, g.y - 5, 2, g.h + 10);
  }

  /* ---- Zonas de tiro ---- */
  _drawZones(ctx) {
    if (this.state !== 'aim' && this.state !== 'power') return;
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const r = this._zoneRect(col, row);
        const isSel = this.sel.col === col && this.sel.row === row;
        if (this.state === 'power' && !isSel) continue; // en power solo la elegida
        const pulse = isSel ? 0.25 + 0.15 * Math.sin(this.animT * 6) : 0.07;
        ctx.fillStyle = isSel ? `rgba(255,210,63,${pulse + 0.15})` : `rgba(63,210,255,${pulse})`;
        ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        ctx.strokeStyle = isSel ? '#ffd23f' : 'rgba(63,210,255,0.35)';
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
        if (this.state === 'aim') {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(row * 3 + col + 1), r.x + r.w / 2, r.y + r.h / 2 + 4);
        }
      }
    }
  }

  /* ---- Portero animado (idle: balanceo; dive: brazos extendidos) ---- */
  _drawKeeper(ctx) {
    const idle = this.state === 'aim' || this.state === 'power';
    const sway = idle ? Math.sin(this.animT * 2.2) * 6 : 0;
    const bob = idle ? Math.abs(Math.sin(this.animT * 4.4)) * 3 : 0;
    const x = this.keeper.x + sway;
    const baseY = this.goal.y + this.goal.h;
    const top = baseY - 62 + this.keeper.y + bob;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, baseY - 2, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Piernas + calcetas
    ctx.fillStyle = '#f2c094';
    ctx.fillRect(x - 10, top + 40, 7, 12);
    ctx.fillRect(x + 3, top + 40, 7, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 10, top + 48, 7, 8);
    ctx.fillRect(x + 3, top + 48, 7, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 11, top + 55, 9, 5);
    ctx.fillRect(x + 2, top + 55, 9, 5);
    // Shorts
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 12, top + 32, 24, 10);
    // Jersey verde con franja
    ctx.fillStyle = '#3fae5f';
    ctx.fillRect(x - 13, top + 12, 26, 22);
    ctx.fillStyle = '#ff6440';
    ctx.fillRect(x - 13, top + 20, 26, 4);

    // Brazos
    const diving = this.state === 'shot' || (this.state === 'result' && this.currentShot);
    if (diving && this._keeperTo) {
      const dir = Math.sign(this._keeperTo.x - this.W / 2) || (Math.random() < 0.5 ? -1 : 1);
      const vert = this._keeperTo.row === 0 ? 1 : -0.4;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#3fae5f';
        ctx.fillRect(x + dir * (12 + i * 7) - 3, top + 16 - vert * i * 6, 7, 7);
      }
      // Guantes
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x + dir * 33 - 4, top + 16 - vert * 18, 9, 9);
      ctx.fillRect(x + dir * 26 - 4, top + 22 - vert * 12, 8, 8);
    } else {
      // Brazos abiertos en guardia
      ctx.fillStyle = '#3fae5f';
      ctx.fillRect(x - 24, top + 16, 12, 6);
      ctx.fillRect(x + 12, top + 16, 12, 6);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 30, top + 13, 8, 9);
      ctx.fillRect(x + 22, top + 13, 8, 9);
    }

    // Cabeza
    ctx.fillStyle = '#f2c094';
    ctx.fillRect(x - 8, top - 3, 16, 15);
    ctx.fillStyle = '#3a2313';
    ctx.fillRect(x - 8, top - 5, 16, 5);
    ctx.fillStyle = '#181818';
    ctx.fillRect(x - 5, top + 3, 3, 3);
    ctx.fillRect(x + 2, top + 3, 3, 3);
  }

  /* ---- Balón con textura y vuelo con parábola ---- */
  _drawBall(ctx) {
    const b = this.ball;
    const t = this.state === 'shot' ? Math.min(this.shotT / 0.55, 1) : 0;
    const scale = 1 - 0.45 * t; // se hace chico al alejarse (profundidad)
    const r = 11 * scale;
    const arcY = this.state === 'shot' ? -Math.sin(Math.PI * t) * 34 * scale : 0;
    const y = b.y + arcY;

    // Sombra en el piso
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 9 * scale, r * 1.3, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    ctx.beginPath();
    ctx.arc(b.x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pentágonos (rotan durante el vuelo)
    const ang = t * 7 + this.animT * (this.state === 'shot' ? 0 : 0.4);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(b.x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = ang + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Banderines de fiesta ---- */
  _drawBunting(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(this.W / 2, 40, this.W, 18);
    ctx.stroke();
    for (let i = 0; i < 13; i++) {
      const fx = 8 + i * 28;
      const fy = 18 + Math.sin((Math.PI * fx) / this.W) * 20;
      ctx.fillStyle = this.flagColors[i % this.flagColors.length];
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 12, fy);
      ctx.lineTo(fx + 6, fy + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---- Mensajes centrales (instrucciones y resultado) ---- */
  _drawMessages(ctx) {
    ctx.textAlign = 'center';
    if (this.state === 'aim') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(this.W / 2 - 130, 320, 260, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('ELIGE TU ESQUINA', this.W / 2, 338);
      ctx.fillStyle = '#9fd8ff';
      ctx.font = '10px monospace';
      ctx.fillText('tap en la zona · teclas 1-6', this.W / 2, 353);
    }
    if ((this.state === 'result' || this.state === 'over') && this.currentShot) {
      const s = this.currentShot;
      const labels = { goal: 'GOOOL!', save: 'ATAJADO', post: 'AL PALO!', off: 'FUERA' };
      ctx.font = 'bold 38px monospace';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.strokeText(labels[s.result], this.W / 2, 345);
      ctx.fillStyle = s.result === 'goal' ? '#3fff8e' : '#ff3f6e';
      ctx.fillText(labels[s.result], this.W / 2, 345);
      const qLabels = { perfect: 'PERFECT!', good: 'GOOD', weak: 'BAD', wild: 'WILD!' };
      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = s.quality === 'perfect' ? '#ffd23f' : '#ddd';
      ctx.fillText(qLabels[s.quality], this.W / 2, 372);
      if (s.points > 0) {
        ctx.fillStyle = '#3fd2ff';
        ctx.fillText('+' + s.points + ' pts', this.W / 2, 396);
      }
    }
  }

  /* ---- Barra de potencia con ventana perfect según PRE ---- */
  _drawPowerBar(ctx) {
    if (this.state !== 'power') return;
    const bx = 55, by = 515, bw = 250, bh = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 6, by - 26, bw + 12, bh + 34);
    ctx.fillStyle = '#20202e';
    ctx.fillRect(bx, by, bw, bh);
    // Segmentos: weak | good | perfect | wild
    ctx.fillStyle = 'rgba(63,210,255,0.25)';
    ctx.fillRect(bx + bw * 0.40, by, bw * (this.winLo - 40) / 100, bh);
    ctx.fillStyle = 'rgba(255,210,63,0.75)';
    ctx.fillRect(bx + bw * this.winLo / 100, by, bw * (95 - this.winLo) / 100, bh);
    ctx.fillStyle = 'rgba(255,63,110,0.6)';
    ctx.fillRect(bx + bw * 0.95, by, bw * 0.05, bh);
    // Relleno actual
    ctx.fillStyle = this.power > 95 ? '#ff3f6e' : this.power >= this.winLo ? '#ffd23f' : '#3fd2ff';
    ctx.fillRect(bx, by, bw * this.power / 100, bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POTENCIA — tap / espacio', this.W / 2, by - 10);
  }

  /* ---- HUD estilo Doom: panel inferior con la cara reactiva ----
   * idle → parpadea · power/shot → tensa y suda ·
   * gol → sonríe · fallo → llora con lágrimas animadas. */
  _faceExpr() {
    if (this.state === 'power' || this.state === 'shot') return 'tense';
    if ((this.state === 'result' || this.state === 'over') && this.currentShot) {
      return this.currentShot.result === 'goal' ? 'happy' : 'sad';
    }
    return 'idle';
  }

  _drawPanel(ctx) {
    const y0 = this.PANEL_Y;
    const W = this.W;
    // Marco metálico oscuro
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, y0, W, this.H - y0);
    ctx.fillStyle = '#2e2e44';
    ctx.fillRect(0, y0, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y0 + 3, W, 2);
    // Separadores tipo consola
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(112, y0 + 8, 2, 62);
    ctx.fillRect(W - 114, y0 + 8, 2, 62);

    // --- Cara reactiva (centro) ---
    const fx = W / 2 - 30;
    FaceRenderer.draw(ctx, this.player.look, this._faceExpr(), fx, y0 + 6, 60, this.animT);
    ctx.fillStyle = '#888';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.player.name, W / 2, y0 + 78);

    // --- Bloque izquierdo: score ---
    ctx.textAlign = 'left';
    ctx.fillStyle = '#777';
    ctx.font = '9px monospace';
    ctx.fillText('SCORE', 12, y0 + 20);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(String(this.score), 12, y0 + 42);
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText('MEJOR ' + Math.max(this.best, this.score), 12, y0 + 58);
    if (this.streak >= 2) {
      ctx.fillStyle = '#ff9f3f';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('RACHA x' + (1 + 0.25 * Math.min(this.streak, 4)).toFixed(2), 12, y0 + 73);
    }

    // --- Bloque derecho: penales ---
    ctx.textAlign = 'right';
    ctx.fillStyle = '#777';
    ctx.font = '9px monospace';
    ctx.fillText('PENAL ' + Math.min(this.kicksTaken + 1, this.TOTAL_KICKS) + '/' + this.TOTAL_KICKS, W - 12, y0 + 20);
    for (let i = 0; i < this.TOTAL_KICKS; i++) {
      const shot = this.shots[i];
      ctx.beginPath();
      ctx.arc(W - 20 - (this.TOTAL_KICKS - 1 - i) * 20, y0 + 38, 7, 0, Math.PI * 2);
      ctx.fillStyle = !shot ? '#333' : shot.result === 'goal' ? '#3fff8e' : '#ff3f6e';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.fillText('OVR ' + playerOverall(this.player), W - 12, y0 + 62);
  }

  _drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.W, this.PANEL_Y);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('FIN DE LA TANDA', this.W / 2, this.H / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(this.goals + '/' + this.TOTAL_KICKS + ' goles · ' + this.score + ' pts', this.W / 2, this.H / 2 - 20);
  }
}
