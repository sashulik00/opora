/*
  Проверка заголовков безопасности: чужие плееры видео разрешены, остальная защита не ослаблена.
  Запуск: npm test
*/
const request = require("supertest");
const { createApp } = require("../app");

// Сами запросы в базу здесь не идут: нужна только страница и её заголовки
const app = createApp({ db: {}, jwtSecret: "test-secret-test-secret-test-secret-1234", bcryptRounds: 4 });

/* Заголовок Content-Security-Policy в виде { директива: [значения] } */
async function cspOf(path) {
  const res = await request(app).get(path).expect(200);
  const directives = {};
  res.headers["content-security-policy"].split(";").forEach(function (part) {
    const words = part.trim().split(/\s+/);
    if (words[0]) directives[words[0]] = words.slice(1);
  });
  return directives;
}

describe("заголовки безопасности", function () {
  test("frame-src разрешает плееры Rutube, Дзена и VK", async function () {
    const csp = await cspOf("/lesson.html");
    expect(csp["frame-src"]).toEqual(expect.arrayContaining([
      "'self'",
      "https://rutube.ru", "https://*.rutube.ru",
      "https://dzen.ru", "https://*.dzen.ru",
      "https://vkvideo.ru", "https://*.vkvideo.ru",
      "https://vk.com", "https://*.vk.com",
      "https://vk.ru", "https://*.vk.ru"
    ]));
  });

  test("в frame-src нет разрешения на любые сайты", async function () {
    const csp = await cspOf("/lesson.html");
    ["*", "https:", "http:", "data:"].forEach(function (source) {
      expect(csp["frame-src"]).not.toContain(source);
    });
  });

  test("остальная политика не ослаблена", async function () {
    const csp = await cspOf("/lesson.html");
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
  });

  test("Referrer-Policy — strict-origin-when-cross-origin", async function () {
    const res = await request(app).get("/lesson.html").expect(200);
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
