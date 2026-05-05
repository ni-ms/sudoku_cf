CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  room_id     TEXT PRIMARY KEY,
  mode        TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  winner_id   TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  room_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  finished_at INTEGER,
  errors      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_games_difficulty_duration
  ON games(difficulty, duration_ms);