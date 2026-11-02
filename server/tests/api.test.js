/*
  Проверка API регистрации, входа и прогресса.
  Работает с отдельной базой opora_test (TEST_DATABASE_URL в .env); перед тестами она очищается.
  Запуск: npm test
*/
const request = require("supertest");
const { readConfig } = require("../config");
const { createDb } = require("../db");
const { createApp, COOKIE_NAME } = require("../app");

const { config } = readConfig();
let db;
let app;

beforeAll(async function () {
  db = createDb(config.testDatabaseUrl);
  await db.init();
  await db.pool.query("TRUNCATE users, progress RESTART IDENTITY CASCADE");
  app = createApp({ db: db, jwtSecret: "test-secret-test-secret-test-secret-1234", bcryptRounds: 4, loginLimit: 1000 });
});

afterAll(async function () {
  await db.close();
});

/* agent — «браузер» со своими cookie */
async function registered(email, password) {
  const agent = request.agent(app);
  await agent.post("/api/register").send({ email: email, password: password || "password123" }).expect(201);
  return agent;
}

describe("регистрация", function () {
  test("новая почта — 201, вход сразу, cookie httpOnly", async function () {
    const agent = request.agent(app);
    const res = await agent.post("/api/register").send({ email: "  Anna@Example.RU ", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("anna@example.ru");  // почта приводится к нижнему регистру

    const cookie = res.headers["set-cookie"].join(";");
    expect(cookie).toContain(COOKIE_NAME + "=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get("/api/me");
    expect(me.body.user.email).toBe("anna@example.ru");

    const row = await db.pool.query("SELECT password_hash FROM users WHERE email = 'anna@example.ru'");
    expect(row.rows[0].password_hash).not.toContain("password123");  // пароль хранится только как хеш
  });

  test("та же почта ещё раз (в другом регистре) — 409", async function () {
    await registered("twice@example.ru");
    const res = await request(app).post("/api/register").send({ email: "TWICE@example.ru", password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/уже зарегистрирована/);
  });

  test("короткий пароль — 400", async function () {
    const res = await request(app).post("/api/register").send({ email: "short@example.ru", password: "1234567" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/не короче 8/);
  });

  test("неправильная почта — 400", async function () {
    const res = await request(app).post("/api/register").send({ email: "не-почта", password: "password123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/почты/);
  });
});

describe("вход и выход", function () {
  beforeAll(async function () {
    await registered("login@example.ru", "rightpassword");
  });

  test("неверный пароль — 401, cookie не выдаётся", async function () {
    const res = await request(app).post("/api/login").send({ email: "login@example.ru", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Неверная почта или пароль.");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("несуществующая почта — тот же ответ, что и при неверном пароле", async function () {
    const res = await request(app).post("/api/login").send({ email: "nobody@example.ru", password: "rightpassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Неверная почта или пароль.");
  });

  test("верный пароль — вход; выход — /api/me снова пустой", async function () {
    const agent = request.agent(app);
    await agent.post("/api/login").send({ email: "LOGIN@example.ru", password: "rightpassword" }).expect(200);
    expect((await agent.get("/api/me")).body.user.email).toBe("login@example.ru");
    await agent.post("/api/logout").expect(200);
    expect((await agent.get("/api/me")).body.user).toBeNull();
  });

  test("попытки входа ограничены", async function () {
    const strict = createApp({ db: db, jwtSecret: "test-secret-test-secret-test-secret-1234", bcryptRounds: 4, loginLimit: 3 });
    for (let i = 0; i < 3; i++) {
      await request(strict).post("/api/login").send({ email: "login@example.ru", password: "wrongpassword" }).expect(401);
    }
    const res = await request(strict).post("/api/login").send({ email: "login@example.ru", password: "rightpassword" });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Слишком много попыток/);
  });
});

describe("прогресс", function () {
  test("без входа — 401", async function () {
    const get = await request(app).get("/api/progress");
    expect(get.status).toBe(401);
    expect(get.body.error).toMatch(/Войдите/);
    const put = await request(app).put("/api/progress").send({ progress: { burns: { passed: true } } });
    expect(put.status).toBe(401);
  });

  test("поддельный токен — 401", async function () {
    const res = await request(app).get("/api/progress").set("Cookie", COOKIE_NAME + "=not-a-real-token");
    expect(res.status).toBe(401);
  });

  test("запись и чтение — тот же объект, что в localStorage", async function () {
    const agent = await registered("progress@example.ru");
    expect((await agent.get("/api/progress")).body.progress).toEqual({});  // у нового пользователя пусто

    const progress = {
      burns: { best: 8, total: 10, passed: true, completed: true },
      practiceDone: { burns: { "spot-error-1": true }, wounds: true }
    };
    await agent.put("/api/progress").send({ progress: progress }).expect(200);
    expect((await agent.get("/api/progress")).body.progress).toEqual(progress);
  });

  test("чужой прогресс не виден и не меняется", async function () {
    const alice = await registered("alice@example.ru");
    const bob = await registered("bob@example.ru");
    await alice.put("/api/progress").send({ progress: { burns: { passed: true } } }).expect(200);

    expect((await bob.get("/api/progress")).body.progress).toEqual({});
    await bob.put("/api/progress").send({ progress: { wounds: { passed: true } } }).expect(200);
    expect((await alice.get("/api/progress")).body.progress).toEqual({ burns: { passed: true } });
  });

  test("неверный формат и слишком большой запрос — ошибка по-русски", async function () {
    const agent = await registered("format@example.ru");
    const bad = await agent.put("/api/progress").send({ progress: [1, 2, 3] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("Неверный формат прогресса.");

    const big = await agent.put("/api/progress").send({ progress: { text: "x".repeat(150 * 1024) } });
    expect(big.status).toBe(413);
    expect(big.body.error).toBe("Слишком большой запрос.");
  });
});

describe("раздача сайта", function () {
  test("страницы и файлы сайта открываются", async function () {
    await request(app).get("/").expect(200);
    await request(app).get("/login.html").expect(200);
    await request(app).get("/css/style.css").expect(200);
    await request(app).get("/js/main.js").expect(200);
  });

  test.each([
    "/.env", "/.env.example", "/.gitignore", "/.git/config", "/package.json", "/docker-compose.yml",
    "/server/app.js", "/server/config.js", "/node_modules/express/package.json", "/tools/make-masks.py",
    "/js/..%2f.env", "/js/%2e%2e/server/app.js", "/css/..%2f..%2f.env"
  ])("закрытый файл %s — 404", async function (url) {
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
  });
});
