-- TORNEO DE CEL — schema D1 (SQLite)
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country TEXT DEFAULT '',
  handle TEXT DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('penales','survivor')),
  score INTEGER NOT NULL CHECK (score >= 0),
  stats TEXT DEFAULT '{}',
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_mode_ts ON scores(mode, ts);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_mode_player ON scores(mode, player_id);
