/* ============================================================
 * TORNEO DE CEL — ui.js
 * Orquestador: pantallas (single page con estados), perfil de
 * jugador, arranque de modos, flujo de game over, leaderboard UI.
 * ============================================================ */

'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);

  let currentGame = null;
  let lastResult = null;
  let profile = null;
  let lbMode = 'penales';
  let lbRange = 'alltime';
  let rosterPlayer = null; // carta elegida para penales

  /* ---------------- Pantallas ---------------- */

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.toggle('active', s.id === id);
    });
  }

  /* ---------------- Perfil de jugador ---------------- */

  function loadProfile() {
    let p = TDCStorage.get('tdc_profile');
    if (!p) {
      p = {
        id: tdcUUID(),
        nickname: 'PLAYER' + Math.floor(100 + Math.random() * 900),
        country: 'MX',
        handle: ''
      };
      TDCStorage.set('tdc_profile', p);
    }
    return p;
  }

  function syncProfileInputs() {
    $('#inp-nickname').value = profile.nickname;
    $('#inp-country').value = profile.country;
    $('#inp-handle').value = profile.handle;
  }

  function saveProfileFromInputs() {
    profile.nickname = ($('#inp-nickname').value.trim() || profile.nickname).slice(0, 12);
    profile.country = ($('#inp-country').value.trim().toUpperCase() || 'MX').slice(0, 2);
    profile.handle = $('#inp-handle').value.trim().slice(0, 20);
    TDCStorage.set('tdc_profile', profile);
  }

  function refreshBestScores() {
    $('#best-penales').textContent = 'Mejor Penales: ' + TDCStorage.get('tdc_best_penales', 0);
    $('#best-survivor').textContent = 'Mejor Survivor: ' + TDCStorage.get('tdc_best_survivor', 0);
    $('#best-fantasy').textContent = 'Mayor premio Tómbola: 🪙 ' + TDCStorage.get('tdc_best_fantasy', 0);
  }

  /* ---------------- Arranque de juegos ---------------- */

  function startGame(mode, player) {
    saveProfileFromInputs();
    if (currentGame) currentGame.stop();
    if (mode === 'fantasy') {
      // Tómbola FC vive en su propia pantalla DOM (no usa el canvas compartido)
      currentGame = null;
      showScreen('screen-fantasy');
      FantasyGame.start({ onResult: (result) => handleGameOver(result, { show: false }) });
      return;
    }
    showScreen('screen-game');
    const canvas = $('#game-canvas');
    if (mode === 'penales') {
      rosterPlayer = player || rosterPlayer || ROSTER[0];
      currentGame = new PenalesGame(canvas, { onGameOver: handleGameOver, player: rosterPlayer });
    } else {
      currentGame = new SurvivorGame(canvas, { onGameOver: handleGameOver });
    }
    currentGame.start();
  }

  /* ---------------- Selección de carta (penales) ---------------- */

  function renderCardGrid() {
    const grid = $('#card-grid');
    grid.innerHTML = '';
    for (const p of ROSTER) {
      const c = document.createElement('canvas');
      c.width = 150;
      c.height = Math.round(150 * CardRenderer.HEIGHT_RATIO);
      c.className = 'player-card';
      c.title = p.name;
      CardRenderer.draw(c.getContext('2d'), p, 0, 0, 150);
      c.addEventListener('click', () => startGame('penales', p));
      grid.appendChild(c);
    }
  }

  /* ---------------- Game over: score → leaderboard → score card ---------------- */

  async function handleGameOver(result, opts = {}) {
    const show = opts.show !== false;
    if (currentGame) { currentGame.stop(); currentGame = null; }
    lastResult = result;

    const MODE_NAMES = { penales: 'PENALES', survivor: 'SURVIVOR', fantasy: 'TÓMBOLA FC' };
    const modeName = MODE_NAMES[result.mode] || result.mode.toUpperCase();
    $('#go-title').textContent = modeName + ' — ' + result.score + ' PTS';

    const s = result.stats || {};
    const parts = [];
    if (s.goals !== undefined) parts.push(s.goals + '/' + s.kicks + ' goles');
    if (s.perfects !== undefined) parts.push(s.perfects + ' tiros perfectos');
    if (s.maxStreak !== undefined) parts.push('racha máx ' + s.maxStreak);
    if (s.kills !== undefined) parts.push(s.kills + ' aliens eliminados');
    if (s.time !== undefined) parts.push(Math.floor(s.time) + 's sobrevividos');
    if (s.stage !== undefined) parts.push('stage ' + s.stage);
    if (s.weaponLv !== undefined) parts.push('arma nv' + s.weaponLv);
    if (s.chips !== undefined) parts.push(s.chips + ' chips');
    if (s.result !== undefined) parts.push('marcador ' + s.result);
    if (s.bet !== undefined) parts.push('apostó 🪙' + s.bet + ' a ' + (s.betType || '') + ' x' + s.odds);
    if (s.win !== undefined) parts.push(s.win ? '¡cobró 🪙' + s.payout + '!' : 'la casa ganó');
    $('#go-summary').textContent = parts.join(' · ');

    const flavor = ShareCard.pickFlavor(result.mode, result.score);
    $('#go-flavor').textContent = flavor;

    if (show) showScreen('screen-gameover');
    refreshBestScores();

    // Enviar score al leaderboard (o guardarlo local si no hay API/red)
    let rank = null;
    try {
      const res = await LeaderboardAPI.submitScore(profile, result.mode, result.score, result.stats);
      rank = res.rank;
    } catch (e) { /* el juego nunca se rompe por el leaderboard */ }

    // Dibujar la score card 9:16 con el rank ya resuelto
    ShareCard.buildCard($('#card-canvas'), {
      player: profile,
      mode: result.mode,
      score: result.score,
      rank,
      flavor,
      stats: result.stats,
      rosterPlayer: result.mode === 'penales' ? rosterPlayer : null
    });
  }

  /* ---------------- Leaderboard UI ---------------- */

  async function refreshLeaderboard() {
    const list = $('#leaderboard-list');
    list.innerHTML = '<div class="lb-empty">Cargando…</div>';
    let lb;
    try {
      lb = await LeaderboardAPI.getLeaderboard({
        mode: lbMode, range: lbRange, limit: 10, playerId: profile.id
      });
    } catch (e) {
      list.innerHTML = '<div class="lb-empty">No se pudo cargar :(</div>';
      return;
    }

    if (!lb.entries.length) {
      list.innerHTML = '<div class="lb-empty">Aún no hay scores.<br>¡Sé el primero!</div>';
      return;
    }

    list.innerHTML = '';
    let meInTop = false;
    for (const e of lb.entries) {
      const isMe = e.player.id === profile.id;
      if (isMe) meInTop = true;
      list.appendChild(lbRow(e.rank, e.player, e.score, isMe));
    }
    // Si el jugador actual no está en el top 10, lo mostramos abajo
    if (lb.me && !meInTop) {
      const sep = document.createElement('div');
      sep.className = 'lb-sep';
      sep.textContent = '· · ·';
      list.appendChild(sep);
      list.appendChild(lbRow(lb.me.rank, profile, lb.me.score, true));
    }
  }

  function lbRow(rank, player, score, isMe) {
    const row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' me' : '');
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = player.nickname + (isMe ? ' (tú)' : '');
    row.innerHTML = '<span class="lb-rank">#' + rank + '</span>';
    row.appendChild(name);
    const country = document.createElement('span');
    country.className = 'lb-country';
    country.textContent = player.country || '';
    row.appendChild(country);
    const sc = document.createElement('span');
    sc.className = 'lb-score';
    sc.textContent = score;
    row.appendChild(sc);
    return row;
  }

  function bindTabs(containerSel, attr, onChange) {
    $(containerSel).addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      document.querySelectorAll(containerSel + ' .tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset[attr]);
    });
  }

  /* ---------------- Wiring ---------------- */

  function init() {
    profile = loadProfile();
    syncProfileInputs();
    refreshBestScores();

    $('#btn-penales').addEventListener('click', () => {
      saveProfileFromInputs();
      renderCardGrid();
      showScreen('screen-select');
    });
    $('#btn-select-back').addEventListener('click', () => showScreen('screen-menu'));
    $('#btn-survivor').addEventListener('click', () => startGame('survivor'));
    $('#btn-fantasy').addEventListener('click', () => startGame('fantasy'));
    $('#btn-fantasy-back').addEventListener('click', () => {
      FantasyGame.stop();
      showScreen('screen-menu');
      refreshBestScores();
    });

    // Hooks que usa fantasy.js para volver al menú / abrir la score card
    window.TDC_backToMenu = () => { showScreen('screen-menu'); refreshBestScores(); };
    window.TDC_showGameOver = () => showScreen('screen-gameover');

    $('#btn-quit').addEventListener('click', () => {
      if (currentGame) { currentGame.stop(); currentGame = null; }
      showScreen('screen-menu');
      refreshBestScores();
    });

    $('#btn-leaderboard').addEventListener('click', () => {
      saveProfileFromInputs();
      showScreen('screen-leaderboard');
      refreshLeaderboard();
    });
    $('#btn-lb-back').addEventListener('click', () => showScreen('screen-menu'));
    bindTabs('#tabs-mode', 'mode', (m) => { lbMode = m; refreshLeaderboard(); });
    bindTabs('#tabs-range', 'range', (r) => { lbRange = r; refreshLeaderboard(); });

    $('#btn-retry').addEventListener('click', () => {
      if (lastResult) startGame(lastResult.mode);
    });
    $('#btn-go-menu').addEventListener('click', () => {
      showScreen('screen-menu');
      refreshBestScores();
    });
    $('#btn-download-card').addEventListener('click', () => {
      if (!lastResult) return;
      ShareCard.download($('#card-canvas'),
        'torneo-de-cel-' + lastResult.mode + '-' + lastResult.score + '.png');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
