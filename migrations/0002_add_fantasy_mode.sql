-- Migración 0002: agrega el modo 'fantasy' (Tómbola FC) al CHECK de scores.
-- SQLite no permite modificar un CHECK: se recrea la tabla y se copian los datos.
-- Ejecutar completo en la consola D1 (o con wrangler d1 execute --file).
-- APLICADA EN PRODUCCIÓN: 2026-07-16 vía consola D1.

ALTER TABLE scores RENAME TO scores_old;

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country TEXT DEFAULT '',
  handle TEXT DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('penales','survivor','fantasy')),
  score INTEGER NOT NULL CHECK (score >= 0),
  stats TEXT DEFAULT '{}',
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO scores (id, player_id, nickname, country, handle, mode, score, stats, ts)
SELECT id, player_id, nickname, country, handle, mode, score, stats, ts FROM scores_old;

DROP TABLE scores_old;

CREATE INDEX IF NOT EXISTS idx_scores_mode_ts ON scores(mode, ts);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_mode_player ON scores(mode, player_id);
