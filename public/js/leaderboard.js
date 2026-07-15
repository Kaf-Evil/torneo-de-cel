/* ============================================================
 * TORNEO DE CEL — leaderboard.js
 * Cliente del leaderboard mundial + persistencia local (fallback).
 *
 * Contrato REST (independiente del proveedor; adaptable a
 * Supabase / Firebase / Node+Express):
 *
 *   POST /score
 *   Request:
 *   {
 *     "player": { "id": "uuid", "nickname": "paco", "country": "MX", "handle": "@paco" },
 *     "mode": "penales" | "survivor",
 *     "score": 850,
 *     "stats": { ... },            // stats libres por modo
 *     "ts": "2026-07-14T12:00:00Z"
 *   }
 *   Response 200:
 *   { "ok": true, "rank": { "daily": 1, "weekly": 3, "alltime": 12 }, "best_personal": 900 }
 *
 *   GET /leaderboard?mode=penales|survivor|total&range=daily|weekly|alltime&limit=10&player_id=uuid
 *   Response 200:
 *   {
 *     "mode": "penales", "range": "alltime",
 *     "entries": [ { "rank": 1, "player": {...}, "score": 1200 }, ... ],
 *     "me": { "rank": 45, "score": 300 }   // null si el jugador no tiene score
 *   }
 * ============================================================ */

'use strict';

/* ---------- Storage seguro: usa localStorage si existe, si no memoria ---------- */
const TDCStorage = {
  _mem: {},
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return key in this._mem ? this._mem[key] : fallback;
    }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { this._mem[key] = value; }
  }
};

function tdcUUID() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const LeaderboardAPI = {
  // Detección automática: servido por HTTP(S) → usa la API del mismo dominio
  // (Cloudflare Pages Functions en /api). Abierto como archivo local (file://)
  // → modo 100% local con scores en el dispositivo. Puedes forzar otra URL
  // poniendo aquí un string, p.ej. 'https://torneo-de-cel.pages.dev/api'.
  API_URL: (typeof location !== 'undefined' && location.protocol.startsWith('http')) ? '/api' : null,
  TIMEOUT_MS: 6000,

  /* ---------- Regla del score_total (documentada y explícita) ----------
   * Cada modo se normaliza a 0..1000 con un tope de referencia y se suman:
   *   norm_pen  = min(best_penales  / 1500, 1) * 1000
   *   norm_surv = min(best_survivor / 3000, 1) * 1000
   *   score_total = round(norm_pen + norm_surv)   // rango 0..2000
   * Así ningún modo domina al otro aunque sus escalas sean distintas. */
  PEN_CAP: 1500,
  SURV_CAP: 3000,
  totalScore(bestPen, bestSurv) {
    const np = Math.min(bestPen / this.PEN_CAP, 1) * 1000;
    const ns = Math.min(bestSurv / this.SURV_CAP, 1) * 1000;
    return Math.round(np + ns);
  },

  /* ---------- fetch con timeout (AbortController) ---------- */
  async _fetch(path, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);
    try {
      const res = await fetch(this.API_URL + path, { ...options, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Envía el score final de una partida (penales o survivor).
   * Siempre guarda una copia local; si hay API y falla (offline/timeout),
   * el envío queda encolado y se reintenta en el próximo submit.
   * Devuelve { ok, rank, source }.
   */
  async submitScore(player, mode, score, stats = {}) {
    const entry = { player, mode, score, stats, ts: new Date().toISOString() };
    this._saveLocal(entry);

    if (!this.API_URL) {
      return { ok: true, rank: this._localRank(player.id, mode), source: 'local' };
    }
    try {
      await this._flushPending();
      const json = await this._fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      return { ok: true, rank: (json.rank && json.rank.alltime) || null, source: 'api' };
    } catch (err) {
      const pending = TDCStorage.get('tdc_pending', []);
      pending.push(entry);
      TDCStorage.set('tdc_pending', pending);
      return { ok: false, rank: this._localRank(player.id, mode), source: 'local', error: String(err) };
    }
  },

  /* Reintenta envíos que quedaron pendientes por estar offline */
  async _flushPending() {
    const pending = TDCStorage.get('tdc_pending', []);
    if (!pending.length || !this.API_URL) return;
    const still = [];
    for (const entry of pending) {
      try {
        await this._fetch('/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (e) { still.push(entry); }
    }
    TDCStorage.set('tdc_pending', still);
  },

  /**
   * Top N por modo ('penales' | 'survivor' | 'total') y rango
   * ('daily' | 'weekly' | 'alltime'). Si hay API la usa; si falla, cae a local.
   */
  async getLeaderboard({ mode = 'total', range = 'alltime', limit = 10, playerId = null } = {}) {
    if (this.API_URL) {
      try {
        const qs = `mode=${mode}&range=${range}&limit=${limit}` + (playerId ? `&player_id=${playerId}` : '');
        return await this._fetch('/leaderboard?' + qs);
      } catch (e) { /* sin red: caemos al modo local */ }
    }
    return this._localLeaderboard(mode, range, limit, playerId);
  },

  /* ================= Modo local (sin backend) ================= */

  _saveLocal(entry) {
    const all = TDCStorage.get('tdc_scores', []);
    all.push(entry);
    if (all.length > 500) all.splice(0, all.length - 500); // cap de historial
    TDCStorage.set('tdc_scores', all);
  },

  _inRange(ts, range) {
    const t = new Date(ts).getTime();
    const now = Date.now();
    if (range === 'daily') return now - t < 864e5;
    if (range === 'weekly') return now - t < 7 * 864e5;
    return true;
  },

  /* Mejor score de cada jugador para un modo/rango */
  _bestByPlayer(mode, range) {
    const best = new Map();
    for (const e of TDCStorage.get('tdc_scores', [])) {
      if (e.mode !== mode || !this._inRange(e.ts, range)) continue;
      const prev = best.get(e.player.id);
      if (!prev || e.score > prev.score) best.set(e.player.id, e);
    }
    return best;
  },

  _localLeaderboard(mode, range, limit, playerId) {
    let rows;
    if (mode === 'total') {
      const pen = this._bestByPlayer('penales', range);
      const sur = this._bestByPlayer('survivor', range);
      const ids = new Set([...pen.keys(), ...sur.keys()]);
      rows = [...ids].map((id) => {
        const p = pen.get(id), s = sur.get(id);
        return {
          player: (p || s).player,
          score: this.totalScore(p ? p.score : 0, s ? s.score : 0)
        };
      });
    } else {
      rows = [...this._bestByPlayer(mode, range).values()]
        .map((e) => ({ player: e.player, score: e.score }));
    }
    rows.sort((a, b) => b.score - a.score);

    const entries = rows.slice(0, limit).map((r, i) => ({ rank: i + 1, ...r }));
    let me = null;
    if (playerId) {
      const idx = rows.findIndex((r) => r.player.id === playerId);
      if (idx >= 0) me = { rank: idx + 1, score: rows[idx].score };
    }
    return { mode, range, entries, me, source: 'local' };
  },

  _localRank(playerId, mode) {
    const lb = this._localLeaderboard(mode, 'alltime', 1e6, playerId);
    return lb.me ? lb.me.rank : null;
  }
};
