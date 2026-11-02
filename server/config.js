/*
  Настройки сервера. Берутся из файла .env в корне проекта
  (образец со всеми полями — .env.example).
*/
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

function readConfig() {
  const config = {
    port: Number(process.env.PORT) || 3000,
    databaseUrl: process.env.DATABASE_URL,
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // true — cookie только по https (на настоящем хостинге). На своём компьютере (http://localhost) — false
    cookieSecure: process.env.COOKIE_SECURE === "true"
  };

  const problems = [];
  if (!config.databaseUrl) problems.push("не задан DATABASE_URL (адрес базы данных)");
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    problems.push("JWT_SECRET (секрет для входа) не задан или короче 32 символов");
  }
  return { config: config, problems: problems };
}

module.exports = { readConfig };
