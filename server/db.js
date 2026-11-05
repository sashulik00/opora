/*
  База данных PostgreSQL: подключение и создание таблиц.
  Таблицы создаются сами при запуске сервера, если их ещё нет.
*/
const { Pool } = require("pg");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS mood_entries (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     DATE NOT NULL,
    mood    SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
    note    TEXT CHECK (char_length(note) <= 300),
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS wellbeing_results (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    score      SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 21),
    level      TEXT NOT NULL CHECK (level IN ('low', 'mid', 'high'))
  );
  CREATE INDEX IF NOT EXISTS wellbeing_results_user ON wellbeing_results (user_id, created_at DESC);

  ALTER TABLE users ADD COLUMN IF NOT EXISTS share_wellbeing BOOLEAN NOT NULL DEFAULT false;
`;

function createDb(connectionString) {
  // connectionTimeoutMillis: база не отвечает — запрос получит ошибку через 5 секунд, а не будет висеть
  const pool = new Pool({ connectionString: connectionString, max: 10, connectionTimeoutMillis: 5000 });

  // Связь оборвалась (например, база перезапустилась). Пул сам выбросит эту связь и откроет новую при следующем запросе.
  // Без этого обработчика такая ошибка роняет весь сервер
  pool.on("error", function (err) {
    console.error("[База] связь оборвалась, переподключимся при следующем запросе:", err.message);
  });

  return {
    pool: pool,

    init: function () {
      return pool.query(SCHEMA);
    },

    findUserByEmail: async function (email) {
      const result = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
      return result.rows[0] || null;
    },

    findUserById: async function (id) {
      const result = await pool.query("SELECT id, email FROM users WHERE id = $1", [id]);
      return result.rows[0] || null;
    },

    /* Новый пользователь. Если почта уже есть — ошибка с code "23505" (нарушение уникальности) */
    createUser: async function (email, passwordHash) {
      const result = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email, passwordHash]
      );
      return result.rows[0];
    },

    /* Прогресс пользователя: тот же объект, что раньше лежал в localStorage. Нет записи — пустой объект */
    getProgress: async function (userId) {
      const result = await pool.query("SELECT data FROM progress WHERE user_id = $1", [userId]);
      return result.rows[0] ? result.rows[0].data : {};
    },

    saveProgress: async function (userId, data) {
      const result = await pool.query(
        `INSERT INTO progress (user_id, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
         RETURNING updated_at`,
        [userId, JSON.stringify(data)]
      );
      return result.rows[0].updated_at;
    },

    /* Отметки настроения за days дней до today включительно, от старых к новым.
       day::text — чтобы дата пришла строкой «2026-11-05»: объект Date сдвинул бы её на часовой пояс */
    getMood: async function (userId, today, days) {
      const result = await pool.query(
        `SELECT day::text AS day, mood, note FROM mood_entries
         WHERE user_id = $1 AND day > $2::date - $3::int ORDER BY day`,
        [userId, today, days]
      );
      return result.rows;
    },

    /* Одна отметка на день: повторное сохранение заменяет её целиком */
    saveMood: async function (userId, day, mood, note) {
      const result = await pool.query(
        `INSERT INTO mood_entries (user_id, day, mood, note) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, day) DO UPDATE SET mood = EXCLUDED.mood, note = EXCLUDED.note
         RETURNING day::text AS day, mood, note`,
        [userId, day, mood, note]
      );
      return result.rows[0];
    },

    /* Результаты теста, сначала новые */
    getWellbeingResults: async function (userId, limit) {
      const result = await pool.query(
        `SELECT score, level, created_at FROM wellbeing_results
         WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    },

    addWellbeingResult: async function (userId, score, level) {
      const result = await pool.query(
        "INSERT INTO wellbeing_results (user_id, score, level) VALUES ($1, $2, $3) RETURNING score, level, created_at",
        [userId, score, level]
      );
      return result.rows[0];
    },

    getShareWellbeing: async function (userId) {
      const result = await pool.query("SELECT share_wellbeing FROM users WHERE id = $1", [userId]);
      return Boolean(result.rows[0] && result.rows[0].share_wellbeing);
    },

    setShareWellbeing: async function (userId, enabled) {
      await pool.query("UPDATE users SET share_wellbeing = $2 WHERE id = $1", [userId, enabled]);
    },

    close: function () {
      return pool.end();
    }
  };
}

module.exports = { createDb };
