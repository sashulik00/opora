/*
  Модель Яндекс AI Studio (OpenAI-совместимый Responses API — как в примере кода Яндекса).
  Ключ, ID каталога, модель и адрес — только из .env:
    YANDEX_CLOUD_API_KEY, YANDEX_CLOUD_FOLDER, YANDEX_CLOUD_MODEL, YANDEX_API_BASE_URL
*/
const { OpenAI } = require("openai");

const DEFAULT_MODEL = "aliceai-llm-flash/latest";
const DEFAULT_BASE_URL = "https://ai.api.cloud.yandex.net/v1";

function createYandexModel(env) {
  env = env || process.env;
  const apiKey = env.YANDEX_CLOUD_API_KEY;
  const folder = env.YANDEX_CLOUD_FOLDER;

  if (!apiKey || !folder) {
    // Без ключа консультант отвечает запасным сообщением со списком уроков
    return async function () {
      throw new Error("не заданы YANDEX_CLOUD_API_KEY или YANDEX_CLOUD_FOLDER в .env");
    };
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: env.YANDEX_API_BASE_URL || DEFAULT_BASE_URL,
    project: folder,
    timeout: 30000,
    maxRetries: 1
  });
  const model = "gpt://" + folder + "/" + (env.YANDEX_CLOUD_MODEL || DEFAULT_MODEL);

  /* instructions — системная инструкция; input — список реплик [{ role, content }] */
  return async function callModel(instructions, input) {
    const response = await client.responses.create({
      model: model,
      instructions: instructions,
      input: input,
      temperature: 0.3,
      max_output_tokens: 1000
    });
    const text = (response.output_text || "").trim();
    if (!text) throw new Error("модель вернула пустой ответ");
    return text;
  };
}

module.exports = { createYandexModel };
