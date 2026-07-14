/* ============================================================
 * TORNEO DE CEL — public/_worker.js
 * Worker "advanced mode" de Cloudflare Pages: atiende /api/* y
 * deja pasar todo lo demás a los archivos estáticos (env.ASSETS).
 * Autocontenido a propósito: compatible tanto con `wrangler pages
 * deploy` como con la carga directa desde el dashboard.
 *
 * Endpoints (contrato en GDD §4.3):
 *   POST /api/score        → guarda score, devuelve ranks
 *   GET  /api/leaderboard  → top N por modo/rango + posición propia
 * Binding requerido: D1 con nombre "DB".
 * ============================================================ */

const CAPS = { penales: 1500, survivor: 100000 };
const PEN_CAP = 1500;
const SURV_CAP = 3000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function sinceFor(range) {
  const now = Date.now();
  if (range === 'daily') return new Date(now - 864e5).toISOString();
  if (range === 'weekly') return new Date(now - 7 * 864e5).toISOString();
  return '1970-01-01T00:00:00.000Z';
}

/* Leaderboard "total": mejor score por jugador y modo, normalizado
 * a 0..1000 por modo y sumado (0..2000). */
const TOTAL_CTE = `
WITH best AS (
  SELECT player_id, mode, MAX(score) AS s
  FROM scores WHERE ts >= ?1
  GROUP BY player_id, mode
),
tot AS (
  SELECT player_id,
    CAST(ROUND(
      MIN(1000.0, COALESCE(MAX(CASE WHEN mode='penales' THEN s END), 0) / ${PEN_CAP}.0 * 1000.0) +
      MIN(1000.0, COALESCE(MAX(CASE WHEN mode='survivor' THEN s END), 0) / ${SURV_CAP}.0 * 1000.0)
    ) AS INTEGER) AS score
  FROM best GROUP BY player_id
),
info AS (
  SELECT player_id, MAX(nickname) AS nickname, MAX(country) AS country, MAX(handle) AS handle
  FROM scores GROUP BY player_id
)`;

/* ---------------- POST /api/score ---------------- */
async function handleScore(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const p = body.player || {};
  const mode = body.mode;
  const score = Math.floor(Number(body.score));

  if (mode !== 'penales' && mode !== 'survivor') return json({ ok: false, error: 'invalid_mode' }, 400);
  if (typeof p.id !== 'string' || p.id.length < 8 || p.id.length > 40) return json({ ok: false, error: 'invalid_player' }, 400);
  if (!Number.isFinite(score) || score < 0 || score > CAPS[mode]) return json({ ok: false, error: 'invalid_score' }, 400);

  const nickname = String(p.nickname || 'PLAYER').slice(0, 12).trim() || 'PLAYER';
  const country = String(p.country || '').slice(0, 2).toUpperCase();
  const handle = String(p.handle || '').slice(0, 20);
  const stats = JSON.stringify(body.stats || {}).slice(0, 500);

  // Anti-spam: máx. 1 score cada 8 s por jugador
  const last = await env.DB
    .prepare('SELECT ts FROM scores WHERE player_id = ? ORDER BY id DESC LIMIT 1')
    .bind(p.id).first();
  if (last && Date.now() - new Date(last.ts).getTime() < 8000) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  await env.DB.prepare(
    'INSERT INTO scores (player_id, nickname, country, handle, mode, score, stats) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(p.id, nickname, country, handle, mode, score, stats).run();

  const rank = {};
  for (const range of ['daily', 'weekly', 'alltime']) {
    const since = sinceFor(range);
    const mine = await env.DB
      .prepare('SELECT MAX(score) AS s FROM scores WHERE mode = ? AND player_id = ? AND ts >= ?')
      .bind(mode, p.id, since).first();
    if (mine.s === null) { rank[range] = null; continue; }
    const better = await env.DB.prepare(
      `SELECT COUNT(*) + 1 AS r FROM (
         SELECT player_id, MAX(score) AS s FROM scores
         WHERE mode = ?1 AND ts >= ?2 GROUP BY player_id
       ) WHERE s > ?3`
    ).bind(mode, since, mine.s).first();
    rank[range] = better.r;
  }

  const best = await env.DB
    .prepare('SELECT MAX(score) AS s FROM scores WHERE mode = ? AND player_id = ?')
    .bind(mode, p.id).first();

  return json({ ok: true, rank, best_personal: best.s });
}

/* ---------------- GET /api/leaderboard ---------------- */
async function handleLeaderboard(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'total';
  const range = url.searchParams.get('range') || 'alltime';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);
  const playerId = url.searchParams.get('player_id');

  if (!['penales', 'survivor', 'total'].includes(mode)) return json({ ok: false, error: 'invalid_mode' }, 400);
  if (!['daily', 'weekly', 'alltime'].includes(range)) return json({ ok: false, error: 'invalid_range' }, 400);
  const since = sinceFor(range);

  let entries = [];
  let me = null;

  if (mode === 'total') {
    const rows = await env.DB.prepare(
      TOTAL_CTE + `
      SELECT t.player_id, i.nickname, i.country, i.handle, t.score
      FROM tot t JOIN info i ON i.player_id = t.player_id
      ORDER BY t.score DESC, t.player_id LIMIT ?2`
    ).bind(since, limit).all();
    entries = rows.results;

    if (playerId) {
      const mine = await env.DB.prepare(
        TOTAL_CTE + ` SELECT score FROM tot WHERE player_id = ?2`
      ).bind(since, playerId).first();
      if (mine) {
        const better = await env.DB.prepare(
          TOTAL_CTE + ` SELECT COUNT(*) + 1 AS r FROM tot WHERE score > ?2`
        ).bind(since, mine.score).first();
        me = { rank: better.r, score: mine.score };
      }
    }
  } else {
    const rows = await env.DB.prepare(
      `SELECT player_id, MAX(nickname) AS nickname, MAX(country) AS country,
              MAX(handle) AS handle, MAX(score) AS score
       FROM scores WHERE mode = ?1 AND ts >= ?2
       GROUP BY player_id ORDER BY score DESC, player_id LIMIT ?3`
    ).bind(mode, since, limit).all();
    entries = rows.results;

    if (playerId) {
      const mine = await env.DB
        .prepare('SELECT MAX(score) AS s FROM scores WHERE mode = ? AND player_id = ? AND ts >= ?')
        .bind(mode, playerId, since).first();
      if (mine && mine.s !== null) {
        const better = await env.DB.prepare(
          `SELECT COUNT(*) + 1 AS r FROM (
             SELECT player_id, MAX(score) AS s FROM scores
             WHERE mode = ?1 AND ts >= ?2 GROUP BY player_id
           ) WHERE s > ?3`
        ).bind(mode, since, mine.s).first();
        me = { rank: better.r, score: mine.s };
      }
    }
  }

  return json({
    mode,
    range,
    entries: entries.map((r, i) => ({
      rank: i + 1,
      player: { id: r.player_id, nickname: r.nickname, country: r.country, handle: r.handle },
      score: r.score
    })),
    me,
    source: 'api'
  });
}

/* ---------------- Router principal ---------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/score' && request.method === 'POST') return handleScore(request, env);
    if (url.pathname === '/api/leaderboard' && request.method === 'GET') return handleLeaderboard(request, env);
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found' }, 404);
    // Todo lo demás: archivos estáticos del juego
    return env.ASSETS.fetch(request);
  }
};
