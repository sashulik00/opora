/*
  Обрыв связи с базой: сервер не падает, а следующий запрос открывает новую связь.
  Обрывается только собственная связь этого теста с тестовой базой.
  Запуск: npm test
*/
const { Client } = require("pg");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { readConfig } = require("../config");
const { createDb } = require("../db");
const { createApp, COOKIE_NAME } = require("../app");

const { config } = readConfig();

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/* Оборвать связь с базой по номеру её процесса */
async function terminate(pid) {
  const killer = new Client({ connectionString: config.testDatabaseUrl });
  await killer.connect();
  await killer.query("SELECT pg_terminate_backend($1)", [pid]);
  await killer.end();
}

test("обрыв простаивающей связи не роняет процесс, следующий запрос работает", async function () {
  const log = jest.spyOn(console, "error").mockImplementation(function () {});
  const db = createDb(config.testDatabaseUrl);

  const before = await db.pool.query("SELECT pg_backend_pid() AS pid");
  await terminate(before.rows[0].pid);
  await wait(300);

  // Обрыв замечен и записан в журнал, текст понятный
  expect(log.mock.calls.map(function (c) { return c.join(" "); }).join("\n")).toMatch(/\[База\] связь оборвалась/);

  // Новая связь — другой процесс базы
  const after = await db.pool.query("SELECT pg_backend_pid() AS pid");
  expect(after.rows[0].pid).not.toBe(before.rows[0].pid);

  await db.close();
  log.mockRestore();
});

describe("база недоступна: человек остаётся вошедшим", function () {
  const SECRET = "test-secret-test-secret-test-secret-1234";
  const broken = function () { return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432")); };
  const db = { findUserById: broken, findUserByEmail: broken, getProgress: broken, saveProgress: broken };
  const app = createApp({ db: db, jwtSecret: SECRET, bcryptRounds: 4 });
  const cookie = COOKIE_NAME + "=" + jwt.sign({ sub: "1" }, SECRET, { algorithm: "HS256", expiresIn: "1d" });
  let log;

  beforeEach(function () { log = jest.spyOn(console, "error").mockImplementation(function () {}); });
  afterEach(function () { log.mockRestore(); });

  test("/api/me — 500, cookie входа не стирается, подробностей базы в ответе нет", async function () {
    const res = await request(app).get("/api/me").set("Cookie", cookie);
    expect(res.status).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|5432/);
  });

  test("/api/progress — 500, а не «войдите»: браузер повторит сохранение позже", async function () {
    const read = await request(app).get("/api/progress").set("Cookie", cookie);
    expect(read.status).toBe(500);
    const write = await request(app).put("/api/progress").set("Cookie", cookie).send({ progress: {} });
    expect(write.status).toBe(500);
    expect(write.headers["set-cookie"]).toBeUndefined();
  });

  test("испорченный токен по-прежнему стирает cookie и база для этого не нужна", async function () {
    const res = await request(app).get("/api/me").set("Cookie", COOKIE_NAME + "=broken-token");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
    expect(res.headers["set-cookie"].join(";")).toMatch(new RegExp(COOKIE_NAME + "=;"));
  });
});

test("обрыв во время запроса — ошибка только у этого запроса, следующий работает", async function () {
  const log = jest.spyOn(console, "error").mockImplementation(function () {});
  const db = createDb(config.testDatabaseUrl);

  const slow = db.pool.query("SELECT pg_backend_pid() AS pid, pg_sleep(5)");
  await wait(200);
  const running = new Client({ connectionString: config.testDatabaseUrl });
  await running.connect();
  const found = await running.query(
    "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND query LIKE 'SELECT pg_backend_pid() AS pid, pg_sleep%' AND pid <> pg_backend_pid()"
  );
  await running.end();
  expect(found.rows).toHaveLength(1);
  await terminate(found.rows[0].pid);

  await expect(slow).rejects.toThrow();
  await wait(100);
  const next = await db.pool.query("SELECT 1 AS n");
  expect(next.rows[0].n).toBe(1);

  await db.close();
  log.mockRestore();
});
