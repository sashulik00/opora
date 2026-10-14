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

  // Страницы, кроме главной и входа, появятся позже
  const links = [
    { href: "index.html", text: "Главная", page: "home" },
    { href: "lessons.html", text: "Уроки", page: "lessons" },
    { href: "reference.html", text: "Справочник", page: "reference" },
    { href: "consultant.html", text: "Консультант", page: "consultant" },
    { href: "help.html", text: "Помощь", page: "help" },
    { href: "login.html", text: user ? user.name : "Кабинет / Войти", page: "login" }
  ];

  const items = links.map(function (link) {
    const active = link.page === page ? ' class="active" aria-current="page"' : "";
    return '<li><a href="' + link.href + '"' + active + ">" + escapeHtml(link.text) + "</a></li>";
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

function renderList(items) {
  return "<ul>" + items.map(function (item) {
    return "<li>" + escapeHtml(item) + "</li>";
  }).join("") + "</ul>";
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

    '<h2 class="lesson-h2">Памятка</h2>' +
    '<div class="memo-grid">' +
      '<div class="card memo memo-do"><h3>Что делать</h3>' + renderList(topic.memo.doList) + "</div>" +
      '<div class="card memo memo-dont"><h3>Чего нельзя</h3>' + renderList(topic.memo.dontList) + "</div>" +
      '<div class="card memo memo-urgent"><h3>' + escapeHtml(section.urgentTitle) + "</h3>" + renderList(topic.memo.urgentList) + "</div>" +
    "</div>" +

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

/* ---------- Запуск ---------- */

document.addEventListener("DOMContentLoaded", function () {
  renderHeader();
  renderFileWarning();
  renderFooter();
  renderSections();
  setupLoginPage();
  renderLessonsPage();
  renderLessonPage();
});
