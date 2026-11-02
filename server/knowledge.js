/*
  Знания консультанта — тексты тем из js/data.js.

  Как сервер читает data.js: файл выполняется как есть в отдельной «песочнице» (модуль vm),
  и оттуда забираются TOPICS, SECTIONS и CONSULTANT. Сам data.js не меняется — сайт в браузере
  работает как раньше. Если data.js изменили, сервер перечитает его при следующем вопросе.

  Поиск: слова вопроса и тем приводятся к «основе» (отрезаются русские окончания),
  у каждой темы считается вес совпадений. Внешних библиотек нет.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_FILE = path.join(__dirname, "..", "js", "data.js");

/* Служебные слова, по которым искать бессмысленно */
const STOP_WORDS = new Set((
  "и в во не на с со по за из к ко у о об от до для при без над под про а но да или ли же бы то " +
  "что как так это этот эта эти тот та те он она оно они мы вы я ты его ее их мне меня нам нас вам вас " +
  "мой моя мое мои наш наша свой своя есть был была были быть будет если когда где куда чем чтобы " +
  "можно нужно надо ли ещё еще уже очень только тоже также какой какая какие каких делать сделать " +
  "что-то кто здравствуйте привет добрый день вечер пожалуйста спасибо подскажите скажите помогите вопрос " +
  "сколько стоит стоить много мало всегда никогда сейчас потом тогда себя себе"
).split(" "));

/* Окончания — от длинных к коротким. Отрезается первое подходящее, если основа остаётся не короче 3 букв */
const ENDINGS = [
  "иями", "ями", "ами", "иях", "ией", "ого", "его", "ому", "ему", "ыми", "ими", "ешь", "ишь",
  "ться", "тся", "ать", "ять", "еть", "ить", "уть",
  "ой", "ей", "ий", "ый", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ах", "ях", "ам", "ям",
  "ом", "ем", "ов", "ев", "ия", "ья", "ью", "ию", "ет", "ит", "ут", "ют", "ат", "ят", "ал", "ял", "ил", "ла", "ли",
  "а", "я", "о", "е", "ы", "и", "у", "ю", "ь", "й"
];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е");
}

function stem(word) {
  word = word.replace(/(ся|сь)$/, "");  // «обожглась» → «обожгла»
  for (const ending of ENDINGS) {
    if (word.endsWith(ending) && word.length - ending.length >= 3) return word.slice(0, -ending.length);
  }
  return word;
}

/* Текст → список основ значимых слов */
function stems(text) {
  return (normalize(text).match(/[а-яa-z0-9]+/g) || [])
    .filter(function (w) { return w.length >= 3 && !STOP_WORDS.has(w); })
    .map(stem);
}

/* Совпадают ли основы: равны или одна начинается с другой (не короче 5 букв) — «перевяз»/«перевязк» */
function stemsMatch(a, b) {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return short.length >= 5 && long.startsWith(short);
}

/* Весь текст темы для модели: описание, подробности, памятки, частые вопросы (без теста) */
function topicMaterial(topic, section) {
  const lines = ["Тема: " + topic.title + (section ? " (" + section.title + ")" : "")];
  function add(label, value) {
    if (Array.isArray(value)) value = value.filter(Boolean).map(function (v) { return "— " + v; }).join("\n");
    if (value) lines.push(label + ":\n" + value);
  }
  function addMemo(prefix, memo) {
    memo = memo || {};
    add(prefix + " — что делать", memo.doList);
    add(prefix + " — чего нельзя", memo.dontList);
    add(prefix + " — " + ((section && section.urgentTitle) || "когда срочно к врачу").toLowerCase(), memo.urgentList);
  }
  add("Кратко", topic.description);
  add("Введение", topic.intro);
  add("Подробно", (topic.details || []).join("\n"));
  addMemo("Памятка урока", topic.lessonMemo);
  addMemo("Памятка справочника", topic.memo);
  add("Частые вопросы", (topic.faq || []).filter(function (f) { return f && f.q; }).map(function (f) { return f.q + " " + f.a; }));
  return lines.join("\n\n");
}

/* Индекс темы: основа слова → вес. Название весит больше всего, потом ключевые слова, описание, остальной текст */
function buildIndex(topic, keywords) {
  const weights = new Map();
  function addStems(list, weight, cap) {
    const counts = new Map();
    list.forEach(function (s) { counts.set(s, (counts.get(s) || 0) + 1); });
    counts.forEach(function (count, s) {
      weights.set(s, (weights.get(s) || 0) + weight * Math.min(count, cap));
    });
  }
  function addText(text, weight, cap) {
    addStems(stems(text), weight, cap);
  }
  addText(topic.title, 8, 1);
  addText(topic.articleTitle, 3, 1);
  // Ключевые слова консультанта в data.js — уже основы («ожог», «кипят»), их не обрезаем
  addStems((keywords || []).map(normalize).filter(function (k) { return k.length >= 3; }), 5, 1);
  addText(topic.description + " " + (topic.intro || ""), 2, 2);
  addText(topicMaterial(topic), 1, 3);
  return weights;
}

let cache = null;  // { mtime, topics: [...] }

/* Загрузить (или перечитать изменённый) data.js */
function load() {
  const mtime = fs.statSync(DATA_FILE).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;

  const code = fs.readFileSync(DATA_FILE, "utf8");
  const data = vm.runInNewContext(code + "\n;({ TOPICS: TOPICS, SECTIONS: SECTIONS, CONSULTANT: CONSULTANT })", {}, { filename: "data.js" });
  const keywordsByTopic = {};
  ((data.CONSULTANT && data.CONSULTANT.answers) || []).forEach(function (a) { keywordsByTopic[a.topicId] = a.keywords; });

  const topics = data.TOPICS.map(function (topic) {
    const section = data.SECTIONS.find(function (s) { return s.id === topic.section; });
    return {
      id: topic.id,
      title: topic.title,
      kind: topic.kind,
      material: topicMaterial(topic, section),
      index: buildIndex(topic, keywordsByTopic[topic.id])
    };
  });
  cache = { mtime: mtime, topics: topics };
  return cache;
}

/* Ссылка на тему: урок — на страницу урока, тема справочника — на статью */
function sourceOf(topic) {
  const isLesson = topic.kind === "lesson";
  return {
    topicId: topic.id,
    title: topic.title,
    kind: isLesson ? "lesson" : "article",
    url: (isLesson ? "lesson.html?id=" : "article.html?id=") + encodeURIComponent(topic.id)
  };
}

/* 2–3 самые подходящие темы. Темы, которые сильно слабее лучшей, отбрасываются */
function search(question, limit) {
  limit = limit || 3;
  const query = Array.from(new Set(stems(question)));
  if (!query.length) return [];

  const scored = load().topics.map(function (topic) {
    let score = 0;
    query.forEach(function (q) {
      let best = 0;
      topic.index.forEach(function (weight, s) {
        if (weight > best && stemsMatch(q, s)) best = weight;
      });
      score += best;
    });
    return { topic: topic, score: score };
  }).filter(function (r) { return r.score > 0; });

  scored.sort(function (a, b) { return b.score - a.score; });
  const top = scored.length ? scored[0].score : 0;
  return scored.filter(function (r) { return r.score >= top * 0.3; }).slice(0, limit).map(function (r) { return r.topic; });
}

/* Фразы «до приезда скорой…» из материалов сайта (для тревожного ответа). Сейчас таких фраз в data.js нет */
function firstAidHints(topics) {
  const hints = [];
  topics.forEach(function (topic) {
    (topic.material.match(/[^\n.!?]*до приезда[^\n.!?]*[.!?]?/gi) || []).forEach(function (s) {
      s = s.replace(/^[—\s]+/, "").trim();
      if (s && hints.indexOf(s) === -1) hints.push(s);
    });
  });
  return hints.slice(0, 3);
}

function allTopics() {
  return load().topics;
}

module.exports = { search, sourceOf, firstAidHints, allTopics, stems, stem };
