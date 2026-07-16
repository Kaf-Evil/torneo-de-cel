/* ============================================================
 * TORNEO DE CEL — fantasy.js  (TÓMBOLA FC v1.0)
 * Juego rápido de fantasy + apuestas estilo casino:
 *   1. Eliges formación (4-4-2, 4-3-3, 3-5-2, 5-3-2, 3-4-3)
 *   2. La TÓMBOLA te sortea 11 personajes famosos (parodia):
 *      ídolos k-pop, artistas, leyendas y cracks actuales.
 *   3. Alineas: ajuste AUTO gratis, ajustes manuales cuestan monedas.
 *   4. Apuestas contra un rival generado (marcador exacto o 1X2)
 *      con cuotas calculadas con lógica de casino (ventaja de la casa).
 *   5. Ves la simulación del partido y cobras (o lloras).
 *
 * Economía: monedas persistentes (inician en 1000). Los ajustes
 * manuales y las apuestas se descuentan de ahí. Rescate diario si quiebras.
 *
 * Leaderboard EXCLUSIVO (mode 'fantasy'): se compite por la mayor
 * ganancia neta en una sola apuesta. No entra al score "Total".
 *
 * Torneo entre amigos: pass-and-play local en el mismo cel, cada
 * amigo arma su equipo y apuesta con 1000 monedas temporales; tabla
 * final sin clasificación global (no toca el leaderboard mundial).
 *
 * Depende de: TDCStorage (leaderboard.js), FaceRenderer (players.js).
 * ============================================================ */

'use strict';

const FantasyGame = (() => {

  /* =================== ROSTER PARÓDICO =================== */
  // cat: KPOP | POP | LEYENDA | PRO — pos natural: GK | DEF | MID | FWD
  const L = (skin, hair, style, shirt, extra) => Object.assign({ skin, hair, style, shirt }, extra || {});
  const POOL = [
    // ---- K-POP ----
    { id: 'jhoon',   name: 'JHOON K',        cat: 'KPOP', country: 'KR', pos: 'FWD', ovr: 74, look: L('#f7d7b0', '#3a2a6e', 'flat', '#b26eff') },
    { id: 'minsol',  name: 'MIN-SOL',        cat: 'KPOP', country: 'KR', pos: 'MID', ovr: 70, look: L('#f7d7b0', '#111111', 'spiky', '#ff6ec7') },
    { id: 'taegol',  name: 'TAE-GOL',        cat: 'KPOP', country: 'KR', pos: 'FWD', ovr: 77, look: L('#f2c094', '#7a1fa8', 'spiky', '#3fd2ff') },
    { id: 'lissa',   name: 'LISSA NOVA',     cat: 'KPOP', country: 'TH', pos: 'MID', ovr: 72, look: L('#f2c094', '#1a1a1a', 'long', '#ffd23f') },
    { id: 'djseul',  name: 'DJ SEÚL',        cat: 'KPOP', country: 'KR', pos: 'GK',  ovr: 63, look: L('#f7d7b0', '#222222', 'cap', '#3fff8e', { cap: '#111111' }) },
    { id: 'baebeat', name: 'BAE BEAT',       cat: 'KPOP', country: 'KR', pos: 'DEF', ovr: 66, look: L('#f7d7b0', '#c98a2d', 'flat', '#ff3f6e') },
    { id: 'parkv',   name: 'PARK VOCAL',     cat: 'KPOP', country: 'KR', pos: 'DEF', ovr: 64, look: L('#f2c094', '#111111', 'flat', '#ffffff') },
    { id: 'iunita',  name: 'IU-NITA',        cat: 'KPOP', country: 'KR', pos: 'MID', ovr: 69, look: L('#f7d7b0', '#3a1f0e', 'long', '#b26eff') },
    { id: 'gdx',     name: 'G-DRAGÓN X',     cat: 'KPOP', country: 'KR', pos: 'FWD', ovr: 71, look: L('#f7d7b0', '#e8e8e8', 'spiky', '#111111') },
    { id: 'rosef',   name: 'ROSÉ FINA',      cat: 'KPOP', country: 'NZ', pos: 'DEF', ovr: 65, look: L('#f7d7b0', '#e8b07f', 'long', '#ff9f3f') },
    // ---- ARTISTAS POP ----
    { id: 'badcon',  name: 'BAD CONEJO',     cat: 'POP', country: 'PR', pos: 'FWD', ovr: 78, look: L('#d99a6c', '#111111', 'flat', '#3fff8e', { beard: '#222222' }) },
    { id: 'shaki',   name: 'LA SHAKI',       cat: 'POP', country: 'CO', pos: 'MID', ovr: 80, look: L('#e8b07f', '#c98a2d', 'long', '#ffd23f') },
    { id: 'weeknd',  name: 'EL WEEKND',      cat: 'POP', country: 'CA', pos: 'FWD', ovr: 72, look: L('#8d5a2b', '#111111', 'afro', '#ff3f6e') },
    { id: 'taylor',  name: 'TAYLOR RÁPIDA',  cat: 'POP', country: 'US', pos: 'MID', ovr: 76, look: L('#f7d7b0', '#e8d48a', 'long', '#b26eff') },
    { id: 'pesop',   name: 'PESO PACHUCA',   cat: 'POP', country: 'MX', pos: 'FWD', ovr: 70, look: L('#e8b07f', '#1a1a1a', 'cap', '#111111', { cap: '#3fd2ff' }) },
    { id: 'dualuna', name: 'DUA LUNA',       cat: 'POP', country: 'GB', pos: 'DEF', ovr: 71, look: L('#e8b07f', '#111111', 'long', '#3fd2ff') },
    { id: 'karolj',  name: 'KAROL J',        cat: 'POP', country: 'CO', pos: 'MID', ovr: 73, look: L('#e8b07f', '#ff4f9e', 'long', '#ff6ec7') },
    { id: 'drako',   name: 'DRAKO',          cat: 'POP', country: 'CA', pos: 'DEF', ovr: 62, look: L('#8d5a2b', '#111111', 'flat', '#ffd23f', { beard: '#111111' }) },
    { id: 'billie',  name: 'BILLIE OJITOS',  cat: 'POP', country: 'US', pos: 'GK',  ovr: 68, look: L('#f7d7b0', '#1f6e3a', 'long', '#3fff8e') },
    { id: 'rauw',    name: 'RAUW ALE',       cat: 'POP', country: 'PR', pos: 'DEF', ovr: 67, look: L('#d99a6c', '#222222', 'spiky', '#ffffff') },
    // ---- LEYENDAS ----
    { id: 'pelusa',  name: 'EL PELUSA',      cat: 'LEYENDA', country: 'AR', pos: 'FWD', ovr: 97, look: L('#e8b07f', '#1a1a1a', 'afro', '#3fd2ff') },
    { id: 'orei',    name: 'O REI',          cat: 'LEYENDA', country: 'BR', pos: 'FWD', ovr: 96, look: L('#8d5a2b', '#111111', 'flat', '#ffd23f') },
    { id: 'fenom',   name: 'EL FENÓMENO',    cat: 'LEYENDA', country: 'BR', pos: 'FWD', ovr: 94, look: L('#d99a6c', '#111111', 'flat', '#3fff8e') },
    { id: 'zizou',   name: 'ZIZOU Z',        cat: 'LEYENDA', country: 'FR', pos: 'MID', ovr: 95, look: L('#e8b07f', '#555555', 'flat', '#ffffff') },
    { id: 'saniker', name: 'SAN IKER',       cat: 'LEYENDA', country: 'ES', pos: 'GK',  ovr: 91, look: L('#f2c094', '#222222', 'flat', '#3fff8e') },
    { id: 'kaiser',  name: 'EL KÁISER',      cat: 'LEYENDA', country: 'DE', pos: 'DEF', ovr: 95, look: L('#f7d7b0', '#c98a2d', 'flat', '#ffffff') },
    { id: 'ilmuro',  name: 'PAOLO IL MURO',  cat: 'LEYENDA', country: 'IT', pos: 'DEF', ovr: 93, look: L('#e8b07f', '#1a1a1a', 'flat', '#3fd2ff') },
    { id: 'didi',    name: 'DIDÍ DIEZ',      cat: 'LEYENDA', country: 'BR', pos: 'MID', ovr: 88, look: L('#8d5a2b', '#111111', 'flat', '#ffd23f') },
    { id: 'hugol',   name: 'HUGOL',          cat: 'LEYENDA', country: 'MX', pos: 'FWD', ovr: 90, look: L('#e8b07f', '#1a1a1a', 'flat', '#3fff8e', { beard: '#1a1a1a' }) },
    { id: 'kitneon', name: 'KIT NEÓN',       cat: 'LEYENDA', country: 'MX', pos: 'GK',  ovr: 87, look: L('#d99a6c', '#111111', 'cap', '#ff9f3f', { cap: '#3fff8e' }) },
    { id: 'capitano',name: 'IL CAPITANO',    cat: 'LEYENDA', country: 'IT', pos: 'MID', ovr: 89, look: L('#e8b07f', '#3a1f0e', 'flat', '#ff3f6e') },
    { id: 'pajaro',  name: 'PÁJARO LOCO',    cat: 'LEYENDA', country: 'BR', pos: 'FWD', ovr: 92, look: L('#d99a6c', '#111111', 'spiky', '#ffd23f') },
    // ---- CRACKS ACTUALES ----
    { id: 'liogoat', name: 'LIO GOAT',       cat: 'PRO', country: 'AR', pos: 'FWD', ovr: 95, look: L('#e8b07f', '#3a1f0e', 'flat', '#3fd2ff', { beard: '#3a1f0e' }) },
    { id: 'bicho',   name: 'EL BICHO SIU',   cat: 'PRO', country: 'PT', pos: 'FWD', ovr: 94, look: L('#e8b07f', '#111111', 'spiky', '#ff3f6e') },
    { id: 'kiki',    name: 'KIKI TURBO',     cat: 'PRO', country: 'FR', pos: 'FWD', ovr: 93, look: L('#8d5a2b', '#111111', 'flat', '#3fd2ff') },
    { id: 'erling',  name: 'ERLING BOT',     cat: 'PRO', country: 'NO', pos: 'FWD', ovr: 92, look: L('#f7d7b0', '#e8d48a', 'long', '#7fdcff') },
    { id: 'vini',    name: 'VINI BAILE',     cat: 'PRO', country: 'BR', pos: 'FWD', ovr: 90, look: L('#8d5a2b', '#111111', 'spiky', '#ffffff') },
    { id: 'belling', name: 'BELLIN-GOAL',    cat: 'PRO', country: 'GB', pos: 'MID', ovr: 90, look: L('#8d5a2b', '#111111', 'flat', '#ffd23f') },
    { id: 'chef',    name: 'KEVIN EL CHEF',  cat: 'PRO', country: 'BE', pos: 'MID', ovr: 91, look: L('#f7d7b0', '#c98a2d', 'flat', '#7fdcff') },
    { id: 'rodri',   name: 'RODRI RELOJ',    cat: 'PRO', country: 'ES', pos: 'MID', ovr: 89, look: L('#e8b07f', '#222222', 'flat', '#ff9f3f') },
    { id: 'vanduque',name: 'VAN DUQUE',      cat: 'PRO', country: 'NL', pos: 'DEF', ovr: 90, look: L('#8d5a2b', '#111111', 'flat', '#ff3f6e', { beard: '#111111' }) },
    { id: 'achraf',  name: 'ACHRAF TREN',    cat: 'PRO', country: 'MA', pos: 'DEF', ovr: 88, look: L('#d99a6c', '#111111', 'flat', '#3fff8e') },
    { id: 'dibu',    name: 'DIBU ATAJATODO', cat: 'PRO', country: 'AR', pos: 'GK',  ovr: 91, look: L('#e8b07f', '#1a1a1a', 'flat', '#ffd23f', { beard: '#1a1a1a' }) },
    { id: 'terg',    name: 'TER GIGANTE',    cat: 'PRO', country: 'DE', pos: 'GK',  ovr: 87, look: L('#f7d7b0', '#c98a2d', 'flat', '#b26eff') }
  ];

  const CAT_COLOR = { KPOP: '#ff6ec7', POP: '#b26eff', LEYENDA: '#ffd23f', PRO: '#3fd2ff' };
  const CAT_LABEL = { KPOP: 'K-POP', POP: 'ARTISTA', LEYENDA: 'LEYENDA', PRO: 'CRACK' };

  /* =================== FORMACIONES Y ESTILOS =================== */
  const FORMATIONS = {
    '4-4-2': [4, 4, 2],
    '4-3-3': [4, 3, 3],
    '3-5-2': [3, 5, 2],
    '5-3-2': [5, 3, 2],
    '3-4-3': [3, 4, 3]
  };
  const STYLES = {
    ofensivo:    { label: '🔥 OFENSIVO',   atk: +0.50, def: +0.35, desc: 'más goles tuyos… y del rival' },
    equilibrado: { label: '⚖️ EQUILIBRADO', atk: 0,     def: 0,     desc: 'ni fu ni fa, puro fútbol' },
    defensivo:   { label: '🧱 DEFENSIVO',  atk: -0.35, def: -0.50, desc: 'candado: partidos cerrados' }
  };

  /* =================== ECONOMÍA =================== */
  const COSTS = { reroll: 60, swap: 20, formation: 30 }; // ajustes manuales
  const START_COINS = 1000;
  const MIN_BET = 10;
  const MAX_BET = 1000;
  const RESCUE_AMOUNT = 300;   // rescate diario si quiebras
  const RESCUE_BELOW = 50;

  const RIVAL_NAMES = [
    'DEPORTIVO TACOS', 'REAL CUMBIA', 'ATLÉTICO CHANCLA', 'FC PERREO',
    'CLUB SUDOR', 'UNIÓN GARNACHA', 'INTER DE LA ESQUINA', 'RAYO VALLENATO',
    'SPORTING SIESTA', 'CD PAMBOLERO', 'JUVENTUS DEL BARRIO', 'BORUSSIA BIRRIA'
  ];

  /* =================== HELPERS =================== */
  const $ = (sel) => document.querySelector(sel);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function poisson(k, lambda) {
    // P(X=k) = e^-λ λ^k / k!
    let f = 1;
    for (let i = 2; i <= k; i++) f *= i;
    return Math.exp(-lambda) * Math.pow(lambda, k) / f;
  }
  function samplePoisson(lambda, max = 7) {
    const u = Math.random();
    let acc = 0;
    for (let k = 0; k <= max; k++) {
      acc += poisson(k, lambda);
      if (u < acc) return k;
    }
    return max;
  }

  /* Rating efectivo según posición asignada vs natural */
  function effRating(ch, slotPos) {
    if (ch.pos === slotPos) return ch.ovr;
    if (slotPos === 'GK') return ch.ovr - 18;         // de campo al arco: caos
    if (ch.pos === 'GK') return ch.ovr - 14;          // portero jugando en cancha
    const adj = { DEF: { MID: 8, FWD: 14 }, MID: { DEF: 8, FWD: 8 }, FWD: { MID: 8, DEF: 14 } };
    return ch.ovr - adj[ch.pos][slotPos];
  }

  /* =================== ESTADO =================== */
  let S = null;          // sesión actual
  let onResult = null;   // callback de ui.js (solo modo solo)
  let tickTimer = null;

  function coinsGet() { return TDCStorage.get('tdc_coins', START_COINS); }
  function coinsSet(v) { TDCStorage.set('tdc_coins', Math.max(0, Math.floor(v))); refreshCoinsHUD(); }

  function walletGet() { return S.tournament ? S.players[S.idx].coins : coinsGet(); }
  function walletAdd(delta) {
    if (S.tournament) S.players[S.idx].coins = Math.max(0, S.players[S.idx].coins + delta);
    else coinsSet(coinsGet() + delta);
    refreshCoinsHUD();
  }

  function refreshCoinsHUD() {
    const el = $('#fantasy-coins');
    if (!el) return;
    const name = S && S.tournament ? S.players[S.idx].name + ' · ' : '';
    el.textContent = name + '🪙 ' + walletGet();
  }

  /* =================== ARRANQUE =================== */
  function start(opts = {}) {
    onResult = opts.onResult || null;
    S = {
      tournament: false, players: null, idx: 0,
      formation: '4-4-2', style: 'equilibrado',
      squad: null,        // [{ch, slot:'GK'|'DEF'|'MID'|'FWD'}] x11
      selected: -1,       // índice seleccionado en la cancha (para swap/reroll)
      rival: null, bet: null
    };
    stopTicker();
    renderSetup();
    refreshCoinsHUD();
  }

  function stop() { stopTicker(); }
  function stopTicker() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  /* =================== PASO 0: SETUP =================== */
  function renderSetup() {
    const body = $('#fantasy-body');
    const coins = coinsGet();
    const canRescue = coins < RESCUE_BELOW &&
      TDCStorage.get('tdc_rescue_day') !== new Date().toDateString();

    body.innerHTML = `
      <h2 class="f-title">🎰 TÓMBOLA FC</h2>
      <p class="f-sub">Sortea un equipo de famosos, apuesta y reza.</p>

      <div class="f-label">FORMACIÓN</div>
      <div class="f-chips" id="f-formations"></div>

      <div class="f-label">ESTILO DE JUEGO</div>
      <div class="f-chips" id="f-styles"></div>

      <button id="f-go-draw" class="btn btn-big">🎲 GIRAR LA TÓMBOLA</button>
      <button id="f-go-tourney" class="btn">👥 TORNEO ENTRE AMIGOS</button>
      ${canRescue ? `<button id="f-rescue" class="btn f-rescue">🆘 RESCATE DIARIO +${RESCUE_AMOUNT}</button>` : ''}
      <p class="f-hint">Ajustes manuales cuestan monedas · el ajuste AUTO es gratis<br>
      Leaderboard propio: la mayor ganancia en una sola apuesta 💰</p>
    `;

    const fWrap = $('#f-formations');
    for (const f of Object.keys(FORMATIONS)) {
      const b = document.createElement('button');
      b.className = 'f-chip' + (S.formation === f ? ' active' : '');
      b.textContent = f;
      b.addEventListener('click', () => { S.formation = f; renderSetup(); });
      fWrap.appendChild(b);
    }
    const sWrap = $('#f-styles');
    for (const [key, st] of Object.entries(STYLES)) {
      const b = document.createElement('button');
      b.className = 'f-chip' + (S.style === key ? ' active' : '');
      b.textContent = st.label;
      b.title = st.desc;
      b.addEventListener('click', () => { S.style = key; renderSetup(); });
      sWrap.appendChild(b);
    }
    $('#f-go-draw').addEventListener('click', () => doDraw());
    $('#f-go-tourney').addEventListener('click', renderTourneySetup);
    const r = $('#f-rescue');
    if (r) r.addEventListener('click', () => {
      TDCStorage.set('tdc_rescue_day', new Date().toDateString());
      coinsSet(coinsGet() + RESCUE_AMOUNT);
      renderSetup();
    });
  }

  /* =================== TORNEO: SETUP =================== */
  function renderTourneySetup() {
    const body = $('#fantasy-body');
    body.innerHTML = `
      <h2 class="f-title">👥 TORNEO ENTRE AMIGOS</h2>
      <p class="f-sub">Pass-and-play: cada quien arma su equipo y apuesta
      con 1000 monedas de torneo. Tabla final y a presumir.<br>
      <b>No afecta el leaderboard mundial ni tus monedas.</b></p>
      <div id="f-names" class="f-names"></div>
      <button id="f-add-name" class="btn btn-small">+ AGREGAR JUGADOR</button>
      <button id="f-start-tourney" class="btn btn-big">🏁 EMPEZAR TORNEO</button>
      <button id="f-back-setup" class="btn btn-small">← Volver</button>
    `;
    const names = ['JUGADOR 1', 'JUGADOR 2'];
    const wrap = $('#f-names');
    const draw = () => {
      wrap.innerHTML = '';
      names.forEach((n, i) => {
        const inp = document.createElement('input');
        inp.value = n;
        inp.maxLength = 12;
        inp.addEventListener('input', () => { names[i] = inp.value; });
        wrap.appendChild(inp);
      });
    };
    draw();
    $('#f-add-name').addEventListener('click', () => {
      if (names.length >= 8) return;
      names.push('JUGADOR ' + (names.length + 1));
      draw();
    });
    $('#f-start-tourney').addEventListener('click', () => {
      S.tournament = true;
      S.players = names
        .map((n) => ({ name: (n.trim() || 'ANON').toUpperCase().slice(0, 12), coins: START_COINS, done: false, result: null }))
        .slice(0, 8);
      S.idx = 0;
      renderTourneyTurn();
    });
    $('#f-back-setup').addEventListener('click', renderSetup);
  }

  function renderTourneyTurn() {
    const p = S.players[S.idx];
    const body = $('#fantasy-body');
    body.innerHTML = `
      <h2 class="f-title">TURNO DE<br>${p.name}</h2>
      <p class="f-sub">Pásale el cel 📱➡️ Tienes 🪙 ${p.coins} de torneo.</p>
      <div class="f-label">FORMACIÓN</div>
      <div class="f-chips" id="f-formations"></div>
      <div class="f-label">ESTILO</div>
      <div class="f-chips" id="f-styles"></div>
      <button id="f-go-draw" class="btn btn-big">🎲 GIRAR LA TÓMBOLA</button>
    `;
    const fWrap = $('#f-formations');
    for (const f of Object.keys(FORMATIONS)) {
      const b = document.createElement('button');
      b.className = 'f-chip' + (S.formation === f ? ' active' : '');
      b.textContent = f;
      b.addEventListener('click', () => { S.formation = f; renderTourneyTurn(); });
      fWrap.appendChild(b);
    }
    const sWrap = $('#f-styles');
    for (const [key, st] of Object.entries(STYLES)) {
      const b = document.createElement('button');
      b.className = 'f-chip' + (S.style === key ? ' active' : '');
      b.textContent = st.label;
      b.addEventListener('click', () => { S.style = key; renderTourneyTurn(); });
      sWrap.appendChild(b);
    }
    $('#f-go-draw').addEventListener('click', () => doDraw());
    refreshCoinsHUD();
  }

  /* =================== PASO 1: TÓMBOLA (sorteo) =================== */
  function slotList(formation) {
    const [d, m, f] = FORMATIONS[formation];
    const slots = ['GK'];
    for (let i = 0; i < d; i++) slots.push('DEF');
    for (let i = 0; i < m; i++) slots.push('MID');
    for (let i = 0; i < f; i++) slots.push('FWD');
    return slots;
  }

  function doDraw() {
    // 11 personajes únicos, tómbola pura: la suerte es parte del juego
    const bag = [...POOL];
    const drawn = [];
    for (let i = 0; i < 11; i++) {
      const k = Math.floor(Math.random() * bag.length);
      drawn.push(bag.splice(k, 1)[0]);
    }
    const slots = slotList(S.formation);
    S.squad = slots.map((slot, i) => ({ ch: drawn[i], slot }));
    autoAssign(false); // primer acomodo razonable gratis (es parte del sorteo)
    renderDrawReveal(drawn);
  }

  /* Ajuste AUTO (gratis): asigna cada personaje al slot donde rinde más */
  function autoAssign(charge) {
    const slots = slotList(S.formation);
    const chars = S.squad.map((s) => s.ch);
    const used = new Array(chars.length).fill(false);
    const squad = [];
    // orden de asignación: GK primero, luego el resto por "escasez"
    const order = slots.map((slot, i) => ({ slot, i }))
      .sort((a, b) => (a.slot === 'GK' ? -1 : b.slot === 'GK' ? 1 : 0));
    for (const { slot } of order) {
      let bi = -1, bv = -1e9;
      for (let c = 0; c < chars.length; c++) {
        if (used[c]) continue;
        const v = effRating(chars[c], slot);
        if (v > bv) { bv = v; bi = c; }
      }
      used[bi] = true;
      squad.push({ ch: chars[bi], slot });
    }
    // reordena en el orden natural de la formación
    squad.sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
    // reconstruye respetando el conteo por línea
    const bySlot = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const s of squad) bySlot[s.slot].push(s);
    S.squad = slots.map((slot) => bySlot[slot].shift());
    S.selected = -1;
    if (charge) { /* AUTO es gratis: no cobra */ }
  }

  function teamRating() {
    const sum = S.squad.reduce((acc, s) => acc + effRating(s.ch, s.slot), 0);
    return Math.round(sum / S.squad.length);
  }

  /* Animación de revelado de la tómbola */
  function renderDrawReveal(drawn) {
    const body = $('#fantasy-body');
    body.innerHTML = `
      <h2 class="f-title">🎲 LA TÓMBOLA DICE…</h2>
      <div id="f-reveal" class="f-reveal"></div>
      <button id="f-skip" class="btn btn-small">SALTAR ⏩</button>
    `;
    const wrap = $('#f-reveal');
    const cards = [];
    drawn.forEach((ch) => {
      const c = document.createElement('canvas');
      c.width = 84; c.height = 108;
      c.className = 'f-mini';
      drawMiniBack(c);
      wrap.appendChild(c);
      cards.push({ canvas: c, ch });
    });
    let i = 0;
    const reveal = () => {
      if (i >= cards.length) { setTimeout(renderLineup, 600); return; }
      drawMiniCard(cards[i].canvas, cards[i].ch);
      i++;
      tickTimer = setTimeout(reveal, 260);
    };
    tickTimer = setTimeout(reveal, 350);
    $('#f-skip').addEventListener('click', () => {
      stopTicker();
      cards.forEach((c) => drawMiniCard(c.canvas, c.ch));
      setTimeout(renderLineup, 250);
    });
  }

  function drawMiniBack(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', canvas.width / 2, canvas.height / 2 + 14);
  }

  function drawMiniCard(canvas, ch, slot) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = CAT_COLOR[ch.cat];
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    FaceRenderer.draw(ctx, ch.look, 'idle', w * 0.2, 4, w * 0.6, 0);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    let fs = 9;
    ctx.font = 'bold ' + fs + 'px "Courier New", monospace';
    while (ctx.measureText(ch.name).width > w - 8 && fs > 6) {
      fs -= 0.5; ctx.font = 'bold ' + fs + 'px "Courier New", monospace';
    }
    ctx.fillText(ch.name, w / 2, h - 26);
    ctx.fillStyle = CAT_COLOR[ch.cat];
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.fillText(CAT_LABEL[ch.cat], w / 2, h - 16);
    const eff = slot ? effRating(ch, slot) : ch.ovr;
    ctx.fillStyle = eff >= 85 ? '#3fff8e' : eff >= 70 ? '#ffd23f' : '#ff3f6e';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(String(eff) + (slot && slot !== ch.pos ? '↓' : ''), w / 2, h - 5);
  }

  /* =================== PASO 2: ALINEACIÓN (cancha) =================== */
  const PITCH_W = 340, PITCH_H = 400;
  let pitchHits = []; // rects clicables por jugador

  function renderLineup(msg) {
    const body = $('#fantasy-body');
    const rating = teamRating();
    const wallet = walletGet();
    body.innerHTML = `
      <div class="f-row">
        <h2 class="f-title-sm">TU EQUIPO — ${S.formation}</h2>
        <span class="f-rating">MEDIA <b>${rating}</b></span>
      </div>
      ${msg ? `<p class="f-msg">${msg}</p>` : ''}
      <canvas id="f-pitch" width="${PITCH_W}" height="${PITCH_H}"></canvas>
      <p class="f-hint" id="f-tip">Toca un jugador para seleccionarlo · toca otro para INTERCAMBIAR (🪙 ${COSTS.swap})</p>
      <div class="f-actions">
        <button id="f-auto" class="btn btn-small">🤖 AUTO (gratis)</button>
        <button id="f-reroll" class="btn btn-small" disabled>🎲 RESORTEAR (🪙 ${COSTS.reroll})</button>
        <button id="f-reform" class="btn btn-small">🔀 FORMACIÓN (🪙 ${COSTS.formation})</button>
      </div>
      <button id="f-go-bet" class="btn btn-big">💰 IR A LA APUESTA</button>
    `;
    drawPitch();
    $('#f-pitch').addEventListener('click', onPitchClick);
    $('#f-auto').addEventListener('click', () => { autoAssign(true); renderLineup('Alineación optimizada 🤖'); });
    $('#f-reroll').addEventListener('click', doReroll);
    $('#f-reform').addEventListener('click', renderReformation);
    $('#f-go-bet').addEventListener('click', renderBet);
    refreshCoinsHUD();
    updateActionButtons();
  }

  function updateActionButtons() {
    const rr = $('#f-reroll');
    if (rr) rr.disabled = S.selected < 0 || walletGet() < COSTS.reroll;
    const rf = $('#f-reform');
    if (rf) rf.disabled = walletGet() < COSTS.formation;
  }

  function drawPitch() {
    const canvas = $('#f-pitch');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = PITCH_W, H = PITCH_H;
    // césped con franjas
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#0e5c2f' : '#0b4d27';
      ctx.fillRect(0, (H / 8) * i, W, H / 8);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.beginPath(); ctx.arc(W / 2, H * 0.42, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(W * 0.28, H - 44, W * 0.44, 38); // área propia (abajo)
    ctx.strokeRect(W * 0.28, 6, W * 0.44, 38);      // área rival (arriba)

    // filas: FWD arriba, MID, DEF, GK abajo
    const rows = { FWD: [], MID: [], DEF: [], GK: [] };
    S.squad.forEach((s, i) => rows[s.slot].push(i));
    const rowY = { FWD: 0.16, MID: 0.40, DEF: 0.64, GK: 0.86 };
    pitchHits = [];
    for (const [slot, idxs] of Object.entries(rows)) {
      idxs.forEach((sqIdx, k) => {
        const n = idxs.length;
        const x = W * ((k + 1) / (n + 1));
        const y = H * rowY[slot];
        const s = S.squad[sqIdx];
        const size = 34;
        const eff = effRating(s.ch, s.slot);
        // selección
        if (S.selected === sqIdx) {
          ctx.fillStyle = 'rgba(255,210,63,0.25)';
          ctx.fillRect(x - size / 2 - 5, y - size / 2 - 5, size + 10, size + 24);
          ctx.strokeStyle = '#ffd23f';
          ctx.strokeRect(x - size / 2 - 5, y - size / 2 - 5, size + 10, size + 24);
        }
        FaceRenderer.draw(ctx, s.ch.look, 'idle', x - size / 2, y - size / 2, size, 0);
        ctx.textAlign = 'center';
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(s.ch.name.split(' ')[0], x, y + size / 2 + 8);
        ctx.fillStyle = eff >= 85 ? '#3fff8e' : eff >= 70 ? '#ffd23f' : '#ff6e6e';
        ctx.fillText(String(eff) + (s.slot !== s.ch.pos ? '↓' : ''), x, y + size / 2 + 17);
        pitchHits.push({ x: x - size / 2 - 6, y: y - size / 2 - 6, w: size + 12, h: size + 26, idx: sqIdx });
      });
    }
  }

  function onPitchClick(e) {
    const canvas = $('#f-pitch');
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (PITCH_W / r.width);
    const y = (e.clientY - r.top) * (PITCH_H / r.height);
    const hit = pitchHits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (!hit) { S.selected = -1; drawPitch(); updateActionButtons(); return; }
    if (S.selected < 0 || S.selected === hit.idx) {
      S.selected = S.selected === hit.idx ? -1 : hit.idx;
      drawPitch(); updateActionButtons();
      return;
    }
    // segundo toque: INTERCAMBIO manual (cuesta monedas)
    if (walletGet() < COSTS.swap) {
      $('#f-tip').textContent = 'No te alcanza para el intercambio (🪙 ' + COSTS.swap + ') 😬';
      return;
    }
    walletAdd(-COSTS.swap);
    const a = S.squad[S.selected], b = S.squad[hit.idx];
    const tmp = a.ch; a.ch = b.ch; b.ch = tmp;
    S.selected = -1;
    renderLineup('Intercambio hecho (−🪙 ' + COSTS.swap + ')');
  }

  function doReroll() {
    if (S.selected < 0 || walletGet() < COSTS.reroll) return;
    walletAdd(-COSTS.reroll);
    const inSquad = new Set(S.squad.map((s) => s.ch.id));
    const options = POOL.filter((c) => !inSquad.has(c.id));
    S.squad[S.selected].ch = pick(options);
    const nm = S.squad[S.selected].ch.name;
    S.selected = -1;
    renderLineup('La tómbola te dio a ' + nm + ' (−🪙 ' + COSTS.reroll + ')');
  }

  function renderReformation() {
    if (walletGet() < COSTS.formation) return;
    const body = $('#fantasy-body');
    body.innerHTML = `
      <h2 class="f-title-sm">CAMBIAR FORMACIÓN (🪙 ${COSTS.formation})</h2>
      <div class="f-chips" id="f-formations"></div>
      <button id="f-back-lineup" class="btn btn-small">← Cancelar</button>
    `;
    const fWrap = $('#f-formations');
    for (const f of Object.keys(FORMATIONS)) {
      const b = document.createElement('button');
      b.className = 'f-chip' + (S.formation === f ? ' active' : '');
      b.textContent = f;
      b.addEventListener('click', () => {
        if (f === S.formation) { renderLineup(); return; }
        walletAdd(-COSTS.formation);
        S.formation = f;
        // Reacomoda los mismos 11 en la nueva formación
        const chars = S.squad.map((s) => s.ch);
        const slots = slotList(f);
        S.squad = slots.map((slot, i) => ({ ch: chars[i], slot }));
        autoAssign(false);
        renderLineup('Nueva formación: ' + f + ' (−🪙 ' + COSTS.formation + ')');
      });
      fWrap.appendChild(b);
    }
    $('#f-back-lineup').addEventListener('click', () => renderLineup());
  }

  /* =================== PASO 3: APUESTA (casino) =================== */
  function makeRival() {
    return {
      name: pick(RIVAL_NAMES),
      rating: Math.round(62 + Math.random() * 30)
    };
  }

  function lambdas(myR, rvR) {
    const st = STYLES[S.style];
    const diff = (myR - rvR) / 22;
    return {
      mine: clamp(1.35 + diff + st.atk, 0.25, 4),
      rival: clamp(1.35 - diff + st.def, 0.25, 4)
    };
  }

  /* Cuota estilo casino: 0.85/p (15% ventaja de la casa), tope x25 */
  function oddsExact(a, b, lam) {
    const p = poisson(a, lam.mine) * poisson(b, lam.rival);
    return clamp(0.85 / Math.max(p, 1e-6), 1.5, 25);
  }
  function odds1X2(kind, lam) {
    let pW = 0, pD = 0, pL = 0;
    for (let a = 0; a <= 7; a++) {
      for (let b = 0; b <= 7; b++) {
        const p = poisson(a, lam.mine) * poisson(b, lam.rival);
        if (a > b) pW += p; else if (a === b) pD += p; else pL += p;
      }
    }
    const p = kind === 'W' ? pW : kind === 'D' ? pD : pL;
    return clamp(0.9 / Math.max(p, 1e-6), 1.05, 25);
  }

  function renderBet() {
    if (!S.rival) S.rival = makeRival();
    const myR = teamRating();
    const lam = lambdas(myR, S.rival.rating);
    const wallet = walletGet();
    if (!S.bet) S.bet = { type: 'exact', a: 2, b: 1, kind: 'W', amount: Math.min(100, wallet) };

    const body = $('#fantasy-body');
    body.innerHTML = `
      <h2 class="f-title-sm">💰 LA APUESTA</h2>
      <div class="f-vs">
        <div class="f-team"><b>TU EQUIPO</b><span>MEDIA ${myR}</span></div>
        <div class="f-vs-x">VS</div>
        <div class="f-team"><b>${S.rival.name}</b><span>MEDIA ${S.rival.rating}</span></div>
      </div>
      <div class="f-chips">
        <button id="f-bt-exact" class="f-chip ${S.bet.type === 'exact' ? 'active' : ''}">MARCADOR EXACTO</button>
        <button id="f-bt-1x2" class="f-chip ${S.bet.type === '1x2' ? 'active' : ''}">GANO / EMPATE / PIERDO</button>
      </div>
      <div id="f-bet-body"></div>
      <div class="f-label">CUÁNTO LE METES (tienes 🪙 ${wallet})</div>
      <div class="f-amount">
        <button class="f-chip" data-amt="50">50</button>
        <button class="f-chip" data-amt="100">100</button>
        <button class="f-chip" data-amt="300">300</button>
        <button class="f-chip" data-amt="max">MAX</button>
        <input id="f-amt" type="number" min="${MIN_BET}" max="${Math.min(wallet, MAX_BET)}" value="${S.bet.amount}">
      </div>
      <div class="f-odds" id="f-odds"></div>
      <button id="f-play" class="btn btn-big">⚽ JUGAR EL PARTIDO</button>
      <button id="f-back-lineup" class="btn btn-small">← Volver al equipo</button>
    `;
    $('#f-bt-exact').addEventListener('click', () => { S.bet.type = 'exact'; renderBet(); });
    $('#f-bt-1x2').addEventListener('click', () => { S.bet.type = '1x2'; renderBet(); });
    $('#f-back-lineup').addEventListener('click', () => renderLineup());
    body.querySelectorAll('[data-amt]').forEach((b) => {
      b.addEventListener('click', () => {
        const max = Math.min(walletGet(), MAX_BET);
        S.bet.amount = b.dataset.amt === 'max' ? max : Math.min(parseInt(b.dataset.amt, 10), max);
        renderBet();
      });
    });
    $('#f-amt').addEventListener('input', (e) => {
      S.bet.amount = parseInt(e.target.value, 10) || 0;
      updateOdds();
    });

    const bb = $('#f-bet-body');
    if (S.bet.type === 'exact') {
      bb.innerHTML = `
        <div class="f-score-pick">
          <div class="f-step"><button id="f-a-minus" class="btn btn-small">−</button>
            <span id="f-a">${S.bet.a}</span>
            <button id="f-a-plus" class="btn btn-small">+</button><label>TUYOS</label></div>
          <span class="f-vs-x">–</span>
          <div class="f-step"><button id="f-b-minus" class="btn btn-small">−</button>
            <span id="f-b">${S.bet.b}</span>
            <button id="f-b-plus" class="btn btn-small">+</button><label>RIVAL</label></div>
        </div>`;
      const upd = () => { $('#f-a').textContent = S.bet.a; $('#f-b').textContent = S.bet.b; updateOdds(); };
      $('#f-a-minus').addEventListener('click', () => { S.bet.a = Math.max(0, S.bet.a - 1); upd(); });
      $('#f-a-plus').addEventListener('click', () => { S.bet.a = Math.min(5, S.bet.a + 1); upd(); });
      $('#f-b-minus').addEventListener('click', () => { S.bet.b = Math.max(0, S.bet.b - 1); upd(); });
      $('#f-b-plus').addEventListener('click', () => { S.bet.b = Math.min(5, S.bet.b + 1); upd(); });
    } else {
      bb.innerHTML = `
        <div class="f-chips">
          <button class="f-chip ${S.bet.kind === 'W' ? 'active' : ''}" data-kind="W">GANO ✅</button>
          <button class="f-chip ${S.bet.kind === 'D' ? 'active' : ''}" data-kind="D">EMPATE 🤝</button>
          <button class="f-chip ${S.bet.kind === 'L' ? 'active' : ''}" data-kind="L">PIERDO 💀</button>
        </div>`;
      bb.querySelectorAll('[data-kind]').forEach((b) => {
        b.addEventListener('click', () => { S.bet.kind = b.dataset.kind; renderBet(); });
      });
    }

    function updateOdds() {
      const o = S.bet.type === 'exact' ? oddsExact(S.bet.a, S.bet.b, lam) : odds1X2(S.bet.kind, lam);
      const amt = clamp(S.bet.amount || 0, 0, Math.min(walletGet(), MAX_BET));
      const el = $('#f-odds');
      el.innerHTML = `CUOTA <b>x${o.toFixed(2)}</b> · PREMIO POSIBLE <b>🪙 ${Math.floor(amt * o)}</b>`;
      $('#f-play').disabled = amt < MIN_BET || amt > walletGet();
    }
    updateOdds();

    $('#f-play').addEventListener('click', () => {
      const amt = clamp(S.bet.amount || 0, MIN_BET, Math.min(walletGet(), MAX_BET));
      S.bet.amount = amt;
      S.bet.odds = S.bet.type === 'exact' ? oddsExact(S.bet.a, S.bet.b, lam) : odds1X2(S.bet.kind, lam);
      walletAdd(-amt); // la apuesta se descuenta al entrar al partido
      runMatch(lam);
    });
    refreshCoinsHUD();
  }

  /* =================== PASO 4: SIMULACIÓN =================== */
  function runMatch(lam) {
    // El marcador final sale de las MISMAS distribuciones que las cuotas
    const gMine = samplePoisson(lam.mine);
    const gRival = samplePoisson(lam.rival);
    const events = [];
    const usedMin = new Set();
    const rndMin = () => {
      let m;
      do { m = 3 + Math.floor(Math.random() * 87); } while (usedMin.has(m));
      usedMin.add(m);
      return m;
    };
    for (let i = 0; i < gMine; i++) {
      const scorer = pick(S.squad.filter((s) => s.slot !== 'GK'));
      events.push({ min: rndMin(), side: 'me', txt: '⚽ ¡GOOOL de ' + scorer.ch.name + '!' });
    }
    for (let i = 0; i < gRival; i++) events.push({ min: rndMin(), side: 'rv', txt: '💀 Gol de ' + S.rival.name + '…' });
    const FLAVOR = [
      '🥅 ¡Atajadón del portero!', '🥴 Tiro a las nubes', '🟨 Amarilla por drama',
      '📣 La porra no deja de cantar', '🤸 Chilena que casi entra', '🧊 El partido se enfría',
      '🔥 ¡Palo! Casi casi', '😱 El VAR revisa… no hay nada'
    ];
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
      events.push({ min: rndMin(), side: 'x', txt: pick(FLAVOR) });
    }
    events.sort((a, b) => a.min - b.min);

    const body = $('#fantasy-body');
    body.innerHTML = `
      <div class="f-scoreboard">
        <span>TU EQUIPO</span>
        <b id="f-sb">0 – 0</b>
        <span>${S.rival.name}</span>
      </div>
      <div class="f-minute" id="f-min">0'</div>
      <div class="f-ticker" id="f-ticker"></div>
    `;
    let minute = 0, sMe = 0, sRv = 0, ei = 0;
    const ticker = $('#f-ticker');
    tickTimer = setInterval(() => {
      minute += 3;
      if (minute > 90) {
        stopTicker();
        settleBet(sMe, sRv);
        return;
      }
      $('#f-min').textContent = minute + "'";
      while (ei < events.length && events[ei].min <= minute) {
        const ev = events[ei++];
        if (ev.side === 'me') sMe++;
        if (ev.side === 'rv') sRv++;
        $('#f-sb').textContent = sMe + ' – ' + sRv;
        const row = document.createElement('div');
        row.className = 'f-ev' + (ev.side === 'me' ? ' me' : ev.side === 'rv' ? ' rv' : '');
        row.textContent = ev.min + "' " + ev.txt;
        ticker.prepend(row);
      }
    }, 380);
  }

  function settleBet(sMe, sRv) {
    const b = S.bet;
    let won = false;
    if (b.type === 'exact') won = sMe === b.a && sRv === b.b;
    else won = (b.kind === 'W' && sMe > sRv) || (b.kind === 'D' && sMe === sRv) || (b.kind === 'L' && sMe < sRv);
    const payout = won ? Math.floor(b.amount * b.odds) : 0;
    const net = payout - b.amount; // ganancia neta (lo apostado ya se descontó)
    if (won) walletAdd(payout);

    const betTxt = b.type === 'exact' ? `${b.a}–${b.b} exacto` : (b.kind === 'W' ? 'ganar' : b.kind === 'D' ? 'empatar' : 'perder');
    const stats = {
      result: sMe + '-' + sRv, bet: b.amount, odds: +b.odds.toFixed(2),
      betType: betTxt, win: won, payout, team: teamRating(),
      rival: S.rival.rating, formation: S.formation, style: S.style
    };
    const score = Math.max(0, net); // score del leaderboard: ganancia neta

    if (!S.tournament) {
      const best = TDCStorage.get('tdc_best_fantasy', 0);
      if (score > best) TDCStorage.set('tdc_best_fantasy', score);
      // envía al leaderboard mundial de inmediato (aunque no abra la score card)
      if (onResult) onResult({ mode: 'fantasy', score, stats });
    } else {
      S.players[S.idx].done = true;
      S.players[S.idx].result = { score: sMe + '-' + sRv, won, net, coins: S.players[S.idx].coins };
    }
    renderMatchResult(sMe, sRv, won, payout, net);
  }

  function renderMatchResult(sMe, sRv, won, payout, net) {
    const body = $('#fantasy-body');
    const b = S.bet;
    const banner = won
      ? `<div class="f-win">🎉 ¡APUESTA GANADA! 🎉<br>Premio: 🪙 ${payout} (neto +${net})</div>`
      : `<div class="f-lose">💸 Apuesta perdida (−🪙 ${b.amount})<br>La casa siempre gana… ¿o no?</div>`;
    const isLastTourney = S.tournament && S.idx >= S.players.length - 1;
    body.innerHTML = `
      <h2 class="f-title-sm">FINAL DEL PARTIDO</h2>
      <div class="f-scoreboard final"><span>TU EQUIPO</span><b>${sMe} – ${sRv}</b><span>${S.rival.name}</span></div>
      ${banner}
      <div class="menu-buttons">
        ${S.tournament
          ? (isLastTourney
             ? '<button id="f-tourney-table" class="btn btn-big">🏆 VER TABLA FINAL</button>'
             : '<button id="f-next-player" class="btn btn-big">📱 SIGUIENTE JUGADOR</button>')
          : `<button id="f-see-card" class="btn">📸 VER SCORE CARD</button>
             <button id="f-again" class="btn btn-big">🔄 OTRA TÓMBOLA</button>`}
        <button id="f-menu" class="btn">← Menú</button>
      </div>
    `;
    if (S.tournament) {
      const btn = $('#f-tourney-table') || $('#f-next-player');
      btn.addEventListener('click', () => {
        if (isLastTourney) renderTourneyTable();
        else {
          S.idx++;
          S.squad = null; S.rival = null; S.bet = null; S.selected = -1;
          renderTourneyTurn();
        }
      });
    } else {
      $('#f-see-card').addEventListener('click', () => {
        if (window.TDC_showGameOver) window.TDC_showGameOver();
      });
      $('#f-again').addEventListener('click', () => {
        S.squad = null; S.rival = null; S.bet = null; S.selected = -1;
        renderSetup();
      });
    }
    $('#f-menu').addEventListener('click', () => {
      stop();
      if (window.TDC_backToMenu) window.TDC_backToMenu();
    });
    refreshCoinsHUD();
  }

  function renderTourneyTable() {
    const body = $('#fantasy-body');
    const table = [...S.players].sort((a, b) => b.coins - a.coins);
    const rows = table.map((p, i) => `
      <div class="lb-row ${i === 0 ? 'me' : ''}">
        <span class="lb-rank">${i === 0 ? '👑' : '#' + (i + 1)}</span>
        <span class="lb-name">${p.name}</span>
        <span class="lb-country">${p.result ? p.result.score : ''}</span>
        <span class="lb-score">🪙 ${p.coins}</span>
      </div>`).join('');
    body.innerHTML = `
      <h2 class="f-title">🏆 TABLA DEL TORNEO</h2>
      <p class="f-sub">${table[0].name} se lleva la gloria (y nada más, era amistoso 😌)</p>
      <div class="lb-list">${rows}</div>
      <div class="menu-buttons">
        <button id="f-tourney-again" class="btn btn-big">🔄 OTRO TORNEO</button>
        <button id="f-menu" class="btn">← Menú</button>
      </div>
    `;
    $('#f-tourney-again').addEventListener('click', renderTourneySetup);
    $('#f-menu').addEventListener('click', () => {
      stop();
      if (window.TDC_backToMenu) window.TDC_backToMenu();
    });
  }

  return { start, stop, POOL, COSTS, START_COINS };
})();
