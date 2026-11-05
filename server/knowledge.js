/*
  Знания консультанта — тексты тем из js/data.js.

  Как сервер читает data.js: файл выполняется как есть в отдельной «песочнице» (модуль vm),
  и оттуда забираются TOPICS, SECTIONS, CONSULTANT и GLOSSARY. Сам data.js не меняется — сайт в браузере
  работает как раньше. Если data.js изменили, сервер перечитает его при следующем вопросе.

  Поиск: слова вопроса и тем приводятся к «основе» (отрезаются русские окончания),
  у каждой темы считается вес совпадений. Опечатки прощаются (расстояние Левенштейна),
  разговорные слова понимаются по словарю server/synonyms.js. Внешних библиотек нет.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SYNONYMS = require("./synonyms");
const { CRISIS_PHONES } = require("../js/phones");

const DATA_FILE = path.join(__dirname, "..", "js", "data.js");

const SYNONYM_WEIGHT = 20;    // слово вопроса из словаря темы весит больше, чем любое другое слово
const WORD_MAX = 10;          // одно слово вопроса приносит теме не больше этого, сколько бы раз оно ни встречалось в её тексте
const FUZZY_FACTOR = 0.6;     // слово с опечаткой весит меньше точного
const FUZZY_MIN_WEIGHT = 2;   // опечатки ищем только среди важных слов темы: случайных совпадений в длинном тексте не нужно
const MIN_SCORE = 4;          // тема слабее этого — считаем, что не нашлась (одно слово где-то в тексте — ещё не тема)

/* Служебные слова, по которым искать бессмысленно */
const STOP_WORDS = new Set((
  "и в во не на с со по за из к ко у о об от до для при без над под про а но да или ли же бы то " +
  "что как так это этот эта эти тот та те он она оно они мы вы я ты его ее их мне меня нам нас вам вас " +
  "мой моя мое мои наш наша свой своя свое свою свои своих своим своими своей своего своему своем есть был была были быть будет если когда где куда чем чтобы " +
  "можно нужно надо ли ещё еще уже очень только тоже также какой какая какие каких делать сделать " +
  "что-то кто здравствуйте привет добрый день вечер пожалуйста спасибо подскажите скажите помогите вопрос " +
  "сколько стоит стоить много мало всегда никогда сейчас потом тогда себя себе " +
  // Слова, которые есть почти в каждой теме или ничего не говорят о теме
  "него неё ней нельзя после перед почему зачем хочу могу может нужен нужна дела дело " +
  "расскажи расскажите рассказать напиши напишите посоветуй посоветуйте приготовить приготовьте " +
  "уход ухода уходу уходе ухаживать ухаживаю ухаживает"
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

/* Сколько опечаток прощаем слову: от 5 букв — одну, от 9 — две */
function allowedErrors(word) {
  if (word.length >= 9) return 2;
  return word.length >= 5 ? 1 : 0;
}

/* Расстояние Левенштейна, но не больше max: дальше считать незачем, вернётся max + 1 */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = [];
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (current[j] < best) best = current[j];
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/* Похожи ли основы с учётом опечаток. Первая буква должна совпасть: в ней почти не ошибаются,
   зато так «дочь» не станет «ночью». Совсем короткие основы не сравниваем */
function isTypoOf(word, queryStem, indexStem) {
  const max = allowedErrors(word.length <= indexStem.length + 1 ? word : word.slice(0, indexStem.length + 1));
  if (!max || queryStem.length < 4 || indexStem.length < 4 || queryStem[0] !== indexStem[0]) return false;
  return editDistance(queryStem, indexStem, max) <= max;
}

/* Основа слова без отбрасывания служебных: нужна для фраз словаря («не сплю», «нет сил») */
function wordsOf(text) {
  return (normalize(text).match(/[а-яa-z0-9]+/g) || []).map(function (w) {
    return { word: w, stem: stem(w) };
  });
}

/* Словарь: тема → список фраз, каждая фраза — список основ */
const SYNONYM_PHRASES = Object.keys(SYNONYMS).map(function (id) {
  return { id: id, phrases: SYNONYMS[id].map(wordsOf) };
});

/* Где фраза словаря стоит в вопросе: все слова подряд, с учётом окончаний и опечаток. Нет — -1 */
function findPhrase(words, phrase) {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    const fits = phrase.every(function (p, j) {
      const w = words[i + j];
      return stemsMatch(w.stem, p.stem) || isTypoOf(w.word, w.stem, p.stem);
    });
    if (fits) return i;
  }
  return -1;
}

/* Темы, чьи фразы из словаря есть в вопросе. Возвращает { id темы: основы слов вопроса, которые эти фразы покрыли } */
function synonymHits(question) {
  const words = wordsOf(question);
  const hits = {};
  SYNONYM_PHRASES.forEach(function (entry) {
    entry.phrases.forEach(function (phrase) {
      const at = findPhrase(words, phrase);
      if (at === -1) return;
      hits[entry.id] = hits[entry.id] || new Set();
      phrase.forEach(function (p, j) { hits[entry.id].add(words[at + j].stem); });
    });
  });
  return hits;
}

/* Совпадают ли основы: равны или одна начинается с другой (не короче 5 букв) — «перевяз»/«перевязк» */
function stemsMatch(a, b) {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return short.length >= 5 && long.startsWith(short);
}

/* Весь текст темы для модели: описание, подробности, статья, памятки, частые вопросы (без теста) */
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
  add("Статья", (topic.article || []).map(function (part) { return part.heading + "\n" + part.text.join("\n"); }).join("\n\n"));
  addMemo("Памятка урока", topic.lessonMemo);
  addMemo("Памятка справочника", topic.memo);
  add("Частые вопросы", (topic.faq || []).filter(function (f) { return f && f.q; }).map(function (f) { return f.q + " " + f.a; }));
  return lines.join("\n\n");
}

/* Все пункты памяток темы: урока и справочника */
function memoText(topic) {
  return [topic.lessonMemo, topic.memo].map(function (memo) {
    memo = memo || {};
    return [].concat(memo.doList || [], memo.dontList || [], memo.urgentList || []).filter(Boolean).join(" ");
  }).join(" ");
}

/* Индекс темы: основа слова → вес. Название весит больше всего, потом ключевые слова, памятка, вступление, остальной текст */
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
  addText(memoText(topic), 3, 2);
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
  const data = vm.runInNewContext(code + "\n;({ TOPICS: TOPICS, SECTIONS: SECTIONS, CONSULTANT: CONSULTANT, GLOSSARY: GLOSSARY })", {}, { filename: "data.js" });
  const keywordsByTopic = {};
  ((data.CONSULTANT && data.CONSULTANT.answers) || []).forEach(function (a) { keywordsByTopic[a.topicId] = a.keywords; });

  const topics = data.TOPICS.map(function (topic) {
    const section = data.SECTIONS.find(function (s) { return s.id === topic.section; });
    return {
      id: topic.id,
      title: topic.title,
      kind: topic.kind,
      section: topic.section,
      material: topicMaterial(topic, section),
      index: buildIndex(topic, keywordsByTopic[topic.id])
    };
  });
  const glossary = data.GLOSSARY.map(function (item) {
    const phone = CRISIS_PHONES.find(function (p) { return p.tel === item.phone; });
    const names = [item.term].concat(item.keywords || []);
    return {
      text: item.term + " — " + item.text + (phone ? " Телефон: " + phone.number : ""),
      phrases: names.map(wordsOf),
      questionStems: stems(names.join(" ")),
      answerStems: stems(item.text)
    };
  });
  const faq = [];
  topics.forEach(function (topic, i) {
    (data.TOPICS[i].faq || []).filter(function (f) { return f && f.q; }).forEach(function (f) {
      faq.push({
        text: "«" + f.q + "»\n" + f.a,
        topicId: topic.id,
        keywords: (f.keywords || []).map(wordsOf),
        questionStems: stems(f.q),
        answerStems: stems(f.a)
      });
    });
  });
  cache = { mtime: mtime, topics: topics, glossary: glossary, faq: faq };
  return cache;
}

/* Есть ли термин в вопросе. Короткое сокращение — только точным словом: основа «СВО» совпала бы с «свой», «свои» */
function hasTerm(words, phrase) {
  if (phrase.length === 1 && phrase[0].word.length <= 3) {
    return words.some(function (w) { return w.word === phrase[0].word; });
  }
  return findPhrase(words, phrase) !== -1;
}

/* Определения из словаря для терминов, названных в вопросе: строки «Термин — пояснение» */
function searchGlossary(question) {
  const words = wordsOf(question);
  return load().glossary
    .filter(function (item) { return item.phrases.some(function (phrase) { return hasTerm(words, phrase); }); })
    .map(function (item) { return item.text; });
}

/* Слова о том, кто спрашивает и что хочет сделать, а не о чём вопрос: «как получить жильё участнику СВО» — вопрос о жилье */
const NOT_SUBJECT = stems("участник сво ветеран боец бойца раненый ранение получить оформить обратиться положены нужны");

/*
  Лучшее совпадение среди частых вопросов и словаря: ответ сайта, если модель отказалась.
  Слово вопроса приносит 2 балла, если оно есть в самом частом вопросе или в названии термина, и 1 — если только в ответе.
  Ключевая фраза частого вопроса (keywords) приносит 2 балла, даже если её слова выше не считаются.
  Частый вопрос подходит, если совпало слово его вопроса или ключевая фраза и при этом он из найденной темы либо набрал не меньше половины баллов.
  Термин словаря — так же, но ещё он должен быть назван в вопросе целиком: иначе «операция» найдёт «СВО».
  При равенстве выше запись, где совпало больше слов вопроса (и те, что не считаются выше), с более редким словом, из темы выше в поиске.
  Возвращает { text, topicId } или null
*/
function searchReference(question, foundTopics) {
  const words = wordsOf(question);
  const allStems = Array.from(new Set(stems(question)));
  const query = allStems.filter(function (s) {
    return !NOT_SUBJECT.some(function (x) { return stemsMatch(s, x); });
  });
  const data = load();
  const entries = data.faq.concat(data.glossary);
  function has(list, s) { return list.some(function (x) { return stemsMatch(s, x); }); }
  function rarity(s) {
    return 1 / Math.max(1, entries.filter(function (e) { return has(e.questionStems, s) || has(e.answerStems, s); }).length);
  }
  let best = null;
  entries.forEach(function (entry) {
    if (entry.phrases && !entry.phrases.some(function (phrase) { return hasTerm(words, phrase); })) return;
    const inQuestion = query.filter(function (s) { return has(entry.questionStems, s); });
    const byKeyword = (entry.keywords || []).some(function (phrase) { return hasTerm(words, phrase); }) ? 2 : 0;
    if (!inQuestion.length && !byKeyword) return;
    const inAnswer = query.filter(function (s) { return !has(entry.questionStems, s) && has(entry.answerStems, s); });
    const score = inQuestion.length * 2 + inAnswer.length + byKeyword;
    const rank = foundTopics.findIndex(function (t) { return t.id === entry.topicId; });
    if (rank === -1 && score < query.length) return;
    const fullMatch = allStems.filter(function (s) { return has(entry.questionStems, s); }).length;
    const value = score + fullMatch * 0.3 + inQuestion.reduce(function (sum, s) { return sum + rarity(s); }, 0) + (rank === -1 ? 0 : (foundTopics.length - rank) * 0.1);
    if (!best || value > best.value) best = { value: value, text: entry.text, topicId: entry.topicId || null };
  });
  return best && { text: best.text, topicId: best.topicId };
}

/* Ссылка на статью темы, в том числе темы-урока */
function articleSourceOf(topicId) {
  const topic = load().topics.find(function (t) { return t.id === topicId; });
  return { topicId: topic.id, title: topic.title, kind: "article", url: "article.html?id=" + encodeURIComponent(topic.id) };
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
  const words = (normalize(question).match(/[а-яa-z0-9]+/g) || [])
    .filter(function (w) { return w.length >= 3 && !STOP_WORDS.has(w); });
  const seen = new Set();
  const query = words
    .map(function (w) { return { word: w, stem: stem(w) }; })
    .filter(function (q) {
      if (seen.has(q.stem)) return false;
      seen.add(q.stem);
      return true;
    });
  const synonyms = synonymHits(question);
  if (!query.length && !Object.keys(synonyms).length) return [];

  const scored = load().topics.map(function (topic) {
    const covered = synonyms[topic.id];
    let score = covered ? SYNONYM_WEIGHT * covered.size : 0;
    query.forEach(function (q) {
      if (covered && covered.has(q.stem)) return;
      let best = 0;
      topic.index.forEach(function (weight, s) {
        if (weight > best && stemsMatch(q.stem, s)) best = weight;
      });
      // Опечатка в важном слове темы может весить больше точного совпадения где-то в длинном тексте
      topic.index.forEach(function (weight, s) {
        if (weight >= FUZZY_MIN_WEIGHT && weight * FUZZY_FACTOR > best && isTypoOf(q.word, q.stem, s)) best = weight * FUZZY_FACTOR;
      });
      score += Math.min(best, WORD_MAX);
    });
    return { topic: topic, score: score };
  }).filter(function (r) { return r.score >= MIN_SCORE; });

  scored.sort(function (a, b) { return b.score - a.score; });
  const top = scored.length ? scored[0].score : 0;
  return scored.filter(function (r) { return r.score >= top * 0.6; }).slice(0, limit).map(function (r) { return r.topic; });
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

module.exports = { search, searchGlossary, searchReference, articleSourceOf, sourceOf, firstAidHints, allTopics, stems, stem, editDistance };
