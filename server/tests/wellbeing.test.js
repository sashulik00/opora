/*
  Проверка самочувствия: отметки настроения, тест, согласие, сводка и комментарий консультанта.
  Настоящий Яндекс не вызывается: модель подменена заглушкой.
  Запуск: npm test
*/
const request = require("supertest");
const { readConfig } = require("../config");
const { createDb } = require("../db");
const { createApp } = require("../app");
const { getWellbeingSummary, INSTRUCTIONS } = require("../consultant");
const { todayFor, shiftDay } = require("../wellbeing");

const { config } = readConfig();
const SECRET = "test-secret-test-secret-test-secret-1234";
let db;
let model;
let app;
let userCount = 0;

beforeAll(async function () {
  db = createDb(config.testDatabaseUrl);
  await db.init();
  await db.pool.query("TRUNCATE users, progress RESTART IDENTITY CASCADE");
  model = jest.fn();
  app = createApp({ db: db, jwtSecret: SECRET, bcryptRounds: 4, callModel: model, registerLimit: 1000, consultantLimit: 1000 });
});

beforeEach(function () {
  model.mockReset();
  model.mockResolvedValue("Вижу, что вы стараетесь. Попробуйте сегодня короткую паузу.");
});

afterAll(async function () {
  await db.close();
});

/* Новый вошедший «браузер» и id пользователя */
async function signedIn() {
  const agent = request.agent(app);
  userCount++;
  const email = "mood" + userCount + "@example.ru";
  await agent.post("/api/register").send({ email: email, password: "password123" }).expect(201);
  return { agent: agent, id: (await db.findUserByEmail(email)).id };
}

/* Отметки за прошлые дни: { сколько дней назад: настроение } */
async function addMoods(userId, moods, note) {
  const today = todayFor();
  for (const ago of Object.keys(moods)) {
    await db.saveMood(userId, shiftDay(today, -Number(ago)), moods[ago], note || null);
  }
}

describe("консультант и пол собеседника", function () {
  test("во всех режимах просим не определять пол", function () {
    ["care", "urgent", "support"].forEach(function (mode) {
      expect(INSTRUCTIONS[mode]).toMatch(/не определяй пол собеседника/);
    });
  });
});

describe("миграция", function () {
  test("повторный запуск ничего не ломает, согласие по умолчанию выключено", async function () {
    const { id } = await signedIn();
    await addMoods(id, { 0: 3 });
    await db.init();
    expect(await db.getShareWellbeing(id)).toBe(false);
    expect(await db.getMood(id, todayFor(), 30)).toHaveLength(1);
  });
});

describe("отметки настроения", function () {
  test("сохранение и чтение: день — строкой, заметка на месте", async function () {
    const { agent } = await signedIn();
    const saved = await agent.put("/api/mood").send({ mood: 4, note: "  Выспалась  ", tzOffset: 0 });
    expect(saved.status).toBe(200);
    const today = todayFor(0);
    expect(saved.body.entry).toEqual({ day: today, mood: 4, note: "Выспалась" });

    const read = await agent.get("/api/mood?tzOffset=0");
    expect(read.body.today).toBe(today);
    expect(read.body.entries).toEqual([{ day: today, mood: 4, note: "Выспалась" }]);
  });

  test("одна отметка на день: вторая заменяет первую", async function () {
    const { agent, id } = await signedIn();
    await agent.put("/api/mood").send({ mood: 2, note: "Тяжело" }).expect(200);
    await agent.put("/api/mood").send({ mood: 5 }).expect(200);
    const rows = await db.pool.query("SELECT mood, note FROM mood_entries WHERE user_id = $1", [id]);
    expect(rows.rows).toEqual([{ mood: 5, note: null }]);
  });

  test("«сегодня» считается по часовому поясу человека", async function () {
    const { agent } = await signedIn();
    const res = await agent.put("/api/mood").send({ mood: 3, tzOffset: -840 });
    expect(res.body.entry.day).toBe(todayFor(-840));
    await agent.put("/api/mood").send({ mood: 3, tzOffset: 5000 }).expect(400);
    await agent.get("/api/mood?tzOffset=abc").expect(400);
  });

  test("отдаются только последние 30 дней", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 0: 3, 29: 3, 30: 3, 60: 3 });
    const res = await agent.get("/api/mood");
    expect(res.body.entries.map(function (e) { return e.day; })).toEqual([shiftDay(todayFor(), -29), todayFor()]);
  });

  test.each([0, 6, -1, 2.5, "3", null, undefined, true, [3]])("mood %p — 400", async function (mood) {
    const { agent, id } = await signedIn();
    await agent.put("/api/mood").send({ mood: mood }).expect(400);
    expect(await db.getMood(id, todayFor(), 30)).toEqual([]);
  });

  test("заметка: 300 символов можно, 301 и не строка — нельзя, нулевой символ не ломает запрос", async function () {
    const { agent } = await signedIn();
    await agent.put("/api/mood").send({ mood: 3, note: "я".repeat(300) }).expect(200);
    const long = await agent.put("/api/mood").send({ mood: 3, note: "я".repeat(301) });
    expect(long.status).toBe(400);
    expect(long.body.error).toMatch(/300/);
    await agent.put("/api/mood").send({ mood: 3, note: 12 }).expect(400);
    const zero = await agent.put("/api/mood").send({ mood: 3, note: "a\u0000b" });
    expect(zero.status).toBe(200);
    expect(zero.body.entry.note).toBe("ab");
  });
});

describe("результаты теста", function () {
  test.each([[0, "low"], [6, "low"], [7, "mid"], [13, "mid"], [14, "high"], [21, "high"]])("%i баллов — %s", async function (score, level) {
    const { agent } = await signedIn();
    const res = await agent.post("/api/wellbeing").send({ score: score, level: "low" });  // присланный уровень не важен
    expect(res.status).toBe(201);
    expect(res.body.result).toMatchObject({ score: score, level: level });
    const read = await agent.get("/api/wellbeing");
    expect(read.body.results[0]).toMatchObject({ score: score, level: level });
  });

  test.each([-1, 22, 1.5, "7", null, undefined])("score %p — 400", async function (score) {
    const { agent } = await signedIn();
    await agent.post("/api/wellbeing").send({ score: score }).expect(400);
  });

  test("отдаются последние 10, новые первыми", async function () {
    const { agent } = await signedIn();
    for (let score = 0; score < 12; score++) await agent.post("/api/wellbeing").send({ score: score }).expect(201);
    const res = await agent.get("/api/wellbeing");
    expect(res.body.results.map(function (r) { return r.score; })).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });
});

describe("доступ", function () {
  test("без входа — 401 везде, модель не вызывается", async function () {
    const guest = request(app);
    await guest.get("/api/mood").expect(401);
    await guest.put("/api/mood").send({ mood: 3 }).expect(401);
    await guest.get("/api/wellbeing").expect(401);
    await guest.post("/api/wellbeing").send({ score: 3 }).expect(401);
    await guest.put("/api/settings/share-wellbeing").send({ enabled: true }).expect(401);
    const res = await guest.post("/api/consultant/insight");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Войдите/);
    expect(model).not.toHaveBeenCalled();
  });

  test("чужие данные недоступны и не меняются", async function () {
    const first = await signedIn();
    const second = await signedIn();
    await first.agent.put("/api/mood").send({ mood: 1, note: "Секрет" }).expect(200);
    await first.agent.post("/api/wellbeing").send({ score: 20 }).expect(201);
    await first.agent.put("/api/settings/share-wellbeing").send({ enabled: true }).expect(200);

    expect((await second.agent.get("/api/mood?userId=" + first.id)).body.entries).toEqual([]);
    const other = await second.agent.get("/api/wellbeing?userId=" + first.id);
    expect(other.body).toEqual({ results: [], shareWellbeing: false });

    // user_id из запроса не берётся: отметка второго не трогает отметку первого
    await second.agent.put("/api/mood").send({ mood: 5, user_id: first.id, userId: first.id }).expect(200);
    const rows = await first.agent.get("/api/mood");
    expect(rows.body.entries[0]).toMatchObject({ mood: 1, note: "Секрет" });
  });
});

describe("согласие", function () {
  test("включается и выключается; неверный формат — 400", async function () {
    const { agent, id } = await signedIn();
    expect((await agent.get("/api/wellbeing")).body.shareWellbeing).toBe(false);
    await agent.put("/api/settings/share-wellbeing").send({ enabled: true }).expect(200);
    expect(await db.getShareWellbeing(id)).toBe(true);
    expect((await agent.get("/api/wellbeing")).body.shareWellbeing).toBe(true);
    await agent.put("/api/settings/share-wellbeing").send({ enabled: false }).expect(200);
    expect(await db.getShareWellbeing(id)).toBe(false);
    await agent.put("/api/settings/share-wellbeing").send({ enabled: "true" }).expect(400);
    await agent.put("/api/settings/share-wellbeing").send({}).expect(400);
  });
});

describe("getWellbeingSummary", function () {
  test("без согласия — null, даже когда данные есть", async function () {
    const { id } = await signedIn();
    await addMoods(id, { 0: 1, 1: 1 });
    expect(await getWellbeingSummary(id, db)).toBeNull();
  });

  test("с согласием, но без данных — null", async function () {
    const { id } = await signedIn();
    await db.setShareWellbeing(id, true);
    expect(await getWellbeingSummary(id, db)).toBeNull();
  });

  test("с согласием — среднее за 7 дней, плохие дни в конце, последний тест; заметок нет", async function () {
    const { id } = await signedIn();
    await db.setShareWellbeing(id, true);
    // 10 дней назад не входит в среднее: (5 + 2 + 1) / 3
    await addMoods(id, { 10: 1, 6: 5, 1: 2, 0: 1 }, "ЗАМЕТКА-СЕКРЕТ");
    await db.addWellbeingResult(id, 15, "high");

    const summary = await getWellbeingSummary(id, db);
    expect(summary).toMatch(/за 7 дней: 2,7 из 5/);
    expect(summary).toMatch(/подряд в конце: 2/);
    expect(summary).toMatch(/нагрузка высокая/);
    expect(summary).toContain(String(new Date().getFullYear()));
    expect(summary).not.toContain("ЗАМЕТКА-СЕКРЕТ");
  });

  test("серия обрывается на хорошей отметке; без теста и без отметок за неделю — так и написано", async function () {
    const { id } = await signedIn();
    await db.setShareWellbeing(id, true);
    await addMoods(id, { 20: 1, 15: 4, 10: 2 });
    const summary = await getWellbeingSummary(id, db);
    expect(summary).toMatch(/подряд в конце: 1/);
    expect(summary).toMatch(/За последние 7 дней отметок настроения нет/);
    expect(summary).toMatch(/Тест на нагрузку не проходили/);
  });

  test("в разговоре «Мне тяжело» сводка попадает к модели только с согласием и без заметок", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 0: 2 }, "ЗАМЕТКА-СЕКРЕТ");
    await agent.post("/api/consultant").send({ message: "Мне тяжело", mode: "support" }).expect(200);
    expect(model.mock.calls[0][0]).toBe(INSTRUCTIONS.support);

    await agent.put("/api/settings/share-wellbeing").send({ enabled: true }).expect(200);
    await agent.post("/api/consultant").send({ message: "Мне тяжело", mode: "support" }).expect(200);
    expect(model.mock.calls[1][0]).toMatch(/Самочувствие собеседника:[\s\S]*Средняя оценка настроения/);
    expect(JSON.stringify(model.mock.calls)).not.toContain("ЗАМЕТКА-СЕКРЕТ");

    await agent.post("/api/consultant").send({ message: "Как обработать ожог?", mode: "care" }).expect(200);
    expect(model.mock.calls[2][0]).toBe(INSTRUCTIONS.care);
  });

  test("сводка не прочиталась — разговор всё равно идёт", async function () {
    const { agent } = await signedIn();
    const original = db.getShareWellbeing;
    const quiet = jest.spyOn(console, "error").mockImplementation(function () {});
    db.getShareWellbeing = function () { return Promise.reject(new Error("база недоступна")); };
    const res = await agent.post("/api/consultant").send({ message: "Мне тяжело", mode: "support" });
    db.getShareWellbeing = original;
    quiet.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("answer");
    expect(model.mock.calls[0][0]).toBe(INSTRUCTIONS.support);
  });
});

describe("комментарий консультанта", function () {
  test("меньше 3 отметок — 400, модель не вызывается", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 0: 3, 1: 3 });
    const res = await agent.post("/api/consultant/insight");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 отметки/);
    expect(model).not.toHaveBeenCalled();
  });

  test("работает по нажатию и без галочки: модель в режиме support получает сводку без заметок", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 2: 4, 1: 5, 0: 4 }, "ЗАМЕТКА-СЕКРЕТ");
    const res = await agent.post("/api/consultant/insight");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: "answer", needsTalk: false });
    expect(res.body.answer).toMatch(/короткую паузу/);
    const instructions = model.mock.calls[0][0];
    expect(instructions).toContain(INSTRUCTIONS.support);
    expect(instructions).toMatch(/Средняя оценка настроения за 7 дней: 4,3/);
    expect(instructions).toMatch(/2–3 тёплые фразы/);
    expect(instructions).toMatch(/Диагнозы не ставь/);
    expect(instructions).not.toMatch(/обязательно мягко предложи/);
    expect(JSON.stringify(model.mock.calls)).not.toContain("ЗАМЕТКА-СЕКРЕТ");
  });

  test("плохие дни подряд: разговор и специалист предлагаются, даже если модель о них не написала", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 2: 4, 1: 2, 0: 1 });
    const res = await agent.post("/api/consultant/insight");
    expect(res.body.needsTalk).toBe(true);
    expect(model.mock.calls[0][0]).toMatch(/обязательно мягко предложи/);
    expect(res.body.answer).toMatch(/короткую паузу/);
    expect(res.body.answer).toMatch(/поговорим/);
    expect(res.body.answer).toMatch(/психологом/);
  });

  test("высокая нагрузка в тесте: то же; если модель сама предложила — ничего не дописываем", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 2: 4, 1: 4, 0: 4 });
    await db.addWellbeingResult(id, 18, "high");
    const own = "Давайте поговорим здесь, а ещё хорошо бы обратиться к психологу.";
    model.mockResolvedValue(own);
    const res = await agent.post("/api/consultant/insight");
    expect(res.body.needsTalk).toBe(true);
    expect(res.body.answer).toBe(own);
  });

  test("модель не ответила — понятное сообщение; отказалась — готовые слова, а не её фраза", async function () {
    const { agent, id } = await signedIn();
    await addMoods(id, { 2: 4, 1: 4, 0: 4 });
    const quiet = jest.spyOn(console, "error").mockImplementation(function () {});
    model.mockRejectedValue(new Error("нет связи"));
    const down = await agent.post("/api/consultant/insight");
    expect(down.status).toBe(200);
    expect(down.body.type).toBe("unavailable");
    expect(down.body.answer).toMatch(/недоступен/);

    model.mockReset();
    model.mockResolvedValue("Не могу обсуждать эту тему. Поговорим о чём-нибудь другом?");
    const refused = await agent.post("/api/consultant/insight");
    quiet.mockRestore();
    expect(refused.body.answer).not.toMatch(/Не могу обсуждать/);
    expect(refused.body.answer).toMatch(/забота о себе/);
  });

  test("лимит общий с вопросами консультанту", async function () {
    const limited = createApp({ db: db, jwtSecret: SECRET, bcryptRounds: 4, callModel: model, registerLimit: 1000, consultantLimit: 2 });
    const agent = request.agent(limited);
    userCount++;
    const email = "mood" + userCount + "@example.ru";
    await agent.post("/api/register").send({ email: email, password: "password123" }).expect(201);
    await addMoods((await db.findUserByEmail(email)).id, { 2: 4, 1: 4, 0: 4 });

    await agent.post("/api/consultant").send({ message: "Как обработать ожог?" }).expect(200);
    await agent.post("/api/consultant/insight").expect(200);
    const res = await agent.post("/api/consultant/insight");
    expect(res.status).toBe(429);
  });
});
