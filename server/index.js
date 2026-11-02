/*
  Запуск сервера: npm start
  Перед этим должна работать база: docker compose up -d
*/
const { readConfig } = require("./config");
const { createDb } = require("./db");
const { createApp } = require("./app");

async function main() {
  const { config, problems } = readConfig();
  if (problems.length) {
    console.error("Не получается запустить сервер — проверьте файл .env:");
    problems.forEach(function (p) { console.error("  • " + p); });
    console.error("Образец настроек — в файле .env.example.");
    process.exit(1);
  }

  const db = createDb(config.databaseUrl);
  try {
    await db.init();  // создать таблицы, если их ещё нет
  } catch (e) {
    console.error("Не удалось подключиться к базе данных: " + e.message);
    console.error("Запустите базу командой «docker compose up -d» и проверьте DATABASE_URL в .env.");
    process.exit(1);
  }

  const app = createApp({ db: db, jwtSecret: config.jwtSecret, cookieSecure: config.cookieSecure });
  app.listen(config.port, function () {
    console.log("Сервер запущен. Сайт: http://localhost:" + config.port);
    console.log("Остановить: Ctrl + C");
  });
}

main();
