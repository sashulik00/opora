/*
  Приложение Express: API регистрации и прогресса + раздача сайта.
  createApp() не запускает сервер, а только собирает его — так его удобно проверять в тестах.
*/
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { rateLimit } = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SITE_ROOT = path.join(__dirname, "..");

/* Раздаются ТОЛЬКО эти папки и HTML-файлы из корня сайта.
   server/, .env, node_modules, tools/, content/, скрытые файлы — никогда */
const PUBLIC_DIRS = ["css", "js", "images", "videos", "fonts"];

const COOKIE_NAME = "opora_token";
const TOKEN_DAYS = 7;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;  // bcrypt учитывает только первые 72 байта пароля
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Ошибка, которую можно показать человеку: текст по-русски и код ответа */
function userError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function checkCredentials(body) {
  body = body || {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    throw userError(400, "Введите правильный адрес электронной почты.");
  }
  if (password.length < PASSWORD_MIN) {
    throw userError(400, "Пароль должен быть не короче " + PASSWORD_MIN + " символов.");
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    throw userError(400, "Пароль слишком длинный.");
  }
  return { email: email, password: password };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
  options:
    db            — объект из server/db.js
    jwtSecret     — секрет для подписи токена
    cookieSecure  — true на https-хостинге
    bcryptRounds  — сложность хеша (по умолчанию 12; в тестах меньше, чтобы было быстро)
    loginLimit    — сколько попыток входа можно сделать за 15 минут с одного адреса
*/
function createApp(options) {
  const db = options.db;
  const jwtSecret = options.jwtSecret;
  const bcryptRounds = options.bcryptRounds || 12;
  const cookieOptions = {
    httpOnly: true,                 // JavaScript страницы не может прочитать токен
    sameSite: "lax",
    secure: Boolean(options.cookieSecure),
    path: "/"
  };

  // Хеш-«пустышка»: проверяется, когда почты нет, — чтобы по времени ответа нельзя было понять, есть ли почта
  const dummyHash = bcrypt.hashSync("opora-dummy-password", bcryptRounds);

  const app = express();
  app.disable("x-powered-by");

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // Встроенные видео в уроках — YouTube и Rutube
        "frame-src": ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://rutube.ru"],
        // На своём компьютере сайт открывается по http — не переводить запросы на https
        "upgrade-insecure-requests": options.cookieSecure ? [] : null
      }
    }
  }));

  /* ---------- API ---------- */
  const api = express.Router();
  api.use(express.json({ limit: "100kb" }));
  api.use(cookieParser());

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.loginLimit || 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Слишком много попыток входа. Подождите 15 минут и попробуйте снова." }
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.registerLimit || 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Слишком много регистраций с этого адреса. Попробуйте позже." }
  });

  function signIn(res, user) {
    const token = jwt.sign({ sub: String(user.id) }, jwtSecret, { algorithm: "HS256", expiresIn: TOKEN_DAYS + "d" });
    res.cookie(COOKIE_NAME, token, Object.assign({ maxAge: TOKEN_DAYS * 24 * 60 * 60 * 1000 }, cookieOptions));
  }

  /* Кто вошёл: пользователь из токена или null */
  async function currentUser(req) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return null;
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      return await db.findUserById(Number(payload.sub));
    } catch (e) {
      return null;  // токен испорчен или просрочен
    }
  }

  async function requireAuth(req, res, next) {
    const user = await currentUser(req);
    if (!user) return next(userError(401, "Войдите, чтобы продолжить."));
    req.user = user;
    next();
  }

  api.post("/register", registerLimiter, async function (req, res) {
    const data = checkCredentials(req.body);
    const hash = await bcrypt.hash(data.password, bcryptRounds);
    let user;
    try {
      user = await db.createUser(data.email, hash);
    } catch (e) {
      if (e.code === "23505") throw userError(409, "Эта почта уже зарегистрирована. Войдите на вкладке «Войти».");
      throw e;
    }
    signIn(res, user);
    res.status(201).json({ user: { email: user.email } });
  });

  api.post("/login", loginLimiter, async function (req, res) {
    const data = checkCredentials(req.body);
    const user = await db.findUserByEmail(data.email);
    const ok = await bcrypt.compare(data.password, user ? user.password_hash : dummyHash);
    if (!user || !ok) throw userError(401, "Неверная почта или пароль.");
    signIn(res, user);
    res.json({ user: { email: user.email } });
  });

  api.post("/logout", function (req, res) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ ok: true });
  });

  api.get("/me", async function (req, res) {
    const user = await currentUser(req);
    if (!user && req.cookies[COOKIE_NAME]) res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ user: user ? { email: user.email } : null });
  });

  api.get("/progress", requireAuth, async function (req, res) {
    res.json({ progress: await db.getProgress(req.user.id) });
  });

  api.put("/progress", requireAuth, async function (req, res) {
    const progress = req.body && req.body.progress;
    if (!isPlainObject(progress)) throw userError(400, "Неверный формат прогресса.");
    const updatedAt = await db.saveProgress(req.user.id, progress);
    res.json({ ok: true, updatedAt: updatedAt });
  });

  api.use(function (req, res, next) {
    next(userError(404, "Такого адреса в API нет."));
  });

  // Ошибки API — всегда JSON по-русски
  api.use(function (err, req, res, next) {
    let status = err.status || err.statusCode || 500;
    let message = err.expose && err.status < 500 ? err.message : "Ошибка на сервере. Попробуйте ещё раз.";
    if (err.type === "entity.too.large") message = "Слишком большой запрос.";
    if (err.type === "entity.parse.failed") message = "Неверный формат данных.";
    if (status >= 500) {
      status = 500;
      console.error(err);
    }
    res.status(status).json({ error: message });
  });

  app.use("/api", api);

  /* ---------- Сайт ---------- */
  PUBLIC_DIRS.forEach(function (dir) {
    app.use("/" + dir, express.static(path.join(SITE_ROOT, dir), { dotfiles: "ignore", index: false, redirect: false }));
  });

  app.get("/", function (req, res) {
    res.sendFile("index.html", { root: SITE_ROOT });
  });

  // Только HTML-файлы из корня: буквы, цифры, «-», «_» и «.html» на конце
  app.get("/:page", function (req, res, next) {
    if (!/^[\w-]+\.html$/.test(req.params.page)) return next();
    res.sendFile(req.params.page, { root: SITE_ROOT, dotfiles: "deny" }, function (err) {
      if (err) next();
    });
  });

  app.use(function (req, res) {
    res.status(404).type("text/plain; charset=utf-8").send("Страница не найдена");
  });

  return app;
}

module.exports = { createApp, COOKIE_NAME };
