/*
  Хранилище входа и прогресса — единственное место на сайте, где они читаются и записываются.
  Подключается на каждой странице ПЕРЕД js/main.js.

  Два режима (выбирается сам):
  • "server" — сайт открыт через наш сервер (npm start → http://localhost:3000).
    Вход с паролем через API, прогресс хранится в базе данных.
    Сохранение — с задержкой 0.8 сек (несколько изменений подряд уходят одним запросом),
    а при уходе со страницы — сразу.
  • "local" — сайт открыт файлом (file:///) или сервера нет. Всё как раньше:
    «вход» по почте и прогресс в localStorage этого браузера (пароль не проверяется и не хранится).

  Прогресс — один объект, как раньше в localStorage:
    { burns: { best, total, passed, completed }, practiceDone: { burns: { "spot-error-1": true } }, ... }
*/
const Store = (function () {
  const USERS_KEY = "opora_users";       // режим local: список «зарегистрированных» в этом браузере
  const CURRENT_KEY = "opora_current";   // режим local: почта того, кто вошёл
  const SAVE_DELAY = 800;                // задержка сохранения на сервер, мс

  let mode = "local";
  let user = null;          // { email, name } или null
  let progress = {};
  let loadFailed = false;   // прогресс с сервера не загрузился — тогда не сохраняем, чтобы не затереть его пустым
  let saveTimer = null;
  let pending = false;      // есть несохранённые изменения

  function copy(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function localProgressKey(email) {
    return "opora_progress_" + email;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isEmpty(obj) {
    return !obj || typeof obj !== "object" || Object.keys(obj).length === 0;
  }

  /* Запрос к API. Ошибка сервера превращается в исключение с текстом по-русски */
  function api(method, url, body, keepalive) {
    return fetch("/api" + url, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      keepalive: Boolean(keepalive)
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || !data) {
          const error = new Error((data && data.error) || "Нет связи с сервером. Попробуйте ещё раз.");
          error.status = res.status;
          throw error;
        }
        return data;
      });
    });
  }

  /* ---------- Режим local (как было раньше) ---------- */

  function localUsers() {
    return readJson(USERS_KEY, []);
  }

  function localLoad() {
    const email = localStorage.getItem(CURRENT_KEY);
    user = localUsers().find(function (u) { return u.email === email; }) || null;
    progress = user ? readJson(localProgressKey(user.email), {}) : {};
  }

  /* ---------- Режим server ---------- */

  function loadServerProgress() {
    return api("GET", "/progress").then(function (data) {
      progress = data.progress || {};
      loadFailed = false;
    }).catch(function (e) {
      progress = {};
      loadFailed = true;
      console.warn("Прогресс не загрузился с сервера:", e.message);
    });
  }

  /* После входа: если на сервере прогресса ещё нет, а в этом браузере он остался
     от входа без сервера (localStorage, та же почта) — переносим его на сервер */
  function afterServerLogin(data) {
    user = { email: data.user.email, name: "" };
    return loadServerProgress().then(function () {
      if (loadFailed || !isEmpty(progress)) return;
      const old = readJson(localProgressKey(user.email), {});
      if (isEmpty(old)) return;
      progress = old;
      return api("PUT", "/progress", { progress: old }).catch(function (e) {
        console.warn("Прогресс из браузера не перенёсся на сервер:", e.message);
      });
    });
  }

  function flush(keepalive) {
    clearTimeout(saveTimer);
    if (!pending || mode !== "server" || !user) return Promise.resolve();
    pending = false;
    return api("PUT", "/progress", { progress: progress }, keepalive).catch(function (e) {
      pending = true;  // не получилось — попробуем ещё раз чуть позже
      console.warn("Прогресс не сохранился:", e.message);
      saveTimer = setTimeout(flush, 5000);
    });
  }

  // Уходят со страницы или сворачивают вкладку — сохраняем сразу
  window.addEventListener("pagehide", function () { flush(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });

  /* ---------- Запуск: какой режим и кто вошёл ---------- */

  const ready = (location.protocol === "http:" || location.protocol === "https:")
    ? api("GET", "/me").then(function (data) {
        if (!("user" in data)) throw new Error("Это не наш сервер");
        mode = "server";
        if (data.user) return afterServerLoad(data.user);
      }).catch(function (e) {
        // Сервер есть, но сейчас не может ответить (например, перезапускается база): вход без пароля тут не нужен
        if (e.status >= 500) {
          mode = "server";
          loadFailed = true;
          return;
        }
        if (mode !== "server") {  // сервера нет (например, Live Server) — работаем как раньше
          mode = "local";
          localLoad();
        }
      })
    : Promise.resolve().then(localLoad);

  function afterServerLoad(serverUser) {
    user = { email: serverUser.email, name: "" };
    return loadServerProgress();
  }

  /* ---------- То, чем пользуется main.js ---------- */

  return {
    ready: ready,

    getMode: function () { return mode; },

    /* { email, name } или null. name есть только у старых «входов» без сервера */
    getUser: function () { return user ? copy(user) : null; },

    getProgress: function () { return copy(progress); },

    saveProgress: function (newProgress) {
      progress = copy(newProgress);
      if (!user) return;
      if (mode === "local") {
        localStorage.setItem(localProgressKey(user.email), JSON.stringify(progress));
        return;
      }
      if (loadFailed) return;
      pending = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, SAVE_DELAY);
    },

    /* Сбросить прогресс этого пользователя (кнопка в кабинете) */
    resetProgress: function () {
      progress = {};
      if (!user) return Promise.resolve();
      if (mode === "local") {
        localStorage.removeItem(localProgressKey(user.email));
        return Promise.resolve();
      }
      loadFailed = false;
      pending = true;
      return flush();
    },

    /* Регистрация и вход. Возвращают Promise: null — всё хорошо, иначе текст ошибки */
    register: function (email, password) {
      email = normalizeEmail(email);
      if (mode === "server") {
        return api("POST", "/register", { email: email, password: password })
          .then(afterServerLogin)
          .then(function () { return null; }, function (e) { return e.message; });
      }
      const users = localUsers();
      if (users.some(function (u) { return u.email === email; })) {
        return Promise.resolve("Эта почта уже зарегистрирована. Войдите на вкладке «Войти».");
      }
      users.push({ name: "", email: email });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(CURRENT_KEY, email);
      localLoad();
      return Promise.resolve(null);
    },

    login: function (email, password) {
      email = normalizeEmail(email);
      if (mode === "server") {
        return api("POST", "/login", { email: email, password: password })
          .then(afterServerLogin)
          .then(function () { return null; }, function (e) { return e.message; });
      }
      if (!localUsers().some(function (u) { return u.email === email; })) {
        return Promise.resolve("Такой почты нет. Зарегистрируйтесь на вкладке «Зарегистрироваться».");
      }
      localStorage.setItem(CURRENT_KEY, email);
      localLoad();
      return Promise.resolve(null);
    },

    logout: function () {
      if (mode === "local") {
        localStorage.removeItem(CURRENT_KEY);
        user = null;
        progress = {};
        return Promise.resolve();
      }
      return flush().then(function () {
        return api("POST", "/logout").catch(function () {});
      }).then(function () {
        user = null;
        progress = {};
      });
    }
  };
})();
