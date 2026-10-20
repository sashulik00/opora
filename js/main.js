/*
  Общий скрипт для всех страниц.
  1) Рисует шапку с меню и подвал (чтобы не копировать их в каждый HTML-файл).
  2) Хранит вход/регистрацию в localStorage (память браузера).
  3) Заполняет главную страницу разделами из data.js.
  4) Обрабатывает формы на странице входа.
*/

/* ---------- Пользователи (localStorage) ---------- */

const USERS_KEY = "opora_users";        // список всех зарегистрированных
const CURRENT_KEY = "opora_current";    // почта того, кто сейчас вошёл

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  const email = localStorage.getItem(CURRENT_KEY);
  if (!email) return null;
  return getUsers().find(function (u) { return u.email === email; }) || null;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function registerUser(name, email) {
  email = normalizeEmail(email);
  const users = getUsers();
  if (users.some(function (u) { return u.email === email; })) {
    return "Такая почта уже зарегистрирована. Войдите на вкладке «Вход».";
  }
  users.push({ name: name.trim(), email: email });
  saveUsers(users);
  localStorage.setItem(CURRENT_KEY, email);
  return null; // null — значит ошибки нет
}

function loginUser(email) {
  email = normalizeEmail(email);
  const user = getUsers().find(function (u) { return u.email === email; });
  if (!user) {
    return "Такой почты нет. Зарегистрируйтесь на вкладке «Регистрация».";
  }
  localStorage.setItem(CURRENT_KEY, email);
  return null;
}

function logoutUser() {
  localStorage.removeItem(CURRENT_KEY);
}

/* ---------- Прогресс по урокам (localStorage, отдельно для каждой почты) ---------- */

const PASS_RATE = 0.7; // зачёт — от 70% верных ответов

/* Прогресс хранится так:
   opora_progress_почта = {
     burns: { best: 3, total: 3, passed: true, completed: true },
     ...
   } */
function progressKey(user) {
  return "opora_progress_" + user.email;
}

function getProgress() {
  const user = getCurrentUser();
  if (!user) return {};
  try {
    return JSON.parse(localStorage.getItem(progressKey(user))) || {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  const user = getCurrentUser();
  if (!user) return;
  localStorage.setItem(progressKey(user), JSON.stringify(progress));
}

/* Записать результат теста: храним лучший результат и отметку о зачёте */
function saveTestResult(topicId, correct, total) {
  const progress = getProgress();
  const record = progress[topicId] || { best: 0, total: total, passed: false, completed: false };
  if (correct >= record.best) {
    record.best = correct;
    record.total = total;
  }
  if (correct / total >= PASS_RATE) record.passed = true;
  progress[topicId] = record;
  saveProgress(progress);
}

function markLessonCompleted(topicId) {
  const progress = getProgress();
  if (!progress[topicId]) return;
  progress[topicId].completed = true;
  saveProgress(progress);
}

/* Ссылка на вход, после которого человек вернётся на текущую страницу */
function loginLinkBack() {
  const here = location.pathname.split("/").pop() + location.search;
  return "login.html?back=" + encodeURIComponent(here);
}

/* Защита от «опасных» символов при вставке текста в HTML */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- Шапка и подвал ---------- */

function renderHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  const user = getCurrentUser();
  const page = document.body.dataset.page; // какая страница открыта (для подсветки пункта меню)

  // Страницы «Консультант» и «Помощь» появятся позже
  const links = [
    { href: "index.html", text: "Главная", page: "home" },
    { href: "lessons.html", text: "Уроки", page: "lessons" },
    {
      href: "reference.html", text: "Справочник", page: "reference",
      children: [
        { href: "reference.html", text: "Поиск", page: "reference" },
        { href: "memos.html", text: "Памятки", page: "memos" },
        { href: "videos.html", text: "Видео", page: "videos" },
        { href: "articles.html", text: "Статьи", page: "articles" },
        { href: "faq.html", text: "Частые вопросы", page: "faq" }
      ]
    },
    { href: "consultant.html", text: "Консультант", page: "consultant" },
    { href: "help.html", text: "Помощь", page: "help" },
    { href: "login.html", text: user ? user.name : "Кабинет / Войти", page: "login" }
  ];

  function linkHtml(link, active) {
    return '<a href="' + link.href + '"' + (active ? ' class="active" aria-current="page"' : "") + ">" +
      escapeHtml(link.text) + "</a>";
  }

  const items = links.map(function (link) {
    if (!link.children) return "<li>" + linkHtml(link, link.page === page) + "</li>";

    // Пункт с выпадающим списком: сам пункт — ссылка, стрелка рядом — кнопка «раскрыть»
    const inside = link.children.some(function (c) { return c.page === page; });
    const sub = link.children.map(function (c) {
      return "<li>" + linkHtml(c, c.page === page) + "</li>";
    }).join("");
    return (
      '<li class="has-sub">' +
        '<div class="sub-head">' +
          '<a href="' + link.href + '"' + (inside ? ' class="active"' : "") + ">" + escapeHtml(link.text) + "</a>" +
          '<button type="button" class="sub-toggle" aria-expanded="false" aria-label="Открыть подменю «' +
            escapeHtml(link.text) + '»">▾</button>' +
        "</div>" +
        '<ul class="submenu">' + sub + "</ul>" +
      "</li>"
    );
  }).join("");

  header.innerHTML =
    '<div class="container header-inner">' +
      '<a href="index.html" class="logo">Опора<span>Школа ухода</span></a>' +
      '<button class="menu-toggle" aria-expanded="false" aria-controls="main-menu">☰ Меню</button>' +
      '<nav aria-label="Главное меню"><ul id="main-menu" class="menu">' + items + "</ul></nav>" +
    "</div>";

  // Кнопка «Меню» на телефоне открывает и закрывает список
  const toggle = header.querySelector(".menu-toggle");
  const menu = header.querySelector(".menu");
  toggle.addEventListener("click", function () {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
    toggle.textContent = open ? "✕ Закрыть" : "☰ Меню";
  });

  // Стрелка у «Справочника» открывает и закрывает подменю (на компьютере оно ещё открывается при наведении)
  header.querySelectorAll(".has-sub").forEach(function (item) {
    const button = item.querySelector(".sub-toggle");
    button.addEventListener("click", function () {
      setSubmenu(item, !item.classList.contains("open"));
    });
  });

  // Закрывать подменю при щелчке мимо него и по клавише Esc (подключаем один раз)
  if (!renderHeader.listenersAdded) {
    renderHeader.listenersAdded = true;
    document.addEventListener("click", function (e) {
      document.querySelectorAll(".has-sub.open").forEach(function (item) {
        if (!item.contains(e.target)) setSubmenu(item, false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".has-sub.open").forEach(function (item) {
        setSubmenu(item, false);
        item.querySelector(".sub-toggle").focus();
      });
    });
  }
}

function setSubmenu(item, open) {
  item.classList.toggle("open", open);
  const button = item.querySelector(".sub-toggle");
  button.setAttribute("aria-expanded", open);
  button.textContent = open ? "▴" : "▾";
}

/* Firefox при открытии сайта двойным щелчком (адрес file:///) по умолчанию
   даёт КАЖДОМУ HTML-файлу своё отдельное хранилище localStorage.
   Тогда вход на login.html не виден на lesson.html, и прогресс «теряется».
   В Edge, Яндекс Браузере, Chrome и на настоящем хостинге (адрес https://) такой проблемы нет.
   Поэтому в этом случае показываем предупреждение. */
function renderFileWarning() {
  const isFile = location.protocol === "file:";
  const isFirefox = navigator.userAgent.indexOf("Firefox/") !== -1;
  const header = document.getElementById("site-header");
  if (!isFile || !isFirefox || !header || document.querySelector(".file-warning")) return;

  const box = document.createElement("div");
  box.className = "file-warning";
  box.setAttribute("role", "note");
  box.innerHTML =
    '<div class="container">' +
      "<strong>Вход и прогресс могут не сохраняться.</strong> " +
      "Сайт открыт из файла в Firefox, а Firefox хранит данные каждой страницы отдельно. " +
      "Откройте сайт в Edge или Яндекс Браузере (правый щелчок по index.html → «Открыть с помощью») " +
      "или через расширение Live Server в VS Code. На настоящем сайте в интернете всё будет работать в любом браузере." +
    "</div>";
  header.insertAdjacentElement("afterend", box);
}

function renderFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.innerHTML =
    '<div class="container">' +
      "<p>Справочная информация, не заменяет консультацию врача.</p>" +
      "<p>В экстренной ситуации звоните <strong>112</strong>.</p>" +
    "</div>";
}

/* ---------- Главная: три раздела ---------- */

function renderSections() {
  const box = document.getElementById("sections-list");
  if (!box) return;

  box.innerHTML = SECTIONS.map(function (section) {
    const count = TOPICS.filter(function (t) { return t.section === section.id; }).length;
    return (
      '<article class="card section-card">' +
        '<div class="section-icon" aria-hidden="true">' + section.icon + "</div>" +
        "<h3>" + escapeHtml(section.title) + "</h3>" +
        "<p>" + escapeHtml(section.description) + "</p>" +
        '<p class="muted">Тем: ' + count + "</p>" +
      "</article>"
    );
  }).join("");
}

/* ---------- Страница входа ---------- */

function setupLoginPage() {
  const page = document.getElementById("auth");
  if (!page) return;

  const formsBox = document.getElementById("auth-forms");
  const loggedBox = document.getElementById("auth-logged");

  function showState() {
    const user = getCurrentUser();
    if (user) {
      formsBox.hidden = true;
      loggedBox.hidden = false;
      document.getElementById("logged-name").textContent = user.name;
      document.getElementById("logged-email").textContent = user.email;
    } else {
      formsBox.hidden = false;
      loggedBox.hidden = true;
    }
    renderHeader(); // обновить имя в меню
  }

  // Переключение вкладок «Вход» / «Регистрация»
  const tabs = page.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab);
      });
      document.getElementById("login-form").hidden = tab.dataset.tab !== "login";
      document.getElementById("register-form").hidden = tab.dataset.tab !== "register";
    });
  });

  // Если на вход пришли со страницы урока — после входа вернуть туда
  function afterLogin() {
    const back = new URLSearchParams(location.search).get("back");
    // Разрешаем только страницы нашего сайта, например «lesson.html?id=burns»
    if (back && /^[\w-]+\.html(\?[\w=&-]*)?$/.test(back)) {
      location.href = back;
    } else {
      showState();
    }
  }

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault(); // не перезагружать страницу
    const email = document.getElementById("login-email").value;
    const error = loginUser(email);
    document.getElementById("login-error").textContent = error || "";
    if (!error) afterLogin();
  });

  document.getElementById("register-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const error = name.trim() ? registerUser(name, email) : "Введите имя.";
    document.getElementById("register-error").textContent = error || "";
    if (!error) afterLogin();
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    logoutUser();
    showState();
  });

  showState();
}

/* ---------- Страница «Уроки» ---------- */

function renderLessonsPage() {
  const page = document.getElementById("lessons-page");
  if (!page) return;

  const user = getCurrentUser();
  const progress = getProgress();
  const passedCount = TOPICS.filter(function (t) {
    return progress[t.id] && progress[t.id].passed;
  }).length;
  const percent = Math.round((passedCount / TOPICS.length) * 100);

  let html =
    '<div class="card progress-card">' +
      '<p class="progress-text">Пройдено <strong>' + passedCount + "</strong> из " + TOPICS.length + "</p>" +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOPICS.length +
        '" aria-valuenow="' + passedCount + '" aria-label="Прогресс обучения">' +
        '<div class="progress-fill" style="width:' + percent + '%"></div>' +
      "</div>" +
    "</div>";

  if (!user) {
    html +=
      '<p class="hint">Войдите, чтобы прогресс сохранялся. Смотреть уроки можно и без входа. ' +
      '<a href="' + loginLinkBack() + '">Войти</a></p>';
  }

  SECTIONS.forEach(function (section) {
    html += '<h2 class="lessons-section-title">' + escapeHtml(section.title) + "</h2>";
    html += '<div class="lessons-grid">';

    TOPICS.forEach(function (topic, index) {
      if (topic.section !== section.id) return;
      const record = progress[topic.id];
      const passed = record && record.passed;

      html +=
        '<a class="card lesson-card' + (passed ? " is-passed" : "") + '" href="lesson.html?id=' + encodeURIComponent(topic.id) + '">' +
          '<span class="lesson-num">Урок ' + (index + 1) + "</span>" +
          "<h3>" + escapeHtml(topic.title) + "</h3>" +
          "<p>" + escapeHtml(topic.description) + "</p>" +
          '<div class="lesson-meta">' +
            '<span class="status' + (passed ? " status-done" : "") + '">' + (passed ? "Пройден ✓" : "Не начат") + "</span>" +
            (record ? '<span class="muted">Лучший результат: ' + record.best + "/" + record.total + "</span>" : "") +
          "</div>" +
        "</a>";
    });

    html += "</div>";
  });

  page.innerHTML = html;
}

/* ---------- Страница урока ---------- */

/* Превращает обычную ссылку YouTube/Rutube в ссылку для встроенного плеера */
function getEmbedUrl(url) {
  let match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (match) return "https://www.youtube.com/embed/" + match[1];

  match = url.match(/rutube\.ru\/(?:video|play\/embed|shorts)\/([\w]+)/);
  if (match) return "https://rutube.ru/play/embed/" + match[1];

  return null;
}

function renderVideo(topic) {
  const url = (topic.video || "").trim();
  const embed = url ? getEmbedUrl(url) : null;
  if (embed) {
    return (
      '<div class="video-box">' +
        '<iframe src="' + embed + '" title="Видео: ' + escapeHtml(topic.title) + '" ' +
        'allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
      "</div>"
    );
  }
  return '<div class="video-placeholder">Видео скоро появится</div>';
}

/* Есть ли в списке хотя бы один непустой пункт */
function hasItems(list) {
  return Array.isArray(list) && list.some(function (item) { return item; });
}

function renderList(items, tag) {
  tag = tag || "ul";
  return "<" + tag + ">" + items.filter(Boolean).map(function (item) {
    return "<li>" + escapeHtml(item) + "</li>";
  }).join("") + "</" + tag + ">";
}

/* Памятка из трёх блоков друг под другом — общая для урока (topic.lessonMemo)
   и справочника (topic.memo). Пустые блоки не показываются; если пусто всё — функция вернёт "".
   withHeading — добавить заголовок «Памятка» (нужен в уроке) */
function renderMemo(memo, section, withHeading) {
  memo = memo || {};
  const blocks = [
    { list: memo.doList, cls: "memo-do", title: "Что делать", tag: "ol" },
    { list: memo.dontList, cls: "memo-dont", title: "Чего нельзя" },
    { list: memo.urgentList, cls: "memo-urgent", title: section.urgentTitle }
  ].filter(function (b) { return hasItems(b.list); });

  if (!blocks.length) return "";
  return (
    (withHeading ? '<h2 class="lesson-h2" id="memo">Памятка</h2>' : "") +
    '<div class="memo-stack">' +
      blocks.map(function (b) {
        return '<div class="card memo ' + b.cls + '"><h3>' + escapeHtml(b.title) + "</h3>" + renderList(b.list, b.tag) + "</div>";
      }).join("") +
    "</div>"
  );
}

/* «Подробнее» — абзацы из поля details */
function renderDetails(topic) {
  if (!hasItems(topic.details)) return "";
  return (
    '<h2 class="lesson-h2" id="details">Подробнее</h2>' +
    '<div class="card details">' +
      topic.details.filter(Boolean).map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("") +
    "</div>"
  );
}

/* «Источники» — ссылки из поля sources (только адреса http/https) */
function renderSources(topic) {
  const sources = (topic.sources || []).filter(function (s) {
    return s && s.url && /^https?:\/\//i.test(s.url);
  });
  if (!sources.length) return "";
  return (
    '<h2 class="lesson-h2">Источники</h2>' +
    '<ul class="card sources">' +
      sources.map(function (s) {
        return '<li><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' +
          escapeHtml(s.title || s.url) + "</a></li>";
      }).join("") +
    "</ul>"
  );
}

function renderLessonPage() {
  const page = document.getElementById("lesson-page");
  if (!page) return;

  const id = new URLSearchParams(location.search).get("id");
  const index = TOPICS.findIndex(function (t) { return t.id === id; });

  if (index === -1) {
    page.innerHTML =
      '<div class="card"><h1>Урок не найден</h1>' +
      '<p>Возможно, ссылка устарела.</p>' +
      '<a href="lessons.html" class="btn btn-primary">К списку уроков</a></div>';
    return;
  }

  const topic = TOPICS[index];
  const section = SECTIONS.find(function (s) { return s.id === topic.section; });
  const nextTopic = TOPICS[index + 1];
  const user = getCurrentUser();
  const record = getProgress()[topic.id];

  document.title = topic.title + " — Опора. Школа ухода";

  /* --- Вопросы теста --- */
  const questionsHtml = topic.quiz.map(function (q, qi) {
    const options = q.options.map(function (option, oi) {
      return (
        '<label class="option" data-q="' + qi + '" data-o="' + oi + '">' +
          '<input type="radio" name="q' + qi + '" value="' + oi + '"> ' +
          "<span>" + escapeHtml(option) + "</span>" +
        "</label>"
      );
    }).join("");
    return (
      '<fieldset class="question">' +
        "<legend>" + (qi + 1) + ". " + escapeHtml(q.question) + "</legend>" +
        options +
      "</fieldset>"
    );
  }).join("");

  page.innerHTML =
    '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
      '<a href="lessons.html">Уроки</a> <span aria-hidden="true">→</span> ' +
      '<span aria-current="page">' + escapeHtml(topic.title) + "</span>" +
    "</nav>" +

    '<p class="lesson-num">Урок ' + (index + 1) + " · " + escapeHtml(section.title) + "</p>" +
    "<h1>" + escapeHtml(topic.title) + "</h1>" +
    '<p class="lead">' + escapeHtml(topic.description) + "</p>" +

    renderVideo(topic) +
    renderDetails(topic) +
    renderMemo(topic.lessonMemo, section, true) +

    '<h2 class="lesson-h2">Проверь себя</h2>' +
    '<div class="card">' +
      (record
        ? '<p class="muted">Ваш лучший результат: ' + record.best + "/" + record.total +
          (record.passed ? " — тест сдан ✓" : "") + "</p>"
        : "") +
      (!user
        ? '<p class="hint">Тест можно пройти и без входа, но результат не сохранится. ' +
          '<a href="' + loginLinkBack() + '">Войти</a></p>'
        : "") +
      '<form id="quiz-form">' +
        questionsHtml +
        '<p id="quiz-error" class="error" role="alert"></p>' +
        '<button type="submit" id="check-btn" class="btn btn-primary">Проверить</button>' +
      "</form>" +
      '<div id="quiz-result" class="quiz-result" aria-live="polite" hidden></div>' +
    "</div>" +

    '<div class="card finish-card">' +
      '<button id="finish-btn" class="btn btn-primary" disabled>Завершить урок</button>' +
      '<p id="finish-note" class="muted small">Кнопка станет активной после успешного теста (от 70% верных ответов).</p>' +
      '<div id="finish-next" hidden>' +
        '<p class="success">Урок завершён! ✓</p>' +
        '<div class="buttons">' +
          (nextTopic
            ? '<a href="lesson.html?id=' + encodeURIComponent(nextTopic.id) + '" class="btn btn-primary">Следующий урок</a>'
            : "") +
          '<a href="lessons.html" class="btn btn-secondary">К списку уроков</a>' +
        "</div>" +
      "</div>" +
    "</div>" +

    renderSources(topic) +

    '<div class="consult-box">' +
      '<a href="consultant.html?topic=' + encodeURIComponent(topic.id) + '" class="btn btn-secondary">Спросить консультанта по этой теме</a>' +
    "</div>";

  setupQuiz(topic, record);
}

function setupQuiz(topic, record) {
  const form = document.getElementById("quiz-form");
  const result = document.getElementById("quiz-result");
  const error = document.getElementById("quiz-error");
  const checkBtn = document.getElementById("check-btn");
  const finishBtn = document.getElementById("finish-btn");
  const finishNote = document.getElementById("finish-note");

  function enableFinish() {
    finishBtn.disabled = false;
    finishNote.hidden = true;
  }

  // Если тест уже был сдан раньше — урок можно сразу завершить
  if (record && record.passed) enableFinish();

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Собираем ответы
    const answers = topic.quiz.map(function (q, qi) {
      const checked = form.querySelector('input[name="q' + qi + '"]:checked');
      return checked ? Number(checked.value) : null;
    });

    if (answers.indexOf(null) !== -1) {
      error.textContent = "Ответьте, пожалуйста, на все вопросы.";
      return;
    }
    error.textContent = "";

    // Считаем верные и отмечаем варианты цветом
    let correct = 0;
    const mistakes = [];
    topic.quiz.forEach(function (q, qi) {
      if (answers[qi] === q.correct) {
        correct++;
      } else {
        mistakes.push({ number: qi + 1, question: q.question, yours: q.options[answers[qi]], right: q.options[q.correct] });
        form.querySelector('.option[data-q="' + qi + '"][data-o="' + answers[qi] + '"]').classList.add("is-wrong");
      }
      form.querySelector('.option[data-q="' + qi + '"][data-o="' + q.correct + '"]').classList.add("is-right");
    });

    // Блокируем ответы, пока человек смотрит результат
    form.querySelectorAll("input").forEach(function (input) { input.disabled = true; });
    checkBtn.hidden = true;

    const total = topic.quiz.length;
    const passed = correct / total >= PASS_RATE;
    saveTestResult(topic.id, correct, total); // если не вошли — функция ничего не сохранит

    let html = '<p class="score">Верно ' + correct + " из " + total + "</p>";

    if (mistakes.length) {
      html += "<h3>Разбор ошибок</h3><ul class=\"mistakes\">" + mistakes.map(function (m) {
        return (
          "<li><strong>" + m.number + ". " + escapeHtml(m.question) + "</strong><br>" +
          "Ваш ответ: " + escapeHtml(m.yours) + "<br>" +
          "Правильный ответ: <strong>" + escapeHtml(m.right) + "</strong></li>"
        );
      }).join("") + "</ul>";
    }

    if (passed) {
      html += '<p class="success">Тест сдан! Теперь можно завершить урок.</p>';
      enableFinish();
    } else {
      html +=
        '<p class="fail">Пересмотрите урок и попробуйте снова.</p>' +
        '<button type="button" id="retry-btn" class="btn btn-secondary">Пройти тест заново</button>';
    }

    if (!getCurrentUser()) {
      html += '<p class="hint">Чтобы результат сохранился, <a href="' + loginLinkBack() + '">войдите</a>.</p>';
    }

    result.innerHTML = html;
    result.hidden = false;

    const retryBtn = document.getElementById("retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        form.reset();
        form.querySelectorAll("input").forEach(function (input) { input.disabled = false; });
        form.querySelectorAll(".option").forEach(function (o) { o.classList.remove("is-right", "is-wrong"); });
        result.hidden = true;
        checkBtn.hidden = false;
        form.querySelector("legend").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  });

  finishBtn.addEventListener("click", function () {
    markLessonCompleted(topic.id);
    finishBtn.hidden = true;
    document.getElementById("finish-next").hidden = false;
  });
}

/* ---------- Справочник: общие помощники ---------- */

function sectionOf(topic) {
  return SECTIONS.find(function (s) { return s.id === topic.section; });
}

function hasVideo(topic) {
  return Boolean((topic.video || "").trim());
}

/* Есть ли у темы памятка СПРАВОЧНИКА (поле memo; памятка урока — lessonMemo) */
function hasMemo(topic) {
  const memo = topic.memo || {};
  return hasItems(memo.doList) || hasItems(memo.dontList) || hasItems(memo.urgentList);
}

function hasArticle(topic) {
  return hasItems(topic.details);
}

/* Приводит текст к виду для поиска: маленькие буквы, «ё» → «е», лишние пробелы убраны */
function normalizeText(text) {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/* Текст темы для поиска в справочнике: название, описание, памятка справочника (memo),
   статья (details) и частые вопросы (faq). Памятка и тест урока сюда не входят. */
function topicSearchText(topic) {
  const memo = topic.memo || {};
  const parts = [topic.title, topic.description]
    .concat(memo.doList || [], memo.dontList || [], memo.urgentList || [], topic.details || [])
    .concat((topic.faq || []).map(function (f) { return f.q + " " + f.a; }));
  return normalizeText(parts.join(" "));
}

/* Обложка карточки: картинка из папки images или цветная заглушка с названием раздела.
   Если картинку не удалось загрузить (например, ошибка в имени файла), остаётся заглушка. */
function renderCover(topic, section) {
  const cover = (topic.cover || "").trim();
  return (
    '<div class="tile-cover" style="background:' + escapeHtml(section.color || "#5b6478") + '">' +
      '<span class="tile-cover-label">' + escapeHtml(section.title) + "</span>" +
      (cover
        ? '<img src="images/' + escapeHtml(encodeURI(cover)) + '" alt="" loading="lazy" onerror="this.remove()">'
        : "") +
    "</div>"
  );
}

/* ОДНА общая карточка для справочника, памяток, видео и статей.
   options: href, badge (надпись поверх обложки), play (показать ▶), text (текст под названием) */
function renderTile(topic, options) {
  const section = sectionOf(topic);
  return (
    '<a class="tile" href="' + options.href + '">' +
      '<div class="tile-media">' +
        renderCover(topic, section) +
        (options.play ? '<span class="tile-play" aria-label="Есть видео">▶</span>' : "") +
        (options.badge ? '<span class="tile-badge">' + escapeHtml(options.badge) + "</span>" : "") +
      "</div>" +
      '<div class="tile-body">' +
        '<span class="tile-section">' + escapeHtml(section.title) + "</span>" +
        "<h3>" + escapeHtml(topic.title) + "</h3>" +
        (options.text ? '<p class="tile-text">' + escapeHtml(options.text) + "</p>" : "") +
      "</div>" +
    "</a>"
  );
}

function topicLink(page, topic) {
  return page + "?id=" + encodeURIComponent(topic.id);
}

/* Группа кнопок-фильтров. items: [{id, title}], onChange(id) вызывается при выборе */
function setupFilterButtons(box, items, onChange) {
  box.innerHTML = items.map(function (f, i) {
    return (
      '<button type="button" class="filter' + (i === 0 ? " active" : "") + '" data-id="' + f.id + '" ' +
      'aria-pressed="' + (i === 0) + '">' + escapeHtml(f.title) + "</button>"
    );
  }).join("");

  box.addEventListener("click", function (e) {
    const button = e.target.closest(".filter");
    if (!button) return;
    box.querySelectorAll(".filter").forEach(function (b) {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", b === button);
    });
    onChange(button.dataset.id);
  });
}

const SECTION_FILTERS = [{ id: "all", title: "Все" }].concat(SECTIONS);

/* Типы материалов справочника: есть ли такой материал у темы и на какую страницу он ведёт */
const MATERIAL_TYPES = [
  { id: "memos", title: "Памятки", badge: "Памятка", page: "memo.html", fits: hasMemo },
  { id: "videos", title: "Видео", badge: "Видео", page: "video.html", fits: hasVideo },
  { id: "articles", title: "Статьи", badge: "Статья", page: "article.html", fits: hasArticle }
];

const EMPTY_RESULT =
  '<div class="card empty-result">' +
    "<p>Ничего не найдено. Попробуйте другое слово или " +
    '<a href="consultant.html">спросите консультанта</a>.</p>' +
  "</div>";

/* ---------- Справочник: поиск (reference.html) ---------- */

function setupReferencePage() {
  const page = document.getElementById("reference-page");
  if (!page) return;

  const input = document.getElementById("search-input");
  const list = document.getElementById("reference-list");
  const counter = document.getElementById("results-count");
  let currentSection = "all";
  let currentType = "all";

  setupFilterButtons(document.getElementById("type-filters"), [{ id: "all", title: "Все" }].concat(MATERIAL_TYPES), function (id) {
    currentType = id;
    showResults();
  });
  setupFilterButtons(document.getElementById("filters"), SECTION_FILTERS, function (id) {
    currentSection = id;
    showResults();
  });

  function showResults() {
    // Каждое слово запроса должно встретиться в теме: «уход ожог» найдёт «Ожоги»
    const words = normalizeText(input.value).split(" ").filter(Boolean);
    const types = MATERIAL_TYPES.filter(function (t) { return currentType === "all" || t.id === currentType; });

    // Одна карточка на каждый материал темы: памятка, видео, статья
    const cards = [];
    TOPICS.forEach(function (topic) {
      if (currentSection !== "all" && topic.section !== currentSection) return;
      const text = topicSearchText(topic);
      if (!words.every(function (word) { return text.indexOf(word) !== -1; })) return;

      types.forEach(function (type) {
        if (!type.fits(topic)) return;
        cards.push(renderTile(topic, {
          href: topicLink(type.page, topic),
          badge: type.badge,
          play: type.id === "videos",
          text: topic.description
        }));
      });
    });

    counter.textContent = cards.length ? "Найдено материалов: " + cards.length : "";
    list.innerHTML = cards.length ? cards.join("") : EMPTY_RESULT;
  }

  input.addEventListener("input", showResults);
  showResults();
}

/* ---------- Справочник: списки Памятки, Видео, Статьи ---------- */

function renderMemosPage() {
  const list = document.getElementById("memos-list");
  if (!list) return;
  const topics = TOPICS.filter(hasMemo);
  list.innerHTML = topics.length
    ? topics.map(function (t) {
        return renderTile(t, { href: topicLink("memo.html", t), text: t.description });
      }).join("")
    : EMPTY_RESULT;
}

function renderVideosPage() {
  const list = document.getElementById("videos-list");
  if (!list) return;
  list.innerHTML = TOPICS.map(function (t) {
    const ready = hasVideo(t);
    return renderTile(t, {
      href: topicLink("video.html", t),
      play: ready,
      badge: ready ? "" : "Скоро"
    });
  }).join("");
}

function renderArticlesPage() {
  const list = document.getElementById("articles-list");
  if (!list) return;
  const topics = TOPICS.filter(hasArticle);
  list.innerHTML = topics.length
    ? topics.map(function (t) {
        // На карточке — первый абзац статьи
        const first = t.details.filter(Boolean)[0];
        return renderTile(t, { href: topicLink("article.html", t), text: first });
      }).join("")
    : EMPTY_RESULT;
}

/* ---------- Справочник: Частые вопросы (faq.html) ---------- */

function setupFaqPage() {
  const list = document.getElementById("faq-list");
  if (!list) return;

  function show(sectionId) {
    const topics = TOPICS.filter(function (t) {
      return (sectionId === "all" || t.section === sectionId) && hasItems(t.faq);
    });

    if (!topics.length) {
      list.innerHTML = '<div class="card empty-result"><p>В этом разделе пока нет вопросов.</p></div>';
      return;
    }

    list.innerHTML = topics.map(function (t) {
      return (
        '<section class="faq-topic">' +
          '<p class="tile-section">' + escapeHtml(sectionOf(t).title) + "</p>" +
          "<h2>" + escapeHtml(t.title) + "</h2>" +
          t.faq.filter(function (f) { return f && f.q; }).map(function (f) {
            return (
              '<details class="faq-item">' +
                "<summary>" + escapeHtml(f.q) + "</summary>" +
                '<div class="faq-answer"><p>' + escapeHtml(f.a || "") + "</p></div>" +
              "</details>"
            );
          }).join("") +
        "</section>"
      );
    }).join("");
  }

  setupFilterButtons(document.getElementById("faq-filters"), SECTION_FILTERS, show);
  show("all");
}

/* ---------- Справочник: страницы одного материала (memo / video / article) ---------- */

/* Находит тему по ?id= в адресе. Если не нашли — показывает сообщение и возвращает null */
function topicFromAddress(page, listHref, listTitle) {
  const id = new URLSearchParams(location.search).get("id");
  const topic = TOPICS.find(function (t) { return t.id === id; });
  if (!topic) {
    page.innerHTML =
      '<div class="card"><h1>Материал не найден</h1>' +
      "<p>Возможно, ссылка устарела.</p>" +
      '<a href="' + listHref + '" class="btn btn-primary">' + escapeHtml(listTitle) + "</a></div>";
  }
  return topic || null;
}

/* Хлебные крошки «Справочник → Раздел → Тема» и заголовок */
function renderMaterialHead(topic, listHref, listTitle) {
  return (
    '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
      '<a href="reference.html">Справочник</a> <span aria-hidden="true">→</span> ' +
      '<a href="' + listHref + '">' + escapeHtml(listTitle) + "</a> <span aria-hidden=\"true\">→</span> " +
      '<span aria-current="page">' + escapeHtml(topic.title) + "</span>" +
    "</nav>" +
    '<p class="lesson-num">' + escapeHtml(sectionOf(topic).title) + "</p>" +
    "<h1>" + escapeHtml(topic.title) + "</h1>"
  );
}

/* «Ещё по теме»: ссылки на другие материалы темы, кроме текущей страницы */
function renderMoreOnTopic(topic, current) {
  const links = [
    { page: "memo.html", title: "Памятка" },
    { page: "video.html", title: "Видео" },
    { page: "article.html", title: "Статья" },
    { page: "lesson.html", title: "Урок" }
  ].filter(function (l) { return l.page !== current; });

  return (
    '<aside class="card more-on-topic" aria-label="Ещё по теме">' +
      "<h2>Ещё по теме</h2>" +
      "<ul>" + links.map(function (l) {
        return '<li><a href="' + topicLink(l.page, topic) + '">' + l.title + "</a></li>";
      }).join("") + "</ul>" +
    "</aside>"
  );
}

function renderSoon(text) {
  return '<div class="video-placeholder">' + escapeHtml(text) + "</div>";
}

/* memo.html — только памятка справочника */
function renderMemoPage() {
  const page = document.getElementById("memo-page");
  if (!page) return;
  const topic = topicFromAddress(page, "memos.html", "К списку памяток");
  if (!topic) return;

  document.title = topic.title + " — Памятка — Опора";
  page.innerHTML =
    renderMaterialHead(topic, "memos.html", "Памятки") +
    (renderMemo(topic.memo, sectionOf(topic), false) || renderSoon("Памятка скоро появится")) +
    renderMoreOnTopic(topic, "memo.html");
}

/* video.html — только видеоплеер */
function renderVideoPage() {
  const page = document.getElementById("video-page");
  if (!page) return;
  const topic = topicFromAddress(page, "videos.html", "К списку видео");
  if (!topic) return;

  document.title = topic.title + " — Видео — Опора";
  page.innerHTML =
    renderMaterialHead(topic, "videos.html", "Видео") +
    renderVideo(topic) +
    '<div class="buttons article-actions">' +
      '<a href="videos.html" class="btn btn-secondary">К списку видео</a>' +
    "</div>" +
    renderMoreOnTopic(topic, "video.html");
}

/* article.html — только статья (details) и источники */
function renderArticlePage() {
  const page = document.getElementById("article-page");
  if (!page) return;
  const topic = topicFromAddress(page, "articles.html", "К списку статей");
  if (!topic) return;

  document.title = topic.title + " — Статья — Опора";
  page.innerHTML =
    renderMaterialHead(topic, "articles.html", "Статьи") +
    (hasArticle(topic)
      ? '<div class="card details article-text">' +
          topic.details.filter(Boolean).map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("") +
        "</div>"
      : renderSoon("Статья скоро появится")) +
    renderSources(topic) +
    renderMoreOnTopic(topic, "article.html");
}

/* ---------- Запуск ---------- */

document.addEventListener("DOMContentLoaded", function () {
  renderHeader();
  renderFileWarning();
  renderFooter();
  renderSections();
  setupLoginPage();
  renderLessonsPage();
  renderLessonPage();
  setupReferencePage();
  renderMemosPage();
  renderVideosPage();
  renderArticlesPage();
  setupFaqPage();
  renderMemoPage();
  renderVideoPage();
  renderArticlePage();
});
