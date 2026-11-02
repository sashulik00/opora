/*
  Перед тестами: создать отдельную базу opora_test (в том же PostgreSQL), если её ещё нет.
  Основная база opora тестами не трогается.
*/
const { Client } = require("pg");
const { readConfig } = require("../config");

module.exports = async function () {
  const { config } = readConfig();
  if (!config.testDatabaseUrl) throw new Error("Не задан TEST_DATABASE_URL в файле .env");

  const testUrl = new URL(config.testDatabaseUrl);
  const dbName = testUrl.pathname.slice(1);
  if (!/^\w+$/.test(dbName)) throw new Error("Странное имя тестовой базы: " + dbName);

  // Подключаемся к служебной базе postgres того же сервера и создаём тестовую
  const adminUrl = new URL(config.testDatabaseUrl);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (e) {
    throw new Error("Нет связи с базой (" + e.message + "). Запустите её: docker compose up -d");
  }
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!exists.rowCount) await client.query("CREATE DATABASE " + dbName);
  await client.end();
};
