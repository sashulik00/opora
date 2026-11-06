/*
  Общий скрипт для всех страниц.
  1) Рисует шапку с меню и подвал (чтобы не копировать их в каждый HTML-файл).
  2) Вход и прогресс берёт из js/store.js (сервер или localStorage — решает он).
  3) Заполняет главную страницу разделами из data.js.
  4) Обрабатывает формы на странице входа.
*/

/* ---------- Пользователь (хранит js/store.js) ---------- */

/* { email, name } или null. name есть только у старых «входов» без сервера */
function getCurrentUser() {
  return Store.getUser();
}

/* ---------- Прогресс по урокам (хранит js/store.js: на сервере или в localStorage) ---------- */

/* Порог зачёта PASS_RATE (0.7 = 70%) задан в js/data.js */

/* Уроки — только темы с kind: "lesson". Все подсчёты прогресса, «Продолжить»,
   номера уроков и «Следующий урок» идут по этому списку. Число уроков берётся из data.js. */
const LESSONS = TOPICS.filter(function (t) { return t.kind === "lesson"; });

function isLesson(topic) {
  return Boolean(topic) && topic.kind === "lesson";
}

/* Следующий урок после данного (или null, если это последний) */
function nextLesson(topic) {
  return LESSONS[LESSONS.indexOf(topic) + 1] || null;
}

/* Прогресс — один объект:
   {
     burns: { best: 3, total: 3, passed: true, completed: true },
     practiceDone: { burns: { "spot-error-1": true } },
     ...
   }
   Если человек не вошёл — пустой объект, и ничего не сохраняется */
function getProgress() {
  return Store.getProgress();
}

function saveProgress(progress) {
  Store.saveProgress(progress);
}

/* Записать результат теста: храним лучший результат (по доле верных ответов —
   плохой результат хороший не перезапишет) и отметку о зачёте (она не снимается) */
function saveTestResult(topicId, correct, total) {
  const progress = getProgress();
  const record = progress[topicId] || { best: 0, total: total, passed: false, completed: false };
  const oldRate = record.total ? record.best / record.total : 0;
  if (correct / total >= oldRate) {
    record.best = correct;
    record.total = total;
  }
  if (correct / total >= PASS_RATE) {
    record.passed = true;
    record.completed = true;
  }
  progress[topicId] = record;
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

  const links = [
    { href: "index.html", text: "Главная", page: "home" },
    { href: "lessons.html", text: "Уроки", page: "lessons" },
    {
      href: "reference.html", text: "Справочник", page: "reference",
      children: [
        { href: "reference.html", text: "Поиск", page: "reference" },
        { href: "videos.html", text: "Видео", page: "videos" },
        { href: "articles.html", text: "Статьи", page: "articles" },
        { href: "faq.html", text: "Частые вопросы", page: "faq" },
        { href: "rights.html", text: "Права и документы", page: "rights" }
      ]
    },
    { href: "consultant.html", text: "Консультант", page: "consultant" },
    { href: "help.html", text: "Поддержка", page: "help" }
  ];
  // Справа в шапке: «Войти» или (после входа) «Кабинет»/имя и «Выйти»
  const account = user
    ? { href: "cabinet.html", text: user.name || "Кабинет", page: "cabinet" }
    : { href: "login.html", text: "Войти", page: "login" };

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

  // Три колонки: слева «Опора», по центру меню, справа вход/выход (раскладка — в css/style.css)
  header.innerHTML =
    '<div class="container header-inner">' +
      '<a href="index.html" class="logo">Опора<span>Школа ухода</span></a>' +
      '<button class="menu-toggle" aria-expanded="false" aria-controls="main-menu">☰ Меню</button>' +
      '<nav aria-label="Главное меню"><ul id="main-menu" class="menu">' + items + "</ul></nav>" +
      '<div class="header-actions">' +
        linkHtml(account, account.page === page) +
        (user ? '<button type="button" class="menu-logout">Выйти</button>' : "") +
      "</div>" +
    "</div>";

  const logout = header.querySelector(".menu-logout");
  if (logout) {
    logout.addEventListener("click", function () {
      logout.disabled = true;
      Store.logout().then(function () { location.href = "index.html"; });
    });
  }

  // Кнопка «Меню» на телефоне открывает и закрывает список
  const toggle = header.querySelector(".menu-toggle");
  const menu = header.querySelector(".menu");
  toggle.addEventListener("click", function () {
    const open = menu.classList.toggle("open");
    header.querySelector(".header-actions").classList.toggle("open", open);  // на телефоне вход/выход — вместе с меню
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
    // Считаем только уроки (kind: "lesson"). Раздел без уроков ведёт на «Права и документы»
    const count = LESSONS.filter(function (t) { return t.section === section.id; }).length;
    const href = count ? "lessons.html#" + section.id : "rights.html";
    const note = count ? "Уроков: " + count : "Права и документы: ситуаций " + RIGHTS.length;
    return (
      '<a class="card section-card" href="' + href + '">' +
        '<div class="section-icon" aria-hidden="true">' + section.icon + "</div>" +
        "<h3>" + escapeHtml(section.title) + "</h3>" +
        "<p>" + escapeHtml(section.description) + "</p>" +
        '<p class="muted">' + note + "</p>" +
      "</a>"
    );
  }).join("");
}

/* ---------- Страница входа ---------- */

function setupLoginPage() {
  const page = document.getElementById("auth");
  if (!page) return;

  const formsBox = document.getElementById("auth-forms");
  const loggedBox = document.getElementById("auth-logged");

  // Подпись под формами: где хранятся данные
  document.getElementById("auth-note").textContent = Store.getMode() === "server"
    ? "Прогресс сохраняется на сервере: войдите с любого устройства и продолжите с того же места."
    : "Сайт открыт без сервера: вход и прогресс хранятся только в этом браузере, пароль не проверяется. " +
      "Чтобы работала настоящая регистрация, запустите сервер (инструкция в README.md).";

  function showState() {
    const user = getCurrentUser();
    formsBox.hidden = Boolean(user);
    loggedBox.hidden = !user;
    if (user) document.getElementById("logged-email").textContent = user.email;
    renderHeader(); // обновить меню: «Кабинет» и «Выйти»
  }

  // Переключение вкладок «Войти» / «Зарегистрироваться»
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

  // login.html?tab=register — сразу открыть вкладку «Зарегистрироваться» (кнопка из кабинета)
  if (new URLSearchParams(location.search).get("tab") === "register") {
    page.querySelector('.tab[data-tab="register"]').click();
  }

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

  /* Отправка формы: кнопка неактивна, пока ждём ответ; ошибка — под полями */
  function submitWith(form, errorBox, action) {
    const button = form.querySelector('button[type="submit"]');
    errorBox.textContent = "";
    button.disabled = true;
    action().then(function (error) {
      button.disabled = false;
      errorBox.textContent = error || "";
      if (!error) afterLogin();
    });
  }

  const loginForm = document.getElementById("login-form");
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault(); // не перезагружать страницу
    submitWith(loginForm, document.getElementById("login-error"), function () {
      return Store.login(document.getElementById("login-email").value, document.getElementById("login-password").value);
    });
  });

  const registerForm = document.getElementById("register-form");
  registerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const errorBox = document.getElementById("register-error");
    const password = document.getElementById("reg-password").value;
    if (password.length < 8) {
      errorBox.textContent = "Пароль должен быть не короче 8 символов.";
      return;
    }
    if (password !== document.getElementById("reg-password2").value) {
      errorBox.textContent = "Пароли не совпадают.";
      return;
    }
    submitWith(registerForm, errorBox, function () {
      return Store.register(document.getElementById("reg-email").value, password);
    });
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    Store.logout().then(showState);
  });

  showState();
}

/* ---------- Страница «Уроки» ---------- */

/* --- Прогресс урока: все цифры на сайте (главная, список уроков, кабинет) считаются здесь --- */
const STATUS_NEW = "Не начат";
const STATUS_ACTIVE = "В процессе";
const STATUS_TEST_PASSED = "Тест сдан";
const STATUS_PASSED = "Пройден";

/* Тест сдан: есть отметка о зачёте или лучший результат не ниже порога */
function isTestPassed(record) {
  return Boolean(record && (record.passed || record.best / record.total >= PASS_RATE));
}

/* Прогресс темы. steps — задания практики и тест, done — сколько из них сделано.
   «Пройден» — сделано всё; «Тест сдан» — тест сдан, но практика ещё не вся;
   «В процессе» — выполнено задание или тест пройден, но не сдан.
   passed — сдан ли тест: по нему считается зачёт урока (счётчик «Пройдено N из 10», «Продолжить обучение») */
function lessonProgress(topic, progress) {
  const record = progress[topic.id];
  const tasks = practiceTasks(topic).length;
  const tasksDone = countTasksDone(topic, progress);
  const passed = isTestPassed(record);
  let status = tasksDone || record ? STATUS_ACTIVE : STATUS_NEW;
  if (passed) status = tasksDone === tasks ? STATUS_PASSED : STATUS_TEST_PASSED;
  return {
    steps: tasks + 1,
    done: tasksDone + (passed ? 1 : 0),
    status: status,
    tasks: tasks,
    tasksDone: tasksDone,
    passed: passed
  };
}

/* Первый по порядку урок, который ещё не пройден; все пройдены — null.
   Сюда ведут «Продолжить обучение» на главной и «Продолжить» в кабинете */
function firstUnfinishedLesson(progress) {
  return LESSONS.find(function (t) { return !lessonProgress(t, progress).passed; }) || null;
}

/* Сколько уроков пройдено по сохранённому прогрессу.
   Считаются только уроки: старые записи по темам справочника остаются в памяти, но не учитываются */
function countPassed(progress) {
  return LESSONS.filter(function (t) {
    return lessonProgress(t, progress).passed;
  }).length;
}

/* Кнопка на главной: вошёл и есть прогресс — «Продолжить обучение», всё пройдено — «К урокам», иначе — «Начать обучение» */
function renderHomeStartButton() {
  const button = document.getElementById("home-start");
  if (!button) return;
  const progress = getProgress();
  const started = Boolean(getCurrentUser()) && LESSONS.some(function (t) {
    return lessonProgress(t, progress).status !== STATUS_NEW;
  });
  const next = firstUnfinishedLesson(progress);
  if (started && !next) {
    button.textContent = "К урокам";
    button.href = "lessons.html";
    return;
  }
  button.textContent = started ? "Продолжить обучение" : "Начать обучение";
  button.href = "lesson.html?id=" + encodeURIComponent((started ? next : LESSONS[0]).id);
}

/* Полоса прогресса «Пройдено N из M» на странице «Уроки» */
function renderProgressBar(progress) {
  const passedCount = countPassed(progress);
  const percent = Math.round((passedCount / LESSONS.length) * 100);
  return (
    '<div class="card progress-card">' +
      '<p class="progress-text">Пройдено <strong>' + passedCount + "</strong> из " + LESSONS.length + "</p>" +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + LESSONS.length +
        '" aria-valuenow="' + passedCount + '" aria-label="Прогресс обучения">' +
        '<div class="progress-fill" style="width:' + percent + '%"></div>' +
      "</div>" +
    "</div>"
  );
}

function renderLessonsPage() {
  const page = document.getElementById("lessons-page");
  if (!page) return;

  const user = getCurrentUser();
  const progress = getProgress();

  let html = renderProgressBar(progress);

  if (!user) {
    html +=
      '<p class="hint">Войдите, чтобы прогресс сохранялся. Смотреть уроки можно и без входа. ' +
      '<a href="' + loginLinkBack() + '">Войти</a></p>';
  }

  html += renderLessonCards(progress);
  page.innerHTML = html;
}

/* Карточка урока: номер, название, описание, полоска прогресса и строка «В процессе · 3 из 6», «Тест сдан ✓ · 2 из 6» */
function renderLessonCard(topic, progress) {
  const state = lessonProgress(topic, progress);
  const text = state.status === STATUS_NEW ? state.status
    : state.status + (state.passed ? " ✓" : "") + " · " + state.done + " из " + state.steps;
  return (
    '<a class="card lesson-card' + (state.passed ? " is-passed" : "") + '" href="lesson.html?id=' + encodeURIComponent(topic.id) + '">' +
      '<span class="lesson-num">Урок ' + (LESSONS.indexOf(topic) + 1) + "</span>" +
      "<h3>" + escapeHtml(topic.title) + "</h3>" +
      "<p>" + escapeHtml(topic.description) + "</p>" +
      '<div class="lesson-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + state.steps +
        '" aria-valuenow="' + state.done + '" aria-label="Прогресс урока">' +
        '<div class="lesson-bar-fill" style="width:' + Math.round(state.done / state.steps * 100) + '%"></div>' +
      "</div>" +
      '<div class="lesson-bar-text' + (state.passed ? " is-passed" : "") + '">' + text + "</div>" +
    "</a>"
  );
}

/* Список всех уроков по разделам. Разделы без уроков (сейчас «Социально-правовая помощь») не показываются */
function renderLessonCards(progress) {
  let html = "";
  SECTIONS.forEach(function (section) {
    if (!LESSONS.some(function (t) { return t.section === section.id; })) return;

    html += '<h2 class="lessons-section-title" id="' + section.id + '">' + escapeHtml(section.title) + "</h2>";
    html += '<div class="lessons-grid">';

    LESSONS.forEach(function (topic) {
      if (topic.section === section.id) html += renderLessonCard(topic, progress);
    });

    html += "</div>";
  });
  return html;
}

/* ---------- Личный кабинет ---------- */

/* «Мои уроки»: только начатые — сначала «В процессе», затем «Тест сдан», потом «Пройден» */
function renderMyLessons(progress) {
  function withStatus(status) {
    return LESSONS.filter(function (t) { return lessonProgress(t, progress).status === status; });
  }
  const list = withStatus(STATUS_ACTIVE).concat(withStatus(STATUS_TEST_PASSED), withStatus(STATUS_PASSED));
  if (!list.length) {
    return (
      '<div class="card my-lessons-empty">' +
        "<p>Вы ещё не начали ни одного урока</p>" +
        '<a href="lessons.html" class="btn btn-primary">К урокам</a>' +
      "</div>"
    );
  }
  return '<div class="lessons-grid">' +
    list.map(function (t) { return renderLessonCard(t, progress); }).join("") +
  "</div>";
}

/* Фраза под приветствием */
function cabinetGreeting(passed) {
  if (!passed) return "Начните с первого урока — это займёт 10–15 минут.";
  if (passed === LESSONS.length) return "Все уроки пройдены. Вы большой молодец!";
  return plural(passed, "Пройден ", "Пройдено ", "Пройдено ") + passed + " " + plural(passed, "урок", "урока", "уроков") +
    " из " + LESSONS.length + ". Вы движетесь — это главное.";
}

/* Приветствие: кольцо «N из 10», имя и карточка «Продолжить» (первый непройденный урок; всё пройдено — к списку уроков) */
function renderCabinetHello(user, progress) {
  const passed = countPassed(progress);
  const next = firstUnfinishedLesson(progress);
  return (
    '<div class="card cab-hello">' +
      '<div class="cab-ring" role="progressbar" aria-valuemin="0" aria-valuemax="' + LESSONS.length + '" aria-valuenow="' + passed + '" aria-label="Пройдено уроков">' +
        '<svg viewBox="0 0 110 110" aria-hidden="true" focusable="false">' +
          '<circle class="cab-ring-track" cx="55" cy="55" r="48.5"/>' +
          '<circle class="cab-ring-value" cx="55" cy="55" r="48.5" pathLength="100" stroke-dasharray="' + passed / LESSONS.length * 100 + ' 100" transform="rotate(-90 55 55)"/>' +
        "</svg>" +
        '<p class="cab-ring-text" aria-hidden="true"><strong>' + passed + "</strong><span>из " + LESSONS.length + "</span></p>" +
      "</div>" +
      '<div class="cab-hello-text">' +
        "<h1>Здравствуйте" + (user.name ? ", " + escapeHtml(user.name) : "") + "!</h1>" +
        "<p>" + cabinetGreeting(passed) + "</p>" +
      "</div>" +
      '<div class="cab-next">' +
        (next
          ? '<div class="cab-next-text"><p class="cab-next-label">Продолжить с урока</p><p class="cab-next-title">' + escapeHtml(next.title) + "</p></div>" +
            '<a href="lesson.html?id=' + encodeURIComponent(next.id) + '" class="btn btn-primary cab-btn">Продолжить →</a>'
          : '<div class="cab-next-text"><p class="cab-next-title">Все уроки пройдены <span class="cab-check">✓</span></p></div>' +
            '<a href="lessons.html" class="btn btn-primary cab-btn">К урокам →</a>') +
      "</div>" +
    "</div>"
  );
}

/* Значки карточек статистики и комментария: содержимое svg с viewBox 0 0 24 24 */
const CABINET_ICONS = {
  tasks: '<path class="cab-icon-fill" d="M12 .5 23.5 12 12 23.5 .5 12z"/>',
  tests: '<path d="M6 12.5l4 4 8-9"/>',
  mood: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3"/><circle class="cab-icon-fill" cx="9" cy="10" r="1"/><circle class="cab-icon-fill" cx="15" cy="10" r="1"/>',
  insight: '<path class="cab-icon-fill" d="M12 4c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8z"/>'
};

/* Карточка статистики: значок, подпись, число с припиской и полоска. Полоска только для вида: то же число написано рядом */
function statCard(kind, label, value, note, percent) {
  return '<div class="card stat-card stat-card--' + kind + '">' +
    '<span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + CABINET_ICONS[kind] + "</svg></span>" +
    '<div class="stat-body">' +
      '<p class="stat-label">' + label + "</p>" +
      '<p class="stat-value"><strong id="stat-' + kind + '-value">' + value + '</strong> <span class="stat-note">' + note + "</span></p>" +
      '<div class="stat-bar" aria-hidden="true"><span id="stat-' + kind + '-bar" style="width:' + percent + '%"></span></div>' +
    "</div>" +
  "</div>";
}

/* Статистика: три карточки. Практика и тесты считаются из прогресса; средний результат — по тестам уроков, которые хоть раз проходили.
   Число отметок настроения подставляет drawMyWellbeing, когда они загрузятся */
function renderMyStats(progress) {
  const states = LESSONS.map(function (t) { return lessonProgress(t, progress); });
  const tasks = states.reduce(function (sum, s) { return sum + s.tasks; }, 0);
  const tasksDone = states.reduce(function (sum, s) { return sum + s.tasksDone; }, 0);
  const scores = LESSONS.map(function (t) { return progress[t.id]; })
    .filter(function (r) { return r && r.total > 0; })
    .map(function (r) { return r.best / r.total; });
  const average = scores.length
    ? Math.round(scores.reduce(function (sum, x) { return sum + x; }, 0) / scores.length * 100)
    : 0;

  return (
    '<div class="stats-grid">' +
      statCard("tasks", "Заданий практики", tasksDone, "из " + tasks, tasks ? tasksDone / tasks * 100 : 0) +
      statCard("tests", "Средний результат тестов", scores.length ? average + "%" : "—",
        scores.length ? "по " + scores.length + " " + plural(scores.length, "тесту", "тестам", "тестам") : "", average) +
      statCard("mood", "Отметок настроения", "—", "за " + CHART_DAYS + " дней", 0) +
    "</div>"
  );
}

/* ---------- Кабинет: «Моё самочувствие» ---------- */

const MOOD_LABELS = ["Очень плохо", "Плохо", "Нормально", "Хорошо", "Отлично"];
const MOOD_MOUTHS = ["M12 29 Q20 20 28 29", "M13 28 Q20 24 27 28", "M13 26 H27", "M13 24 Q20 29 27 24", "M12 23 Q20 33 28 23"];
const MOOD_NOTE_MAX = 300;
const CHART_DAYS = 14;
const BAD_STREAK_HINT = 3;     // столько последних отметок 1–2 подряд — предлагаем поговорить
const SILENT_DAYS_HINT = 5;    // столько дней без отметок — напоминаем
const INSIGHT_MIN_MARKS = 3;

function moodFace(mood) {
  return '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<circle cx="20" cy="20" r="17"/>' +
    '<circle class="mood-eye" cx="14" cy="16" r="2"/><circle class="mood-eye" cx="26" cy="16" r="2"/>' +
    '<path d="' + MOOD_MOUTHS[mood - 1] + '"/>' +
  "</svg>";
}

/* «2026-11-05» → «5 ноября» */
function dayTitle(day) {
  return new Date(day + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function shiftLocalDay(day, days) {
  const date = new Date(day + "T12:00:00");
  date.setDate(date.getDate() + days);
  return Store.localDay(date);
}

/* Сколько дней между двумя датами вида «2026-11-05» */
function daysBetween(from, to) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

/* График за 14 дней: точка на каждый отмеченный день, линия и заливка под ней только между соседними днями, пропуски пустые.
   Какой это день — в подсказке над точкой. Подписи рисуются один к одному в пикселях, поэтому при смене ширины график строится заново */
function moodChartHtml(entries, width) {
  const today = Store.localDay(new Date());
  const height = 135;
  const left = 39;
  const right = 18;
  const top = 9;
  const bottom = 6;
  const step = (width - left - right) / (CHART_DAYS - 1);
  const byDay = {};
  entries.forEach(function (e) { byDay[e.day] = e.mood; });

  function y(mood) { return top + (5 - mood) * (height - top - bottom) / 4; }

  let grid = "";
  for (let mood = 1; mood <= 5; mood++) {
    grid += '<line class="mood-grid" x1="' + left + '" x2="' + (width - right) + '" y1="' + y(mood) + '" y2="' + y(mood) + '"/>' +
      '<text class="mood-axis" x="' + (left - 12) + '" y="' + (y(mood) + 4) + '" text-anchor="end">' + mood + "</text>";
  }

  let areas = "";
  let lines = "";
  let dots = "";
  let targets = "";
  const spoken = [];
  for (let i = 0; i < CHART_DAYS; i++) {
    const day = shiftLocalDay(today, i - CHART_DAYS + 1);
    const x = left + i * step;
    const mood = byDay[day];
    const next = byDay[shiftLocalDay(day, 1)];
    if (mood && next && i < CHART_DAYS - 1) {
      lines += '<line class="mood-line" x1="' + x + '" y1="' + y(mood) + '" x2="' + (x + step) + '" y2="' + y(next) + '"/>';
      areas += '<polygon class="mood-area" points="' + x + "," + y(mood) + " " + (x + step) + "," + y(next) + " " + (x + step) + "," + (height - 1) + " " + x + "," + (height - 1) + '"/>';
    }
    if (mood) {
      dots += '<circle class="mood-dot' + (i === CHART_DAYS - 1 ? " mood-dot--today" : "") + '" cx="' + x + '" cy="' + y(mood) + '" r="6"/>';
      targets += '<rect class="mood-target" x="' + (x - step / 2) + '" y="0" width="' + step + '" height="' + height + '" data-tip="' +
        escapeHtml(dayTitle(day) + ": " + MOOD_LABELS[mood - 1]) + '" data-x="' + x + '" data-y="' + y(mood) + '"/>';
      spoken.push(dayTitle(day) + " — " + MOOD_LABELS[mood - 1]);
    }
  }
  const summary = spoken.length ? "Настроение за 14 дней: " + spoken.join(", ") : "За 14 дней отметок нет";
  return '<svg class="mood-chart-svg" role="img" aria-label="' + escapeHtml(summary) + '" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + " " + height + '">' + grid + areas + lines + dots + targets + "</svg>" +
    '<div class="mood-tip" hidden></div>';
}

function drawMoodChart(box, entries) {
  const width = Math.round(box.clientWidth);
  if (width < 100 || Number(box.dataset.width) === width && box.dataset.drawn === JSON.stringify(entries)) return;
  box.dataset.width = width;
  box.dataset.drawn = JSON.stringify(entries);
  box.innerHTML = moodChartHtml(entries, width);
}

/* Всплывающая подпись над точкой графика */
function setupMoodTip(box) {
  function show(e) {
    const tip = box.querySelector(".mood-tip");
    const target = e.target.closest(".mood-target");
    if (!tip) return;
    tip.hidden = !target;
    if (!target) return;
    tip.textContent = target.dataset.tip;
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(box.clientWidth - half, Number(target.dataset.x))) + "px";
    tip.style.top = Number(target.dataset.y) + "px";
  }
  box.addEventListener("pointermove", show);
  box.addEventListener("pointerdown", show);  // на телефоне подпись появляется по нажатию
  box.addEventListener("pointerleave", function () {
    const tip = box.querySelector(".mood-tip");
    if (tip) tip.hidden = true;
  });
}

function myWellbeingBlock() {
  return '<h2 class="visually-hidden">Моё самочувствие</h2><div id="my-wellbeing"><p class="muted">Загружаем…</p></div>';
}

function setupMyWellbeing() {
  const box = document.getElementById("my-wellbeing");
  if (!box) return;

  Promise.all([Store.getMood(), Store.getWellbeing()]).then(function (data) {
    drawMyWellbeing(box, data[0], data[1].results, data[1].shareWellbeing);
  }).catch(function (e) {
    box.innerHTML = '<div class="card"><p class="error" role="alert">Самочувствие не загрузилось: ' + escapeHtml(e.message) + "</p></div>";
  });
}

function drawMyWellbeing(box, entries, results, share) {
  const today = Store.localDay(new Date());
  const todayEntry = entries.find(function (e) { return e.day === today; });
  const last = results[0];

  box.innerHTML =
    '<div id="mood-hints"></div>' +

    '<div class="my-wellbeing-grid">' +
      '<form class="card mood-form" id="mood-form">' +
        '<fieldset class="mood-fieldset">' +
          '<legend class="mood-head"><h3>Как вы сегодня?</h3><span class="mood-head-note">' + dayTitle(today) + "</span></legend>" +
          '<div class="mood-options">' +
            MOOD_LABELS.map(function (label, i) {
              const mood = i + 1;
              return '<label class="mood-option">' +
                '<input type="radio" class="visually-hidden" name="mood" value="' + mood + '"' + (todayEntry && todayEntry.mood === mood ? " checked" : "") + ">" +
                '<span class="mood-face">' + moodFace(mood) + "</span>" +
                '<span class="mood-label">' + label + "</span>" +
              "</label>";
            }).join("") +
          "</div>" +
        "</fieldset>" +
        '<div class="mood-save">' +
          '<label for="mood-note" class="visually-hidden">Заметка (необязательно)</label>' +
          '<input type="text" id="mood-note" maxlength="' + MOOD_NOTE_MAX + '" placeholder="Заметка (необязательно)" autocomplete="off">' +
          '<button type="submit" class="btn btn-primary cab-btn">Сохранить</button>' +
        "</div>" +
        '<p class="mood-status" id="mood-status" role="status">' + (todayEntry ? "Сегодняшнюю отметку можно поменять" : "") + "</p>" +
      "</form>" +

      '<div class="card mood-history">' +
        '<div class="mood-head"><h3>Настроение за 14 дней</h3><span class="mood-head-note">1 — очень плохо · 5 — отлично</span></div>' +
        '<div class="mood-chart" id="mood-chart"></div>' +
        '<p class="mood-last">' +
          (last
            ? "<span>Тест о самочувствии: " +
                '<span class="mood-level mood-level--' + escapeHtml(last.level) + '">' + escapeHtml(wellbeingLevelById(last.level).title) + "</span>" +
                "\u00a0· " + escapeHtml(new Date(last.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })) +
              "</span>" +
              '<a href="help.html#check">Пройти ещё раз →</a>'
            : '<span>Тест о самочувствии ещё не пройден</span><a href="help.html#check">Пройти тест →</a>') +
        "</p>" +
      "</div>" +
    "</div>" +

    '<section class="cab-insight" aria-labelledby="insight-title">' +
      '<span class="cab-insight-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + CABINET_ICONS.insight + "</svg></span>" +
      '<div class="cab-insight-main">' +
        '<h2 id="insight-title">Комментарий консультанта</h2>' +
        '<p id="insight-hint"></p>' +
        '<div class="insight-card" id="insight-card" aria-live="polite" hidden></div>' +
        '<label class="mood-share">' +
          '<input type="checkbox" class="visually-hidden" role="switch" id="share-wellbeing"' + (share ? " checked" : "") + ">" +
          '<span class="mood-switch" aria-hidden="true"></span>' +
          "<span>Консультант может учитывать мои отметки и результаты теста (заметки не передаются)</span>" +
        "</label>" +
        '<p class="error" id="share-error" role="alert"></p>' +
      "</div>" +
      '<button type="button" class="btn cab-btn cab-insight-btn" id="insight-btn">Получить комментарий</button>' +
    "</section>";

  // Значением, а не атрибутом в разметке: в заметке могут быть кавычки
  document.getElementById("mood-note").value = todayEntry && todayEntry.note || "";

  const chart = document.getElementById("mood-chart");
  const hints = document.getElementById("mood-hints");
  const insightBtn = document.getElementById("insight-btn");
  const insightHint = document.getElementById("insight-hint");

  function refresh() {
    drawMoodChart(chart, entries);
    hints.innerHTML = moodHintsHtml(entries, last);
    insightBtn.disabled = entries.length < INSIGHT_MIN_MARKS;
    const marksLeft = INSIGHT_MIN_MARKS - entries.length;
    insightHint.textContent = marksLeft > 0
      ? "Станет доступен после " + INSIGHT_MIN_MARKS + " отметок настроения — " + plural(marksLeft, "осталась", "осталось", "осталось") + " " + marksLeft + "."
      : Store.getMode() === "server" ? "Консультанту отправятся только оценки настроения и результат теста, без заметок" : "";
    // Карточка статистики: отметки приходят за 30 дней, здесь нужны последние 14
    const marks = entries.filter(function (e) { return daysBetween(e.day, today) < CHART_DAYS; }).length;
    document.getElementById("stat-mood-value").textContent = marks;
    document.getElementById("stat-mood-bar").style.width = marks / CHART_DAYS * 100 + "%";
  }
  refresh();
  setupMoodTip(chart);
  if (window.ResizeObserver) new ResizeObserver(function () { drawMoodChart(chart, entries); }).observe(chart);

  const form = document.getElementById("mood-form");
  const status = document.getElementById("mood-status");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const picked = form.querySelector('input[name="mood"]:checked');
    if (!picked) {
      status.textContent = "Выберите, как вы сегодня.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    Store.saveMood(Number(picked.value), document.getElementById("mood-note").value).then(function (entry) {
      const index = entries.findIndex(function (x) { return x.day === entry.day; });
      if (index === -1) entries.push(entry); else entries[index] = entry;
      status.textContent = "Сохранено. Сегодняшнюю отметку можно поменять";
      refresh();
    }).catch(function (e) {
      status.textContent = "Не сохранилось: " + e.message;
    }).then(function () {
      button.disabled = false;
    });
  });

  const shareBox = document.getElementById("share-wellbeing");
  const shareError = document.getElementById("share-error");
  shareBox.addEventListener("change", function () {
    const wanted = shareBox.checked;
    shareError.textContent = "";
    Store.setShareWellbeing(wanted).catch(function (e) {
      shareBox.checked = !wanted;
      shareError.textContent = "Настройка не сохранилась: " + e.message;
    });
  });

  const insightCard = document.getElementById("insight-card");
  insightBtn.addEventListener("click", function () {
    insightCard.hidden = false;
    insightHint.hidden = true;   // вместо строки состояния теперь ответ
    if (Store.getMode() !== "server") {
      insightCard.innerHTML = "<p>Доступно при работе через сервер</p>";
      return;
    }
    insightBtn.disabled = true;
    insightCard.innerHTML = '<p class="typing">Консультант думает…</p>';
    Store.getInsight().then(function (reply) {
      insightCard.innerHTML = formatAnswer(reply.answer) + (reply.needsTalk
        ? '<div class="buttons"><a href="consultant.html?mode=support" class="btn btn-small btn-primary">Поговорить</a></div>'
        : "");
    }).catch(function (e) {
      insightCard.innerHTML = "<p>" + escapeHtml(e.message) + "</p>";
    }).then(function () {
      insightBtn.disabled = entries.length < INSIGHT_MIN_MARKS;
    });
  });
}

/* Подсказки по правилам. Отметки — от старых к новым, last — последний результат теста.
   Если отметок давно нет, про «последние дни» не говорим: остаётся только напоминание */
function moodHintsHtml(entries, last) {
  const today = Store.localDay(new Date());
  const lastEntry = entries[entries.length - 1];
  const silent = !lastEntry || daysBetween(lastEntry.day, today) >= SILENT_DAYS_HINT;
  let badStreak = 0;
  for (let i = entries.length - 1; i >= 0 && entries[i].mood <= 2; i--) badStreak++;

  let html = "";
  if (!silent && badStreak >= BAD_STREAK_HINT) {
    html += '<div class="card mood-hint"><p>Похоже, последние дни тяжёлые. Поговорим?</p>' +
      '<div class="buttons">' +
        '<a href="consultant.html?mode=support" class="btn btn-small btn-primary">Поговорить</a>' +
        '<a href="help.html#selfcare" class="btn btn-small btn-secondary">Минутка для себя</a>' +
      "</div></div>";
  }
  if (last && last.level === "high") {
    html += '<div class="card mood-hint mood-hint-high"><p>Последний тест показал высокую нагрузку. Вы не обязаны справляться с этим в одиночку.</p>' +
      supportPhonesHtml() +
      '<div class="buttons"><a href="consultant.html?mode=support" class="btn btn-small btn-primary">Поговорить сейчас</a></div></div>';
  }
  if (silent) html += '<div class="card mood-hint"><p>Как вы сегодня? Отметьте настроение</p></div>';
  return html;
}

function renderCabinetPage() {
  const page = document.getElementById("cabinet-page");
  if (!page) return;

  const user = getCurrentUser();

  if (!user) {
    page.innerHTML =
      "<h1>Личный кабинет</h1>" +
      '<div class="card cabinet-guest">' +
        '<p class="lead">Войдите, чтобы сохранять прогресс.</p>' +
        '<div class="buttons">' +
          '<a href="login.html" class="btn btn-primary">Войти</a>' +
          '<a href="login.html?tab=register" class="btn btn-secondary">Зарегистрироваться</a>' +
        "</div>" +
      "</div>";
    return;
  }

  const progress = getProgress();

  page.innerHTML =
    renderCabinetHello(user, progress) +

    '<h2 class="visually-hidden">Моя статистика</h2>' +
    renderMyStats(progress) +

    myWellbeingBlock() +

    '<h2 class="lesson-h2">Мои уроки</h2>' +
    renderMyLessons(progress) +

    '<h2 class="lesson-h2">Мои данные</h2>' +
    '<div class="card cabinet-data">' +
      (user.name ? '<p><span class="muted">Имя:</span> <strong>' + escapeHtml(user.name) + "</strong></p>" : "") +
      '<p><span class="muted">Почта:</span> <strong>' + escapeHtml(user.email) + "</strong></p>" +
      '<button type="button" id="cabinet-logout" class="btn btn-secondary">Выйти</button>' +
    "</div>" +

    '<div class="card cabinet-reset">' +
      "<h2>Сбросить прогресс</h2>" +
      '<p class="muted">Удалит все результаты тестов и отметки о пройденных уроках. Аккаунт останется.</p>' +
      '<button type="button" id="reset-btn" class="btn btn-secondary">Сбросить прогресс</button>' +
      // Подтверждение прямо на странице: показывается после нажатия «Сбросить прогресс»
      '<div id="reset-confirm" class="reset-confirm" role="alertdialog" aria-labelledby="reset-question" hidden>' +
        '<p id="reset-question"><strong>Вы уверены?</strong> Отменить это будет нельзя.</p>' +
        '<div class="buttons">' +
          '<button type="button" id="reset-yes" class="btn btn-danger">Да, сбросить</button>' +
          '<button type="button" id="reset-no" class="btn btn-secondary">Отмена</button>' +
        "</div>" +
      "</div>" +
    "</div>";

  setupMyWellbeing();

  document.getElementById("cabinet-logout").addEventListener("click", function () {
    Store.logout().then(function () { location.href = "index.html"; });
  });

  const resetBtn = document.getElementById("reset-btn");
  const confirmBox = document.getElementById("reset-confirm");

  resetBtn.addEventListener("click", function () {
    resetBtn.hidden = true;
    confirmBox.hidden = false;
    document.getElementById("reset-no").focus();
  });
  document.getElementById("reset-no").addEventListener("click", function () {
    confirmBox.hidden = true;
    resetBtn.hidden = false;
    resetBtn.focus();
  });
  document.getElementById("reset-yes").addEventListener("click", function () {
    Store.resetProgress().then(renderCabinetPage); // только прогресс этого пользователя
  });
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

/* Название источника: ссылкой, если адрес есть (только http/https), иначе обычным текстом */
function sourceHtml(source) {
  const url = (source.url || "").trim();
  const title = source.title || url;
  if (/^https?:\/\//i.test(url)) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(title) + "</a>";
  }
  return escapeHtml(title);
}

/* «Источники» — из поля sources. Без адреса название показывается текстом */
function renderSources(topic) {
  const sources = (topic.sources || []).filter(function (s) { return s && (s.title || s.url); });
  if (!sources.length) return "";
  return (
    '<h2 class="lesson-h2">Источники</h2>' +
    '<ul class="card sources">' +
      sources.map(function (s) { return "<li>" + sourceHtml(s) + "</li>"; }).join("") +
    "</ul>"
  );
}

/* Вводный текст темы (поле intro) */
function renderIntro(topic) {
  return topic.intro ? '<p class="card topic-intro">' + escapeHtml(topic.intro) + "</p>" : "";
}

/* ---------- Страница урока: всё на одном экране ---------- */

/* Склонение: plural(2, "задание", "задания", "заданий") → «задания» */
function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

/* Значки карточек — простые рисунки SVG: выглядят одинаково во всех браузерах */
const LESSON_ICONS = {
  memo: '<svg class="lesson-icon lesson-icon--memo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="5" y="4" width="14" height="17" rx="2.5"/><rect x="9" y="2.5" width="6" height="4" rx="1.2"/>' +
    '<path d="M9 11h6M9 15h6"/></svg>',
  practice: '<svg class="lesson-icon lesson-icon--practice" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M10 4.5a2 2 0 0 1 4 0V7h4a1 1 0 0 1 1 1v3.5h-1.5a2.2 2.2 0 0 0 0 4.4H19V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4.1h1.5a2.2 2.2 0 0 0 0-4.4H5V8a1 1 0 0 1 1-1h4z"/></svg>',
  test: '<svg class="lesson-icon lesson-icon--test" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l3 3 5.5-6.5"/></svg>'
};

/* Адрес только http/https, иначе пустая строка */
function webUrl(url) {
  const value = (url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

/* Видео урока или статьи — необязательное поле videos в js/data.js:
     videos: [{ title: "Название", org: "Кто снял", embedUrl: "адрес плеера для iframe", pageUrl: "страница ролика" }]
   embedUrl может не быть (площадка не разрешает встраивание) — тогда вместо плеера карточка со ссылкой на pageUrl.
   org или pageUrl могут быть пустыми — тогда нет подписи под плеером или кнопки «Смотреть на сайте».
   Старое поле video (ссылка YouTube/Rutube) тоже работает, если списка videos нет. */
function lessonVideos(topic) {
  if (Array.isArray(topic.videos) && topic.videos.length) {
    return topic.videos.filter(function (v) { return v && (webUrl(v.embedUrl) || webUrl(v.pageUrl)); });
  }
  const url = (topic.video || "").trim();
  return url ? [{ title: topic.title, embedUrl: getEmbedUrl(url), pageUrl: url }] : [];
}

/* Плеер на странице или, если встроить нельзя, карточка 16:9 со ссылкой на сайт ролика */
function lessonVideoScreen(video) {
  const embed = webUrl(video.embedUrl);
  const pageUrl = webUrl(video.pageUrl);
  if (embed) {
    return (
      '<iframe src="' + escapeHtml(embed) + '" title="' + escapeHtml(video.title || "Видео урока") + '" loading="lazy" ' +
      'allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write" allowfullscreen ' +
      'referrerpolicy="strict-origin-when-cross-origin"></iframe>'
    );
  }
  return (
    '<div class="lesson-video-card">' +
      (video.title ? '<p class="lesson-video-card-title">' + escapeHtml(video.title) + "</p>" : "") +
      (video.org ? '<p class="lesson-video-card-org">' + escapeHtml(video.org) + "</p>" : "") +
      (pageUrl ? '<a href="' + escapeHtml(pageUrl) + '" class="btn btn-primary" target="_blank" rel="noopener">Смотреть на сайте</a>' : "") +
    "</div>"
  );
}

function lessonVideoOrg(video) {
  const platform = videoPlatform(video);
  return video.org ? "Видео: " + video.org + (platform ? ", " + platform : "") : platform;
}

/* Площадка ролика — по адресу плеера */
function videoPlatform(video) {
  const url = video.embedUrl || video.pageUrl || "";
  if (/rutube\./.test(url)) return "Rutube";
  if (/dzen\./.test(url)) return "Дзен";
  if (/\bvk(video)?\./.test(url)) return "VK Видео";
  if (/youtu\.?be/.test(url)) return "YouTube";
  return "";
}

/* Содержимое окна с роликом: плеер и подпись источника */
function videoModalHtml(video) {
  return '<div class="lesson-video-screen">' + lessonVideoScreen(video) + "</div>" +
    '<p class="lesson-video-org">' + escapeHtml(lessonVideoOrg(video)) + "</p>";
}

function renderLessonVideos(videos) {
  if (!videos.length) return "";
  const list = videos.length < 2 ? "" :
    '<ul class="lesson-video-list">' +
      videos.map(function (v, i) {
        return '<li><button type="button" class="lesson-video-item' + (i === 0 ? " is-current" : "") + '" data-video="' + i + '"' +
          ' aria-pressed="' + (i === 0) + '">' + escapeHtml(v.title || "Видео " + (i + 1)) + "</button></li>";
      }).join("") +
    "</ul>";
  return (
    '<section class="lesson-video" aria-label="Видео урока">' +
      '<div class="lesson-video-screen">' + lessonVideoScreen(videos[0]) + "</div>" +
      '<p class="lesson-video-org">' + escapeHtml(lessonVideoOrg(videos[0])) + "</p>" +
      list +
    "</section>"
  );
}

/* Клик по названию ролика — этот ролик в том же плеере */
function setupLessonVideos(page, videos) {
  const box = page.querySelector(".lesson-video");
  if (!box) return;
  box.addEventListener("click", function (e) {
    const button = e.target.closest(".lesson-video-item");
    if (!button || button.classList.contains("is-current")) return;
    const video = videos[Number(button.dataset.video)];
    box.querySelector(".lesson-video-screen").innerHTML = lessonVideoScreen(video);
    box.querySelector(".lesson-video-org").textContent = lessonVideoOrg(video);
    box.querySelectorAll(".lesson-video-item").forEach(function (b) {
      b.classList.toggle("is-current", b === button);
      b.setAttribute("aria-pressed", b === button);
    });
  });
}

/* Статья: вступление и начало текста, остальное раскрывается на месте; внизу раскрытой статьи — источники */
function renderLessonArticle(topic) {
  const details = (topic.details || []).filter(Boolean);
  const sources = (topic.sources || []).filter(function (s) { return s && (s.title || s.url); });
  if (!topic.intro && !details.length) return "";
  return (
    '<article class="card lesson-article" aria-label="Текст урока">' +
      (topic.intro ? '<p class="lesson-article-intro">' + escapeHtml(topic.intro) + "</p>" : "") +
      (details.length
        ? '<div class="lesson-article-body">' +
            details.map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join(" ") +
          "</div>"
        : "") +
      (sources.length
        ? '<div class="lesson-article-sources">' +
            "<h2>Источники</h2>" +
            "<ul>" + sources.map(function (s) { return "<li>" + sourceHtml(s) + "</li>"; }).join("") + "</ul>" +
          "</div>"
        : "") +
      '<button type="button" class="lesson-article-toggle" aria-expanded="false"></button>' +
    "</article>"
  );
}

/* Раскрытие статьи. Кнопка нужна, только если текст обрезан: это проверяется и при изменении ширины окна */
function setupLessonArticle(page) {
  const card = page.querySelector(".lesson-article");
  if (!card) return;
  const body = card.querySelector(".lesson-article-body");
  const sources = card.querySelector(".lesson-article-sources");
  const toggle = card.querySelector(".lesson-article-toggle");
  let expanded = false;

  function update() {
    card.classList.toggle("is-collapsed", !expanded);
    const isCut = !expanded && Boolean(body) && body.scrollHeight > body.clientHeight + 1;
    if (!expanded && !isCut) card.classList.remove("is-collapsed");  // весь текст и так помещается
    toggle.hidden = !expanded && !isCut;
    toggle.textContent = expanded ? "Свернуть ▴" : "Читать полностью ▾";
    toggle.setAttribute("aria-expanded", expanded);
    if (sources) sources.hidden = isCut;
  }

  toggle.addEventListener("click", function () {
    expanded = !expanded;
    update();
    if (!expanded) card.scrollIntoView({ block: "start" });
  });
  window.addEventListener("resize", update);
  update();
}

/* Карточка правой колонки: значок, заголовок, содержимое */
function lessonSideCard(icon, title, content) {
  return '<section class="card lesson-side-card"><h2>' + icon + escapeHtml(title) + "</h2>" + content + "</section>";
}

function renderLessonMemoCard(hasMemoBlocks) {
  if (!hasMemoBlocks) return "";
  return lessonSideCard(LESSON_ICONS.memo, "Памятка",
    '<p class="lesson-side-note">Можно · нельзя · когда срочно к врачу</p>' +
    '<button type="button" class="btn btn-secondary lesson-side-btn" id="lesson-memo-open">Открыть памятку</button>');
}

function renderLessonPracticeCard(topic) {
  const tasks = practiceTasks(topic);
  if (!tasks.length) return "";
  const done = countTasksDone(topic);
  const mark = !done ? "" :
    '<span class="lesson-done">' + (done === tasks.length ? "Выполнено" : done + " из " + tasks.length) + " ✓</span>";
  return lessonSideCard(LESSON_ICONS.practice, "Практика",
    '<p class="lesson-side-note">' + tasks.length + " " + plural(tasks.length, "задание", "задания", "заданий") + "</p>" +
    '<div class="lesson-side-row">' +
      '<a href="' + practiceLink(topic, 1) + '" class="btn btn-primary">Перейти</a>' + mark +
    "</div>");
}

function renderLessonTestCard(topic, record, user) {
  const count = (topic.quiz || []).length;
  if (!count) return "";
  const hasResult = Boolean(record && record.total);
  const passed = hasResult && isTestPassed(record);
  return lessonSideCard(LESSON_ICONS.test, "Тест",
    '<p class="lesson-side-note">' + count + " " + plural(count, "вопрос", "вопроса", "вопросов") +
      " · зачёт от " + Math.round(PASS_RATE * 100) + "%</p>" +
    (hasResult ? '<p class="lesson-side-note">Лучший результат: ' + record.best + " из " + record.total + "</p>" : "") +
    (passed ? '<p class="lesson-side-mark"><span class="lesson-done">Тест сдан ✓</span></p>' : "") +
    '<a href="' + topicTestLink(topic) + '" class="btn btn-primary lesson-side-btn">' +
      (passed ? "Пройти ещё раз" : "Приступить к тесту") + "</a>" +
    (!user
      ? '<p class="lesson-side-hint">Тест можно пройти и без входа, но результат не сохранится. ' +
        '<a href="' + loginLinkBack() + '">Войти</a></p>'
      : ""));
}

/* Окно памятки: тег dialog сам держит фокус внутри и закрывается по Esc.
   Здесь — крестик, щелчок по затемнённому фону и запрет прокрутки страницы под окном */
function setupLessonMemoDialog(page) {
  const open = page.querySelector("#lesson-memo-open");
  const dialog = page.querySelector(".lesson-modal");
  if (!open || !dialog) return;
  let pressedOutside = false;

  open.addEventListener("click", function () {
    document.documentElement.classList.add("modal-open");
    dialog.showModal();
    dialog.querySelector(".lesson-modal-close").focus();
  });
  dialog.addEventListener("close", function () {
    document.documentElement.classList.remove("modal-open");
    open.focus();
  });
  dialog.querySelector(".lesson-modal-close").addEventListener("click", function () { dialog.close(); });
  // Фон — это сам dialog: содержимое занимает его целиком. Выделение текста с отпусканием на фоне окно не закрывает
  dialog.addEventListener("pointerdown", function (e) { pressedOutside = e.target === dialog; });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog && pressedOutside) dialog.close();
  });
}

function renderLessonPage() {
  const page = document.getElementById("lesson-page");
  if (!page) return;

  const id = new URLSearchParams(location.search).get("id");
  const topic = TOPICS.find(function (t) { return t.id === id; });

  if (!topic) {
    page.innerHTML =
      '<div class="card"><h1>Урок не найден</h1>' +
      '<p>Возможно, ссылка устарела.</p>' +
      '<a href="lessons.html" class="btn btn-primary">К списку уроков</a></div>';
    return;
  }

  // Тема только для справочника (kind: "reference") — урока и теста у неё нет
  if (!isLesson(topic)) {
    page.innerHTML = renderNotALesson(topic);
    return;
  }

  const index = LESSONS.indexOf(topic);
  const section = sectionOf(topic);
  const user = getCurrentUser();
  const record = getProgress()[topic.id];
  const videos = lessonVideos(topic);
  const memoBlocks = renderMemo(topic.lessonMemo, section, false);

  document.title = topic.title + " — Опора. Школа ухода";

  page.innerHTML =
    '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
      '<a href="lessons.html">Уроки</a> <span aria-hidden="true">→</span> ' +
      '<span aria-current="page">' + escapeHtml(topic.title) + "</span>" +
    "</nav>" +

    '<p class="lesson-num">Урок ' + (index + 1) + " · " + escapeHtml(section.title) + "</p>" +
    "<h1>" + escapeHtml(topic.title) + "</h1>" +
    '<p class="lead">' + escapeHtml(topic.description) + "</p>" +

    '<div class="lesson-layout">' +
      '<div class="lesson-main">' +
        renderLessonVideos(videos) +
        renderLessonArticle(topic) +
      "</div>" +
      '<aside class="lesson-side" aria-label="Материалы урока">' +
        renderLessonMemoCard(Boolean(memoBlocks)) +
        renderLessonPracticeCard(topic) +   // только если у темы есть поле practice
        renderLessonTestCard(topic, record, user) +   // сам тест — на отдельной странице test.html
      "</aside>" +
      '<p class="lesson-consult">' +
        '<a href="consultant.html?topic=' + encodeURIComponent(topic.id) + '">Спросить консультанта по этой теме</a>' +
      "</p>" +
    "</div>" +

    (memoBlocks
      ? '<dialog class="lesson-modal" aria-labelledby="lesson-modal-title">' +
          '<div class="lesson-modal-box">' +
            '<div class="lesson-modal-head">' +
              '<h2 id="lesson-modal-title">Памятка</h2>' +
              '<button type="button" class="lesson-modal-close" aria-label="Закрыть памятку">✕</button>' +
            "</div>" +
            '<div class="lesson-modal-body">' + memoBlocks + "</div>" +
          "</div>" +
        "</dialog>"
      : "");

  setupLessonVideos(page, videos);
  setupLessonArticle(page);
  setupLessonMemoDialog(page);
}

/* Возврат на урок кнопкой браузера «Назад»: браузер может показать страницу из памяти, со старыми отметками */
window.addEventListener("pageshow", function (e) {
  if (e.persisted && document.getElementById("lesson-page")) location.reload();
});

function topicTestLink(topic) {
  return "test.html?topic=" + encodeURIComponent(topic.id);
}

/* Сообщение для темы справочника, открытой как урок или тест */
function renderNotALesson(topic) {
  return (
    '<div class="card">' +
      "<h1>" + escapeHtml(topic.title) + "</h1>" +
      "<p>Эта тема есть только в справочнике: урока и теста по ней нет.</p>" +
      '<div class="buttons">' +
        '<a href="' + memoLink(topic) + '" class="btn btn-primary">Памятка</a>' +
        '<a href="' + topicLink("article.html", topic) + '" class="btn btn-secondary">Статья</a>' +
      "</div>" +
    "</div>"
  );
}

/* ---------- Практика «Что здесь не так» (поле practice у темы в data.js) ----------
   Картинка из слоёв: фон (правильное состояние) и PNG-слои с прозрачностью.
   Человек ищет слои-ошибки (role "error"); найденный слой растворяется, под ним виден фон.
   Слои с одинаковым group — одна ошибка: подсвечиваются, выбираются и исчезают вместе.
   Верный предмет (role "ok") после выбора остаётся, обводится зелёным и показывает подсказку.
   Какой предмет под курсором — понятно по маске непрозрачных мест слоя:
   маски заранее считает скрипт tools/make-masks.py и кладёт в js/practice-masks.js
   (сайт открывается файлом, и там браузер не даёт читать пиксели картинок).
   Если маски для слоя нет — пробуем прочитать пиксели сами (работает, если сайт открыт через сервер).
   Отметка о выполнении — progress.practiceDone[ID темы] = true; на зачёт урока не влияет. */

const PRACTICE_ALPHA_MIN = 20;  // пиксель — часть предмета, если непрозрачность больше 20 (из 255)
const PRACTICE_REACH = 10;      // запас вокруг предмета в пикселях экрана — мелкие предметы легче выбрать
const PRACTICE_MASK_CELL = 4;   // клетка маски 4×4 пикселя (как в tools/make-masks.py)
let practiceListeners = null;   // обработчики открытого задания (снимаются при переключении)
const PRACTICE_WIDE = "(min-width: 1000px)";   // от этой ширины задание целиком в окне, без прокрутки страницы (css/style.css)
const PRACTICE_NAV_KEY = "opora_practice_nav_folded";   // запоминает, что левая панель свёрнута
let practiceNavFolded = false;
try {
  practiceNavFolded = localStorage.getItem(PRACTICE_NAV_KEY) === "1";
} catch (e) {}

/* Задания практики темы (practice.tasks); нет практики — пустой список */
function practiceTasks(topic) {
  return (topic && topic.practice && Array.isArray(topic.practice.tasks)) ? topic.practice.tasks : [];
}

/* Выполнено ли задание: progress.practiceDone[ID темы][ID задания] = true.
   Старая запись practiceDone[ID темы] = true (до разделения на задания) — это выполненное первое задание */
function isTaskDone(topic, task, progress) {
  const record = ((progress || getProgress()).practiceDone || {})[topic.id];
  if (record === true) return practiceTasks(topic).indexOf(task) === 0;
  return Boolean(record && record[task.id]);
}

function countTasksDone(topic, progress) {
  return practiceTasks(topic).filter(function (t) { return isTaskDone(topic, t, progress); }).length;
}

function saveTaskDone(topic, task) {
  const progress = getProgress();
  progress.practiceDone = progress.practiceDone || {};
  let record = progress.practiceDone[topic.id];
  if (record === true) {  // старая запись — переводим в новый вид
    record = {};
    record[practiceTasks(topic)[0].id] = true;
  }
  record = record || {};
  record[task.id] = true;
  progress.practiceDone[topic.id] = record;
  saveProgress(progress);
}

function practiceLink(topic, taskNumber) {
  return "practice.html?topic=" + encodeURIComponent(topic.id) + (taskNumber > 1 ? "&task=" + taskNumber : "");
}

/* Маска слоя из js/practice-masks.js: { width, height, cell, cols, rows, bits } → с битами в виде массива */
function practiceMaskFromFile(src) {
  if (typeof PRACTICE_MASKS === "undefined" || !PRACTICE_MASKS[src]) return null;
  const m = PRACTICE_MASKS[src];
  const raw = atob(m.bits);
  const bits = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
  return { width: m.width, height: m.height, cell: m.cell, cols: m.cols, rows: m.rows, bits: bits };
}

/* Та же маска, но из пикселей загруженной картинки. На file:/// браузер это запрещает — тогда null */
function practiceMaskFromImage(img) {
  try {
    const w = img.naturalWidth, h = img.naturalHeight, cell = PRACTICE_MASK_CELL;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;  // здесь и бывает ошибка безопасности
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    const bits = new Uint8Array(Math.ceil(cols * rows / 8));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > PRACTICE_ALPHA_MIN) {
          const n = Math.floor(y / cell) * cols + Math.floor(x / cell);
          bits[n >> 3] |= 1 << (n & 7);
        }
      }
    }
    return { width: w, height: h, cell: cell, cols: cols, rows: rows, bits: bits };
  } catch (e) {
    return null;
  }
}

/* Рамка предмета (в пикселях маски) — чтобы поставить окно «Выбрать эту деталь?» рядом с ним */
function practiceMaskBox(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let n = 0; n < m.cols * m.rows; n++) {
    if (m.bits[n >> 3] >> (n & 7) & 1) {
      const cx = n % m.cols, cy = Math.floor(n / m.cols);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
    }
  }
  if (x1 < 0) return null;
  return { x0: x0 * m.cell, y0: y0 * m.cell, x1: (x1 + 1) * m.cell, y1: (y1 + 1) * m.cell };
}

/* Расстояние от точки (x, y) до ближайшего непрозрачного места маски, но не дальше reach.
   0 — точка прямо на предмете, Infinity — предмет дальше reach */
function practiceMaskDistance(m, x, y, reach) {
  const c = m.cell;
  const cx0 = Math.max(0, Math.floor((x - reach) / c)), cx1 = Math.min(m.cols - 1, Math.floor((x + reach) / c));
  const cy0 = Math.max(0, Math.floor((y - reach) / c)), cy1 = Math.min(m.rows - 1, Math.floor((y + reach) / c));
  let best = Infinity;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const n = cy * m.cols + cx;
      if (!(m.bits[n >> 3] >> (n & 7) & 1)) continue;
      const dx = Math.max(cx * c - x, 0, x - (cx + 1) * c);
      const dy = Math.max(cy * c - y, 0, y - (cy + 1) * c);
      best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
    }
  }
  return best <= reach ? best : Infinity;
}

/* Строка внизу задания: слева сообщения (messages), справа кнопки (first — кнопка в начале ряда).
   До завершения видны «Пройти ещё раз» и «К уроку», после — «Готово!» и кнопки practice-after:
   их переключают стили по классу is-done у самой строки */
function practiceBar(topic, taskIndex, doneText, messages, first) {
  const hasNext = taskIndex + 1 < practiceTasks(topic).length;
  const lessonLink = "lesson.html?id=" + encodeURIComponent(topic.id);
  return '<div class="practice-bar">' +
    '<div class="practice-bar-msg">' +
      messages +
      '<div class="practice-finish' + (getCurrentUser() ? "" : " has-note") + '">' +
        '<p class="success">' + doneText + "</p>" +
        (getCurrentUser() ? "" :
          '<p class="practice-note">Вы не вошли, поэтому отметка о практике не сохранится. <a href="' + loginLinkBack() + '">Войти</a></p>') +
      "</div>" +
    "</div>" +
    '<div class="practice-actions">' +
      (first || "") +
      (hasNext
        ? '<a href="' + practiceLink(topic, taskIndex + 2) + '" data-task="' + (taskIndex + 2) + '" class="btn btn-primary practice-after">К следующему заданию</a>'
        : "") +
      '<a href="' + topicTestLink(topic) + '" class="btn ' + (hasNext ? "btn-secondary" : "btn-primary") + ' practice-after practice-to-test">К тесту</a>' +
      '<button type="button" class="btn btn-secondary practice-again">Пройти ещё раз</button>' +
      '<a href="' + lessonLink + '" class="btn btn-secondary practice-lesson practice-before">К уроку</a>' +
      '<a href="' + lessonLink + '" class="btn btn-secondary practice-lesson practice-after">Вернуться к уроку</a>' +
    "</div>" +
  "</div>";
}

/* Карточки результатов справа: раскрыта последняя найденная, предыдущие свёрнуты в одну строку и раскрываются
   по нажатию. Не влезают — прокручивается только список, и последняя карточка всегда видна.
   Уже 1000px раскрыты все (стили), нажимать там не на что. Возвращает функцию «добавить карточку» */
function practiceResultCards(cells, listen) {
  const wide = matchMedia(PRACTICE_WIDE);

  function setOpen(card, open) {
    const head = card.querySelector(".practice-card-head");
    card.classList.toggle("is-open", open);
    head.disabled = !wide.matches;
    if (wide.matches) head.setAttribute("aria-expanded", open ? "true" : "false");
    else head.removeAttribute("aria-expanded");
  }

  function showCard(card) {
    const list = cells.getBoundingClientRect(), rect = card.getBoundingClientRect();
    cells.scrollTop += Math.min(Math.max(0, rect.bottom - list.bottom), rect.top - list.top);
  }

  cells.addEventListener("click", function (e) {
    const head = e.target.closest(".practice-card-head");
    if (!head) return;
    const card = head.closest(".practice-card");
    setOpen(card, !card.classList.contains("is-open"));
    showCard(card);
  });
  wide.addEventListener("change", function () {
    cells.querySelectorAll(".practice-card").forEach(function (card) {
      setOpen(card, card.classList.contains("is-open"));
    });
  }, listen);
  window.addEventListener("resize", function () {
    const open = cells.querySelectorAll(".practice-card.is-open");
    if (open.length) showCard(open[open.length - 1]);
  }, listen);

  return function (extraClass, tagClass, tagText, label, text, tagNote) {
    const cell = cells.querySelector(".practice-cell.is-empty");
    if (!cell) return;
    cells.querySelectorAll(".practice-card").forEach(function (card) { setOpen(card, false); });
    cell.className = "practice-cell practice-card" + extraClass;
    cell.innerHTML =
      '<h3><button type="button" class="practice-card-head" title="' + escapeHtml(label) + '">' +
        '<span class="practice-tag ' + tagClass + '">' + tagText + "</span>" +
        (tagNote ? '<span class="practice-card-note">' + tagNote + "</span>" : "") +
        '<span class="practice-card-name">' + escapeHtml(label) + "</span>" +
      "</button></h3>" +
      "<p>" + escapeHtml(text) + "</p>";
    setOpen(cell, true);
    showCard(cell);
  };
}

/* Задание «Что здесь не так» (type "spot-error") на странице practice.html.
   task — задание из practice.tasks; сцена рисуется в #practice-task, карточки результатов — в #practice-results.
   onDone() вызывается, когда найдены все ошибки (чтобы обновить список заданий слева) */
function setupPractice(topic, task, taskIndex, onDone) {
  const box = document.getElementById("practice-task");
  const side = document.getElementById("practice-results");
  if (!box || !side) return;

  const practice = task;
  const items = (practice.items || []).map(function (item) {
    return Object.assign({}, item, { mask: null, box: null });
  });

  /* «Узел» — то, что выбирают целиком: группа (предметы с одинаковым group) или один предмет.
     Узлы бывают двух ролей: "error" (ошибка) и "ok" (верный предмет) */
  const units = [];
  items.forEach(function (item) {
    if (item.role !== "error" && item.role !== "ok") return;
    const key = item.group || item.id;
    let unit = units.find(function (u) { return u.key === key; });
    if (!unit) {
      unit = { key: key, role: item.role, label: item.label || "", explanation: item.explanation || "",
               items: [], found: false, accepted: false };
      units.push(unit);
    }
    unit.items.push(item);
    item.unit = unit;
  });
  const errorUnits = units.filter(function (u) { return u.role === "error"; });

  box.innerHTML =
    '<div class="practice-work practice-work--scene">' +
    '<div class="practice-scene" style="--practice-ratio: ' + practice.width / practice.height + '">' +
      '<div class="practice-stage" style="aspect-ratio: ' + practice.width + " / " + practice.height + '">' +
        '<img class="practice-bg" src="' + escapeHtml(practice.background) + '" alt="' + escapeHtml(practice.alt || "") + '" draggable="false">' +
        items.map(function (item) {
          return '<img class="practice-layer" data-id="' + escapeHtml(item.id) + '" src="' + escapeHtml(item.image) +
            '" alt="" aria-hidden="true" draggable="false">';
        }).join("") +
      "</div>" +
      // Окно подтверждения — открывается рядом с выбранным предметом
      '<div class="practice-popup" role="dialog" aria-label="Выбрать эту деталь?" hidden>' +
        '<p class="practice-popup-q">Выбрать эту деталь?</p>' +
        '<div class="practice-popup-btns">' +
          '<button type="button" class="btn btn-primary btn-small" data-answer="yes">Да</button>' +
          '<button type="button" class="btn btn-secondary btn-small" data-answer="no">Нет</button>' +
        "</div>" +
      "</div>" +
      // Подсказка у уже выбранного верного предмета
      '<div class="practice-tip" hidden></div>' +
      // Скрытый набор кнопок — для клавиатуры (Tab + Enter) и программ чтения с экрана
      '<div class="practice-keys" role="group" aria-label="Предметы на картинке">' +
        units.map(function (unit, i) {
          return '<button type="button" class="visually-hidden practice-key" data-unit="' + i + '">' +
            "Выбрать эту деталь: " + escapeHtml(unit.label || unit.key) + "</button>";
        }).join("") +
      "</div>" +
    "</div>" +
    "</div>" +

    // Под картинкой: сообщения, «Готово!» и кнопки
    practiceBar(topic, taskIndex, "Готово! Вы нашли все ошибки", '<p class="practice-message" aria-live="polite"></p>');

  // Справа: счётчик и ячейки — по одной на каждый выбираемый предмет (группа — одна ячейка)
  side.innerHTML =
    '<p class="practice-count" tabindex="-1"></p>' +
    '<div class="practice-cells">' +
      units.map(function () { return '<div class="practice-cell is-empty"></div>'; }).join("") +
    "</div>";

  const scene = box.querySelector(".practice-scene");
  const stage = box.querySelector(".practice-stage");
  const popup = box.querySelector(".practice-popup");
  const tip = box.querySelector(".practice-tip");
  const keys = box.querySelector(".practice-keys");
  const message = box.querySelector(".practice-message");
  const bar = box.querySelector(".practice-bar");
  const firstAction = bar.querySelector(".practice-after");
  const count = side.querySelector(".practice-count");
  const cells = side.querySelector(".practice-cells");

  // Общие обработчики (Esc, клик мимо) снимаются, когда открывают другое задание
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };
  const addResultCard = practiceResultCards(cells, listen);

  items.forEach(function (item) {
    item.layer = stage.querySelector('.practice-layer[data-id="' + CSS.escape(item.id) + '"]');
  });
  units.forEach(function (unit, i) {
    unit.keyButton = keys.querySelector('[data-unit="' + i + '"]');
  });

  /* Слои, которые меняются вместе с узлом: сами предметы и слои-cover с coverFor = группа или id предмета */
  function unitLayers(unit) {
    return items.filter(function (i) {
      return i.unit === unit || (i.role === "cover" && (i.coverFor === unit.key ||
        unit.items.some(function (u) { return u.id === i.coverFor; })));
    }).map(function (i) { return i.layer; });
  }
  function itemLayers(unit) {
    return unit.items.map(function (i) { return i.layer; });
  }

  let hovered = null;      // подсвеченный узел
  let chosen = null;       // узел, для которого открыто окно «Выбрать эту деталь?»
  let chosenByKey = false; // окно открыли с клавиатуры — после него вернём фокус на кнопки
  let tipUnit = null;      // узел, у которого открыта подсказка
  let misses = 0;          // промахи подряд; после двух — подсказка
  let pulseTimer = null;

  /* --- Картинки: если хоть одной нет, показываем серый блок вместо практики --- */
  let broken = false;
  function showMissing() {
    if (broken) return;
    broken = true;
    box.innerHTML = '<div class="practice-missing">Картинки практики пока не добавлены</div>';
    side.innerHTML = "";
  }
  stage.querySelectorAll("img").forEach(function (img) {
    const item = items.find(function (i) { return i.layer === img; });
    function ready() {
      if (!item || !item.unit) return;
      item.mask = practiceMaskFromFile(item.image) || practiceMaskFromImage(img);
      item.box = item.mask && practiceMaskBox(item.mask);
      if (!item.mask) console.warn("Практика: нет маски для " + item.image + " — запустите python tools/make-masks.py");
    }
    if (img.complete) {
      if (img.naturalWidth) ready(); else showMissing();
    } else {
      img.addEventListener("load", ready);
      img.addEventListener("error", showMissing);
    }
  });

  /* --- Подсветка: одинаковая у ошибок и верных предметов; у группы — у всех предметов сразу --- */
  function setHover(unit) {
    if (unit && unit.accepted) unit = null;  // выбранный верный предмет и так обведён зелёным
    if (hovered === unit) return;
    if (hovered) itemLayers(hovered).forEach(function (l) { l.classList.remove("is-hover"); });
    hovered = unit;
    if (unit) itemLayers(unit).forEach(function (l) { l.classList.add("is-hover"); });
    stage.classList.toggle("is-pointer", Boolean(unit));
  }

  /* Какой предмет под точкой экрана (или рядом, в пределах запаса) */
  function itemAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    let best = null, bestDist = Infinity;
    items.forEach(function (item) {
      if (!item.unit || item.unit.found || !item.mask) return;
      const k = item.mask.width / rect.width;  // пикселей маски в одном пикселе экрана
      const d = practiceMaskDistance(item.mask, (clientX - rect.left) * k, (clientY - rect.top) * k, PRACTICE_REACH * k) / k;
      if (d <= bestDist) { best = item; bestDist = d; }  // при равенстве выигрывает верхний слой
    });
    return bestDist === Infinity ? null : best;
  }

  /* Ставит окно или подсказку рядом с рамкой предмета: справа; не помещается — слева;
     иначе над предметом или под ним (по центру) */
  function placeNear(el, b) {
    const rect = stage.getBoundingClientRect();
    const k = rect.width / practice.width;
    b = b || { x0: 0, y0: 0, x1: practice.width, y1: practice.height };
    const pw = el.offsetWidth, ph = el.offsetHeight, gap = 14;
    let top = (b.y0 + b.y1) / 2 * k - ph / 2;
    top = Math.max(0, Math.min(top, rect.height - ph));
    let left = b.x1 * k + gap;
    if (left + pw > rect.width) left = b.x0 * k - gap - pw;
    if (left < 0) {
      left = Math.min(Math.max(0, (b.x0 + b.x1) / 2 * k - pw / 2), Math.max(0, rect.width - pw));
      top = b.y0 * k - gap - ph >= 0 ? b.y0 * k - gap - ph : b.y1 * k + gap;
    }
    el.style.left = Math.round(left) + "px";
    // Страницу на компьютере прокрутить нельзя, поэтому окно не должно уходить за низ экрана
    top = Math.min(top, window.innerHeight - rect.top - ph - 4);
    el.style.top = Math.round(Math.max(0, top)) + "px";
  }

  /* --- Подсказка у выбранного верного предмета --- */
  function showTip(unit, item) {
    if (tipUnit === unit) return;
    tipUnit = unit;
    tip.textContent = unit.explanation;
    tip.hidden = false;
    placeNear(tip, (item || unit.items[0]).box);
  }
  function hideTip() {
    tipUnit = null;
    tip.hidden = true;
  }

  stage.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || chosen) return;  // на телефоне — по касанию
    const item = itemAt(e.clientX, e.clientY);
    const unit = item && item.unit;
    setHover(unit);
    if (unit && unit.accepted) showTip(unit, item); else hideTip();
  });
  stage.addEventListener("pointerleave", function () {
    if (!chosen) setHover(null);
    hideTip();
  });

  stage.addEventListener("click", function (e) {
    const wasOpen = Boolean(chosen);
    closePopup();
    const item = itemAt(e.clientX, e.clientY);
    const unit = item && item.unit;
    if (unit && unit.accepted) {
      showTip(unit, item);  // верный предмет уже выбран — только подсказка (на телефоне — по касанию)
    } else if (unit) {
      hideTip();
      setHover(unit);
      openPopup(unit, item, false);
    } else {
      hideTip();
      if (!wasOpen) miss();
    }
  });

  /* --- Окно «Выбрать эту деталь?» --- */
  function openPopup(unit, item, byKey) {
    chosen = unit;
    chosenByKey = byKey;
    popup.hidden = false;
    placeNear(popup, (item || unit.items[0]).box);
    popup.querySelector('[data-answer="yes"]').focus({ preventScroll: true });
  }

  function closePopup(returnFocus) {
    if (!chosen) return;
    const unit = chosen;
    if (popup.contains(document.activeElement)) document.activeElement.blur();
    popup.hidden = true;
    chosen = null;
    setHover(null);
    if (returnFocus && chosenByKey && !unit.found) unit.keyButton.focus();
  }

  popup.addEventListener("click", function (e) {
    const button = e.target.closest("[data-answer]");
    if (!button) return;
    const unit = chosen;
    const byKey = chosenByKey;
    if (button.dataset.answer === "yes") {
      closePopup(false);
      choose(unit, byKey);
    } else {
      closePopup(true);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (chosen) closePopup(true);
    hideTip();
  }, listen);
  document.addEventListener("click", function (e) {
    if (scene.contains(e.target)) return;
    if (chosen) closePopup(false);
    hideTip();
  }, listen);

  /* --- Клавиатура: скрытые кнопки подсвечивают предмет и открывают окно (или подсказку) --- */
  function unitOfKey(target) {
    const key = target.closest(".practice-key");
    return key ? units[Number(key.dataset.unit)] : null;
  }
  keys.addEventListener("focusin", function (e) {
    const unit = unitOfKey(e.target);
    if (!unit || chosen) return;
    setHover(unit);
    if (unit.accepted) showTip(unit); else hideTip();
  });
  keys.addEventListener("focusout", function () {
    if (!chosen) setHover(null);
    hideTip();
  });
  keys.addEventListener("click", function (e) {
    const unit = unitOfKey(e.target);
    if (!unit) return;
    e.stopPropagation();
    if (unit.accepted) { showTip(unit); return; }
    setHover(unit);
    openPopup(unit, null, true);
  });

  /* --- Выбор, промах, итог --- */
  function say(text) {
    message.textContent = text;
    message.classList.remove("is-shown");
    void message.offsetWidth;  // перезапуск плавного появления
    message.classList.toggle("is-shown", Boolean(text));
  }

  function updateCount() {
    const n = errorUnits.filter(function (u) { return u.found; }).length;
    count.innerHTML = "Найдено ошибок: <strong>" + n + "</strong> из " + errorUnits.length;
    return n;
  }

  /* Карточка выбранного предмета — в следующую свободную ячейку справа */
  function addCard(unit) {
    if (unit.role === "ok") addResultCard(" practice-card--neutral", "practice-tag--neutral", "Здесь всё верно", unit.label, unit.explanation, "Это не ошибка");
    else addResultCard(" practice-card--found", "practice-tag--found", "✓ Вы нашли ошибку", unit.label, unit.explanation);
  }

  /* После выбора с клавиатуры — фокус на следующий ещё не выбранный предмет */
  function focusNext(byKey) {
    if (!byKey) return;
    const next = units.find(function (u) { return !u.found && !u.accepted; });
    if (next) next.keyButton.focus();
  }

  function choose(unit, byKey) {
    if (!unit || unit.found || unit.accepted) return;
    misses = 0;

    if (unit.role === "ok") {
      // Верный предмет: не исчезает и не считается; дальше обведён голубым и показывает подсказку
      unit.accepted = true;
      itemLayers(unit).forEach(function (l) { l.classList.add("is-ok"); });
      unit.keyButton.textContent = "Верный предмет: " + (unit.label || unit.key);
      addCard(unit);
      say("Здесь всё верно: " + unit.label + ".");
      focusNext(byKey);
      return;
    }

    unit.found = true;
    unitLayers(unit).forEach(function (l) {
      l.classList.remove("is-pulse");
      l.classList.add("is-gone");
    });
    unit.keyButton.hidden = true;
    addCard(unit);

    const n = updateCount();
    say("Вы нашли ошибку: " + unit.label + ". Найдено ошибок: " + n + " из " + errorUnits.length + ".");

    if (n === errorUnits.length) {
      bar.classList.add("is-done");
      saveTaskDone(topic, task);
      say("Готово! Вы нашли все ошибки");
      message.classList.add("visually-hidden");  // на экране это уже есть в блоке «Готово!»; программа чтения прочитает
      if (byKey) firstAction.focus();
      if (onDone) onDone();
    } else {
      focusNext(byKey);
    }
  }

  function miss() {
    if (errorUnits.every(function (u) { return u.found; })) return;
    say("Здесь всё в порядке, поищите ещё");
    misses++;
    if (misses < 2) return;
    // Два промаха подряд — одна из ненайденных ошибок (вся группа) пульсирует 2 секунды
    misses = 0;
    const left = errorUnits.filter(function (u) { return !u.found; });
    const hint = left[Math.floor(Math.random() * left.length)];
    clearTimeout(pulseTimer);
    items.forEach(function (i) { i.layer.classList.remove("is-pulse"); });
    void stage.offsetWidth;  // перезапуск анимации
    itemLayers(hint).forEach(function (l) { l.classList.add("is-pulse"); });
    pulseTimer = setTimeout(function () {
      items.forEach(function (i) { i.layer.classList.remove("is-pulse"); });
    }, 2000);
  }

  box.querySelector(".practice-again").addEventListener("click", function () {
    units.forEach(function (u) {
      u.found = false;
      u.accepted = false;
      u.keyButton.hidden = false;
      u.keyButton.textContent = "Выбрать эту деталь: " + (u.label || u.key);
    });
    items.forEach(function (i) {
      i.layer.classList.remove("is-gone", "is-pulse", "is-hover", "is-ok");
    });
    hovered = null;
    hideTip();
    misses = 0;
    cells.querySelectorAll(".practice-cell").forEach(function (cell) {
      cell.className = "practice-cell is-empty";
      cell.innerHTML = "";
    });
    cells.scrollTop = 0;
    bar.classList.remove("is-done");
    updateCount();
    message.classList.remove("visually-hidden");
    say("");
    count.focus({ preventScroll: true });
  });

  updateCount();
}

/* Задание «Найди на картинке» (type "find-zones") на странице practice.html.
   Одна картинка и невидимые зоны-эллипсы (поле zones) в пикселях исходной картинки (width × height).
   У зоны может быть несколько мест (areas): клик в любое находит всю зону, отметки появляются на всех местах.
   Зона с role "wrong" — ловушка: только предупреждение, в счётчик и ячейки не входит.
   Положение клика пересчитывается в эти пиксели, поэтому зоны попадают точно при любом размере картинки.
   onDone() вызывается, когда найдены все зоны (чтобы обновить список заданий слева) */
const ZONES_MISS_TIME = 2000;    // сколько держится подсказка о промахе, мс
const ZONES_WRONG_TIME = 4000;   // сколько держится предупреждение ловушки, мс
const ZONES_MIN_HEIGHT = 240;    // в низком окне картинка не меньше этой высоты (остальное — прокруткой)

function setupFindZones(topic, task, taskIndex, onDone) {
  const box = document.getElementById("practice-task");
  const side = document.getElementById("practice-results");
  if (!box || !side) return;

  // Общие обработчики (Esc, клик мимо, размер окна) снимаются, когда открывают другое задание
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };

  // Места зоны: список areas или один эллипс из полей самой зоны
  const zones = (task.zones || []).map(function (zone) {
    return Object.assign({}, zone, { found: false, areas: zone.areas || [zone] });
  });
  const targets = zones.filter(function (z) { return z.role !== "wrong"; });  // зоны, которые ищут (без ловушек)

  function percent(value, total) {
    return (value / total * 100) + "%";
  }

  box.innerHTML =
    '<div class="practice-work practice-work--scene">' +
    '<div class="practice-scene zones-scene" style="--practice-ratio: ' + task.width / task.height + '">' +
      '<div class="practice-stage zones-stage is-pointer" style="aspect-ratio: ' + task.width + " / " + task.height + '">' +
        '<img class="practice-bg" src="' + escapeHtml(task.image) + '" alt="' + escapeHtml(task.alt || "") + '" draggable="false">' +
        // Кнопки лежат точно на зонах: для мыши они прозрачны и невидимы, нужны для клавиатуры (Tab + Enter)
        // и программ чтения с экрана. У зоны из нескольких мест кнопка одна — на первом месте
        '<div role="group" aria-label="Места на картинке">' +
          zones.map(function (zone, i) {
            const area = zone.areas[0];
            return '<button type="button" class="zones-spot" data-zone="' + i + '" aria-label="' + escapeHtml(zone.label) + '" style="' +
              "left: " + percent(area.cx - area.rx, task.width) + "; top: " + percent(area.cy - area.ry, task.height) + "; " +
              "width: " + percent(area.rx * 2, task.width) + "; height: " + percent(area.ry * 2, task.height) + '"></button>';
          }).join("") +
        "</div>" +
      "</div>" +
      // Подсказка у места клика (промах или ловушка); программа чтения узнает о ней из строки ниже
      '<div class="zones-miss" aria-hidden="true" hidden></div>' +
    "</div>" +
    "</div>" +

    // Под картинкой: «Готово!» и кнопки
    practiceBar(topic, taskIndex, "Готово! Вы нашли все места на картинке", '<p class="visually-hidden" aria-live="polite"></p>');

  // Справа: счётчик и ячейки — по одной на каждую зону, которую ищут
  side.innerHTML =
    '<p class="practice-count" tabindex="-1"></p>' +
    '<div class="practice-cells">' +
      targets.map(function () { return '<div class="practice-cell is-empty"></div>'; }).join("") +
    "</div>";

  const scene = box.querySelector(".practice-scene");
  const stage = box.querySelector(".practice-stage");
  const tip = box.querySelector(".zones-miss");
  const message = box.querySelector("p.visually-hidden");
  const bar = box.querySelector(".practice-bar");
  const firstAction = bar.querySelector(".practice-after");
  const count = side.querySelector(".practice-count");
  const cells = side.querySelector(".practice-cells");
  const addResultCard = practiceResultCards(cells, listen);

  zones.forEach(function (zone, i) {
    zone.button = stage.querySelector('[data-zone="' + i + '"]');
  });

  let tipTimer = null;
  let tipZone = null;  // ловушка, предупреждение которой сейчас открыто

  // Картинки нет — серый блок вместо задания
  stage.querySelector("img").addEventListener("error", function () {
    box.innerHTML = '<div class="practice-missing">Картинка практики пока не добавлена</div>';
    side.innerHTML = "";
  });

  function foundCount() {
    return targets.filter(function (z) { return z.found; }).length;
  }

  function updateCount() {
    count.innerHTML = "Найдено: <strong>" + foundCount() + "</strong> из " + targets.length;
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tipZone = null;
    tip.hidden = true;
  }

  /* Подсказка: над точкой клика (не помещается — под ней), в пределах ширины картинки */
  function showTip(x, y, time) {
    tip.hidden = false;
    const gap = 12;
    const top = y - tip.offsetHeight - gap;
    const maxLeft = Math.max(0, stage.offsetWidth - tip.offsetWidth);
    tip.style.left = Math.round(Math.min(Math.max(0, x - tip.offsetWidth / 2), maxLeft)) + "px";
    tip.style.top = Math.round(top >= 0 ? top : y + gap) + "px";
    tipTimer = setTimeout(hideTip, time);
  }

  function miss(x, y) {
    hideTip();
    if (foundCount() === targets.length) return;
    tip.className = "zones-miss";
    tip.textContent = task.missText || "Попробуйте ещё";
    showTip(x, y, ZONES_MISS_TIME);
    message.textContent = tip.textContent;
  }

  /* Клик по ловушке: предупреждение; повторный клик по той же ловушке его закрывает */
  function warn(zone, x, y) {
    const wasOpen = tipZone === zone;
    hideTip();
    if (wasOpen) return;
    tipZone = zone;
    tip.className = "zones-miss zones-miss--wrong";
    tip.innerHTML = "<strong>" + escapeHtml(zone.label) + "</strong>" + escapeHtml(zone.explanation);
    showTip(x, y, ZONES_WRONG_TIME);
    message.textContent = zone.label + ". " + zone.explanation;
  }

  /* Отметки на всех местах зоны и карточка в первой свободной ячейке */
  function markZone(zone, number) {
    zone.areas.forEach(function (area) {
      const mark = document.createElement("span");
      mark.className = "zones-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.style.left = percent(area.cx, task.width);
      mark.style.top = percent(area.cy, task.height);
      mark.textContent = number;
      stage.appendChild(mark);
    });

    addResultCard("", "practice-tag--ok", "✓ Найдено", zone.label, zone.explanation);
  }

  function findZone(zone, byKey) {
    zone.found = true;
    hideTip();
    zone.button.hidden = true;

    const n = foundCount();
    markZone(zone, n);
    updateCount();
    message.textContent = zone.label + ". " + zone.explanation + " Найдено: " + n + " из " + targets.length + ".";

    if (n === targets.length) {
      bar.classList.add("is-done");
      saveTaskDone(topic, task);
      message.textContent += " Готово! Вы нашли все места на картинке";
      if (byKey) firstAction.focus();
      if (onDone) onDone();
    } else if (byKey) {
      // После выбора с клавиатуры — фокус на следующую ненайденную зону
      targets.find(function (z) { return !z.found; }).button.focus();
    }
  }

  /* Клик по картинке: повторный клик по найденной зоне ничего не делает и промахом не считается */
  stage.addEventListener("click", function (e) {
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * task.width;
    const y = (e.clientY - rect.top) / rect.height * task.height;
    const hits = zones.filter(function (z) {
      return z.areas.some(function (area) {
        const dx = (x - area.cx) / area.rx, dy = (y - area.cy) / area.ry;
        return dx * dx + dy * dy <= 1;
      });
    });
    const zone = hits.find(function (z) { return z.role !== "wrong" && !z.found; });
    const wrong = hits.find(function (z) { return z.role === "wrong"; });
    if (zone) findZone(zone, false);
    else if (wrong) warn(wrong, e.clientX - rect.left, e.clientY - rect.top);
    else if (hits.length) hideTip();
    else miss(e.clientX - rect.left, e.clientY - rect.top);
  });

  stage.querySelector('[role="group"]').addEventListener("click", function (e) {
    const button = e.target.closest(".zones-spot");
    if (!button) return;
    e.stopPropagation();
    const zone = zones[Number(button.dataset.zone)];
    if (zone.role !== "wrong") { findZone(zone, true); return; }
    const area = zone.areas[0];
    warn(zone, area.cx / task.width * stage.offsetWidth, area.cy / task.height * stage.offsetHeight);
  });

  // Предупреждение закрывается и по клику: по нему самому, мимо картинки или клавишей Esc
  tip.addEventListener("click", hideTip);
  document.addEventListener("click", function (e) {
    if (!scene.contains(e.target)) hideTip();
  }, listen);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideTip();
  }, listen);

  /* Уже 1000px: картинка как можно крупнее, но целиком в окне под шапкой вместе с заголовком и описанием.
     Широкие картинки упираются в ширину колонки, квадратные и вертикальные — в высоту окна.
     От 1000px размер задают стили: картинка вписана в рабочую область */
  function fitImage() {
    scene.style.maxWidth = "";
    const col = scene.closest(".practice-main-col");
    if (!col || matchMedia(PRACTICE_WIDE).matches) return;
    const above = stage.getBoundingClientRect().top - col.getBoundingClientRect().top;  // заголовок и описание над картинкой
    const top = document.querySelector(".site-header").offsetHeight + 8;
    const height = Math.max(ZONES_MIN_HEIGHT, window.innerHeight - top - above - 20);  // 20 — рамка картинки и зазор снизу
    scene.style.maxWidth = Math.round(height * task.width / task.height) + "px";
  }
  window.addEventListener("resize", fitImage, listen);

  box.querySelector(".practice-again").addEventListener("click", function () {
    zones.forEach(function (z) {
      z.found = false;
      z.button.hidden = false;
    });
    stage.querySelectorAll(".zones-mark").forEach(function (mark) { mark.remove(); });
    cells.querySelectorAll(".practice-cell").forEach(function (cell) {
      cell.className = "practice-cell is-empty";
      cell.innerHTML = "";
    });
    cells.scrollTop = 0;
    hideTip();
    bar.classList.remove("is-done");
    updateCount();
    message.textContent = "";
    count.focus({ preventScroll: true });
  });

  updateCount();
  fitImage();
}

/* Шаги (или пары) в случайном порядке, но не в правильном */
function orderShuffled(steps) {
  const list = steps.slice();
  do {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
  } while (list.length > 1 && list.every(function (step, i) { return step.index === i; }));
  return list;
}

/* Задание «Расставь по порядку» (type "order") на странице practice.html.
   Шаги (поле steps) записаны в правильном порядке; в панели справа они перемешаны.
   Карточку ставят в рамку перетаскиванием или выбором: нажать на карточку, затем на рамку (так же Tab и Enter).
   После проверки верные карточки закрепляются, неверные возвращаются в панель.
   Пояснения: от 1000px — списком «Почему такой порядок» на месте панели, уже — под самими шагами (переключают стили).
   onDone() вызывается, когда все шаги на своих местах (чтобы обновить список заданий слева) */
function setupOrder(topic, task, taskIndex, onDone) {
  const box = document.getElementById("practice-task");
  const side = document.getElementById("practice-results");
  if (!box || !side) return;

  // Обработчики прошлого задания (или прошлого прохождения этого) снимаются
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };

  const steps = (task.steps || []).map(function (step, i) {
    return Object.assign({}, step, { index: i, locked: false });
  });
  const shuffled = orderShuffled(steps);
  const slots = steps.map(function () { return null; });  // какой шаг стоит в каждой рамке
  let selected = null;  // шаг, выбранный нажатием
  let dragged = null;   // шаг, который сейчас тянут мышью

  box.innerHTML =
    '<div class="practice-work practice-zone">' +
    '<div class="practice-zone-head"><h2 class="practice-zone-title">Ваш порядок</h2></div>' +
    '<ol class="order-slots">' +
      steps.map(function (step, i) {
        return '<li class="order-slot" data-slot="' + i + '">' +
          '<span class="order-num" aria-hidden="true">' + (i + 1) + "</span>" +
          '<button type="button" class="order-slot-target" aria-label="Рамка ' + (i + 1) + ', пусто"></button>' +
        "</li>";
      }).join("") +
    "</ol>" +
    "</div>" +

    // Внизу: сообщения, «Проверить», а когда все шаги на своих местах — «Готово!» и кнопки дальше
    practiceBar(topic, taskIndex, "Готово! Все шаги на своих местах",
      '<p class="order-result" aria-live="polite"></p><p class="order-say visually-hidden" aria-live="polite"></p>',
      '<button type="button" class="btn btn-primary order-check" disabled>Проверить</button>');

  side.classList.remove("is-done");
  side.setAttribute("aria-label", "Шаги");
  side.innerHTML =
    '<div class="practice-zone-head">' +
      '<h2 class="order-pool-title" tabindex="-1">Шаги</h2>' +
      '<p class="order-pool-hint">Перетащите шаг в рамку или нажмите на шаг, а затем на рамку.</p>' +
    "</div>" +
    '<div class="order-pool">' +
      shuffled.map(function (step) {
        return '<div class="order-card" data-step="' + step.index + '" draggable="true">' +
          '<div class="order-card-text" role="button" tabindex="0">' + escapeHtml(step.text) + "</div>" +
          '<span class="order-card-ok" role="img" aria-label="Верно" hidden>✓</span>' +
          '<button type="button" class="order-card-x" aria-label="Вернуть шаг в панель: ' + escapeHtml(step.text) + '" hidden>×</button>' +
          '<p class="order-card-note" hidden>' + escapeHtml(step.explanation) + "</p>" +
        "</div>";
      }).join("") +
    "</div>" +
    '<p class="order-pool-empty" hidden>Все шаги в рамках</p>' +
    '<div class="order-why" hidden>' +
      '<h2 class="order-pool-title">Почему такой порядок</h2>' +
      '<ol class="order-why-list">' +
        steps.map(function (step, i) {
          return '<li><span class="order-num" aria-hidden="true">' + (i + 1) + "</span><span>" + escapeHtml(step.explanation) + "</span></li>";
        }).join("") +
      "</ol>" +
    "</div>";

  const result = box.querySelector(".order-result");
  const slotsBox = box.querySelector(".order-slots");
  const slotEls = Array.from(box.querySelectorAll(".order-slot"));
  const check = box.querySelector(".order-check");
  const message = box.querySelector(".order-say");
  const bar = box.querySelector(".practice-bar");
  const firstAction = bar.querySelector(".practice-after");
  const why = side.querySelector(".order-why");
  const pool = side.querySelector(".order-pool");
  const poolEmpty = side.querySelector(".order-pool-empty");
  const poolHint = side.querySelector(".order-pool-hint");

  steps.forEach(function (step) {
    step.card = pool.querySelector('[data-step="' + step.index + '"]');
    step.textEl = step.card.querySelector(".order-card-text");
  });

  function stepOf(el) {
    return steps[Number(el.closest(".order-card").dataset.step)];
  }

  /* Раскладывает карточки по рамкам и панели. Карточка, которая уже на месте, не переставляется:
     иначе с неё слетел бы фокус клавиатуры */
  function render() {
    slots.forEach(function (step, i) {
      if (step && step.card.parentNode !== slotEls[i]) slotEls[i].appendChild(step.card);
      slotEls[i].querySelector(".order-slot-target").hidden = Boolean(step);
      slotEls[i].classList.toggle("is-filled", Boolean(step));
      slotEls[i].classList.toggle("is-locked", Boolean(step && step.locked));
    });
    shuffled.filter(function (step) { return slots.indexOf(step) < 0; }).forEach(function (step, i) {
      if (pool.children[i] !== step.card) pool.insertBefore(step.card, pool.children[i] || null);
    });
    steps.forEach(function (step) {
      const place = slots.indexOf(step);
      step.card.draggable = !step.locked;
      step.card.classList.toggle("is-selected", selected === step);
      step.card.classList.toggle("is-locked", step.locked);
      step.card.querySelector(".order-card-x").hidden = place < 0 || step.locked;
      step.card.querySelector(".order-card-ok").hidden = !step.locked;
      step.card.querySelector(".order-card-note").hidden = !step.locked;
      if (step.locked) {
        ["role", "tabindex", "aria-pressed", "aria-label"].forEach(function (name) { step.textEl.removeAttribute(name); });
      } else {
        step.textEl.setAttribute("aria-pressed", selected === step ? "true" : "false");
        step.textEl.setAttribute("aria-label", (place >= 0 ? "Рамка " + (place + 1) + ": " : "") + step.text);
      }
    });
    slotsBox.classList.toggle("is-choosing", Boolean(selected || dragged));
    check.disabled = slots.some(function (step) { return !step; });
    poolEmpty.hidden = pool.children.length > 0;
    poolHint.hidden = pool.children.length === 0;
  }

  /* После действия с клавиатуры — фокус на следующий шаг в панели, а если их нет — на «Проверить» */
  function focusNext() {
    const next = pool.querySelector(".order-card-text");
    if (next) next.focus();
    else if (!check.disabled) check.focus();
  }

  /* Ставит шаг в рамку: шаг из другой рамки меняется местами с тем, что там стоял; шаг из панели вытесняет его в панель */
  function placeStep(step, slot, byKey) {
    const other = slots[slot];
    if (other && other.locked) return;
    const from = slots.indexOf(step);
    if (from >= 0) slots[from] = other;
    slots[slot] = step;
    selected = null;
    render();
    message.textContent = "Рамка " + (slot + 1) + ": " + step.text;
    if (byKey) focusNext();
  }

  function returnStep(step, byKey) {
    slots[slots.indexOf(step)] = null;
    if (selected === step) selected = null;
    render();
    message.textContent = "Шаг возвращён в панель: " + step.text;
    if (byKey) step.textEl.focus();
  }

  /* Нажатие на карточку: выбрать её или снять выбор. Если выбрана другая, а эта стоит в рамке — поставить выбранную сюда */
  function pressCard(step, byKey) {
    if (step.locked) return;
    if (selected && selected !== step && slots.indexOf(step) >= 0) {
      placeStep(selected, slots.indexOf(step), byKey);
      return;
    }
    selected = selected === step ? null : step;
    render();
    message.textContent = selected ? "Выбран шаг: " + step.text + ". Теперь выберите рамку." : "Выбор снят";
    if (selected && byKey) {
      const empty = slotsBox.querySelector(".order-slot:not(.is-filled) .order-slot-target");
      if (empty) empty.focus();
    }
  }

  function pressSlot(slot, byKey) {
    if (slots[slot] && slots[slot].locked) return;
    if (selected) placeStep(selected, slot, byKey);
    else result.textContent = "Сначала выберите шаг";
  }

  /* Нажатия: на рамку, на карточку, на крестик, на свободное место панели (вернуть выбранную карточку) */
  slotsBox.addEventListener("click", function (e) {
    const cross = e.target.closest(".order-card-x");
    const card = e.target.closest(".order-card");
    const slot = e.target.closest(".order-slot");
    if (cross) returnStep(stepOf(cross), e.detail === 0);
    else if (card) pressCard(stepOf(card), false);
    else if (slot) pressSlot(Number(slot.dataset.slot), e.detail === 0);
  });
  side.addEventListener("click", function (e) {
    const card = e.target.closest(".order-card");
    if (card) pressCard(stepOf(card), false);
    else if (selected && slots.indexOf(selected) >= 0) returnStep(selected, false);
  }, listen);

  /* Клавиатура: у карточки текст с ролью кнопки (настоящая кнопка не даёт перетаскивать в Firefox) */
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!e.target.classList.contains("order-card-text") || !e.target.hasAttribute("role")) return;
    e.preventDefault();
    if (!e.repeat) pressCard(stepOf(e.target), true);
  }
  box.addEventListener("keydown", onKey, listen);
  side.addEventListener("keydown", onKey, listen);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !selected) return;
    selected = null;
    render();
    message.textContent = "Выбор снят";
  }, listen);

  /* --- Перетаскивание мышью --- */
  function setOver(el) {
    [side].concat(slotEls).forEach(function (other) { other.classList.toggle("is-over", other === el); });
  }

  function onDragStart(e) {
    const card = e.target.closest && e.target.closest(".order-card");
    if (!card) return;
    dragged = stepOf(card);
    selected = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-order-step", String(dragged.index));
    render();
    setTimeout(function () {
      card.classList.add("is-dragging");  // сразу нельзя: поблёкнет и то, что тянется за курсором
    }, 0);
  }

  function onDragEnd() {
    if (dragged) dragged.card.classList.remove("is-dragging");
    dragged = null;
    setOver(null);
    render();
  }

  /* Куда можно бросить: в рамку без закреплённого шага или (для шага из рамки) в панель */
  function dropPlace(e) {
    if (!dragged) return null;
    if (side.contains(e.target)) return slots.indexOf(dragged) >= 0 ? side : null;
    const slot = e.target.closest(".order-slot");
    return slot && !slot.classList.contains("is-locked") ? slot : null;
  }

  function onDragOver(e) {
    const place = dropPlace(e);
    setOver(place);
    if (!place) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e) {
    const place = dropPlace(e);
    if (!place) return;
    e.preventDefault();
    if (place === side) returnStep(dragged, false);
    else placeStep(dragged, Number(place.dataset.slot), false);
  }

  [box, side].forEach(function (area) {
    area.addEventListener("dragstart", onDragStart, listen);
    area.addEventListener("dragend", onDragEnd, listen);
    area.addEventListener("dragover", onDragOver, listen);
    area.addEventListener("drop", onDrop, listen);
  });

  /* --- Проверка --- */
  function finish(byKey) {
    bar.classList.add("is-done");
    check.hidden = true;
    result.textContent = "";
    side.classList.add("is-done");
    why.hidden = false;
    poolEmpty.textContent = "Все шаги на своих местах";
    saveTaskDone(topic, task);
    message.textContent = "Готово! Все шаги на своих местах";
    if (byKey) firstAction.focus();
    if (onDone) onDone();
  }

  check.addEventListener("click", function (e) {
    const wrong = [];
    slots.forEach(function (step, i) {
      if (step.index === i) {
        step.locked = true;
      } else {
        slots[i] = null;
        wrong.push(step);
      }
    });
    selected = null;
    render();
    wrong.forEach(function (step) {
      step.card.classList.remove("is-back");
      void step.card.offsetWidth;  // перезапуск анимации
      step.card.classList.add("is-back");
    });
    if (!wrong.length) {
      finish(e.detail === 0);
      return;
    }
    result.textContent = "Верно " + (steps.length - wrong.length) + " из " + steps.length + ". Переставьте остальные шаги";
    if (e.detail === 0) focusNext();
  });

  box.querySelector(".practice-again").addEventListener("click", function () {
    setupOrder(topic, task, taskIndex, onDone);
    side.querySelector(".order-pool-title").focus({ preventScroll: true });
  });

  render();
}

/* Задание «Подбери пару» (type "match") на странице practice.html.
   Пары (поле pairs) записаны в правильном соответствии; ответы в панели справа перемешаны.
   Соединяют перетаскиванием: потянуть линию от карточки слева к ответу, или нажатием: карточка, затем ответ (так же Tab и Enter).
   Верная пара закрепляется, неверная «вздрагивает», линия не остаётся.
   Пояснение: от 1000px — в строке под обеими зонами (все сразу — в окне «Все пояснения»), уже — под левой карточкой.
   Уже 900px колонки идут друг под другом: только нажатия, а вместо линий — номера на карточках (их переключают стили).
   onDone() вызывается, когда все пары найдены (чтобы обновить список заданий слева) */
const MATCH_NARROW = "(max-width: 900px)";
const MATCH_DRAG_START = 6;   // на сколько пикселей сдвинуть указатель, чтобы нажатие стало перетаскиванием
const MATCH_COLORS = 6;       // сколько цветов у номеров (задаются в стилях)

function setupMatch(topic, task, taskIndex, onDone) {
  const box = document.getElementById("practice-task");
  const side = document.getElementById("practice-results");
  if (!box || !side) return;

  // Обработчики прошлого задания (или прошлого прохождения этого) снимаются
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };

  const pairs = (task.pairs || []).map(function (pair, i) {
    return Object.assign({}, pair, { index: i, number: 0 });
  });
  const answers = orderShuffled(pairs);
  let found = 0;
  let selected = null;       // пара, выбранная нажатием на левую карточку
  let drag = null;           // перетаскивание: { pair, id, x0, y0, x, y, moved }
  let ignoreClick = false;   // после перетаскивания браузер присылает ещё и щелчок

  box.innerHTML =
    '<div class="practice-work practice-zone">' +
    '<div class="practice-zone-head">' +
      '<h2 class="practice-zone-title">' + escapeHtml(task.leftTitle || "Вопросы") + "</h2>" +
      '<p class="match-count" tabindex="-1" aria-live="polite"></p>' +
    "</div>" +
    '<ul class="match-list match-questions">' +
      pairs.map(function (pair) {
        return '<li class="match-row">' +
          '<button type="button" class="match-card match-left" data-pair="' + pair.index + '" aria-pressed="false">' +
            (pair.left.image ? '<img class="match-img" src="' + escapeHtml(pair.left.image) + '" alt="" draggable="false">' : "") +
            '<span class="match-text' + (pair.left.image ? " match-text--name" : "") + '">' + escapeHtml(pair.left.label) + "</span>" +
            '<span class="match-num" aria-hidden="true"></span>' +
          "</button>" +
          '<p class="match-note" hidden>' +
            '<span class="visually-hidden">Ответ: ' + escapeHtml(pair.right) + ". </span>" + escapeHtml(pair.explanation) +
          "</p>" +
        "</li>";
      }).join("") +
    "</ul>" +
    "</div>" +

    // Под обеими зонами: пояснение последней найденной пары, ниже — сообщения и кнопки
    '<div class="match-explain">' +
      '<p class="match-explain-text" aria-live="polite">' +
        '<span class="match-explain-label">Пояснение</span> ' +
        '<span class="match-explain-body">Появится, когда вы найдёте пару.</span>' +
      "</p>" +
      '<button type="button" class="btn btn-secondary match-explain-all" hidden>Все пояснения</button>' +
    "</div>" +
    practiceBar(topic, taskIndex, "Готово! Все пары найдены", '<p class="match-say visually-hidden" aria-live="polite"></p>') +

    '<dialog class="match-dialog" aria-labelledby="match-dialog-title">' +
      '<div class="match-dialog-box">' +
        '<div class="match-dialog-head">' +
          '<h2 id="match-dialog-title">Все пояснения</h2>' +
          '<button type="button" class="match-dialog-x" aria-label="Закрыть">×</button>' +
        "</div>" +
        '<ul class="match-dialog-list">' +
          pairs.map(function (pair) {
            return "<li><strong>" + escapeHtml(pair.left.label) + "</strong> — " + escapeHtml(pair.right) +
              "<p>" + escapeHtml(pair.explanation) + "</p></li>";
          }).join("") +
        "</ul>" +
      "</div>" +
    "</dialog>";

  side.setAttribute("aria-label", "Ответы");
  side.innerHTML =
    '<div class="practice-zone-head">' +
      '<h2 class="match-title">Ответы</h2>' +
      '<p class="match-hint">' +
        '<span class="match-hint-wide">Потяните линию от карточки слева к ответу или нажмите на карточку, а затем на ответ.</span>' +
        '<span class="match-hint-narrow">Нажмите на карточку выше, а затем на подходящий ответ.</span>' +
      "</p>" +
      '<p class="match-picked" hidden></p>' +
    "</div>" +
    '<ul class="match-list match-answers">' +
      answers.map(function (pair) {
        return "<li>" +
          '<button type="button" class="match-card match-right" data-pair="' + pair.index + '">' +
            '<span class="match-text">' + escapeHtml(pair.right) + "</span>" +
            '<span class="match-num" aria-hidden="true"></span>' +
          "</button>" +
        "</li>";
      }).join("") +
    "</ul>";

  // Слой с линиями лежит поверх обеих колонок; координаты в нём — от его левого верхнего угла
  const grid = box.closest(".practice-page-grid");
  const oldLines = grid.querySelector(".match-lines");
  if (oldLines) oldLines.remove();
  const lines = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lines.setAttribute("class", "match-lines");
  lines.setAttribute("aria-hidden", "true");
  grid.appendChild(lines);

  function addLine(cls) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", cls);
    lines.appendChild(path);
    return path;
  }
  const dragLine = addLine("match-line match-line--drag");

  const count = box.querySelector(".match-count");
  const message = box.querySelector(".match-say");
  const bar = box.querySelector(".practice-bar");
  const firstAction = bar.querySelector(".practice-after");
  const explainBody = box.querySelector(".match-explain-body");
  const explainAll = box.querySelector(".match-explain-all");
  const dialog = box.querySelector(".match-dialog");
  const hint = side.querySelector(".match-hint");
  const picked = side.querySelector(".match-picked");
  const questionsBox = box.querySelector(".match-questions");
  const answersBox = side.querySelector(".match-answers");

  pairs.forEach(function (pair) {
    pair.leftEl = box.querySelector('.match-left[data-pair="' + pair.index + '"]');
    pair.rightEl = answersBox.querySelector('.match-right[data-pair="' + pair.index + '"]');
    pair.noteEl = pair.leftEl.parentNode.querySelector(".match-note");
    const img = pair.leftEl.querySelector("img");
    if (img) img.addEventListener("error", function () { img.remove(); });  // нет файла — остаётся один текст
  });

  function pairOf(el) {
    return pairs[Number(el.dataset.pair)];
  }

  function isNarrow() {
    return matchMedia(MATCH_NARROW).matches;
  }

  /* --- Линии --- */
  function curve(x1, y1, x2, y2) {
    const bend = Math.max(24, Math.abs(x2 - x1) / 2);
    return "M" + x1 + " " + y1 + " C" + (x1 + bend) + " " + y1 + " " + (x2 - bend) + " " + y2 + " " + x2 + " " + y2;
  }

  /* Перерисовывает все линии по текущему положению карточек */
  function draw() {
    const origin = lines.getBoundingClientRect();
    // Карточка прокручена за край своего списка — линия идёт к его краю
    function middle(rect, listEl) {
      const list = listEl.getBoundingClientRect();
      return Math.min(Math.max(rect.top + rect.height / 2, list.top), list.bottom) - origin.top;
    }
    function leftEnd(pair) {
      const rect = pair.leftEl.getBoundingClientRect();
      return { x: rect.right - origin.left, y: middle(rect, questionsBox) };
    }
    pairs.forEach(function (pair) {
      if (!pair.line) return;
      const from = leftEnd(pair);
      const to = pair.rightEl.getBoundingClientRect();
      pair.line.setAttribute("d", curve(from.x, from.y, to.left - origin.left, middle(to, answersBox)));
    });
    if (drag && drag.moved) {
      const from = leftEnd(drag.pair);
      dragLine.setAttribute("d", curve(from.x, from.y, drag.x - origin.left, drag.y - origin.top));
    } else {
      dragLine.removeAttribute("d");
    }
  }

  /* --- Состояние карточек --- */
  function render() {
    const dragging = drag && drag.moved ? drag.pair : null;
    pairs.forEach(function (pair) {
      const isFound = pair.number > 0;
      [pair.leftEl, pair.rightEl].forEach(function (el) {
        el.disabled = isFound;
        el.classList.toggle("is-found", isFound);
      });
      pair.leftEl.classList.toggle("is-selected", selected === pair || dragging === pair);
      if (isFound) pair.leftEl.removeAttribute("aria-pressed");
      else pair.leftEl.setAttribute("aria-pressed", selected === pair ? "true" : "false");
      pair.noteEl.hidden = !isFound;
    });
    answersBox.classList.toggle("is-choosing", Boolean(selected || dragging));
    draw();
  }

  function updateCount() {
    count.innerHTML = "Найдено пар: <strong>" + found + "</strong> из " + pairs.length;
  }

  /* Строка над ответами заменяет подсказку: что выбрано (карточка слева на телефоне уже за краем окна) */
  function setPicked(text) {
    picked.textContent = text;
    picked.hidden = !text;
    hint.hidden = Boolean(text);
  }

  /* Неверная пара: красная вспышка с дрожью, класс снимается по концу анимации */
  function flagWrong(el) {
    el.classList.remove("is-wrong");
    void el.offsetWidth;  // перезапуск анимации
    el.classList.add("is-wrong");
  }
  [box, side].forEach(function (area) {
    area.addEventListener("animationend", function (e) {
      if (e.target.classList.contains("is-wrong")) e.target.classList.remove("is-wrong");
    }, listen);
  });

  /* Соединить левую карточку пары с ответом другой пары (или той же). Выбор при ошибке остаётся — можно сразу пробовать другой ответ */
  function connect(pair, answer, byKey) {
    if (pair !== answer) {
      flagWrong(pair.leftEl);
      flagWrong(answer.rightEl);
      message.textContent = "Не подходит: " + answer.right;
      render();
      return;
    }
    found += 1;
    pair.number = found;
    pair.line = addLine("match-line");
    [pair.leftEl, pair.rightEl].forEach(function (el) {
      el.classList.remove("is-wrong");  // карточка могла ещё дрожать — линия пойдёт от её настоящего места
      const num = el.querySelector(".match-num");
      num.textContent = found;
      num.dataset.color = (found - 1) % MATCH_COLORS + 1;
    });
    selected = null;
    setPicked("");
    updateCount();
    render();
    explainBody.innerHTML = "<strong>" + escapeHtml(pair.left.label) + "</strong> — " + escapeHtml(pair.explanation);
    message.textContent = "Верно: " + pair.left.label + " — " + pair.right;
    if (found === pairs.length) finish(byKey);
    else if (byKey) box.querySelector(".match-left:not(:disabled)").focus();
  }

  function finish(byKey) {
    bar.classList.add("is-done");
    explainAll.hidden = false;
    setPicked("Все пары найдены");
    saveTaskDone(topic, task);
    message.textContent = "Готово! Все пары найдены";
    if (byKey) firstAction.focus();
    if (onDone) onDone();
  }

  /* Окно «Все пояснения»: крестик, Esc (его обрабатывает сам браузер) и щелчок мимо */
  explainAll.addEventListener("click", function () { dialog.showModal(); });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest(".match-dialog-x")) dialog.close();
  });

  /* --- Нажатия и клавиатура: кнопки сами превращают Enter и пробел в щелчок (у него e.detail === 0) --- */
  function pressLeft(pair, byKey) {
    selected = selected === pair ? null : pair;
    setPicked(selected ? "Выбрано: " + pair.left.label + ". Теперь выберите ответ." : "");
    render();
    message.textContent = selected ? "Выбрано: " + pair.left.label + ". Теперь выберите ответ." : "Выбор снят";
    if (selected && byKey) answersBox.querySelector(".match-right:not(:disabled)").focus();
  }

  function pressRight(pair, byKey) {
    if (selected) {
      connect(selected, pair, byKey);
      return;
    }
    setPicked("Сначала выберите, к чему подобрать ответ");
    message.textContent = "Сначала выберите, к чему подобрать ответ";
  }

  box.addEventListener("click", function (e) {
    const left = e.target.closest(".match-left");
    if (left && !ignoreClick) pressLeft(pairOf(left), e.detail === 0);
  }, listen);
  side.addEventListener("click", function (e) {
    const right = e.target.closest(".match-right");
    if (right && !ignoreClick) pressRight(pairOf(right), e.detail === 0);
  }, listen);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (drag) {
      drag = null;
      setOver(null);
      render();
    } else if (selected) {
      const back = selected;
      selected = null;
      setPicked("");
      render();
      message.textContent = "Выбор снят";
      if (side.contains(document.activeElement)) back.leftEl.focus();
    }
  }, listen);

  /* --- Перетаскивание: мышь и палец. Сенсорный экран отдаёт вертикальный жест прокрутке (touch-action в стилях) --- */
  function setOver(answer) {
    pairs.forEach(function (pair) { pair.rightEl.classList.toggle("is-over", pair === answer); });
  }

  function answerAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const right = el && el.closest(".match-right");
    return right && !right.disabled ? pairOf(right) : null;
  }

  box.addEventListener("pointerdown", function (e) {
    const left = e.target.closest(".match-left");
    if (!left || left.disabled || drag || e.button !== 0 || isNarrow()) return;
    drag = { pair: pairOf(left), id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
  }, listen);

  document.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.moved) {
      if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < MATCH_DRAG_START) return;
      drag.moved = true;
      drag.pair.leftEl.setPointerCapture(drag.id);  // отпустили за краем окна — всё равно узнаем об этом
      selected = null;
      setPicked("");
      render();
    }
    setOver(answerAt(drag.x, drag.y));
    draw();
  }, listen);

  document.addEventListener("pointerup", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    const current = drag;
    drag = null;
    setOver(null);
    if (!current.moved) return;  // обычное нажатие — его обработает щелчок
    ignoreClick = true;
    setTimeout(function () { ignoreClick = false; }, 50);
    const answer = answerAt(e.clientX, e.clientY);
    if (answer) connect(current.pair, answer, false);
    else render();
  }, listen);

  document.addEventListener("pointercancel", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    setOver(null);
    render();
  }, listen);

  /* Линии следуют за карточками: окно, прокрутка (страницы и списков), размер зон (в том числе при сворачивании левой панели) */
  window.addEventListener("resize", draw, listen);
  window.addEventListener("scroll", draw, { capture: true, passive: true, signal: listen.signal });
  const resized = new ResizeObserver(draw);
  resized.observe(grid);
  resized.observe(questionsBox);
  resized.observe(answersBox);
  listen.signal.addEventListener("abort", function () { resized.disconnect(); });

  box.querySelector(".practice-again").addEventListener("click", function () {
    setupMatch(topic, task, taskIndex, onDone);
    box.querySelector(".match-count").focus({ preventScroll: true });
  });

  updateCount();
  render();
}

/* Задание «Заполни пропуск» (type "fill") на странице practice.html.
   В тексте предложения (поле sentences) ровно один ___ — на этом месте пропуск; варианты = answer + wrong, сайт их перемешивает.
   Нажатие на пропуск (или Enter) открывает меню: выбор щелчком или стрелками и Enter, Esc закрывает.
   После проверки верные пропуски зеленеют и закрепляются, неверные краснеют, и их можно выбрать заново; правильный ответ не показывается.
   onDone() вызывается, когда все пропуски верны (чтобы обновить список заданий слева) */
const FILL_MENU_GAP = 6;   // зазор между меню и пропуском или краем окна, px
const FILL_GENERAL_DESC = "Выберите в каждом пропуске верный вариант.";
const FILL_HINT = "Нажмите на оранжевый овал и выберите верный вариант.";

function setupFill(topic, task, taskIndex, onDone) {
  const box = document.getElementById("practice-task");
  const side = document.getElementById("practice-results");
  if (!box || !side) return;

  // Обработчики прошлого задания (или прошлого прохождения этого) снимаются
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };

  const items = (task.sentences || []).map(function (sentence, i) {
    return Object.assign({}, sentence, {
      index: i,
      options: shuffled([sentence.answer].concat(sentence.wrong || [])),
      chosen: null,
      ok: false,
      wrongNow: false
    });
  });
  let opened = null;   // пропуск, для которого открыто меню
  let checked = false; // была ли уже проверка

  box.innerHTML =
    '<div class="practice-work practice-zone">' +
    '<div class="practice-zone-head fill-head"><h2 class="practice-zone-title">Текст</h2><p class="fill-count"></p></div>' +
    '<div class="fill-progress" aria-hidden="true"><span></span></div>' +
    // Строки распределяются по высоте зоны; не влезли — прокручивается только этот блок
    '<div class="fill-scroll"><ol class="fill-text">' +
      items.map(function (item) {
        const parts = item.text.split("___");
        return '<li class="fill-line">' +
          '<span class="order-num" aria-hidden="true">' + (item.index + 1) + "</span>" +
          '<p class="fill-sentence">' + escapeHtml(parts[0]) +
            // Не кнопка: кнопка не переносит длинный ответ на вторую строку
            '<span class="fill-blank" data-item="' + item.index + '" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">' +
              '<span class="fill-value"></span><span class="fill-arrow" aria-hidden="true">▾</span>' +
            "</span>" +
            escapeHtml(parts[1] || "") +
          "</p>" +
        "</li>";
      }).join("") +
    "</ol></div>" +
    "</div>" +

    // Внизу: сообщения, «Проверить», а когда все пропуски верны — «Готово!» и кнопки дальше
    practiceBar(topic, taskIndex, "Готово! Все пропуски заполнены верно",
      '<p class="fill-result" aria-live="polite"></p><p class="fill-say visually-hidden" aria-live="polite"></p>',
      '<button type="button" class="btn btn-primary fill-check" disabled>Проверить</button>') +

    // Меню одно на все пропуски; стоит вне текста, чтобы его не обрезала прокрутка внутри зоны
    '<ul class="fill-menu" role="listbox" hidden></ul>';

  side.classList.remove("is-done");
  side.setAttribute("aria-label", "Пояснения");
  side.innerHTML =
    '<div class="practice-zone-head fill-head"><h2 class="order-pool-title" tabindex="-1">Пояснения</h2><p class="fill-count">по номерам</p></div>' +
    '<ol class="order-why-list fill-why"></ol>';

  const textBox = box.querySelector(".fill-text");
  const textArea = box.querySelector(".fill-scroll");
  const count = box.querySelector(".fill-count");
  const progress = box.querySelector(".fill-progress span");
  const menu = box.querySelector(".fill-menu");
  const result = box.querySelector(".fill-result");
  const message = box.querySelector(".fill-say");
  const check = box.querySelector(".fill-check");
  const bar = box.querySelector(".practice-bar");
  const firstAction = bar.querySelector(".practice-after");
  const why = side.querySelector(".fill-why");

  items.forEach(function (item) {
    item.el = textBox.querySelector('.fill-blank[data-item="' + item.index + '"]');
  });

  function renderBlank(item) {
    const el = item.el;
    el.querySelector(".fill-value").textContent = item.chosen || "выбрать";
    el.classList.toggle("is-filled", Boolean(item.chosen));
    el.classList.toggle("is-ok", item.ok);
    el.classList.toggle("is-wrong", item.wrongNow);
    el.closest(".fill-line").classList.toggle("is-ok", item.ok);
    if (item.ok) {
      ["role", "tabindex", "aria-haspopup", "aria-expanded", "aria-label"].forEach(function (name) { el.removeAttribute(name); });
    } else {
      el.setAttribute("aria-label", "Пропуск " + (item.index + 1) + ": " + (item.chosen || "не выбрано") + (item.wrongNow ? ", неверно" : ""));
    }
  }

  /* Счётчик над текстом: сколько заполнено, а после проверки — сколько верно. Полоса всегда показывает заполнение */
  function renderCount() {
    const filled = items.filter(function (item) { return item.chosen; }).length;
    const right = items.filter(function (item) { return item.ok; }).length;
    count.innerHTML = (checked ? "Верно <strong>" + right : "Заполнено <strong>" + filled) + "</strong> из " + items.length;
    progress.style.width = filled / items.length * 100 + "%";
  }

  /* Сообщение в строке кнопок: пока остаются красные пропуски */
  function renderResult() {
    const wrong = items.filter(function (item) { return item.wrongNow; }).length;
    const right = items.filter(function (item) { return item.ok; }).length;
    result.textContent = wrong
      ? "Верно " + right + " из " + items.length + " — исправьте " + (wrong > 1 ? "красные пропуски" : "красный пропуск")
      : "";
  }

  /* Высота строки рассчитана на самый длинный вариант: выбор ответа не двигает остальные строки */
  function reserveLines() {
    items.forEach(function (item) {
      const line = item.el.closest(".fill-line");
      const value = item.el.querySelector(".fill-value");
      const current = value.textContent;
      line.style.minHeight = "";
      let tallest = line.offsetHeight;
      item.options.forEach(function (option) {
        value.textContent = option;
        tallest = Math.max(tallest, line.offsetHeight);
      });
      value.textContent = current;
      line.style.minHeight = tallest + "px";
    });
  }

  /* --- Меню --- */
  function optionEls() {
    return Array.from(menu.querySelectorAll(".fill-option"));
  }

  /* Меню под пропуском, а если снизу не хватает места — над ним. Не влезает и там — прокрутка внутри меню.
     Положение считается в координатах окна; у пропуска в две строки берётся нижняя строка или верхняя */
  function placeMenu(item) {
    const lines = item.el.getClientRects();
    const first = lines[0], last = lines[lines.length - 1];
    const top = document.querySelector(".site-header").getBoundingClientRect().bottom;
    const below = window.innerHeight - last.bottom - FILL_MENU_GAP * 2;
    const above = first.top - top - FILL_MENU_GAP * 2;
    menu.style.maxHeight = "";
    const height = menu.offsetHeight;
    const down = height <= below || below >= above;
    const shown = Math.min(height, down ? below : above);
    menu.style.maxHeight = shown + "px";
    menu.style.top = (down ? last.bottom + FILL_MENU_GAP : first.top - FILL_MENU_GAP - shown) + "px";
    const left = Math.min((down ? last : first).left, window.innerWidth - menu.offsetWidth - FILL_MENU_GAP);
    menu.style.left = Math.max(FILL_MENU_GAP, left) + "px";
  }

  function openMenu(item) {
    closeMenu(false);
    opened = item;
    item.el.setAttribute("aria-expanded", "true");
    item.el.classList.add("is-open");
    menu.setAttribute("aria-label", "Варианты для пропуска " + (item.index + 1));
    menu.innerHTML = item.options.map(function (option, i) {
      return '<li class="fill-option" role="option" tabindex="-1" data-option="' + i + '" aria-selected="' + (option === item.chosen) + '">' + escapeHtml(option) + "</li>";
    }).join("");
    menu.hidden = false;
    placeMenu(item);
    (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild).focus({ preventScroll: true });
  }

  function closeMenu(returnFocus) {
    if (!opened) return;
    const item = opened;
    opened = null;
    menu.hidden = true;
    item.el.classList.remove("is-open");
    item.el.setAttribute("aria-expanded", "false");
    if (returnFocus) item.el.focus({ preventScroll: true });
  }

  function choose(optionEl) {
    const item = opened;
    item.chosen = item.options[Number(optionEl.dataset.option)];
    item.wrongNow = false;
    closeMenu(true);
    renderBlank(item);
    check.disabled = items.some(function (it) { return !it.chosen; });
    renderCount();
    renderResult();
    message.textContent = "Пропуск " + (item.index + 1) + ": " + item.chosen;
  }

  /* Щелчки: по варианту, по пропуску (закреплённый не отвечает), мимо меню */
  document.addEventListener("click", function (e) {
    const option = e.target.closest(".fill-option");
    const blank = e.target.closest(".fill-blank");
    if (option && opened) choose(option);
    else if (blank && !blank.classList.contains("is-ok") && !blank.classList.contains("is-open")) openMenu(items[Number(blank.dataset.item)]);
    else closeMenu(false);
  }, listen);

  /* Клавиатура: Enter, пробел или стрелка вниз на пропуске открывают меню */
  textBox.addEventListener("keydown", function (e) {
    const blank = e.target.closest(".fill-blank");
    if (!blank || blank.classList.contains("is-ok") || ["Enter", " ", "ArrowDown"].indexOf(e.key) < 0) return;
    e.preventDefault();
    if (!e.repeat) openMenu(items[Number(blank.dataset.item)]);
  });

  menu.addEventListener("keydown", function (e) {
    const list = optionEls();
    const at = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(at + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (at >= 0 && !e.repeat) choose(list[at]);
    } else if (e.key === "Tab") {
      closeMenu(true);  // фокус вернулся на пропуск, и Tab идёт дальше от него
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu(true);
  }, listen);

  // Меню стоит в координатах окна: окно изменилось — закрываем; текст прокрутили — меню едет за пропуском,
  // а если пропуск скрылся за краем текста или окна, закрываем
  window.addEventListener("resize", function () { closeMenu(false); }, listen);
  window.addEventListener("scroll", function (e) {
    if (!opened || e.target === menu) return;
    const rect = opened.el.getBoundingClientRect(), area = textArea.getBoundingClientRect();
    const top = Math.max(area.top, document.querySelector(".site-header").getBoundingClientRect().bottom);
    if (rect.bottom < top || rect.top > Math.min(area.bottom, window.innerHeight)) closeMenu(false);
    else placeMenu(opened);
  }, { capture: true, passive: true, signal: listen.signal });

  /* --- Проверка --- */
  /* Плашка на каждый пропуск: до проверки все серые, после — у верных пояснение, у неверных просьба выбрать другой вариант */
  function renderWhy() {
    why.innerHTML = items.map(function (item) {
      const text = item.ok ? item.explanation : checked ? "Выберите другой вариант" : "Пояснение откроется после проверки";
      return '<li class="fill-why-item' + (item.ok ? " is-ok" : "") + '"><span class="order-num" aria-hidden="true">' + (item.index + 1) + "</span><span>" + escapeHtml(text) + "</span></li>";
    }).join("");
  }

  function finish(byKey) {
    bar.classList.add("is-done");
    check.hidden = true;
    saveTaskDone(topic, task);
    message.textContent = "Готово! Все пропуски заполнены верно";
    if (byKey) firstAction.focus();
    if (onDone) onDone();
  }

  check.addEventListener("click", function (e) {
    items.forEach(function (item) {
      item.ok = item.chosen === item.answer;
      item.wrongNow = !item.ok;
      renderBlank(item);
    });
    checked = true;
    renderWhy();
    renderCount();
    renderResult();
    if (items.every(function (item) { return item.ok; })) {
      finish(e.detail === 0);
      return;
    }
    if (e.detail === 0) items.find(function (item) { return !item.ok; }).el.focus();
  });

  box.querySelector(".practice-again").addEventListener("click", function () {
    setupFill(topic, task, taskIndex, onDone);
    side.querySelector(".order-pool-title").focus({ preventScroll: true });
  });

  items.forEach(renderBlank);
  renderCount();
  renderWhy();
  reserveLines();

  // Ширина текста изменилась (окно, свёрнутая панель слева) — строки переносятся иначе
  let textWidth = textBox.offsetWidth;
  const textResize = new ResizeObserver(function () {
    if (textBox.offsetWidth === textWidth) return;
    textWidth = textBox.offsetWidth;
    reserveLines();
  });
  textResize.observe(textBox);
  listen.signal.addEventListener("abort", function () { textResize.disconnect(); });
}

/* ---------- Страница практики (practice.html?topic=ID&task=номер) ----------
   Слева — список заданий темы (сворачивается; уже 1000px — выпадающий список), в центре — задание, справа — карточки результатов.
   Задания переключаются без перезагрузки: меняется только ?task= в адресе */
/* Записка над картинкой (необязательное поле задания note: { title, items, footnote }).
   Нет поля или оно пустое — ничего не выводится */
function renderPracticeNote(note) {
  if (!note || !(note.title || hasItems(note.items))) return "";
  return (
    '<aside class="practice-note-card" aria-label="' + escapeHtml(note.title || "Записка") + '">' +
      (note.title ? '<h2 class="practice-note-title">' + escapeHtml(note.title) + "</h2>" : "") +
      (hasItems(note.items) ? renderList(note.items, "ol") : "") +
      (note.footnote ? '<p class="practice-note-foot">' + escapeHtml(note.footnote) + "</p>" : "") +
    "</aside>"
  );
}

/* Описание под заголовком задания. У «Заполни пропуск» общее описание заменяет подсказка, как обращаться с овалами */
function practiceDescHtml(task) {
  const isFill = task.type === "fill";
  const description = isFill && task.description === FILL_GENERAL_DESC ? "" : task.description;
  return (description ? '<p class="practice-task-desc">' + escapeHtml(description) + "</p>" : "") +
    (isFill ? '<p class="practice-task-desc">' + FILL_HINT + "</p>" : "");
}

function renderPracticePage() {
  const page = document.getElementById("practice-page");
  if (!page) return;

  const params = new URLSearchParams(location.search);
  const topic = TOPICS.find(function (t) { return t.id === params.get("topic"); });
  const tasks = practiceTasks(topic);

  if (!tasks.length) {
    page.innerHTML =
      '<div class="card practice-none">' +
        "<h1>Практика для этой темы пока не готова</h1>" +
        '<a href="lessons.html" class="btn btn-primary">Вернуться к урокам</a>' +
      "</div>";
    return;
  }

  let index = parseInt(params.get("task"), 10) - 1;
  if (!(index >= 0 && index < tasks.length)) index = 0;
  const task = tasks[index];

  document.title = "Практика: " + topic.title + " — Опора. Школа ухода";

  page.innerHTML =
    '<div class="practice-page-grid' + (["order", "match", "fill"].indexOf(task.type) >= 0 ? " practice-page-grid--zones practice-page-grid--" + task.type : "") + (practiceNavFolded ? " is-nav-folded" : "") + '">' +
      '<nav class="practice-nav" aria-label="Задания практики"></nav>' +
      '<section class="practice-main-col">' +
        '<div class="practice-head">' +
          '<div class="practice-title-row">' +
            '<h1 class="practice-task-title">' + escapeHtml(task.title) + "</h1>" +
            '<span class="practice-task-badge">Задание ' + (index + 1) + " из " + tasks.length + "</span>" +
          "</div>" +
          practiceDescHtml(task) +
        "</div>" +
        renderPracticeNote(task.note) +
        '<div id="practice-task"></div>' +
      "</section>" +
      '<aside class="practice-side-col" id="practice-results" aria-label="Результаты"></aside>' +
    "</div>";

  const nav = page.querySelector(".practice-nav");
  let navOpen = false;   // открыт ли выпадающий список (уже 1000px)
  function renderNav() {
    const foldLabel = practiceNavFolded ? "Развернуть список заданий" : "Свернуть список заданий";
    // Только вид: то же число написано рядом словами
    const progressBar = '<div class="practice-nav-progress" aria-hidden="true"><span style="width:' + countTasksDone(topic) / tasks.length * 100 + '%"></span></div>';
    nav.innerHTML =
      '<button type="button" class="practice-nav-fold" aria-expanded="' + !practiceNavFolded + '" aria-label="' + foldLabel + '" title="' + foldLabel + '">' +
        (practiceNavFolded ? "»" : "«") +
      "</button>" +
      '<button type="button" class="practice-nav-drop" aria-expanded="' + navOpen + '">' +
        "<strong>Задания</strong> " +
        '<span class="practice-nav-drop-count">Выполнено ' + countTasksDone(topic) + " из " + tasks.length + "</span>" +
      "</button>" +
      progressBar +
      '<div class="practice-nav-body">' +
        '<h2 class="practice-nav-title">Практика</h2>' +
        '<p class="practice-nav-topic">' + escapeHtml(topic.title) + "</p>" +
        '<p class="practice-nav-count">Выполнено заданий: ' + countTasksDone(topic) + " из " + tasks.length + "</p>" +
        progressBar +
        '<ol class="practice-nav-list">' +
          tasks.map(function (t, i) {
            const done = isTaskDone(topic, t);
            // В свёрнутой панели виден только кружок, поэтому название — в подсказке и для программ чтения
            const folded = practiceNavFolded
              ? ' title="' + escapeHtml(t.title) + '" aria-label="' + (i + 1) + ". " + escapeHtml(t.title) + (done ? ", выполнено" : "") + '"'
              : "";
            return "<li>" +
              '<a href="' + practiceLink(topic, i + 1) + '" data-task="' + (i + 1) + '"' + folded +
                ' class="practice-nav-item' + (i === index ? " is-current" : "") + (done ? " is-done" : "") + '"' +
                (i === index ? ' aria-current="step"' : "") + ">" +
                '<span class="practice-nav-circle" aria-hidden="true">' + (i + 1) + "</span>" +
                '<span class="practice-nav-label">' +
                  '<span class="practice-nav-num">' + (i + 1) + ".</span> " + escapeHtml(t.title) +
                  (done ? '\u00a0<span class="practice-nav-check" aria-label="выполнено">✓</span>' : "") +   // галочка не уходит на строку одна
                "</span>" +
              "</a></li>";
          }).join("") +
        "</ol>" +
        '<a href="lesson.html?id=' + encodeURIComponent(topic.id) + '" class="practice-nav-back">← К уроку</a>' +
      "</div>";
  }
  renderNav();

  nav.addEventListener("click", function (e) {
    if (e.target.closest(".practice-nav-fold")) {
      practiceNavFolded = !practiceNavFolded;
      try {
        localStorage.setItem(PRACTICE_NAV_KEY, practiceNavFolded ? "1" : "0");
      } catch (err) {}
      nav.parentNode.classList.toggle("is-nav-folded", practiceNavFolded);
      renderNav();
      nav.querySelector(".practice-nav-fold").focus();
    } else if (e.target.closest(".practice-nav-drop")) {
      navOpen = !navOpen;
      nav.classList.toggle("is-open", navOpen);
      nav.querySelector(".practice-nav-drop").setAttribute("aria-expanded", navOpen);
    }
  });

  if (task.type === "spot-error") setupPractice(topic, task, index, renderNav);
  if (task.type === "find-zones") setupFindZones(topic, task, index, renderNav);
  if (task.type === "order") setupOrder(topic, task, index, renderNav);
  if (task.type === "match") setupMatch(topic, task, index, renderNav);
  if (task.type === "fill") setupFill(topic, task, index, renderNav);

  // Переход к другому заданию (список слева и кнопка «К следующему заданию») — без перезагрузки.
  // Обработчик вешается один раз: сам блок страницы при переключении не пересоздаётся
  if (page.dataset.ready) return;
  page.dataset.ready = "1";
  page.addEventListener("click", function (e) {
    const link = e.target.closest("a[data-task]");
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    history.pushState(null, "", link.getAttribute("href"));
    renderPracticePage();
    window.scrollTo(0, 0);
  });
}

/* Кнопки «назад/вперёд» браузера между заданиями */
window.addEventListener("popstate", function () {
  if (document.getElementById("practice-page")) renderPracticePage();
});

/* ---------- Тест (test.html?topic=ID) ---------- */

/* Перемешивание списка (алгоритм Фишера — Йетса). Исходный список не меняется */
function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function renderTestPage() {
  const page = document.getElementById("test-page");
  if (!page) return;

  const id = new URLSearchParams(location.search).get("topic");
  const topic = TOPICS.find(function (t) { return t.id === id; });

  if (!topic) {
    page.innerHTML =
      '<div class="card"><h1>Тест не найден</h1>' +
      "<p>Возможно, ссылка устарела.</p>" +
      '<a href="lessons.html" class="btn btn-primary">К списку уроков</a></div>';
    return;
  }
  if (!isLesson(topic)) {
    page.innerHTML = renderNotALesson(topic);
    return;
  }

  const lessonHref = topicLink("lesson.html", topic);
  const next = nextLesson(topic);
  document.title = "Тест: " + topic.title + " — Опора";

  page.innerHTML =
    '<a href="' + lessonHref + '" class="back-link">← Вернуться к материалу</a>' +
    '<p class="lesson-num">Тест · Урок ' + (LESSONS.indexOf(topic) + 1) + "</p>" +
    "<h1>" + escapeHtml(topic.title) + "</h1>" +
    '<div id="test-body"></div>';

  const body = document.getElementById("test-body");
  let questions = [];
  let current = 0;
  let answers = [];

  /* Новое прохождение: вопросы и варианты в случайном порядке */
  function start() {
    questions = shuffled(topic.quiz).map(function (q) {
      return {
        question: q.question,
        explanation: q.explanation || "",
        correctText: q.options[q.correct],
        // Запоминаем исходный номер варианта, чтобы проверить ответ после перемешивания
        options: shuffled(q.options.map(function (text, i) { return { text: text, isCorrect: i === q.correct }; }))
      };
    });
    current = 0;
    answers = [];
    showQuestion();
  }

  function showQuestion() {
    const q = questions[current];
    const total = questions.length;
    const isLast = current === total - 1;

    body.innerHTML =
      '<div class="test-progress">' +
        '<p class="progress-text">Вопрос <strong>' + (current + 1) + "</strong> из " + total + "</p>" +
        '<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + total +
          '" aria-valuenow="' + (current + 1) + '" aria-label="Ход теста">' +
          '<div class="progress-fill" style="width:' + Math.round((current + 1) / total * 100) + '%"></div>' +
        "</div>" +
      "</div>" +
      '<form id="test-form" class="card">' +
        '<fieldset class="question">' +
          '<legend tabindex="-1">' + escapeHtml(q.question) + "</legend>" +
          q.options.map(function (o, oi) {
            return (
              '<label class="option">' +
                '<input type="radio" name="answer" value="' + oi + '"> ' +
                "<span>" + escapeHtml(o.text) + "</span>" +
              "</label>"
            );
          }).join("") +
        "</fieldset>" +
        '<p id="test-error" class="error" role="alert"></p>' +
        '<button type="submit" class="btn btn-primary">' + (isLast ? "Показать результат" : "Далее") + "</button>" +
      "</form>";

    // Для перехода с клавиатуры и программ чтения с экрана — фокус на новый вопрос
    if (current > 0) body.querySelector("legend").focus();

    document.getElementById("test-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const checked = this.querySelector('input[name="answer"]:checked');
      if (!checked) {
        document.getElementById("test-error").textContent = "Выберите один вариант ответа.";
        return;
      }
      answers.push(q.options[Number(checked.value)]);
      current++;
      if (current < questions.length) showQuestion();
      else showResult();
    });
  }

  function showResult() {
    const total = questions.length;
    const correct = answers.filter(function (a) { return a.isCorrect; }).length;
    const percent = Math.round(correct / total * 100);
    const passed = correct / total >= PASS_RATE;
    const needed = Math.ceil(PASS_RATE * total - 1e-9); // сколько верных нужно для зачёта

    saveTestResult(topic.id, correct, total); // если не вошли — функция ничего не сохранит

    body.innerHTML =
      '<div class="card test-result ' + (passed ? "is-passed" : "is-failed") + '" tabindex="-1">' +
        '<p class="test-percent">' + percent + "%</p>" +
        '<p class="test-verdict">' + (passed ? "Зачтено ✓" : "Не зачтено") + "</p>" +
        "<p>Верно " + correct + " из " + total + ". Для зачёта нужно " + needed + " из " + total +
          " (" + Math.round(PASS_RATE * 100) + "%).</p>" +
        (passed ? "" : '<p class="muted">Пересмотрите материал урока и попробуйте ещё раз.</p>') +
        (!getCurrentUser()
          ? '<p class="hint">Результат не сохранён: вы не вошли. <a href="' + loginLinkBack() + '">Войти</a></p>'
          : "") +
        '<div class="buttons">' +
          '<button type="button" id="test-again" class="btn btn-secondary">Пройти ещё раз</button>' +
          '<a href="' + lessonHref + '" class="btn btn-secondary">Вернуться к уроку</a>' +
          (next ? '<a href="' + topicLink("lesson.html", next) + '" class="btn btn-primary">К следующему уроку</a>' : "") +
        "</div>" +
      "</div>" +

      '<h2 class="lesson-h2">Разбор ответов</h2>' +
      '<ol class="test-review">' +
        questions.map(function (q, i) {
          const a = answers[i];
          return (
            '<li class="card review-item ' + (a.isCorrect ? "is-right" : "is-wrong") + '">' +
              '<p class="review-question">' + escapeHtml(q.question) + "</p>" +
              "<p>Ваш ответ: <strong>" + escapeHtml(a.text) + "</strong> " +
                (a.isCorrect ? '<span class="review-mark">✓ верно</span>' : '<span class="review-mark">✗ неверно</span>') + "</p>" +
              "<p>Верный ответ: <strong>" + escapeHtml(q.correctText) + "</strong></p>" +
              (q.explanation ? '<p class="review-explanation">' + escapeHtml(q.explanation) + "</p>" : "") +
            "</li>"
          );
        }).join("") +
      "</ol>";

    const resultCard = body.querySelector(".test-result");
    resultCard.focus();
    resultCard.scrollIntoView({ block: "start" });

    document.getElementById("test-again").addEventListener("click", function () {
      start();
      page.scrollIntoView({ block: "start" });
    });
  }

  start();
}

/* ---------- Справочник: общие помощники ---------- */

function sectionOf(topic) {
  return SECTIONS.find(function (s) { return s.id === topic.section; });
}

function hasVideo(topic) {
  return lessonVideos(topic).length > 0;
}

function hasArticle(topic) {
  return hasItems(topic.article) || hasItems(topic.details);
}

/* Приводит текст к виду для поиска: маленькие буквы, «ё» → «е», лишние пробелы убраны */
function normalizeText(text) {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/* Текст темы для поиска в справочнике: название, описание, памятка справочника (memo),
   статья (article, details) и частые вопросы (faq). Памятка и тест урока сюда не входят. */
function topicSearchText(topic) {
  const memo = topic.memo || {};
  const article = (topic.article || []).map(function (part) { return part.heading + " " + part.text.join(" "); });
  const parts = [topic.title, topic.description, topic.intro || ""]
    .concat(memo.doList || [], memo.dontList || [], memo.urgentList || [], topic.details || [], article)
    .concat((topic.faq || []).map(function (f) { return f.q + " " + f.a; }));
  return normalizeText(parts.join(" "));
}

/* Адрес картинки на карточке темы: картинка статьи (image) или обложка (cover), иначе пусто */
function topicCardImage(topic) {
  const cover = (topic.cover || "").trim();
  return (topic.image || "").trim() || (cover ? "images/" + cover : "");
}

/* Картинка в блоке box не загрузилась (например, ошибка в имени файла) — убираем её, остаётся то, что под ней.
   Отдельной функцией, потому что инлайновые onerror запрещены политикой сервера */
function dropBrokenImages(box) {
  box.addEventListener("error", function (e) {
    if (e.target.tagName === "IMG") e.target.remove();
  }, true);
}

/* Обложка карточки в поиске: картинка темы или цветная заглушка с названием раздела */
function renderCover(topic, section) {
  const src = topicCardImage(topic);
  return (
    '<div class="tile-cover" style="background:' + escapeHtml(section.color || "#5b6478") + '">' +
      '<span class="tile-cover-label">' + escapeHtml(section.title) + "</span>" +
      (src ? '<img src="' + escapeHtml(encodeURI(src)) + '" alt="" loading="lazy">' : "") +
    "</div>"
  );
}

/* Общая карточка материала в поиске справочника (у видео своя карточка — renderVideoCard).
   options: href, badge (надпись поверх обложки), text (текст под названием) */
function renderTile(topic, options) {
  const section = sectionOf(topic);
  return (
    '<a class="tile" href="' + options.href + '">' +
      '<div class="tile-media">' +
        renderCover(topic, section) +
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

/* Статья темы с сразу открытой памяткой */
function memoLink(topic) {
  return topicLink("article.html", topic) + "&memo=1";
}

/* Раздел видео, сразу на этой теме */
function videoLink(topic) {
  return "videos.html?topic=" + encodeURIComponent(topic.id);
}

/* Окно поверх страницы: как памятка в уроке (крестик, Esc, щелчок по фону, страница под окном не прокручивается).
   Содержимое убирается при закрытии: плеер не продолжает играть. Возвращает функцию open(title, html, opener) */
function createPageModal(extraClass) {
  const dialog = document.createElement("dialog");
  dialog.className = "lesson-modal page-modal" + (extraClass ? " " + extraClass : "");
  dialog.setAttribute("aria-labelledby", "page-modal-title");
  dialog.innerHTML =
    '<div class="lesson-modal-box">' +
      '<div class="lesson-modal-head">' +
        '<h2 id="page-modal-title"></h2>' +
        '<button type="button" class="lesson-modal-close" aria-label="Закрыть окно">✕</button>' +
      "</div>" +
      '<div class="lesson-modal-body"></div>' +
    "</div>";
  document.body.appendChild(dialog);

  const body = dialog.querySelector(".lesson-modal-body");
  let opener = null;
  let pressedOutside = false;

  dialog.addEventListener("close", function () {
    body.innerHTML = "";
    document.documentElement.classList.remove("modal-open");
    if (opener) opener.focus();
  });
  dialog.querySelector(".lesson-modal-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("pointerdown", function (e) { pressedOutside = e.target === dialog; });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog && pressedOutside) dialog.close();
  });

  return function open(title, html, from) {
    opener = from;
    dialog.querySelector("h2").textContent = title;
    body.innerHTML = html;
    body.scrollTop = 0;
    document.documentElement.classList.add("modal-open");
    dialog.showModal();
    dialog.querySelector(".lesson-modal-close").focus();
  };
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

/* Типы материалов в поиске справочника: есть ли такой материал у темы и куда он ведёт.
   Памятки отдельных карточек не имеют: они открываются из статьи и из урока */
const MATERIAL_TYPES = [
  { id: "videos", title: "Видео", fits: hasVideo },
  { id: "articles", title: "Статьи", badge: "Статья", link: function (t) { return topicLink("article.html", t); }, fits: hasArticle }
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
  const videos = [];   // ролики показанных карточек: номер в списке — data-video у карточки
  setupVideoCards(list, videos);

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

    // Одна карточка на каждый материал темы: статья, каждый ролик
    const cards = [];
    videos.length = 0;
    TOPICS.forEach(function (topic) {
      if (currentSection !== "all" && topic.section !== currentSection) return;
      const text = topicSearchText(topic);
      if (!words.every(function (word) { return text.indexOf(word) !== -1; })) return;

      types.forEach(function (type) {
        if (!type.fits(topic)) return;
        if (type.id === "videos") {
          lessonVideos(topic).forEach(function (video) {
            videos.push(video);
            cards.push(renderVideoCard(topic, video, videos.length - 1));
          });
          return;
        }
        cards.push(renderTile(topic, {
          href: type.link(topic),
          badge: type.badge,
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

/* ---------- Справочник: разделы Видео и Статьи ---------- */

/* Значки тем на превью роликов: содержимое svg с viewBox 0 0 24 24 */
const VIDEO_ICONS = {
  burns: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.8 1.2 2.7 2 3 .3-3-.2-5.7 1-8.5z"/>',
  wounds: '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>',
  bedsores: '<path d="M3 7v11M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-8v5"/><circle cx="6.5" cy="10.5" r="1.7"/>',
  amputation: '<path d="M9 3h6M12 3v6M8.5 9h7l-1 5h-5zM12 14v7M10 21h4"/>',
  mobility: '<circle cx="11" cy="3.5" r="1.5"/><path d="M11 6.5V12h6l3 6M8 10.5a5.5 5.5 0 1 0 7 6.5"/>',
  nutrition: '<path d="M12 7c-1.5-1.5-6-1.5-7 3-.8 4 1.8 10 4.5 10 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c2.7 0 5.3-6 4.5-10-1-4.5-5.5-4.5-7-3zM12 7c0-2 1-3.5 3-4"/>',
  stress: '<path d="M12 20s-7.5-4.6-9-9.5C2 7 4.5 4 7.5 4c1.9 0 3.5 1 4.5 2.5C13 5 14.6 4 16.5 4 19.5 4 22 7 21 10.5 19.5 15.4 12 20 12 20z"/><path d="M6.5 12h2.5l1.5-3 2.5 5 1.5-2h3"/>',
  insomnia: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  aggression: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  talking: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  burnout: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22.5 11v2M6 10.5v3"/>',
  children: '<circle cx="8.5" cy="7" r="3"/><circle cx="17" cy="11" r="2.2"/><path d="M3 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6M15 20c.1-2.5 1-4 3-4s3 1.5 3 4"/>',
  documents: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  payments: '<circle cx="12" cy="12" r="9"/><path d="M10 17V7h3a3 3 0 0 1 0 6H8.5M8.5 15.5H13"/>',
  disability: '<path d="M8 4h8v3H8zM8 5.5H6v15h12v-15h-2M9 13.5l2 2 4-4"/>',
  prosthetics: '<path d="M8.5 3h7L14 9h-4zM12 12v7M12 19v2h6c0-1-1-1.5-2.5-2z"/><circle cx="12" cy="10.5" r="1.5"/>'
};
/* Новая тема без своего значка: значок раздела */
const VIDEO_SECTION_ICONS = { medical: "wounds", psychology: "stress", legal: "documents" };

/* Карточка ролика на странице «Видео» и в поиске справочника: превью (картинка thumb или градиент раздела со значком темы),
   название ролика, ниже тема и автор. index — номер ролика в списке, который получает setupVideoCards */
function renderVideoCard(topic, video, index) {
  const thumb = (video.thumb || "").trim();
  return (
    '<a class="video-card" href="' + videoLink(topic) + '" data-video="' + index + '" data-topic="' + escapeHtml(topic.id) + '" aria-haspopup="dialog">' +
      '<span class="video-thumb video-thumb--' + escapeHtml(topic.section) + '">' +
        '<svg class="video-thumb-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          (VIDEO_ICONS[topic.id] || VIDEO_ICONS[VIDEO_SECTION_ICONS[topic.section]]) +
        "</svg>" +
        (thumb ? '<img src="' + escapeHtml(encodeURI(thumb)) + '" alt="" loading="lazy">' : "") +
        '<span class="video-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M8 5l11 7-11 7z"/></svg></span>' +
      "</span>" +
      '<span class="video-card-title">' + escapeHtml(video.title) + "</span>" +
      '<span class="video-card-topic">' + escapeHtml(topic.title + (video.org ? "\u00a0· " + video.org : "")) + "</span>" +
    "</a>"
  );
}

/* Карточки роликов в блоке box: нажатие открывает ролик в окне. videos — список, на который указывает data-video у карточки.
   Возвращает функцию «показать ролик этой карточки» */
function setupVideoCards(box, videos) {
  const openModal = createPageModal("video-modal");

  function showVideo(card) {
    const video = videos[Number(card.dataset.video)];
    openModal(video.title, videoModalHtml(video), card);
  }

  box.addEventListener("click", function (e) {
    const card = e.target.closest(".video-card");
    if (!card) return;
    e.preventDefault();
    showVideo(card);
  });

  // Под картинкой остаётся градиент со значком у ролика, цветная заглушка у статьи
  dropBrokenImages(box);

  return showVideo;
}

function videoArrow(cls, label, path) {
  return (
    '<button type="button" class="video-arrow ' + cls + '" aria-label="' + label + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>' +
    "</button>"
  );
}

/* Лента: стрелки листают на страницу карточек, на краю стрелка бледная и не работает.
   Неактивную стрелку не выключаем совсем (disabled): у того, кто листает с клавиатуры, пропал бы фокус */
function setupVideoRow(group) {
  const track = group.querySelector(".video-track");
  const prev = group.querySelector(".video-arrow-prev");
  const next = group.querySelector(".video-arrow-next");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function update() {
    const end = track.scrollWidth - track.clientWidth;
    prev.setAttribute("aria-disabled", track.scrollLeft <= 1);
    next.setAttribute("aria-disabled", track.scrollLeft >= end - 1);
  }

  function turn(direction, arrow) {
    if (arrow.getAttribute("aria-disabled") === "true") return;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || 0;
    const step = track.firstElementChild.offsetWidth + gap;
    const width = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const perPage = Math.max(1, Math.floor((width + gap + 1) / step));
    track.scrollBy({ left: direction * perPage * step, behavior: calm ? "auto" : "smooth" });
  }

  prev.addEventListener("click", function () { turn(-1, prev); });
  next.addEventListener("click", function () { turn(1, next); });
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  // Tab на край следующей карточки: браузер считает её видимой и не прокручивает. Только клавиатура: при нажатии мышью сдвиг сорвал бы клик
  track.addEventListener("focusin", function (e) {
    if (!e.target.matches(":focus-visible")) return;
    const card = e.target.getBoundingClientRect();
    const row = track.getBoundingClientRect();
    if (card.left < row.left || card.right > row.right) e.target.closest(".video-card-item").scrollIntoView({ block: "nearest", inline: "start" });
  });
  update();
}

/* Раздел видео: ролики из поля videos тем, по лентам разделов. Темы без роликов не показываются.
   videos.html?topic=ID прокручивает ленту к теме, отмечает её карточки и сразу открывает первый ролик темы в окне */
function setupVideosPage() {
  const box = document.getElementById("videos-list");
  if (!box) return;

  const items = [];
  const groups = SECTIONS.map(function (section) {
    const cards = TOPICS.filter(function (t) { return t.section === section.id && hasVideo(t); }).map(function (topic) {
      return lessonVideos(topic).map(function (video) {
        items.push(video);
        return '<li class="video-card-item">' + renderVideoCard(topic, video, items.length - 1) + "</li>";
      }).join("");
    }).join("");
    const titleId = "videos-" + section.id;
    return cards
      ? '<section class="videos-group" aria-labelledby="' + titleId + '">' +
          '<h2 id="' + titleId + '">' + escapeHtml(section.title) + "</h2>" +
          videoArrow("video-arrow-prev", "Назад", "M19 12H5M11 6l-6 6 6 6") +
          '<ul class="video-track">' + cards + "</ul>" +
          videoArrow("video-arrow-next", "Вперёд", "M5 12h14M13 6l6 6-6 6") +
        "</section>"
      : "";
  }).join("");
  box.innerHTML = groups || EMPTY_RESULT;
  box.querySelectorAll(".videos-group").forEach(setupVideoRow);

  const showVideo = setupVideoCards(box, items);

  const topicId = new URLSearchParams(location.search).get("topic");
  const cards = Array.from(box.querySelectorAll(".video-card")).filter(function (c) { return c.dataset.topic === topicId; });
  if (!cards.length) return;
  cards.forEach(function (c) { c.classList.add("is-target"); });
  cards[0].scrollIntoView({ block: "start", inline: "start" });
  showVideo(cards[0]);
}

function renderArticlesPage() {
  const list = document.getElementById("articles-list");
  if (!list) return;
  const topics = TOPICS.filter(hasArticle);
  list.innerHTML = topics.length ? topics.map(renderArticleCard).join("") : EMPTY_RESULT;
  dropBrokenImages(list);
}

/* Карточка статьи на articles.html: картинка 16:9, заголовок статьи (articleTitle,
   если пусто — название темы) и кнопка «Читать статью». Вся карточка — одна ссылка.
   Без картинки — плашка с названием раздела, терракотовая и зелёная по очереди. */
function renderArticleCard(topic, index) {
  const section = sectionOf(topic);
  const src = topicCardImage(topic);
  const title = (topic.articleTitle || "").trim() || topic.title;

  return (
    '<article class="article-card">' +
      '<div class="article-card-media' + (index % 2 ? " is-green" : "") + '">' +
        '<span class="article-card-placeholder" aria-hidden="true">' + escapeHtml(section.title) + "</span>" +
        (src ? '<img src="' + escapeHtml(encodeURI(src)) + '" alt="" loading="lazy">' : "") +
      "</div>" +
      '<div class="article-card-body">' +
        // Ссылка в заголовке растянута на всю карточку (см. .article-card-link::after)
        '<h2 class="article-card-title"><a class="article-card-link" href="' + topicLink("article.html", topic) + '">' +
          escapeHtml(title) + "</a></h2>" +
        '<span class="article-card-button" aria-hidden="true">Читать статью</span>' +
      "</div>" +
    "</article>"
  );
}

/* ---------- Справочник: Частые вопросы (faq.html) ---------- */

/* Вопросы аккордеоном: свёрнуты, раскрываются по нажатию */
function renderFaqItems(faq) {
  return faq.filter(function (f) { return f && f.q; }).map(function (f) {
    return (
      '<details class="faq-item">' +
        "<summary>" + escapeHtml(f.q) + "</summary>" +
        '<div class="faq-answer"><p>' + escapeHtml(f.a || "") + "</p></div>" +
      "</details>"
    );
  }).join("");
}

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
          renderFaqItems(t.faq) +
        "</section>"
      );
    }).join("");
  }

  setupFilterButtons(document.getElementById("faq-filters"), SECTION_FILTERS, show);
  show("all");
}

/* ---------- Справочник: статья (article.html) ---------- */

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
    "<h1>" + escapeHtml((topic.articleTitle || "").trim() || topic.title) + "</h1>"
  );
}

function renderSoon(text) {
  return '<div class="video-placeholder">' + escapeHtml(text) + "</div>";
}

/* Новый текст статьи (поле article): разделы с подзаголовками */
function renderArticleSections(topic) {
  return (
    '<article class="card article-text">' +
      topic.article.map(function (part) {
        return "<h2>" + escapeHtml(part.heading) + "</h2>" +
          part.text.map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("");
      }).join("") +
    "</article>"
  );
}

/* Частые вопросы темы под текстом статьи */
function renderArticleFaq(topic) {
  return hasItems(topic.faq)
    ? '<section class="article-faq"><h2>Частые вопросы</h2>' + renderFaqItems(topic.faq) + "</section>"
    : "";
}

/* Статья справочной темы: вводный абзац, абзацы details, частые вопросы и источники */
function renderReferenceArticle(topic) {
  return (
    renderIntro(topic) +
    (hasItems(topic.details)
      ? '<div class="card details article-text">' +
          topic.details.filter(Boolean).map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("") +
        "</div>"
      : renderSoon("Статья скоро появится")) +
    renderArticleFaq(topic) +
    renderSources(topic)
  );
}

/* Широкая картинка над текстом статьи (поле image; imagePosition — какую её часть оставить в кадре) */
function renderArticleImage(topic) {
  const image = (topic.image || "").trim();
  if (!image) return "";
  const position = (topic.imagePosition || "").trim();
  return '<img class="article-image" src="' + escapeHtml(encodeURI(image)) + '" alt="" width="800" height="450"' +
    (position ? ' style="object-position:' + escapeHtml(position) + '"' : "") + ">";
}

/* article.html — картинка, текст статьи, частые вопросы и кнопки: Памятка (окно), Видео по теме, Урок по теме.
   article.html?id=ID&memo=1 открывает памятку сразу */
function renderArticlePage() {
  const page = document.getElementById("article-page");
  if (!page) return;
  const topic = topicFromAddress(page, "articles.html", "К списку статей");
  if (!topic) return;

  const memoBlocks = renderMemo(topic.memo, sectionOf(topic), false);
  document.title = topic.title + " — Статья — Опора";
  page.innerHTML =
    renderMaterialHead(topic, "articles.html", "Статьи") +
    '<div class="article-buttons">' +
      (memoBlocks ? '<button type="button" class="btn btn-primary" id="article-memo-open" aria-haspopup="dialog">Памятка</button>' : "") +
      (hasVideo(topic) ? '<a href="' + videoLink(topic) + '" class="btn btn-secondary">Видео по теме</a>' : "") +
      (isLesson(topic) ? '<a href="' + topicLink("lesson.html", topic) + '" class="btn btn-secondary">Урок по теме</a>' : "") +
    "</div>" +
    renderArticleImage(topic) +
    (hasItems(topic.article) ? renderArticleSections(topic) + renderArticleFaq(topic) : renderReferenceArticle(topic));

  // Файла нет — статья выглядит как без картинки
  dropBrokenImages(page);

  if (!memoBlocks) return;
  const openModal = createPageModal();
  const memoButton = document.getElementById("article-memo-open");
  function showMemo() { openModal("Памятка", memoBlocks, memoButton); }
  memoButton.addEventListener("click", showMemo);
  if (new URLSearchParams(location.search).get("memo") === "1") showMemo();
}

/* ---------- Поддержка (help.html) ---------- */

/* Телефоны из js/phones.js: подсказка в кабинете */
function supportPhonesHtml() {
  return '<ul class="support-phones">' +
    CRISIS_PHONES.map(function (p) {
      return '<li><a href="tel:' + escapeHtml(p.tel) + '">' + escapeHtml(p.number) + "</a> — " + escapeHtml(p.short) + "</li>";
    }).join("") +
  "</ul>";
}

/* Карточка «Куда обратиться»: те же телефоны строками */
function renderSupportContacts() {
  const box = document.getElementById("support-phones");
  if (!box) return;
  box.innerHTML = CRISIS_PHONES.map(function (p) {
    return '<li><span>' + escapeHtml(p.title) + '</span><a href="tel:' + escapeHtml(p.tel) + '">' + escapeHtml(p.number) + "</a></li>";
  }).join("");
}

/* Плашка над тестом: сохраняется ли результат */
function renderSupportBanner() {
  const box = document.getElementById("support-banner");
  if (!box) return;
  const user = getCurrentUser();
  box.innerHTML =
    '<span class="support-banner-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 12.5l4 4 8-9"/></svg>' +
    "</span>" +
    "<p>" + escapeHtml(user ? WELLBEING.noteUser : WELLBEING.noteGuest) + "</p>" +
    (user ? '<a href="cabinet.html">Открыть кабинет</a>' : '<a href="' + loginLinkBack() + '">Войти</a>');
}

/* Уровень нагрузки по баллам теста: первый, у которого сумма не больше max. На сервере то же считает server/wellbeing.js */
function wellbeingLevelOf(score) {
  return WELLBEING.levels.find(function (l) { return score <= l.max; });
}

function wellbeingLevelById(id) {
  return WELLBEING.levels.find(function (l) { return l.id === id; });
}

/* Кольцо с баллами: доля закрашена по сумме, цвет задаёт уровень (CSS) */
function wellbeingRing(score, max) {
  const length = 2 * Math.PI * 42;
  return '<div class="result-ring" role="img" aria-label="' + score + " из " + max + '">' +
    '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<circle class="result-ring-track" cx="50" cy="50" r="42"/>' +
      (score > 0
        ? '<circle class="result-ring-value" cx="50" cy="50" r="42" stroke-dasharray="' + (length * score / max) + " " + length + '"/>'
        : "") +
    "</svg>" +
    '<div class="result-ring-text"><strong>' + score + "</strong><span>из " + max + "</span></div>" +
  "</div>";
}

/* Тест «Проверить себя»: по одному вопросу, результат на том же месте. Вошедшим результат сохраняется */
function setupWellbeingSurvey() {
  const box = document.getElementById("check");
  if (!box) return;

  const user = getCurrentUser();
  const total = WELLBEING.questions.length;
  const scoreMax = total * (WELLBEING.options.length - 1);
  let answers = [];     // номер выбранного варианта по каждому вопросу: он же баллы
  let current = 0;
  let finished = false;
  let score = 0;

  function focusTitle(selector) {
    box.querySelector(selector).focus({ preventScroll: true });
  }

  function showQuestion(moveFocus) {
    finished = false;
    const last = current === total - 1;
    box.innerHTML =
      '<div class="survey-head"><h2>Проверить себя</h2><p>Вопрос ' + (current + 1) + " из " + total + "</p></div>" +
      '<div class="survey-progress" aria-hidden="true">' +
        WELLBEING.questions.map(function (q, i) {
          return '<span class="' + (i < current ? "is-done" : i === current ? "is-current" : "") + '"></span>';
        }).join("") +
      "</div>" +
      '<h3 class="survey-question" id="survey-question" tabindex="-1">' + escapeHtml(WELLBEING.questions[current]) + "</h3>" +
      '<p class="survey-hint">Вспомните последние две недели</p>' +
      '<div class="survey-options" role="group" aria-labelledby="survey-question">' +
        WELLBEING.options.map(function (option, i) {
          return '<button type="button" class="survey-option" data-option="' + i + '" aria-pressed="' + (answers[current] === i) + '">' + escapeHtml(option) + "</button>";
        }).join("") +
      "</div>" +
      '<div class="survey-nav">' +
        '<button type="button" class="btn btn-secondary survey-back"' + (current === 0 ? " disabled" : "") + ">← Назад</button>" +
        '<button type="button" class="btn btn-primary survey-next"' + (answers[current] === undefined ? " disabled" : "") + ">" +
          (last ? "Показать результат" : "Дальше →") +
        "</button>" +
      "</div>";
    if (moveFocus) focusTitle(".survey-question");
  }

  function choose(option) {
    answers[current] = option;
    box.querySelectorAll(".survey-option").forEach(function (b) {
      b.setAttribute("aria-pressed", Number(b.dataset.option) === option);
    });
    box.querySelector(".survey-next").disabled = false;
  }

  function save() {
    const error = box.querySelector(".result-save-error");
    error.textContent = "";
    Store.saveWellbeing(score).catch(function (e) {
      error.innerHTML = "Результат не сохранился: " + escapeHtml(e.message) +
        ' <button type="button" class="survey-retry">Сохранить ещё раз</button>';
    });
  }

  function showResult() {
    finished = true;
    score = answers.reduce(function (sum, a) { return sum + a; }, 0);
    const level = wellbeingLevelOf(score);
    box.innerHTML =
      '<div class="survey-head"><h2 id="survey-result" tabindex="-1">Ваш результат</h2><p>' +
        escapeHtml(new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })) + "</p></div>" +
      '<div class="result-main result-' + level.id + '">' +
        wellbeingRing(score, scoreMax) +
        "<div>" +
          '<p class="result-level">' + escapeHtml(level.title) + "</p>" +
          '<p class="result-text">' + escapeHtml(level.text) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="result-list">' + renderList(level.list) + "</div>" +
      (level.urgent
        ? '<p class="wellbeing-urgent">' + escapeHtml(WELLBEING.urgentNote) + "</p>" +
          '<p class="result-phones">' + CRISIS_PHONES.map(function (p) {
            return '<a href="tel:' + escapeHtml(p.tel) + '">' + escapeHtml(p.number) + "</a>";
          }).join('<span aria-hidden="true"> · </span>') + "</p>"
        : "") +
      '<p class="result-note">' + escapeHtml(WELLBEING.disclaimer) + "</p>" +
      '<p class="error result-save-error" role="alert"></p>' +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-secondary survey-again">Пройти ещё раз</button>' +
        '<div class="result-buttons">' + level.buttons.map(function (b, i) {
          return '<a href="' + escapeHtml(b.href) + '" class="btn ' + (i === level.buttons.length - 1 ? "btn-primary" : "btn-secondary") + '">' + escapeHtml(b.text) + "</a>";
        }).join("") + "</div>" +
      "</div>";
    focusTitle("#survey-result");
    if (user) save();
  }

  function go(index) {
    current = index;
    showQuestion(true);
  }

  box.addEventListener("click", function (e) {
    const option = e.target.closest(".survey-option");
    if (option) return choose(Number(option.dataset.option));
    if (e.target.closest(".survey-back")) return go(current - 1);
    if (e.target.closest(".survey-next")) return current === total - 1 ? showResult() : go(current + 1);
    if (e.target.closest(".survey-retry")) return save();
    if (e.target.closest(".survey-again")) {
      answers = [];
      go(0);
    }
  });

  /* Стрелки листают, цифры выбирают ответ. Результат показывает только кнопка: случайное нажатие не должно его сохранить */
  document.addEventListener("keydown", function (e) {
    if (finished || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const place = box.getBoundingClientRect();
    if (place.bottom < 0 || place.top > window.innerHeight) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (current > 0) go(current - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (current < total - 1 && answers[current] !== undefined) go(current + 1);
    } else if (/^[1-4]$/.test(e.key)) {
      e.preventDefault();
      choose(Number(e.key) - 1);
    }
  });

  showQuestion(false);
}

/* ---------- Минутка для себя: практики в окне поверх страницы ---------- */

/* Идёт по шагам [{ seconds, ... }]: onStep в начале шага, onTick — сколько секунд осталось, onDone в конце.
   Возвращает функцию «стоп» */
function runTimedSteps(steps, onStep, onTick, onDone) {
  let index = -1;
  let endsAt = 0;
  let timer = null;

  function tick() {
    const left = endsAt - Date.now();
    if (left <= 0) return next();
    onTick(Math.ceil(left / 1000));
    timer = setTimeout(tick, Math.min(200, left));
  }
  function next() {
    index++;
    if (index >= steps.length) return onDone();
    endsAt = Date.now() + steps[index].seconds * 1000;
    onStep(steps[index], index);
    tick();
  }
  next();
  return function () { clearTimeout(timer); };
}

/* Практика с кнопками «Начать»/«Стоп». Что происходит на шаге — решает сама практика: onStep и onStop.
   Возвращает функцию, которая останавливает таймер, когда окно закрывают */
function practiceTimer(body, steps, onStep, onTick, onStop, doneText) {
  const startBtn = body.querySelector(".practice-start");
  const stopBtn = body.querySelector(".practice-stop");
  let stop = null;

  function finish(text) {
    if (stop) stop();
    stop = null;
    startBtn.hidden = false;
    stopBtn.hidden = true;
    onStop(text);
  }
  startBtn.addEventListener("click", function () {
    startBtn.hidden = true;
    stopBtn.hidden = false;
    stopBtn.focus();
    stop = runTimedSteps(steps, onStep, onTick, function () {
      stop = null;
      finish(doneText);
      startBtn.focus();
    });
  });
  stopBtn.addEventListener("click", function () {
    finish("");
    startBtn.focus();
  });
  return function () { if (stop) stop(); };
}

const PRACTICE_BUTTONS =
  '<div class="buttons practice-buttons">' +
    '<button type="button" class="btn btn-primary practice-start">Начать</button>' +
    '<button type="button" class="btn btn-secondary practice-stop" hidden>Стоп</button>' +
  "</div>";

/* Каждая практика рисует себя в body и возвращает функцию остановки (или ничего) */
const PRACTICE_RUNNERS = {
  /* Дыхание 4–6: круг растёт на вдохе и сжимается на выдохе. Движение — только в CSS, его отключает prefers-reduced-motion */
  breath: function (body, practice) {
    body.insertAdjacentHTML("beforeend",
      '<div class="breath-stage">' +
        '<div class="breath-circle"></div>' +
        '<div class="breath-text">' +
          '<span class="breath-phase" aria-live="polite"></span>' +
          '<span class="practice-seconds" aria-hidden="true"></span>' +
        "</div>" +
      "</div>" +
      '<p class="selfcare-count" aria-live="polite">&nbsp;</p>' +
      PRACTICE_BUTTONS);
    const circle = body.querySelector(".breath-circle");
    const phase = body.querySelector(".breath-phase");
    const seconds = body.querySelector(".practice-seconds");
    const count = body.querySelector(".selfcare-count");
    const steps = [];
    for (let i = 1; i <= practice.rounds; i++) {
      steps.push({ seconds: 4, label: "Вдох", cls: "is-in", round: i }, { seconds: 6, label: "Выдох", cls: "is-out", round: i });
    }
    return practiceTimer(body, steps, function (step) {
      circle.className = "breath-circle " + step.cls;
      phase.textContent = step.label;
      count.textContent = step.round + " из " + practice.rounds;
    }, function (left) {
      seconds.textContent = left;
    }, function (text) {
      circle.className = "breath-circle";
      phase.textContent = text;
      seconds.textContent = "";
      count.innerHTML = "&nbsp;";
    }, "Готово");
  },

  /* Квадратное дыхание: точка идёт вдоль сторон квадрата, текущая сторона подписана */
  square: function (body, practice) {
    body.insertAdjacentHTML("beforeend",
      '<div class="square-stage">' +
        '<span class="square-label square-label-0">Вдох</span>' +
        '<span class="square-label square-label-1">Пауза</span>' +
        '<span class="square-label square-label-2">Выдох</span>' +
        '<span class="square-label square-label-3">Пауза</span>' +
        '<div class="square-box">' +
          '<div class="square-dot"></div>' +
          '<div class="square-text">' +
            '<span class="breath-phase" aria-live="polite"></span>' +
            '<span class="practice-seconds" aria-hidden="true"></span>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<p class="selfcare-count" aria-live="polite">&nbsp;</p>' +
      PRACTICE_BUTTONS);
    const stage = body.querySelector(".square-stage");
    const dot = body.querySelector(".square-dot");
    const phase = body.querySelector(".breath-phase");
    const seconds = body.querySelector(".practice-seconds");
    const count = body.querySelector(".selfcare-count");
    const steps = [];
    for (let i = 1; i <= practice.rounds; i++) {
      ["Вдох", "Пауза", "Выдох", "Пауза"].forEach(function (label, side) {
        steps.push({ seconds: 4, label: label, side: side, round: i });
      });
    }
    return practiceTimer(body, steps, function (step) {
      dot.className = "square-dot square-dot-" + step.side;
      stage.dataset.side = step.side;
      phase.textContent = step.label;
      count.textContent = "Круг " + step.round + " из " + practice.rounds;
    }, function (left) {
      seconds.textContent = left;
    }, function (text) {
      dot.className = "square-dot";
      delete stage.dataset.side;
      phase.textContent = text;
      seconds.textContent = "";
      count.innerHTML = "&nbsp;";
    }, "Готово");
  },

  /* 5-4-3-2-1: шаги по одному, кнопка «Дальше» */
  steps: function (body, practice) {
    body.insertAdjacentHTML("beforeend",
      '<div class="practice-panel">' +
        '<p class="selfcare-count"></p>' +
        '<p class="practice-step" tabindex="-1" aria-live="polite"></p>' +
      "</div>" +
      '<div class="buttons practice-buttons"><button type="button" class="btn btn-primary practice-next">Дальше</button></div>');
    const count = body.querySelector(".selfcare-count");
    const text = body.querySelector(".practice-step");
    const next = body.querySelector(".practice-next");
    let index = 0;

    function show() {
      if (index < practice.steps.length) {
        count.textContent = "Шаг " + (index + 1) + " из " + practice.steps.length;
        text.textContent = practice.steps[index];
      } else {
        count.textContent = "";
        text.textContent = practice.ending;
        next.textContent = "Начать сначала";
      }
    }
    next.addEventListener("click", function () {
      if (index >= practice.steps.length) {
        index = 0;
        next.textContent = "Дальше";
      } else {
        index++;
      }
      show();
    });
    show();
  },

  /* Сжать и отпустить: таймер по частям тела */
  tense: function (body, practice) {
    body.insertAdjacentHTML("beforeend",
      '<div class="practice-panel">' +
        '<p class="selfcare-count">&nbsp;</p>' +
        '<p class="practice-step" aria-live="polite">Кисти, плечи, лицо, живот, стопы</p>' +
        '<p class="practice-phase" aria-live="polite">&nbsp;</p>' +
        '<p class="practice-seconds practice-seconds-big" aria-hidden="true">&nbsp;</p>' +
      "</div>" +
      PRACTICE_BUTTONS);
    const count = body.querySelector(".selfcare-count");
    const part = body.querySelector(".practice-step");
    const phase = body.querySelector(".practice-phase");
    const seconds = body.querySelector(".practice-seconds");
    const steps = [];
    practice.parts.forEach(function (p, i) {
      steps.push(
        { seconds: 5, label: "Напрягите", part: p, number: i + 1, tense: true },
        { seconds: 10, label: "Отпустите", part: p, number: i + 1 }
      );
    });
    return practiceTimer(body, steps, function (step) {
      count.textContent = "Шаг " + step.number + " из " + practice.parts.length;
      part.textContent = step.part;
      phase.textContent = step.label;
      phase.classList.toggle("is-tense", Boolean(step.tense));
    }, function (left) {
      seconds.textContent = left;
    }, function (text) {
      count.innerHTML = "&nbsp;";
      part.textContent = text || "Кисти, плечи, лицо, живот, стопы";
      phase.innerHTML = "&nbsp;";
      phase.classList.remove("is-tense");
      seconds.innerHTML = "&nbsp;";
    }, "Готово");
  },

  /* Пауза для себя: три поля. Что написано, нигде не сохраняется */
  pause: function (body, practice) {
    body.insertAdjacentHTML("beforeend",
      '<form class="practice-pause">' +
        [1, 2, 3].map(function (n) {
          return '<label for="pause-' + n + '" class="visually-hidden">Сегодня я, запись ' + n + "</label>" +
            '<input type="text" id="pause-' + n + '" placeholder="Сегодня я…" autocomplete="off" maxlength="200">';
        }).join("") +
        '<div class="buttons practice-buttons"><button type="submit" class="btn btn-primary">Готово</button></div>' +
        '<p class="practice-praise" role="status"></p>' +
      "</form>");
    const form = body.querySelector(".practice-pause");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelector(".practice-praise").textContent = practice.praise;
    });
  }
};

/* Значки плиток практик */
const PRACTICE_ICONS = {
  breath: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  steps: '<text x="12" y="17.5" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor" stroke="none">5</text>',
  tense: '<path d="M7 11.5V8a1.5 1.5 0 0 1 3 0v3m0-1V6.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V11m0-2a1.5 1.5 0 0 1 3 0v5.5a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 15v-1a2.5 2.5 0 0 1 2.5-2.5H12"/>',
  pause: '<path d="M5 9h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3.5v2.5M13 3.5v2.5"/>'
};

/* Плитки «Минутки для себя»: практики и видео. И то и другое открывается в окне поверх страницы */
function setupSelfCare() {
  const list = document.getElementById("practice-list");
  if (!list) return;

  const videos = lessonVideos({ videos: SUPPORT_VIDEOS });

  list.innerHTML =
    PRACTICES.map(function (p, i) {
      return '<li><button type="button" class="support-tile" data-practice="' + i + '" aria-haspopup="dialog">' +
        '<span class="support-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + PRACTICE_ICONS[p.type] + "</svg></span>" +
        '<span class="support-tile-title">' + escapeHtml(p.title) + "</span>" +
        '<span class="support-tile-time">' + escapeHtml(p.time) + "</span>" +
        '<span class="support-tile-start">Начать →</span>' +
      "</button></li>";
    }).join("") +
    videos.map(function (v, i) {
      return '<li class="support-tile-video-item"><button type="button" class="support-tile support-tile-video" data-video="' + i + '" aria-haspopup="dialog">' +
        '<span class="support-video-preview" aria-hidden="true"><span class="support-video-play"><svg viewBox="0 0 24 24" focusable="false"><path d="M8 5l11 7-11 7z"/></svg></span></span>' +
        '<span class="support-video-caption">' +
          '<span class="support-tile-title">' + escapeHtml(v.short || v.title) + "</span>" +
          '<span class="support-tile-time">Видео · ' + escapeHtml(v.source) + "</span>" +
        "</span>" +
      "</button></li>";
    }).join("");

  // Окно памятки урока, только с другим содержимым
  const dialog = document.createElement("dialog");
  dialog.className = "lesson-modal practice-modal";
  dialog.setAttribute("aria-labelledby", "practice-modal-title");
  dialog.innerHTML =
    '<div class="lesson-modal-box">' +
      '<div class="lesson-modal-head">' +
        '<h2 id="practice-modal-title"></h2>' +
        '<button type="button" class="lesson-modal-close" aria-label="Закрыть окно">✕</button>' +
      "</div>" +
      '<div class="lesson-modal-body"></div>' +
    "</div>";
  document.body.appendChild(dialog);

  const body = dialog.querySelector(".lesson-modal-body");
  let opener = null;
  let stopPractice = null;
  let pressedOutside = false;

  function show(title, isVideo) {
    dialog.querySelector("h2").textContent = title;
    dialog.classList.toggle("video-modal", isVideo);
    document.documentElement.classList.add("modal-open");
    dialog.showModal();
    dialog.querySelector(".lesson-modal-close").focus();
  }

  list.addEventListener("click", function (e) {
    opener = e.target.closest(".support-tile");
    if (!opener) return;
    if (opener.dataset.video !== undefined) {
      const video = videos[Number(opener.dataset.video)];
      body.innerHTML = videoModalHtml(video);
      show(video.title, true);
      return;
    }
    const practice = PRACTICES[Number(opener.dataset.practice)];
    body.innerHTML = '<p class="practice-intro">' + escapeHtml(practice.text) + "</p>";
    stopPractice = PRACTICE_RUNNERS[practice.type](body, practice);
    show(practice.title + " · " + practice.time, false);
  });

  // Крестик, Esc или щелчок по фону: таймер останавливается, плеер убирается вместе с содержимым окна
  dialog.addEventListener("close", function () {
    if (stopPractice) stopPractice();
    stopPractice = null;
    body.innerHTML = "";
    document.documentElement.classList.remove("modal-open");
    if (opener) opener.focus();
  });
  dialog.querySelector(".lesson-modal-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("pointerdown", function (e) { pressedOutside = e.target === dialog; });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog && pressedOutside) dialog.close();
  });
}

/* ---------- ИИ-консультант (consultant.html) — демо без ИИ ---------- */

/* Слова сообщения в «поисковом» виде: маленькие буквы, ё → е, без знаков препинания */
function messageWords(text) {
  return normalizeText(text).split(/[^a-zа-я0-9]+/).filter(Boolean);
}

/* Совпадает ли ключевое слово с вопросом.
   Фраза из нескольких слов ищется целиком, одно слово — как начало любого слова вопроса
   ("ожог" найдёт «ожога», но "ран" не найдёт «раненый», если писать "рана"/"раны"). */
function keywordMatches(keyword, words, joined) {
  const k = normalizeText(keyword);
  if (k.indexOf(" ") !== -1) return joined.indexOf(k) !== -1;
  return words.some(function (w) { return w.indexOf(k) === 0; });
}

/* Тревожная фраза ищется с запасом на окончания: у длинных слов последние две буквы
   не учитываются. Так «кровотечение» найдёт и «кровотечения», а «потерял сознание» —
   «потеряла сознание». Слова фразы должны идти подряд. Лучше лишний раз показать 112,
   чем пропустить опасную ситуацию. */
function alarmMatches(phrase, words) {
  const parts = messageWords(phrase).map(function (w) {
    return w.length > 5 ? w.slice(0, -2) : w;
  });
  for (let i = 0; i + parts.length <= words.length; i++) {
    const fits = parts.every(function (p, j) { return words[i + j].indexOf(p) === 0; });
    if (fits) return true;
  }
  return false;
}

/* Подбор ответа по data.js. Возвращает один из вариантов:
   { type: "alarm" } | { type: "answer", text, topicId } | { type: "fallback" } */
function findConsultantAnswer(question) {
  const joined = " " + messageWords(question).join(" ") + " ";
  const words = messageWords(question);

  // 1) Тревожные слова важнее всего
  const alarm = CONSULTANT.alarmWords.some(function (phrase) { return alarmMatches(phrase, words); });
  if (alarm) return { type: "alarm" };

  // 2) Ответ, у которого совпало больше всего ключевых слов
  let best = null;
  let bestScore = 0;
  CONSULTANT.answers.forEach(function (a) {
    const score = a.keywords.filter(function (k) { return keywordMatches(k, words, joined); }).length;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  });
  if (best) return { type: "answer", text: best.text, topicId: best.topicId };

  // 3) Ничего не нашли
  return { type: "fallback" };
}

/* ЕДИНСТВЕННОЕ место, где появляется ответ консультанта.
   • Сайт открыт через сервер (npm start) — вопрос уходит на сервер (/api/consultant),
     там ИИ Яндекса отвечает по материалам школы.
   • Сайт открыт файлом без сервера — упрощённые ответы по ключевым словам из data.js (как раньше).
   Возвращает Promise с объектом:
     { type: "crisis" | "alarm" | "answer" | "unavailable", mode, answer, sources, phones } — ответ сервера,
     { type: "error", text } — ошибка (не вошли, слишком длинно, нет связи…),
     или старый вид от findConsultantAnswer — без сервера. */
function getConsultantReply(question, history, mode) {
  if (Store.getMode() === "server") {
    return fetch("/api/consultant", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history: history, mode: mode })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) return { type: "error", text: data.error || "Консультант сейчас недоступен. Попробуйте чуть позже." };
        return data;
      });
    }).catch(function () {
      return { type: "error", text: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз." };
    });
  }
  const delay = 500 + Math.random() * 500; // 0,5–1 секунда
  return new Promise(function (resolve) {
    setTimeout(function () { resolve(findConsultantAnswer(question)); }, delay);
  });
}

/* Текст ответа ИИ → абзацы (пустая строка — новый абзац, перенос строки — <br>) */
/* Номер фонда в готовом ответе — ссылкой tel:, как на странице «Поддержка» */
function linkFundPhone(html) {
  const phone = CRISIS_PHONES.find(function (p) { return p.tel === "117"; });
  return html.split(escapeHtml(phone.number)).join('<a href="tel:' + escapeHtml(phone.tel) + '">' + escapeHtml(phone.number) + "</a>");
}

function formatAnswer(text) {
  return String(text || "")
    .replace(/\*\*/g, "")                       // жирный из Markdown просто убираем
    .split(/\n\s*\n/)
    .map(function (p) { return p.trim(); })
    .filter(Boolean)
    .map(function (p) { return "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>"; })
    .join("");
}

/* Адрес темы из ответа сервера: только страница урока или статьи */
function sourceUrl(source) {
  return /^((lesson|article)\.html\?id=[\w-]+|rights\.html)$/.test(source.url || "") ? source.url : "lesson.html?id=" + encodeURIComponent(source.topicId);
}

/* «Источники: урок «Ожоги», статья «Выплаты и льготы»» */
function sourcesHtml(sources) {
  if (!sources || !sources.length) return "";
  return '<p class="msg-sources">Источники: ' + sources.map(function (s) {
    return (s.kind === "article" ? "статья" : "урок") + ' <a href="' + sourceUrl(s) + '">«' + escapeHtml(s.title) + "»</a>";
  }).join(", ") + "</p>";
}

/* Кнопки под ответом: предложенные темы. Тем нет — «Все уроки» (но не в разговоре о самочувствии) */
function topicLinksHtml(reply) {
  const sources = reply.sources || [];
  if (!sources.length && reply.mode === "support") return "";
  return '<div class="msg-links">' +
    (sources.length
      ? sources.map(function (s) {
          return '<a href="' + sourceUrl(s) + '" class="btn btn-small btn-secondary">' + escapeHtml(s.title) + "</a>";
        }).join("")
      : '<a href="lessons.html" class="btn btn-small btn-secondary">Все уроки</a>') +
  "</div>";
}

/* Режимы консультанта: кнопки над чатом. Выбранный режим уходит на сервер полем mode и помнится до перезагрузки */
const CONSULTANT_MODES = [
  { id: "urgent", label: "Срочный вопрос по уходу",
    greeting: "Опишите, что происходит. Отвечу коротко: что делать сейчас и когда звонить врачу." },
  { id: "support", label: "Мне тяжело, хочу поговорить",
    greeting: "Можно просто рассказать, как вы. Я выслушаю. Я не психолог, но помогу найти, куда обратиться, если нужно." },
  { id: "care", label: "Вопрос по урокам", greeting: "" }  // пусто — обычное приветствие CONSULTANT.greeting
];

/* Чат консультанта — один и тот же и на странице consultant.html, и в окне на главной:
   сообщения, запрос к серверу (или ответы по ключевым словам без него), тревожные ответы, источники.
   parts — { log, form, input, send } */
function createConsultantChat(parts) {
  const chat = parts.log;
  const input = parts.input;
  const sendBtn = parts.send;
  const serverMode = Store.getMode() === "server";
  const history = [];  // последние реплики для сервера: [{ role: "user"|"assistant", content }]
  let busy = false;
  let mode = parts.mode || "care";

  function addMessage(who, html, extraClass) {
    const msg = document.createElement("div");
    msg.className = "msg msg-" + who + (extraClass ? " " + extraClass : "");
    msg.innerHTML =
      '<span class="visually-hidden">' + (who === "user" ? "Вы:" : "Консультант:") + "</span>" + html;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
    return msg;
  }

  function topicButtons(topicId) {
    const topic = TOPICS.find(function (t) { return t.id === topicId; });
    if (!topic) return "";
    // У урока — «Открыть урок», у темы справочника — только памятка и статья
    if (!isLesson(topic)) {
      return (
        '<div class="msg-links">' +
          '<a href="' + memoLink(topic) + '" class="btn btn-small btn-primary">Памятка</a>' +
          '<a href="' + topicLink("article.html", topic) + '" class="btn btn-small btn-secondary">Статья</a>' +
          (topic.section === "legal"
            ? '<a href="rights.html" class="btn btn-small btn-secondary">Права и документы</a>'
            : "") +
        "</div>"
      );
    }
    return (
      '<div class="msg-links">' +
        '<a href="' + topicLink("lesson.html", topic) + '" class="btn btn-small btn-primary">Открыть урок</a>' +
        '<a href="' + memoLink(topic) + '" class="btn btn-small btn-secondary">Памятка</a>' +
        '<a href="' + topicLink("article.html", topic) + '" class="btn btn-small btn-secondary">Статья</a>' +
      "</div>"
    );
  }

  function replyHtml(reply) {
    // Ответы сервера (ИИ)
    if (serverMode && reply.type === "crisis") {
      return formatAnswer(reply.answer) + '<div class="crisis-phones">' +
        (reply.phones || []).map(function (p) {
          return '<a href="tel:' + escapeHtml(p.tel) + '" class="alarm-phone">' + escapeHtml(p.number) + "</a>";
        }).join("") +
      "</div>";
    }
    if (serverMode && reply.type === "alarm") {
      return (
        formatAnswer(reply.answer).replace("<p>", '<p class="alarm-text">') +
        '<a href="tel:103" class="alarm-phone">Позвонить 103</a>' +
        '<a href="tel:112" class="alarm-phone">Позвонить 112</a>' +
        sourcesHtml(reply.sources)
      );
    }
    if (reply.type === "error") return "<p>" + escapeHtml(reply.text) + "</p>";
    if (serverMode) return linkFundPhone(formatAnswer(reply.answer)) + topicLinksHtml(reply);

    // Без сервера — как раньше
    if (reply.type === "alarm") {
      return (
        '<p class="alarm-text">' + escapeHtml(CONSULTANT.alarmText) + "</p>" +
        '<a href="tel:112" class="alarm-phone">Позвонить 112</a>'
      );
    }
    if (reply.type === "answer") {
      return "<p>" + escapeHtml(reply.text) + "</p>" + topicButtons(reply.topicId);
    }
    return (
      "<p>" + escapeHtml(CONSULTANT.fallback) + "</p>" +
      '<div class="msg-links"><a href="' + escapeHtml(CONSULTANT.fallbackLink.url) +
        '" class="btn btn-small btn-secondary">' + escapeHtml(CONSULTANT.fallbackLink.title) + "</a></div>"
    );
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
  }

  function ask(question) {
    question = question.trim();
    if (!question || busy) return;
    if (question.length > 500) {
      addMessage("bot", "<p>Вопрос слишком длинный: не больше 500 символов. Сократите его, пожалуйста.</p>");
      return;
    }

    setBusy(true);
    addMessage("user", "<p>" + escapeHtml(question) + "</p>");
    input.value = "";

    const typing = addMessage("bot", '<p class="typing">Консультант думает…</p>', "msg-typing");

    getConsultantReply(question, history.slice(-6), mode).then(function (reply) {
      typing.remove();
      addMessage("bot", replyHtml(reply), reply.type === "alarm" ? "msg-alarm" : reply.type === "crisis" ? "msg-crisis" : "");
      if (serverMode && reply.type !== "error") {
        history.push({ role: "user", content: question }, { role: "assistant", content: reply.answer || "" });
        history.splice(0, Math.max(0, history.length - 6));
      }
      setBusy(false);
    });
  }

  // Отправка кнопкой и клавишей Enter (Enter в поле формы отправляет её сам)
  parts.form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
    input.focus();
  });

  /* Кнопки режимов над чатом. Они нужны только там, где отвечает сервер и человек вошёл.
     Смена режима начинает разговор заново: прошлые реплики на сервер не уходят, иначе модель подхватит прежний тон */
  function showModes(onChange) {
    if (!serverMode || !getCurrentUser()) return;
    const bar = document.createElement("div");
    bar.className = "chat-modes";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "О чём хотите спросить");
    bar.innerHTML = CONSULTANT_MODES.map(function (m) {
      return '<button type="button" class="chat-mode" data-mode="' + m.id + '" aria-pressed="' + (m.id === mode) + '">' + escapeHtml(m.label) + "</button>";
    }).join("");
    chat.parentNode.insertBefore(bar, chat);
    bar.addEventListener("click", function (e) {
      const button = e.target.closest(".chat-mode");
      if (!button || button.dataset.mode === mode) return;
      mode = button.dataset.mode;
      history.length = 0;
      bar.querySelectorAll(".chat-mode").forEach(function (b) { b.setAttribute("aria-pressed", b === button); });
      const chosen = CONSULTANT_MODES.find(function (m) { return m.id === mode; });
      addMessage("bot", "<p>" + escapeHtml(chosen.greeting || CONSULTANT.greeting) + "</p>");
      if (onChange) onChange(mode);
    });
  }

  return { addMessage: addMessage, ask: ask, setBusy: setBusy, replyHtml: replyHtml, showModes: showModes, serverMode: serverMode };
}

function setupConsultantPage() {
  const log = document.getElementById("chat-log");
  if (!log) return;

  const input = document.getElementById("chat-input");
  const hintsBox = document.getElementById("chat-hints");
  // consultant.html?mode=support — сразу нужный режим. Неизвестный режим — обычный
  const modeParam = new URLSearchParams(location.search).get("mode");
  const startMode = CONSULTANT_MODES.find(function (m) { return m.id === modeParam; });
  const chat = createConsultantChat({
    log: log,
    form: document.getElementById("chat-form"),
    input: input,
    send: document.getElementById("chat-send"),
    mode: startMode ? startMode.id : "care"
  });
  const serverMode = chat.serverMode;

  document.getElementById("chat-mode").textContent = serverMode
    ? "Ответы готовит ИИ по материалам уроков и справочника школы."
    : "Сайт открыт без сервера: консультант отвечает упрощённо, по ключевым словам.";

  // Первое сообщение консультанта: у выбранного режима оно своё, а гостю пока нужно только войти
  const needsLogin = serverMode && !getCurrentUser();
  chat.addMessage("bot", "<p>" + escapeHtml(!needsLogin && startMode && startMode.greeting || CONSULTANT.greeting) + "</p>");

  // Через сервер консультант работает только для вошедших
  if (needsLogin) {
    chat.addMessage("bot",
      "<p>Чтобы задать вопрос, войдите или зарегистрируйтесь.</p>" +
      '<div class="msg-links">' +
        '<a href="' + loginLinkBack() + '" class="btn btn-small btn-primary">Войти</a>' +
        '<a href="login.html?tab=register&amp;back=' + encodeURIComponent(location.pathname.split("/").pop() + location.search) +
          '" class="btn btn-small btn-secondary">Зарегистрироваться</a>' +
      "</div>");
    chat.setBusy(true);
    input.disabled = true;
    hintsBox.hidden = true;
    return;
  }

  // Примеры вопросов подходят только к вопросам по урокам
  chat.showModes(function (mode) { hintsBox.hidden = mode !== "care"; });
  hintsBox.hidden = Boolean(startMode) && startMode.id !== "care";

  // Кнопки-подсказки отправляют свой текст как вопрос
  hintsBox.addEventListener("click", function (e) {
    const hint = e.target.closest(".chat-hint");
    if (hint) chat.ask(hint.textContent);
  });

  // consultant.html?topic=burns — сразу спросить про тему и показать ответ именно по ней
  const topicId = new URLSearchParams(location.search).get("topic");
  const topic = TOPICS.find(function (t) { return t.id === topicId; });
  if (topic && serverMode) {
    chat.ask("Расскажите коротко главное по теме «" + topic.title + "»");
  } else if (topic) {
    const answer = CONSULTANT.answers.find(function (a) { return a.topicId === topic.id; });
    chat.setBusy(true);
    chat.addMessage("user", "<p>" + escapeHtml("Расскажите про тему: " + topic.title) + "</p>");
    const typing = chat.addMessage("bot", '<p class="typing">Консультант думает…</p>', "msg-typing");
    setTimeout(function () {
      typing.remove();
      chat.addMessage("bot", chat.replyHtml(answer
        ? { type: "answer", text: answer.text, topicId: topic.id }
        : { type: "answer", text: topic.description, topicId: topic.id }));
      chat.setBusy(false);
    }, 700);
  }
}

/* Виджет консультанта на главной: круглая кнопка в углу и окно чата. Без входа окно предлагает войти */
function setupConsultantWidget() {
  if (document.body.dataset.page !== "home") return;

  const box = document.createElement("div");
  box.innerHTML =
    '<button type="button" class="btn btn-primary chat-fab" aria-label="Открыть консультанта" aria-haspopup="dialog" aria-expanded="false" aria-controls="chat-widget">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h0A1.5 1.5 0 0 1 4 15.5z"/><path d="M8 9h8M8 12.5h5"/></svg>' +
    "</button>" +
    '<section class="chat-widget" id="chat-widget" role="dialog" aria-labelledby="chat-widget-title" hidden>' +
      '<div class="chat-widget-head">' +
        '<h2 id="chat-widget-title">Консультант</h2>' +
        '<button type="button" class="chat-widget-close" aria-label="Закрыть консультанта">×</button>' +
      "</div>" +
      '<p class="chat-widget-note">Отвечает по материалам школы, может ошибаться и не заменяет врача. ' +
        'При опасности звоните <a href="tel:103">103</a> или <a href="tel:112">112</a></p>' +
      '<div class="chat-log" role="log" aria-live="polite" aria-label="Переписка с консультантом"></div>' +
      '<form class="chat-form">' +
        '<label for="chat-widget-input" class="visually-hidden">Ваш вопрос</label>' +
        '<input type="text" id="chat-widget-input" placeholder="Напишите вопрос…" autocomplete="off" maxlength="500">' +
        '<button type="submit" class="btn btn-small btn-primary">Отправить</button>' +
      "</form>" +
    "</section>";
  while (box.firstChild) document.body.appendChild(box.firstChild);

  const fab = document.querySelector(".chat-fab");
  const widget = document.getElementById("chat-widget");
  const form = widget.querySelector(".chat-form");
  const input = widget.querySelector("input");
  const log = widget.querySelector(".chat-log");

  const chat = createConsultantChat({ log: log, form: form, input: input, send: form.querySelector("button") });
  const guest = !getCurrentUser();
  if (guest) {
    form.hidden = true;
    chat.addMessage("bot",
      "<p>Чтобы задать вопрос, войдите в аккаунт</p>" +
      '<div class="msg-links"><a href="' + loginLinkBack() + '" class="btn btn-small btn-primary">Войти</a></div>');
  } else {
    chat.addMessage("bot", "<p>" + escapeHtml(CONSULTANT.greeting) + "</p>");
    chat.showModes();
  }

  function setOpen(open) {
    widget.hidden = !open;
    fab.hidden = open;
    fab.setAttribute("aria-expanded", open);
    if (open) {
      log.scrollTop = log.scrollHeight;
      (guest ? log.querySelector("a") : input).focus();
    } else {
      fab.focus();
    }
  }

  fab.addEventListener("click", function () { setOpen(true); });
  widget.querySelector(".chat-widget-close").addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !widget.hidden) setOpen(false);
  });
}

/* ---------- Права и документы (rights.html) ---------- */

/* Текст карточки для поиска: название, ключевые слова и все блоки */
function rightsSearchText(item) {
  return normalizeText([item.title, item.what, item.where, item.entitled]
    .concat(item.keywords || [], item.documents || [], item.steps || [])
    .join(" "));
}

/* Подробности элемента: блоки для окна поверх страницы */
function rightsDetailsHtml(item) {
  const source = item.source || {};
  const validUrl = /^https?:\/\//i.test(source.url || "");

  function block(title, content) {
    return content ? '<div class="rights-block"><h3>' + title + "</h3>" + content + "</div>" : "";
  }
  function para(text) { return text ? "<p>" + escapeHtml(text) + "</p>" : ""; }

  return (
    block("Что это", para(item.what)) +
    block("Куда обратиться", para(item.where)) +
    block("Какие документы нужны", hasItems(item.documents) ? renderList(item.documents) : "") +
    block("Что положено", para(item.entitled)) +
    block("Что делать по шагам", hasItems(item.steps) ? renderList(item.steps, "ol") : "") +
    block("Где проверить",
      // Название источника: ссылкой, если адрес есть, иначе текстом
      (source.title || validUrl
        ? "<p>" + sourceHtml(source) + "</p>"
        : '<p class="muted">Источник уточняется</p>') +
      '<p class="muted">Проверено: ' + escapeHtml(item.checked || "дата уточняется") + "</p>")
  );
}

/* Строка элемента: название, действие серым, круглая кнопка со стрелкой. Кликабельна вся строка */
function renderRightsRow(item) {
  return (
    '<button type="button" class="rights-row" data-id="' + escapeHtml(item.id) + '" aria-haspopup="dialog">' +
      '<span class="rights-row-text">' +
        '<span class="rights-row-title">' + escapeHtml(item.title) + "</span>" +
        '<span class="rights-row-action">Подробнее</span>' +
      "</span>" +
      '<span class="rights-row-arrow" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
      "</span>" +
    "</button>"
  );
}

function setupRightsPage() {
  const list = document.getElementById("rights-list");
  if (!list) return;

  const input = document.getElementById("rights-search");
  const openModal = createPageModal();

  function show() {
    const words = normalizeText(input.value).split(" ").filter(Boolean);
    const found = RIGHTS.filter(function (item) {
      const text = rightsSearchText(item);
      return words.every(function (w) { return text.indexOf(w) !== -1; });
    });

    list.innerHTML = found.length
      ? found.map(renderRightsRow).join("")
      : '<div class="card empty-result"><p><strong>Ничего не найдено.</strong> ' +
        "Попробуйте другое слово, например «инвалидность», «протез» или «выплаты», " +
        'или <a href="consultant.html">спросите консультанта</a>.</p></div>';
  }

  list.addEventListener("click", function (e) {
    const row = e.target.closest(".rights-row");
    if (!row) return;
    const item = RIGHTS.find(function (r) { return r.id === row.dataset.id; });
    openModal(item.title, rightsDetailsHtml(item), row);
  });

  input.addEventListener("input", show);
  show();
}

/* Словарь сокращений под сеткой. Номер телефона берётся из js/phones.js */
function renderGlossary() {
  const list = document.getElementById("glossary-list");
  if (!list) return;
  list.innerHTML = GLOSSARY.map(function (item) {
    const phone = CRISIS_PHONES.find(function (p) { return p.tel === item.phone; });
    return (
      "<div>" +
        "<dt>" + escapeHtml(item.term) + "</dt>" +
        "<dd>" + escapeHtml(item.text) +
          (phone ? ' Телефон: <a href="tel:' + escapeHtml(phone.tel) + '">' + escapeHtml(phone.number) + "</a>" : "") +
        "</dd>" +
      "</div>"
    );
  }).join("");
}

/* ---------- Запуск ---------- */

document.addEventListener("DOMContentLoaded", function () {
  Store.ready.then(startPage);
});

function startPage() {
  renderHeader();
  renderFileWarning();
  renderFooter();
  renderSections();
  renderHomeStartButton();
  setupLoginPage();
  renderLessonsPage();
  renderCabinetPage();
  renderLessonPage();
  renderPracticePage();
  renderTestPage();
  setupRightsPage();
  renderGlossary();
  setupReferencePage();
  setupVideosPage();
  renderArticlesPage();
  setupFaqPage();
  renderArticlePage();
  renderSupportBanner();
  renderSupportContacts();
  setupWellbeingSurvey();
  setupSelfCare();
  setupConsultantPage();
  setupConsultantWidget();
}
