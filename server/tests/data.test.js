/*
  Проверка содержимого js/data.js: на сайте нет заглушек, тесты есть только у уроков,
  ответы консультанта без сервера ведут на свою тему и не называют лекарств.
  Запуск: npm test
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "data.js"), "utf8") +
  ";this.TOPICS = TOPICS; this.SECTIONS = SECTIONS; this.CONSULTANT = CONSULTANT; this.WELLBEING = WELLBEING; this.GLOSSARY = GLOSSARY;", context);
const { TOPICS, SECTIONS, CONSULTANT, WELLBEING, GLOSSARY } = context;

test("в описаниях разделов и ответах консультанта нет заглушек", function () {
  SECTIONS.forEach(function (s) {
    expect(s.description).not.toMatch(/заглушк/i);
    expect(s.description.length).toBeGreaterThan(20);
  });
  CONSULTANT.answers.forEach(function (a) { expect(a.text).not.toMatch(/заглушк/i); });
});

test("у каждого уровня теста три совета", function () {
  expect(WELLBEING.levels.map(function (l) { return l.id; })).toEqual(["low", "mid", "high"]);
  WELLBEING.levels.forEach(function (l) { expect(l.list).toHaveLength(3); });
});

test("в темах не осталось вопросов-заглушек", function () {
  expect(JSON.stringify(TOPICS)).not.toMatch(/заглушк/i);
});

test("тест есть у каждого урока и нет ни у одной темы справочника", function () {
  TOPICS.forEach(function (t) {
    if (t.kind === "lesson") expect(t.quiz.length).toBeGreaterThan(0);
    else expect(t.quiz).toBeUndefined();
  });
});

test("у тем справочника нет практики: кнопка «К тесту» в практике на них не выводит", function () {
  TOPICS.filter(function (t) { return t.kind !== "lesson"; }).forEach(function (t) {
    expect(t.practice).toBeUndefined();
  });
});

test("ответы консультанта без сервера: 2–3 предложения, ссылка на свою тему, без лекарств и доз", function () {
  expect(CONSULTANT.answers).toHaveLength(16);
  CONSULTANT.answers.forEach(function (a) {
    const topic = TOPICS.find(function (t) { return t.id === a.topicId; });
    const ending = " Подробнее в теме «" + topic.title + "».";
    expect(a.text.endsWith(ending)).toBe(true);

    // Точки внутри кавычек («…?») предложение не заканчивают
    const body = a.text.slice(0, -ending.length).replace(/«[^»]*»/g, "«»");
    const sentences = body.split(/[.!?](?:\s|$)/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(3);

    expect(a.text).not.toMatch(/\d+\s*(мг|мл|таблет|капс|раз[а]? в день)|антибиотик|антисептик|снотворн|обезболивающ|таблетк/i);
  });
});

test("статьи уроков: 2–4 раздела, 400–700 слов, не повторяют текст урока, без лекарств и доз", function () {
  const lessons = TOPICS.filter(function (t) { return t.kind === "lesson"; });
  expect(lessons).toHaveLength(10);
  lessons.forEach(function (t) {
    expect(t.article.length).toBeGreaterThanOrEqual(2);
    expect(t.article.length).toBeLessThanOrEqual(4);
    const paragraphs = t.article.reduce(function (all, part) {
      expect(part.heading.length).toBeGreaterThan(0);
      expect(part.text.length).toBeGreaterThan(0);
      return all.concat(part.text);
    }, []);
    const text = t.article.map(function (part) { return part.heading; }).concat(paragraphs).join(" ");
    const words = text.split(/\s+/).filter(function (w) { return /[а-яё0-9]/i.test(w); }).length;
    expect(words).toBeGreaterThanOrEqual(400);
    expect(words).toBeLessThanOrEqual(700);
    paragraphs.forEach(function (p) { expect(t.details).not.toContain(p); });
    expect(text).not.toMatch(/\d+\s*(мг|мл|таблет|капс|раз[а]? в день)|антибиотик|антисептик|снотворн|обезболивающ|таблетк|ПТСР/i);
    // Номера телефонов — только в js/phones.js
    expect(text).not.toMatch(/8-800/);
  });
});

test("у тем справочника статья прежняя: поля article нет", function () {
  TOPICS.filter(function (t) { return t.kind !== "lesson"; }).forEach(function (t) {
    expect(t.article).toBeUndefined();
    expect(t.details.length).toBeGreaterThan(0);
  });
});

test("словарь: 10 терминов, номер телефона только из js/phones.js", function () {
  const { CRISIS_PHONES } = require("../../js/phones");
  expect(GLOSSARY).toHaveLength(10);
  GLOSSARY.forEach(function (item) {
    expect(item.term.length).toBeGreaterThan(0);
    expect(item.text.length).toBeGreaterThan(0);
    if (item.phone) expect(CRISIS_PHONES.map(function (p) { return p.tel; })).toContain(item.phone);
  });
  expect(GLOSSARY.filter(function (item) { return item.phone; }).map(function (item) { return item.term; })).toEqual(["Фонд «Защитники Отечества»"]);
  expect(JSON.stringify(GLOSSARY)).not.toMatch(/8-800|затем 1/);
});

test("новые ответы и источник на месте", function () {
  const topic = function (id) { return TOPICS.find(function (t) { return t.id === id; }); };
  const questions = function (id) { return topic(id).faq.map(function (f) { return f.q; }); };
  expect(questions("disability")).toContain("Что такое «военная травма» и почему важна формулировка?");
  expect(questions("prosthetics")).toContain("Нужно ли участнику СВО писать заявление на средства реабилитации?");
  expect(questions("prosthetics")).toContain("Где можно потратить сертификат?");
  expect(questions("payments")).toEqual(expect.arrayContaining(["Какие выплаты положены при ранении?", "Какие льготы положены участникам СВО?"]));
  expect(questions("documents")).toContain("Как получить удостоверение ветерана боевых действий?");
  const paymentsSources = topic("payments").sources.map(function (s) { return s.url; });
  expect(paymentsSources).toContain("https://legalacts.ru/doc/ukaz-prezidenta-rf-ot-05032022-n-98-o-dopolnitelnykh/");
  expect(paymentsSources.join(" ")).not.toContain("harant");
  expect(topic("prosthetics").sources.map(function (s) { return s.url; })).toContain(
    "https://xn--90aivcdt6dxbc.xn--p1ai/articles/news/poryadok-vydachi-sredstv-reabilitatsii-dlya-uchastnikov-svo-uproshchen/");
});

