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
    { href: "help.html", text: "Помощь", page: "help" }
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
    "<h1>Здравствуйте" + (user.name ? ", " + escapeHtml(user.name) : "") + "!</h1>" +
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

/* Видео урока — необязательное поле videos в js/data.js:
     videos: [{ title: "Название", org: "Кто снял", embedUrl: "адрес плеера для iframe", pageUrl: "страница ролика" }]
   embedUrl может не быть (площадка не разрешает встраивание) — тогда вместо плеера карточка со ссылкой на pageUrl.
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
      'allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen ' +
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
  return video.org ? "Видео: " + video.org : "";
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
    '<p class="lesson-side-note">' + tasks.length + " " + plural(tasks.length, "задание", "задания", "заданий") +
      " на " + (tasks.length === 1 ? "картинке" : "картинках") + "</p>" +
    '<div class="lesson-side-row">' +
      '<a href="' + practiceLink(topic, 1) + '" class="btn btn-primary">Перейти</a>' + mark +
    "</div>");
}

function renderLessonTestCard(topic, record, user) {
  const count = (topic.quiz || []).length;
  if (!count) return "";
  const hasResult = Boolean(record && record.total);
  const passed = hasResult && (record.passed || record.best / record.total >= PASS_RATE);
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
        '<a href="' + topicLink("memo.html", topic) + '" class="btn btn-primary">Памятка</a>' +
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

/* Задания практики темы (practice.tasks); нет практики — пустой список */
function practiceTasks(topic) {
  return (topic && topic.practice && Array.isArray(topic.practice.tasks)) ? topic.practice.tasks : [];
}

/* Выполнено ли задание: progress.practiceDone[ID темы][ID задания] = true.
   Старая запись practiceDone[ID темы] = true (до разделения на задания) — это выполненное первое задание */
function isTaskDone(topic, task) {
  const record = (getProgress().practiceDone || {})[topic.id];
  if (record === true) return practiceTasks(topic).indexOf(task) === 0;
  return Boolean(record && record[task.id]);
}

function countTasksDone(topic) {
  return practiceTasks(topic).filter(function (t) { return isTaskDone(topic, t); }).length;
}

/* Практика темы выполнена, если выполнены все её задания */
function isPracticeDone(topic) {
  const tasks = practiceTasks(topic);
  return tasks.length > 0 && countTasksDone(topic) === tasks.length;
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

  const tasks = practiceTasks(topic);
  const nextIndex = taskIndex + 1 < tasks.length ? taskIndex + 1 : -1;
  const mainCls = isTaskDone(topic, task) ? "btn-primary" : "btn-secondary";  // после выполнения — выделена цветом

  box.innerHTML =
    '<div class="practice-scene">' +
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

    // Под картинкой: сообщения, «Готово!» и кнопки
    '<p class="practice-message" aria-live="polite"></p>' +
    '<div class="practice-finish" hidden>' +
      '<p class="success">Готово! Вы нашли все ошибки</p>' +
      (getCurrentUser() ? "" :
        '<p class="practice-note">Вы не вошли, поэтому отметка о практике не сохранится. <a href="' + loginLinkBack() + '">Войти</a></p>') +
      '<a href="lesson.html?id=' + encodeURIComponent(topic.id) + '" class="btn btn-secondary practice-finish-back" hidden>Вернуться к уроку</a>' +
    "</div>" +
    '<div class="practice-actions">' +
      (nextIndex >= 0
        ? '<a href="' + practiceLink(topic, nextIndex + 1) + '" data-task="' + (nextIndex + 1) + '" class="btn ' + mainCls + ' practice-main">К следующему заданию</a>'
        : '<a href="' + topicTestLink(topic) + '" class="btn ' + mainCls + ' practice-main">К тесту</a>') +
      '<button type="button" class="btn btn-secondary practice-again">Пройти ещё раз</button>' +
      '<a href="lesson.html?id=' + encodeURIComponent(topic.id) + '" class="btn btn-secondary">К уроку</a>' +
    "</div>";

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
  const finish = box.querySelector(".practice-finish");
  const mainButton = box.querySelector(".practice-main");
  const count = side.querySelector(".practice-count");
  const cells = side.querySelector(".practice-cells");

  // Общие обработчики (Esc, клик мимо) снимаются, когда открывают другое задание
  if (practiceListeners) practiceListeners.abort();
  practiceListeners = new AbortController();
  const listen = { signal: practiceListeners.signal };

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
    const cell = cells.querySelector(".practice-cell.is-empty");
    if (!cell) return;
    const ok = unit.role === "ok";
    cell.className = "practice-cell practice-card" + (ok ? " practice-card--ok" : "");
    cell.innerHTML =
      '<span class="practice-tag ' + (ok ? "practice-tag--ok" : "practice-tag--error") + '">' + (ok ? "Верно" : "Ошибка") + "</span>" +
      "<h3>" + escapeHtml(unit.label) + "</h3>" +
      "<p>" + escapeHtml(unit.explanation) + "</p>";
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
      // Верный предмет: не исчезает и не считается; дальше обведён зелёным и показывает подсказку
      unit.accepted = true;
      itemLayers(unit).forEach(function (l) { l.classList.add("is-ok"); });
      unit.keyButton.textContent = "Верный предмет: " + (unit.label || unit.key);
      addCard(unit);
      say("Верно, этот предмет нужен, его оставляем: " + unit.label + ".");
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
    say("Верно, это ошибка: " + unit.label + ". Найдено ошибок: " + n + " из " + errorUnits.length + ".");

    if (n === errorUnits.length) {
      finish.hidden = false;
      saveTaskDone(topic, task);
      // Без входа отметки не сохраняются, поэтому единственное задание считаем выполненным по факту
      finish.querySelector(".practice-finish-back").hidden = !(isPracticeDone(topic) || tasks.length === 1);
      mainButton.classList.replace("btn-secondary", "btn-primary");
      say("Готово! Вы нашли все ошибки");
      message.classList.add("visually-hidden");  // на экране это уже есть в блоке «Готово!»; программа чтения прочитает
      if (byKey) mainButton.focus();
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
    finish.hidden = true;
    updateCount();
    message.classList.remove("visually-hidden");
    say("");
    count.focus();
  });

  updateCount();
}

/* ---------- Страница практики (practice.html?topic=ID&task=номер) ----------
   Слева — список заданий темы, в центре — задание, справа — карточки результатов.
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
    '<div class="practice-page-grid">' +
      '<nav class="practice-nav" aria-label="Задания практики"></nav>' +
      '<section class="practice-main-col">' +
        '<h1 class="practice-task-title">' + escapeHtml(task.title) + "</h1>" +
        (task.description ? '<p class="practice-task-desc">' + escapeHtml(task.description) + "</p>" : "") +
        renderPracticeNote(task.note) +
        '<div id="practice-task"></div>' +
      "</section>" +
      '<aside class="practice-side-col" id="practice-results" aria-label="Результаты"></aside>' +
    "</div>";

  const nav = page.querySelector(".practice-nav");
  function renderNav() {
    nav.innerHTML =
      '<h2 class="practice-nav-title">Практика</h2>' +
      '<p class="practice-nav-topic">' + escapeHtml(topic.title) + "</p>" +
      '<p class="practice-nav-count">Выполнено заданий: ' + countTasksDone(topic) + " из " + tasks.length + "</p>" +
      '<ol class="practice-nav-list">' +
        tasks.map(function (t, i) {
          const done = isTaskDone(topic, t);
          return "<li>" +
            '<a href="' + practiceLink(topic, i + 1) + '" data-task="' + (i + 1) + '"' +
              ' class="practice-nav-item' + (i === index ? " is-current" : "") + (done ? " is-done" : "") + '"' +
              (i === index ? ' aria-current="step"' : "") + ">" +
              '<span class="practice-nav-num">' + (i + 1) + ".</span> " + escapeHtml(t.title) +
              (done ? ' <span class="practice-nav-check" aria-label="выполнено">✓</span>' : "") +
            "</a></li>";
        }).join("") +
      "</ol>" +
      '<a href="lesson.html?id=' + encodeURIComponent(topic.id) + '" class="practice-nav-back">← К уроку</a>';
  }
  renderNav();

  if (task.type === "spot-error") setupPractice(topic, task, index, renderNav);

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
  list.innerHTML = topics.length ? topics.map(renderMemoCard).join("") : EMPTY_RESULT;
}

/* Карточка памятки для «кладки» на memos.html.
   Пропорции картинки идут по кругу: 4:3, 3:4, 1:1, 16:10 (классы memo-card--a…d в style.css).
   Если у темы нет cover (или файл не нашёлся) — цветная плашка с названием раздела. */
const MEMO_CARD_SHAPES = ["a", "b", "c", "d"];

function renderMemoCard(topic, index) {
  const section = sectionOf(topic);
  const shape = MEMO_CARD_SHAPES[index % MEMO_CARD_SHAPES.length];
  const cover = (topic.cover || "").trim();
  const href = topicLink("memo.html", topic);

  return (
    '<article class="memo-card memo-card--' + shape + '">' +
      '<div class="memo-card-media' + (index % 2 ? " is-green" : "") + '">' +
        '<span class="memo-card-placeholder" aria-hidden="true">' + escapeHtml(section.title) + "</span>" +
        (cover
          ? '<img src="images/' + escapeHtml(encodeURI(cover)) + '" alt="" loading="lazy" onerror="this.remove()">'
          : "") +
      "</div>" +
      '<div class="memo-card-body">' +
        '<div class="memo-card-tags">' +
          '<span class="memo-card-section">' + escapeHtml(section.title) + "</span>" +
          (isLesson(topic) ? '<span class="memo-card-lesson">Есть урок</span>' : "") +
        "</div>" +
        // Вся карточка кликабельна: ссылка в заголовке растянута на карточку (см. .memo-card-link::after)
        '<h2 class="memo-card-title"><a class="memo-card-link" href="' + href + '">' + escapeHtml(topic.title) + "</a></h2>" +
        '<p class="memo-card-text">' + escapeHtml(topic.description) + "</p>" +
        '<span class="memo-card-more" aria-hidden="true">Открыть памятку →</span>' +
      "</div>" +
    "</article>"
  );
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
  list.innerHTML = topics.length ? topics.map(renderArticleCard).join("") : EMPTY_RESULT;
}

/* Карточка статьи на articles.html: картинка 4:3, заголовок статьи (articleTitle,
   если пусто — название темы) и кнопка «Читать статью». Вся карточка — одна ссылка.
   Без cover — плашка с названием раздела, терракотовая и зелёная по очереди. */
function renderArticleCard(topic, index) {
  const section = sectionOf(topic);
  const cover = (topic.cover || "").trim();
  const title = (topic.articleTitle || "").trim() || topic.title;

  return (
    '<article class="article-card">' +
      '<div class="article-card-media' + (index % 2 ? " is-green" : "") + '">' +
        '<span class="article-card-placeholder" aria-hidden="true">' + escapeHtml(section.title) + "</span>" +
        (cover
          ? '<img src="images/' + escapeHtml(encodeURI(cover)) + '" alt="" loading="lazy" onerror="this.remove()">'
          : "") +
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
   • Сайт открыт через сервер (npm start) — вопрос уходит на сервер (/api/consultant),
     там ИИ Яндекса отвечает по материалам школы.
   • Сайт открыт файлом без сервера — упрощённые ответы по ключевым словам из data.js (как раньше).
   Возвращает Promise с объектом:
     { type: "alarm" | "answer" | "nothing" | "unavailable", answer, sources } — ответ сервера,
     { type: "error", text } — ошибка (не вошли, слишком длинно, нет связи…),
     или старый вид от findConsultantAnswer — без сервера. */
function getConsultantReply(question, history) {
  if (Store.getMode() === "server") {
    return fetch("/api/consultant", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history: history })
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
function formatAnswer(text) {
  return String(text || "")
    .replace(/\*\*/g, "")                       // жирный из Markdown просто убираем
    .split(/\n\s*\n/)
    .map(function (p) { return p.trim(); })
    .filter(Boolean)
    .map(function (p) { return "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>"; })
    .join("");
}

/* «Источники: урок «Ожоги», статья «Выплаты и льготы»» */
function sourcesHtml(sources) {
  if (!sources || !sources.length) return "";
  return '<p class="msg-sources">Источники: ' + sources.map(function (s) {
    const url = /^(lesson|article)\.html\?id=[\w-]+$/.test(s.url || "") ? s.url : "lesson.html?id=" + encodeURIComponent(s.topicId);
    return (s.kind === "article" ? "статья" : "урок") + ' <a href="' + url + '">«' + escapeHtml(s.title) + "»</a>";
  }).join(", ") + "</p>";
}

function setupConsultantPage() {
  const chat = document.getElementById("chat-log");
  if (!chat) return;

  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const hintsBox = document.getElementById("chat-hints");
  const serverMode = Store.getMode() === "server";
  const history = [];  // последние реплики для сервера: [{ role: "user"|"assistant", content }]
  let busy = false;

  document.getElementById("chat-mode").textContent = serverMode
    ? "Ответы готовит ИИ по материалам уроков и справочника школы."
    : "Сайт открыт без сервера: консультант отвечает упрощённо, по ключевым словам.";

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
    // Ответы сервера (ИИ)
    if (serverMode && reply.type === "alarm") {
      return (
        formatAnswer(reply.answer).replace("<p>", '<p class="alarm-text">') +
        '<a href="tel:103" class="alarm-phone">Позвонить 103</a>' +
        '<a href="tel:112" class="alarm-phone">Позвонить 112</a>' +
        sourcesHtml(reply.sources)
      );
    }
    if (reply.type === "error") return "<p>" + escapeHtml(reply.text) + "</p>";
    if (serverMode) {
      return formatAnswer(reply.answer) + sourcesHtml(reply.sources) +
        (reply.type === "nothing" || (reply.type === "unavailable" && !(reply.sources || []).length)
          ? '<div class="msg-links"><a href="lessons.html" class="btn btn-small btn-secondary">Все уроки</a></div>'
          : "");
    }

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

    getConsultantReply(question, history.slice(-6)).then(function (reply) {
      typing.remove();
      addMessage("bot", replyHtml(reply), reply.type === "alarm" ? "msg-alarm" : "");
      if (serverMode && reply.type !== "error") {
        history.push({ role: "user", content: question }, { role: "assistant", content: reply.answer || "" });
        history.splice(0, Math.max(0, history.length - 6));
      }
      setBusy(false);
    });
  }

  // Первое сообщение консультанта
  addMessage("bot", "<p>" + escapeHtml(CONSULTANT.greeting) + "</p>");

  // Через сервер консультант работает только для вошедших
  if (serverMode && !getCurrentUser()) {
    addMessage("bot",
      "<p>Чтобы задать вопрос, войдите или зарегистрируйтесь.</p>" +
      '<div class="msg-links">' +
        '<a href="' + loginLinkBack() + '" class="btn btn-small btn-primary">Войти</a>' +
        '<a href="login.html?tab=register&amp;back=' + encodeURIComponent(location.pathname.split("/").pop() + location.search) +
          '" class="btn btn-small btn-secondary">Зарегистрироваться</a>' +
      "</div>");
    setBusy(true);
    input.disabled = true;
    hintsBox.hidden = true;
    return;
  }

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
  if (topic && serverMode) {
    ask("Расскажите коротко главное по теме «" + topic.title + "»");
  } else if (topic) {
    const answer = CONSULTANT.answers.find(function (a) { return a.topicId === topic.id; });
    setBusy(true);
    addMessage("user", "<p>" + escapeHtml("Расскажите про тему: " + topic.title) + "</p>");
    const typing = addMessage("bot", '<p class="typing">Консультант думает…</p>', "msg-typing");
    setTimeout(function () {
      typing.remove();
      addMessage("bot", replyHtml(answer
        ? { type: "answer", text: answer.text, topicId: topic.id }
        : { type: "answer", text: topic.description, topicId: topic.id }));
      setBusy(false);
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
  Store.ready.then(startPage);
});

function startPage() {
  renderHeader();
  renderFileWarning();
  renderFooter();
  renderSections();
  setupLoginPage();
  renderLessonsPage();
  renderCabinetPage();
  renderLessonPage();
  renderPracticePage();
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
}
