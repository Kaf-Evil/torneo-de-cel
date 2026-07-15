/* ============================================================
 * TORNEO DE CEL — players.js
 * Roster de jugadores con stats estilo FIFA + renderers:
 *   - FaceRenderer: cara pixel-art con expresiones (idle, tense,
 *     happy, sad) — la misma cara se usa en la carta, en el HUD
 *     estilo Doom del modo penales y en la score card.
 *   - CardRenderer: carta de jugador estilo FIFA dibujada en canvas.
 *
 * Los stats NO son decorativos, afectan el gameplay de penales:
 *   POT (potencia)  → tiros más difíciles de atajar
 *   PRE (precisión) → ventana de tiro perfecto más ancha
 *   SER (serenidad) → la barra de potencia oscila más lento
 *   PIC (picardía)  → el portero te "lee" menos
 * ============================================================ */

'use strict';

const ROSTER = [
  {
    id: 'trueno', name: 'EL TRUENO', country: 'MX',
    stats: { POT: 94, PRE: 70, SER: 66, PIC: 62 },
    look: { skin: '#f2c094', hair: '#1a1a1a', style: 'spiky', shirt: '#ff3f6e' }
  },
  {
    id: 'magia', name: 'LA MAGIA', country: 'BR',
    stats: { POT: 68, PRE: 93, SER: 74, PIC: 85 },
    look: { skin: '#8d5a2b', hair: '#111111', style: 'afro', shirt: '#ffd23f' }
  },
  {
    id: 'dongol', name: 'DON GOL', country: 'AR',
    stats: { POT: 80, PRE: 82, SER: 88, PIC: 70 },
    look: { skin: '#e8b07f', hair: '#666666', style: 'flat', beard: '#666666', shirt: '#3fd2ff' }
  },
  {
    id: 'jefa', name: 'LA JEFA', country: 'MX',
    stats: { POT: 76, PRE: 84, SER: 90, PIC: 78 },
    look: { skin: '#d99a6c', hair: '#3a1f0e', style: 'long', shirt: '#3fff8e' }
  },
  {
    id: 'ponchito', name: 'PONCHITO', country: 'MX',
    stats: { POT: 88, PRE: 62, SER: 58, PIC: 90 },
    look: { skin: '#f2c094', hair: '#222222', style: 'cap', cap: '#ff3f6e', shirt: '#b26eff' }
  },
  {
    id: 'nino', name: 'EL NIÑO', country: 'ES',
    stats: { POT: 72, PRE: 78, SER: 64, PIC: 96 },
    look: { skin: '#f7d7b0', hair: '#c98a2d', style: 'flat', shirt: '#ff9f3f' }
  }
];

function playerOverall(p) {
  const s = p.stats;
  return Math.round((s.POT + s.PRE + s.SER + s.PIC) / 4);
}

/* ============================================================
 * FaceRenderer — cara 8-bit procedural en una grilla de 16x16.
 * draw(ctx, look, expr, x, y, size, t)
 *   expr: 'idle' | 'tense' | 'happy' | 'sad'
 *   t: tiempo en segundos (anima parpadeo, lágrimas, sudor)
 * ============================================================ */
const FaceRenderer = {
  draw(ctx, look, expr, x, y, size, t = 0) {
    const u = size / 16;
    const R = (cx, cy, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(x + cx * u, y + cy * u, w * u, h * u);
    };
    const skin = look.skin, hair = look.hair;
    const dark = '#181818';

    // ---- Pelo trasero (estilos con volumen) ----
    if (look.style === 'afro') {
      R(2.5, 0, 11, 5, hair);
      R(1.8, 2, 12.4, 4, hair);
      R(2, 5, 2, 4, hair);
      R(12, 5, 2, 4, hair);
    } else if (look.style === 'long') {
      R(3, 0.6, 10, 3, hair);
      R(2, 2.5, 2.2, 10.5, hair);
      R(11.8, 2.5, 2.2, 10.5, hair);
    }

    // ---- Cabeza ----
    R(4, 2, 8, 11, skin);
    R(3.4, 3.5, 0.8, 8, skin);
    R(11.8, 3.5, 0.8, 8, skin);
    // Orejas
    R(2.6, 7, 1, 2, skin);
    R(12.4, 7, 1, 2, skin);

    // ---- Pelo frontal ----
    if (look.style === 'spiky') {
      R(4, 1, 8, 2, hair);
      for (let i = 0; i < 4; i++) R(4.3 + i * 2, 0, 1.2, 1.2, hair);
      R(4, 3, 1.4, 1.6, hair);
      R(10.6, 3, 1.4, 1.6, hair);
    } else if (look.style === 'flat') {
      R(4, 1, 8, 2.2, hair);
      R(4, 3.2, 1.2, 1.2, hair);
      R(10.8, 3.2, 1.2, 1.2, hair);
    } else if (look.style === 'afro') {
      R(4, 1, 8, 2.2, hair);
    } else if (look.style === 'long') {
      R(4, 1, 8, 2, hair);
    } else if (look.style === 'cap') {
      R(3.6, 0.4, 8.8, 2.8, look.cap || '#ff3f6e');
      R(9.5, 3, 4.2, 0.9, look.cap || '#ff3f6e'); // visera
      R(4, 3.2, 1.4, 1, hair);
    }

    // ---- Barba (opcional) ----
    if (look.beard) {
      R(4, 9.6, 1.2, 3.4, look.beard);
      R(10.8, 9.6, 1.2, 3.4, look.beard);
      R(4, 11.6, 8, 1.4, look.beard);
    }

    // ---- Cejas + ojos + boca según expresión ----
    const browCol = hair === '#c98a2d' ? '#8a5a10' : '#181818';
    if (expr === 'idle') {
      R(5.3, 4.8, 1.9, 0.6, browCol);
      R(8.8, 4.8, 1.9, 0.6, browCol);
      const blink = (t % 3.4) < 0.14;
      if (blink) {
        R(5.7, 6.5, 1.1, 0.4, dark);
        R(9.2, 6.5, 1.1, 0.4, dark);
      } else {
        R(5.7, 5.9, 1.1, 1.3, dark);
        R(9.2, 5.9, 1.1, 1.3, dark);
      }
      R(6.2, 10.6, 3.6, 0.7, '#8a4a3a'); // boca neutra
    } else if (expr === 'tense') {
      // Cejas fruncidas (escalonadas hacia adentro)
      R(5.2, 4.9, 1, 0.6, browCol);
      R(6.1, 5.3, 1, 0.6, browCol);
      R(8.9, 5.3, 1, 0.6, browCol);
      R(9.8, 4.9, 1, 0.6, browCol);
      // Ojos entrecerrados
      R(5.7, 6.2, 1.1, 0.7, dark);
      R(9.2, 6.2, 1.1, 0.7, dark);
      // Dientes apretados
      R(5.9, 10.3, 4.2, 1.2, '#ffffff');
      R(5.9, 10.3, 4.2, 0.18, dark);
      for (let i = 1; i < 4; i++) R(5.9 + i * 1.05, 10.3, 0.18, 1.2, dark);
      R(5.9, 11.32, 4.2, 0.18, dark);
      // Gota de sudor animada
      const sy = (t * 4) % 3;
      R(12.6, 4.5 + sy, 0.7, 1, '#7fdcff');
    } else if (expr === 'happy') {
      R(5.3, 4.6, 1.9, 0.6, browCol);
      R(8.8, 4.6, 1.9, 0.6, browCol);
      // Ojos cerrados felices (^ ^)
      R(5.3, 6.2, 0.7, 0.5, dark); R(5.95, 5.7, 0.8, 0.5, dark); R(6.7, 6.2, 0.7, 0.5, dark);
      R(8.8, 6.2, 0.7, 0.5, dark); R(9.45, 5.7, 0.8, 0.5, dark); R(10.2, 6.2, 0.7, 0.5, dark);
      // Cachetes
      R(4.1, 8.2, 1.1, 0.8, 'rgba(255,120,120,0.55)');
      R(10.8, 8.2, 1.1, 0.8, 'rgba(255,120,120,0.55)');
      // Sonrisota con dientes
      R(5.6, 9.9, 4.8, 1.6, '#7a2418');
      R(5.6, 9.9, 4.8, 0.7, '#ffffff');
      R(5, 9.2, 0.8, 0.9, dark);
      R(10.2, 9.2, 0.8, 0.9, dark);
    } else if (expr === 'sad') {
      // Cejas de tristeza (levantadas hacia adentro)
      R(5.2, 5.4, 1, 0.6, browCol);
      R(6.1, 5.0, 1, 0.6, browCol);
      R(8.9, 5.0, 1, 0.6, browCol);
      R(9.8, 5.4, 1, 0.6, browCol);
      R(5.7, 5.9, 1.1, 1.3, dark);
      R(9.2, 5.9, 1.1, 1.3, dark);
      // Brillo húmedo + lágrimas cayendo (animadas)
      R(5.6, 7.3, 1.3, 0.4, 'rgba(79,195,255,0.6)');
      R(9.1, 7.3, 1.3, 0.4, 'rgba(79,195,255,0.6)');
      const ty1 = (t * 5) % 3.6;
      const ty2 = (t * 5 + 1.8) % 3.6;
      R(5.9, 7.6 + ty1, 0.7, 1.1, '#4fc3ff');
      R(9.4, 7.6 + ty2, 0.7, 1.1, '#4fc3ff');
      // Boca de puchero abierta
      R(6.3, 10.4, 3.4, 1.4, '#7a2418');
      R(5.6, 11.3, 0.8, 0.8, dark);
      R(9.7, 11.3, 0.8, 0.8, dark);
    }

    // ---- Cuello + jersey ----
    R(6.5, 13, 3, 1, skin);
    R(3, 14, 10, 2, look.shirt);
    R(6.4, 13.9, 3.2, 0.6, '#ffffff');
  }
};

/* ============================================================
 * CardRenderer — carta estilo FIFA (escudo dorado) en canvas.
 * draw(ctx, player, x, y, w, {expr, t})
 * La altura es w * 1.45.
 * ============================================================ */
const CardRenderer = {
  HEIGHT_RATIO: 1.45,

  draw(ctx, player, x, y, w, opts = {}) {
    const expr = opts.expr || 'idle';
    const t = opts.t || 0;
    const h = w * this.HEIGHT_RATIO;
    const dark = '#3a2c0f';

    ctx.save();

    // ---- Silueta de escudo ----
    ctx.beginPath();
    ctx.moveTo(x + w * 0.10, y);
    ctx.lineTo(x + w * 0.90, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.10);
    ctx.lineTo(x + w, y + h * 0.74);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.lineTo(x, y + h * 0.74);
    ctx.lineTo(x, y + h * 0.10);
    ctx.quadraticCurveTo(x, y, x + w * 0.10, y);
    ctx.closePath();

    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#f5dd8a');
    g.addColorStop(0.45, '#e3bd55');
    g.addColorStop(1, '#b8912f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.022);
    ctx.strokeStyle = '#6b5115';
    ctx.stroke();

    // Brillo diagonal
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y);
    ctx.lineTo(x + w * 0.80, y);
    ctx.lineTo(x + w * 0.35, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const mono = '"Courier New", monospace';

    // ---- OVR + posición + país (columna izquierda) ----
    ctx.textAlign = 'left';
    ctx.fillStyle = dark;
    ctx.font = 'bold ' + w * 0.21 + 'px ' + mono;
    ctx.fillText(String(playerOverall(player)), x + w * 0.08, y + h * 0.17);
    ctx.font = 'bold ' + w * 0.085 + 'px ' + mono;
    ctx.fillText('PEN', x + w * 0.08, y + h * 0.235);
    ctx.fillText(player.country, x + w * 0.08, y + h * 0.30);

    // ---- Cara ----
    FaceRenderer.draw(ctx, player.look, expr, x + w * 0.36, y + h * 0.055, w * 0.48, t);

    // ---- Nombre ----
    ctx.textAlign = 'center';
    let nameSize = w * 0.105;
    ctx.font = 'bold ' + nameSize + 'px ' + mono;
    while (ctx.measureText(player.name).width > w * 0.86 && nameSize > w * 0.06) {
      nameSize *= 0.92;
      ctx.font = 'bold ' + nameSize + 'px ' + mono;
    }
    ctx.fillStyle = dark;
    ctx.fillText(player.name, x + w / 2, y + h * 0.585);

    // Separador
    ctx.strokeStyle = 'rgba(58,44,15,0.5)';
    ctx.lineWidth = Math.max(1, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.14, y + h * 0.625);
    ctx.lineTo(x + w * 0.86, y + h * 0.625);
    ctx.stroke();

    // ---- Stats (2 columnas x 2 filas) ----
    const s = player.stats;
    const rows = [
      [['POT', s.POT], ['SER', s.SER]],
      [['PRE', s.PRE], ['PIC', s.PIC]]
    ];
    ctx.font = 'bold ' + w * 0.082 + 'px ' + mono;
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 2; row++) {
        const [label, val] = rows[row][col];
        const sx = x + w * (col === 0 ? 0.17 : 0.57);
        const sy = y + h * (0.695 + row * 0.075);
        ctx.textAlign = 'left';
        ctx.fillStyle = val >= 90 ? '#8a1f1f' : dark;
        ctx.fillText(String(val), sx, sy);
        ctx.fillStyle = 'rgba(58,44,15,0.75)';
        ctx.fillText(label, sx + w * 0.14, sy);
      }
    }

    // ---- Logo ----
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(58,44,15,0.6)';
    ctx.font = 'bold ' + w * 0.055 + 'px ' + mono;
    ctx.fillText('TORNEO DE CEL', x + w / 2, y + h * 0.90);

    ctx.restore();
  }
};
