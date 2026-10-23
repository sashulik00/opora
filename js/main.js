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

/* Порог зачёта PASS_RATE (0.7 = 70%) задан в js/data.js, рядом с placeholderQuiz */

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
        { href: "faq.html", text: "Частые вопросы", page: "faq" },
        { href: "rights.html", text: "Права и документы", page: "rights" }
      ]
    },
    { href: "consultant.html", text: "Консультант", page: "consultant" },
    { href: "help.html", text: "Помощь", page: "help" },
    user
      ? { href: "cabinet.html", text: user.name, page: "cabinet" }
      : { href: "login.html", text: "Войти", page: "login" }
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

  // login.html?tab=register — сразу открыть вкладку «Регистрация» (кнопка из кабинета)
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

/* Сколько уроков пройдено по сохранённому прогрессу.
   Считаются только уроки: старые записи по темам справочника остаются в памяти, но не учитываются */
function countPassed(progress) {
  return LESSONS.filter(function (t) {
    return progress[t.id] && progress[t.id].passed;
  }).length;
}

/* Полоса прогресса «Пройдено N из M» — общая для «Уроков» и кабинета.
   suffix — слово после числа, например « уроков» */
function renderProgressBar(progress, suffix) {
  const passedCount = countPassed(progress);
  const percent = Math.round((passedCount / LESSONS.length) * 100);
  return (
    '<div class="card progress-card">' +
      '<p class="progress-text">Пройдено <strong>' + passedCount + "</strong> из " + LESSONS.length + (suffix || "") + "</p>" +
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

/* Список всех уроков по разделам: номер, название, описание, статус и лучший результат.
   Разделы без уроков (сейчас «Социально-правовая помощь») не показываются */
function renderLessonCards(progress) {
  let html = "";
  SECTIONS.forEach(function (section) {
    if (!LESSONS.some(function (t) { return t.section === section.id; })) return;

    html += '<h2 class="lessons-section-title" id="' + section.id + '">' + escapeHtml(section.title) + "</h2>";
    html += '<div class="lessons-grid">';

    LESSONS.forEach(function (topic, index) {
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
  return html;
}

/* ---------- Личный кабинет ---------- */

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
  const next = LESSONS.find(function (t) { return !(progress[t.id] && progress[t.id].passed); });

  page.innerHTML =
    "<h1>Здравствуйте, " + escapeHtml(user.name) + "!</h1>" +
    renderProgressBar(progress, " уроков") +

    '<div class="cabinet-next">' +
      (next
        ? '<a href="lesson.html?id=' + encodeURIComponent(next.id) + '" class="btn btn-primary">Продолжить</a>' +
          '<p class="muted">Следующий урок: ' + escapeHtml(next.title) + "</p>"
        : '<p class="success">Вы прошли все уроки</p>' +
          '<a href="lessons.html" class="btn btn-primary">К списку уроков</a>') +
    "</div>" +

    '<h2 class="lesson-h2">Мои уроки</h2>' +
    renderLessonCards(progress) +

    '<h2 class="lesson-h2">Мои данные</h2>' +
    '<div class="card cabinet-data">' +
      '<p><span class="muted">Имя:</span> <strong>' + escapeHtml(user.name) + "</strong></p>" +
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

  document.getElementById("cabinet-logout").addEventListener("click", function () {
    logoutUser();
    location.href = "index.html";
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
    localStorage.removeItem(progressKey(user)); // только прогресс этого пользователя
    renderCabinetPage();
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

  document.title = topic.title + " — Опора. Школа ухода";

  page.innerHTML =
    '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
      '<a href="lessons.html">Уроки</a> <span aria-hidden="true">→</span> ' +
      '<span aria-current="page">' + escapeHtml(topic.title) + "</span>" +
    "</nav>" +

    '<p class="lesson-num">Урок ' + (index + 1) + " · " + escapeHtml(section.title) + "</p>" +
    "<h1>" + escapeHtml(topic.title) + "</h1>" +
    '<p class="lead">' + escapeHtml(topic.description) + "</p>" +

    renderIntro(topic) +   // вводный текст — над видео
    renderVideo(topic) +
    renderDetails(topic) +
    renderMemo(topic.lessonMemo, section, true) +

    // Тест — на отдельной странице test.html
    '<h2 class="lesson-h2">Проверь себя</h2>' +
    '<div class="card test-start">' +
      "<p>Вопросов в тесте: " + topic.quiz.length + ". Для зачёта нужно не меньше " +
        Math.round(PASS_RATE * 100) + "% верных ответов.</p>" +
      '<a href="' + topicTestLink(topic) + '" class="btn btn-primary">Приступить к тесту</a>' +
      (record ? renderBestResult(record) : "") +
      (!user
        ? '<p class="hint">Тест можно пройти и без входа, но результат не сохранится. ' +
          '<a href="' + loginLinkBack() + '">Войти</a></p>'
        : "") +
    "</div>" +

    renderSources(topic) +

    '<div class="consult-box">' +
      '<a href="consultant.html?topic=' + encodeURIComponent(topic.id) + '" class="btn btn-secondary">Спросить консультанта по этой теме</a>' +
    "</div>";
}

function topicTestLink(topic) {
  return "test.html?topic=" + encodeURIComponent(topic.id);
}

/* «Лучший результат: 8 из 10 (80%) — урок пройден ✓» */
function renderBestResult(record) {
  const percent = record.total ? Math.round(record.best / record.total * 100) : 0;
  return (
    '<p class="best-result">Лучший результат: ' + record.best + " из " + record.total + " (" + percent + "%)" +
      (record.passed ? ' — <span class="status status-done">урок пройден ✓</span>' : "") +
    "</p>"
  );
}

/* Сообщение для темы справочника, открытой как урок или тест */
function renderNotALesson(topic) {
  return (
    '<div class="card">' +
      "<h1>" + escapeHtml(topic.title) + "</h1>" +
      "<p>Эта тема есть только в справочнике: урока и теста по ней нет.</p>" +
      '<div class="buttons">' +
        '<a href="' + topicLink("memo.html", topic) + '" class="btn btn-primary">Памятка</a>' +
        '<a href="' + topicLink("article.html", topic) + '" class="btn btn-secondary">Статья</a>' +
      "</div>" +
    "</div>"
  );
}

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
  const parts = [topic.title, topic.description, topic.intro || ""]
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

  // memos.html?section=psychology — только памятки одного раздела (так ссылается страница «Помощь»)
  const section = SECTIONS.find(function (s) {
    return s.id === new URLSearchParams(location.search).get("section");
  });
  if (section) {
    list.insertAdjacentHTML("beforebegin",
      '<p class="hint">Раздел: <strong>' + escapeHtml(section.title) + "</strong>. " +
      '<a href="memos.html">Показать все памятки</a></p>');
  }

  const topics = TOPICS.filter(function (t) {
    return hasMemo(t) && (!section || t.section === section.id);
  });
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
  ].filter(function (l) {
    // У тем справочника (kind: "reference") урока нет — ссылку «Урок» не показываем
    if (l.page === "lesson.html" && !isLesson(topic)) return false;
    return l.page !== current;
  });

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
    renderIntro(topic) +   // вводный абзац сверху
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
    renderIntro(topic) +   // вводный абзац сверху
    (hasArticle(topic)
      ? '<div class="card details article-text">' +
          topic.details.filter(Boolean).map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("") +
        "</div>"
      : renderSoon("Статья скоро появится")) +
    renderSources(topic) +
    renderMoreOnTopic(topic, "article.html");
}

/* ---------- Помощь (help.html) ---------- */

function renderContacts() {
  const box = document.getElementById("contacts-list");
  if (!box) return;

  box.innerHTML = CONTACTS.map(function (c) {
    const phone = (c.phone || "").trim();
    const url = (c.url || "").trim();
    const validUrl = /^https?:\/\//i.test(url); // ссылки только на сайты (http/https)
    // Для ссылки «позвонить» оставляем только цифры и «+»
    const tel = phone.replace(/[^\d+]/g, "");

    return (
      '<article class="card contact-card">' +
        "<h3>" + escapeHtml(c.title) + "</h3>" +
        (c.description ? "<p>" + escapeHtml(c.description) + "</p>" : "") +
        (phone
          ? '<p class="contact-phone">Телефон: <a href="tel:' + escapeHtml(tel) + '">' + escapeHtml(phone) + "</a></p>"
          : "") +
        (validUrl
          ? '<a href="' + escapeHtml(url) + '" class="btn btn-secondary" target="_blank" rel="noopener">Перейти на сайт</a>'
          : "") +
        (!phone && !validUrl ? '<p class="muted contact-pending">Контакты уточняются</p>' : "") +
      "</article>"
    );
  }).join("");
}

/* Опрос самочувствия: считает баллы и показывает результат. Ответы НЕ сохраняются. */
function setupWellbeingSurvey() {
  const form = document.getElementById("wellbeing-form");
  if (!form) return;

  const result = document.getElementById("wellbeing-result");
  const error = document.getElementById("wellbeing-error");

  form.querySelector(".wellbeing-questions").innerHTML = WELLBEING.questions.map(function (q, qi) {
    return (
      '<fieldset class="question">' +
        "<legend>" + (qi + 1) + ". " + escapeHtml(q) + "</legend>" +
        WELLBEING.options.map(function (option, points) {
          return (
            '<label class="option">' +
              '<input type="radio" name="w' + qi + '" value="' + points + '"> ' +
              "<span>" + escapeHtml(option) + "</span>" +
            "</label>"
          );
        }).join("") +
      "</fieldset>"
    );
  }).join("");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    let total = 0;
    let answered = 0;
    WELLBEING.questions.forEach(function (q, qi) {
      const checked = form.querySelector('input[name="w' + qi + '"]:checked');
      if (checked) {
        answered++;
        total += Number(checked.value);
      }
    });

    if (answered < WELLBEING.questions.length) {
      error.textContent = "Ответьте, пожалуйста, на все вопросы.";
      result.hidden = true;
      return;
    }
    error.textContent = "";

    const outcome = WELLBEING.results.find(function (r) { return total <= r.max; }) ||
      WELLBEING.results[WELLBEING.results.length - 1];

    result.innerHTML =
      '<p class="wellbeing-text">' + escapeHtml(outcome.text) + "</p>" +
      '<p class="muted">' + escapeHtml(WELLBEING.disclaimer) + "</p>" +
      (outcome.high ? '<p class="wellbeing-urgent">' + escapeHtml(WELLBEING.urgentNote) + "</p>" : "");
    result.hidden = false;
    result.focus();
  });

  // «Пройти заново» очищает ответы и прячет результат
  form.addEventListener("reset", function () {
    error.textContent = "";
    result.hidden = true;
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
   Сейчас — поиск по data.js с небольшой паузой «Консультант печатает…».
   Чтобы подключить настоящий ИИ, достаточно заменить содержимое этой функции
   на запрос к своему серверу (см. объяснение в чате). Функция должна вернуть Promise
   с объектом того же вида, что у findConsultantAnswer. */
function getConsultantReply(question) {
  const delay = 500 + Math.random() * 500; // 0,5–1 секунда
  return new Promise(function (resolve) {
    setTimeout(function () { resolve(findConsultantAnswer(question)); }, delay);
  });
}

function setupConsultantPage() {
  const chat = document.getElementById("chat-log");
  if (!chat) return;

  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const hintsBox = document.getElementById("chat-hints");
  let busy = false;

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
          '<a href="' + topicLink("memo.html", topic) + '" class="btn btn-small btn-primary">Памятка</a>' +
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
        '<a href="' + topicLink("memo.html", topic) + '" class="btn btn-small btn-secondary">Памятка</a>' +
        '<a href="' + topicLink("article.html", topic) + '" class="btn btn-small btn-secondary">Статья</a>' +
      "</div>"
    );
  }

  function replyHtml(reply) {
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

  function ask(question) {
    question = question.trim();
    if (!question || busy) return;

    busy = true;
    sendBtn.disabled = true;
    addMessage("user", "<p>" + escapeHtml(question) + "</p>");
    input.value = "";

    const typing = addMessage("bot", '<p class="typing">Консультант печатает…</p>', "msg-typing");

    getConsultantReply(question).then(function (reply) {
      typing.remove();
      addMessage("bot", replyHtml(reply), reply.type === "alarm" ? "msg-alarm" : "");
      busy = false;
      sendBtn.disabled = false;
    });
  }

  // Первое сообщение консультанта
  addMessage("bot", "<p>" + escapeHtml(CONSULTANT.greeting) + "</p>");

  // Отправка кнопкой и клавишей Enter (Enter в поле формы отправляет её сам)
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
    input.focus();
  });

  // Кнопки-подсказки отправляют свой текст как вопрос
  hintsBox.addEventListener("click", function (e) {
    const hint = e.target.closest(".chat-hint");
    if (hint) ask(hint.textContent);
  });

  // consultant.html?topic=burns — сразу спросить про тему и показать ответ именно по ней
  const topicId = new URLSearchParams(location.search).get("topic");
  const topic = TOPICS.find(function (t) { return t.id === topicId; });
  if (topic) {
    const answer = CONSULTANT.answers.find(function (a) { return a.topicId === topic.id; });
    busy = true;
    sendBtn.disabled = true;
    addMessage("user", "<p>" + escapeHtml("Расскажите про тему: " + topic.title) + "</p>");
    const typing = addMessage("bot", '<p class="typing">Консультант печатает…</p>', "msg-typing");
    setTimeout(function () {
      typing.remove();
      addMessage("bot", replyHtml(answer
        ? { type: "answer", text: answer.text, topicId: topic.id }
        : { type: "answer", text: topic.description, topicId: topic.id }));
      busy = false;
      sendBtn.disabled = false;
    }, 700);
  }
}

/* ---------- Права и документы (rights.html) ---------- */

/* Текст карточки для поиска: название, ключевые слова и все блоки */
function rightsSearchText(item) {
  return normalizeText([item.title, item.what, item.where, item.entitled]
    .concat(item.keywords || [], item.documents || [], item.steps || [])
    .join(" "));
}

function renderRightsCard(item) {
  const source = item.source || {};
  const validUrl = /^https?:\/\//i.test(source.url || "");
  const panelId = "rights-panel-" + item.id;

  function block(title, content) {
    return content ? '<div class="rights-block"><h3>' + title + "</h3>" + content + "</div>" : "";
  }
  function para(text) { return text ? "<p>" + escapeHtml(text) + "</p>" : ""; }

  return (
    '<article class="card rights-item" data-id="' + escapeHtml(item.id) + '">' +
      '<h2 class="rights-heading">' +
        '<button type="button" class="rights-toggle" aria-expanded="false" aria-controls="' + panelId + '">' +
          "<span>" + escapeHtml(item.title) + "</span>" +
          '<span class="rights-arrow" aria-hidden="true">▾</span>' +
        "</button>" +
      "</h2>" +
      '<div class="rights-panel" id="' + panelId + '" hidden>' +
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
          '<p class="muted">Проверено: ' + escapeHtml(item.checked || "дата уточняется") + "</p>") +
      "</div>" +
    "</article>"
  );
}

function setupRightsPage() {
  const list = document.getElementById("rights-list");
  if (!list) return;

  const input = document.getElementById("rights-search");

  // Открыть одну карточку (остальные закрываются) или закрыть её
  function toggle(card, open) {
    list.querySelectorAll(".rights-item").forEach(function (c) {
      const isThis = c === card && open;
      c.classList.toggle("is-open", isThis);
      c.querySelector(".rights-toggle").setAttribute("aria-expanded", isThis);
      c.querySelector(".rights-panel").hidden = !isThis;
    });
  }

  function show() {
    const words = normalizeText(input.value).split(" ").filter(Boolean);
    const found = RIGHTS.filter(function (item) {
      const text = rightsSearchText(item);
      return words.every(function (w) { return text.indexOf(w) !== -1; });
    });

    list.innerHTML = found.length
      ? found.map(renderRightsCard).join("")
      : '<div class="card empty-result"><p><strong>Ничего не найдено.</strong> ' +
        "Попробуйте другое слово, например «инвалидность», «протез» или «выплаты», " +
        'или <a href="consultant.html">спросите консультанта</a>.</p></div>';
  }

  list.addEventListener("click", function (e) {
    const button = e.target.closest(".rights-toggle");
    if (!button) return;
    const card = button.closest(".rights-item");
    toggle(card, !card.classList.contains("is-open"));
  });

  input.addEventListener("input", show);
  show();
}

/* ---------- Запуск ---------- */

document.addEventListener("DOMContentLoaded", function () {
  renderHeader();
  renderFileWarning();
  renderFooter();
  renderSections();
  setupLoginPage();
  renderLessonsPage();
  renderCabinetPage();
  renderLessonPage();
  renderTestPage();
  setupRightsPage();
  setupReferencePage();
  renderMemosPage();
  renderVideosPage();
  renderArticlesPage();
  setupFaqPage();
  renderMemoPage();
  renderVideoPage();
  renderArticlePage();
  renderContacts();
  setupWellbeingSurvey();
  setupConsultantPage();
});
