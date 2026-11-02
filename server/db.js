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
`;

function createDb(connectionString) {
  const pool = new Pool({ connectionString: connectionString, max: 10 });

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

    close: function () {
      return pool.end();
    }
  };
}

module.exports = { createDb };
