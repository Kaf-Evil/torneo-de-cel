/* ============================================================
 * TORNEO DE CEL — share.js
 * Score Card 9:16 (1080x1920) exportable como imagen para
 * stories/reels. Todo se dibuja en canvas: cero assets externos.
 * ============================================================ */

'use strict';

const ShareCard = {
  W: 1080,
  H: 1920,

  /* ---------- Flavor text ----------
   * NOTA DE INTEGRACIÓN CON IA: este es el punto de enchufe.
   * En lugar de elegir una frase de estas listas, puedes mandar
   * { mode, score, stats, tier } a un LLM y pedir una frase nueva
   * con el mismo tono; estas plantillas sirven como few-shot examples.
   * No hay ninguna llamada a modelos en este código. */
  FLAVOR: {
    high: [
      'Tu cel hoy está a nivel LEYENDA DEL BARRIO',
      'Tu cel hoy está a nivel jefe final con lentes oscuros',
      'Tu cel hoy está a nivel \"me retiro invicto\"',
      'Tu cel hoy está a nivel 5G en el desierto'
    ],
    mid: [
      'Tu cel hoy está a nivel taquito de suerte',
      'Tu cel hoy está a nivel \"casi casi, compa\"',
      'Tu cel hoy está a nivel banca del equipo titular',
      'Tu cel hoy está a nivel 60% de batería: se puede'
    ],
    low: [
      'Tu cel hoy está a nivel señal de 1 barrita',
      'Tu cel hoy está a nivel Nokia mojado en arroz',
      'Tu cel hoy está a nivel \"mejor mañana lo intento\"',
      'Tu cel hoy está a nivel modo avión emocional'
    ]
  },
  THRESHOLDS: {
    penales: { high: 600, mid: 300 },
    survivor: { high: 1500, mid: 600 }
  },

  pickFlavor(mode, score) {
    const t = this.THRESHOLDS[mode] || this.THRESHOLDS.penales;
    const tier = score >= t.high ? 'high' : score >= t.mid ? 'mid' : 'low';
    const list = this.FLAVOR[tier];
    return list[Math.floor(Math.random() * list.length)];
  },

  /* ---------- Sprites 8-bit (matrices de pixeles) ---------- */
  SPRITES: {
    penales: {
      palette: { 1: '#f2c094', 2: '#111111', 3: '#3fd2ff', 4: '#ffffff', 5: '#1a7a3c' },
      grid: [
        [0,0,2,2,2,2,0,0],
        [0,2,1,1,1,1,2,0],
        [0,2,1,2,1,2,2,0],
        [0,2,1,1,1,1,2,0],
        [0,0,2,1,1,2,0,0],
        [0,3,3,3,3,3,3,0],
        [3,3,4,3,3,4,3,3],
        [3,3,3,3,3,3,3,3],
        [0,3,3,3,3,3,3,0],
        [0,0,5,5,5,5,0,0],
        [0,0,5,0,0,5,0,0],
        [0,2,2,0,0,2,2,0]
      ]
    },
    survivor: {
      palette: { 1: '#c0c0d8', 2: '#111111', 3: '#3fff8e', 4: '#ff3f6e', 5: '#555577' },
      grid: [
        [0,0,5,5,5,5,0,0],
        [0,5,3,3,3,3,5,0],
        [0,5,3,2,2,3,5,0],
        [0,5,3,3,3,3,5,0],
        [0,0,5,5,5,5,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,4,1,1,4,1,1],
        [1,1,1,1,1,1,1,4],
        [0,1,1,1,1,1,1,4],
        [0,0,1,1,1,1,0,0],
        [0,0,1,0,0,1,0,0],
        [0,2,2,0,0,2,2,0]
      ]
    }
  },

  _drawSprite(ctx, sprite, x, y, px) {
    for (let r = 0; r < sprite.grid.length; r++) {
      for (let c = 0; c < sprite.grid[r].length; c++) {
        const v = sprite.grid[r][c];
        if (!v) continue;
        ctx.fillStyle = sprite.palette[v];
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  },

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
    return y;
  },

  /**
   * Dibuja la score card en el canvas dado (lo redimensiona a 1080x1920).
   * result = { player, mode, score, rank, flavor, stats, rosterPlayer? }
   * Si viene rosterPlayer (modo penales), en lugar del sprite genérico se
   * dibuja la carta FIFA del jugador con cara feliz o llorando según score.
   * Devuelve el canvas para encadenar (toDataURL / download).
   */
  buildCard(canvas, result) {
    const { player, mode, score, rank, flavor, stats, rosterPlayer } = result;
    canvas.width = this.W;
    canvas.height = this.H;
    const ctx = canvas.getContext('2d');
    const W = this.W, H = this.H;

    // Fondo: gradiente oscuro + scanlines retro
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1a3e');
    g.addColorStop(0.5, '#0d0d1a');
    g.addColorStop(1, '#2e0d2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);

    // Marco
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 12;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.textAlign = 'center';

    // Título del torneo
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 90px \"Courier New\", monospace';
    ctx.fillText('TORNEO DE CEL', W / 2, 200);

    // Modo jugado
    ctx.fillStyle = '#3fd2ff';
    ctx.font = 'bold 64px \"Courier New\", monospace';
    ctx.fillText(mode === 'penales' ? '- MODO PENALES -' : '- MODO SURVIVOR -', W / 2, 310);

    if (rosterPlayer && typeof CardRenderer !== 'undefined') {
      // Carta FIFA del jugador elegido: sonríe con buen score, llora con malo
      const t = this.THRESHOLDS[mode] || this.THRESHOLDS.penales;
      const expr = score >= t.mid ? 'happy' : 'sad';
      const cw = 400;
      CardRenderer.draw(ctx, rosterPlayer, (W - cw) / 2, 370, cw, { expr });
      ctx.textAlign = 'center';
    } else {
      // Personaje 8-bit genérico (survivor)
      const sprite = this.SPRITES[mode] || this.SPRITES.penales;
      const px = 34;
      const spriteW = sprite.grid[0].length * px;
      this._drawSprite(ctx, sprite, (W - spriteW) / 2, 420, px);
    }

    // Nickname
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px \"Courier New\", monospace';
    ctx.fillText((player && player.nickname) || 'PLAYER', W / 2, 1050);
    if (player && player.handle) {
      ctx.fillStyle = '#888';
      ctx.font = '44px \"Courier New\", monospace';
      ctx.fillText(player.handle, W / 2, 1110);
    }

    // Score gigante
    ctx.fillStyle = '#3fff8e';
    ctx.font = 'bold 180px \"Courier New\", monospace';
    ctx.fillText(String(score), W / 2, 1300);
    ctx.fillStyle = '#aaa';
    ctx.font = '46px \"Courier New\", monospace';
    ctx.fillText('PUNTOS', W / 2, 1365);

    // Rank en leaderboard (si está disponible)
    if (rank) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 58px \"Courier New\", monospace';
      ctx.fillText('#' + rank + ' EN EL MUNDO', W / 2, 1460);
    }

    // Stats breves
    if (stats) {
      ctx.fillStyle = '#3fd2ff';
      ctx.font = '42px \"Courier New\", monospace';
      const bits = [];
      if (stats.goals !== undefined) bits.push(stats.goals + ' goles');
      if (stats.perfects !== undefined) bits.push(stats.perfects + ' perfectos');
      if (stats.kills !== undefined) bits.push(stats.kills + ' aliens');
      if (stats.time !== undefined) bits.push(Math.floor(stats.time) + 's vivo');
      ctx.fillText(bits.join('  ·  '), W / 2, 1535);
    }

    // Flavor text (con word-wrap)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 48px \"Courier New\", monospace';
    this._wrapText(ctx, '\"' + (flavor || '') + '\"', W / 2, 1630, W - 200, 60);

    // Logo pequeño abajo
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 40px \"Courier New\", monospace';
    ctx.fillText('[ TORNEO DE CEL ]', W / 2, H - 110);
    ctx.fillStyle = '#666';
    ctx.font = '32px \"Courier New\", monospace';
    ctx.fillText('juega en tu navegador', W / 2, H - 65);

    return canvas;
  },

  /* Exporta el canvas como dataURL PNG (para compartir/subir) */
  toDataURL(canvas) {
    return canvas.toDataURL('image/png');
  },

  /* Descarga la card como archivo PNG */
  download(canvas, filename = 'torneo-de-cel-score.png') {
    const a = document.createElement('a');
    a.href = this.toDataURL(canvas);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
