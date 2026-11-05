/*
  Самочувствие ухаживающего: уровень теста и подсчёты по отметкам настроения.
  Дни здесь — строки «2026-11-05»: их можно сравнивать как текст, часовые пояса их не сдвигают.
*/
const MOOD_DAYS = 30;           // за сколько дней отдаём отметки
const RESULTS_MAX = 10;         // сколько последних результатов теста отдаём
const NOTE_MAX = 300;           // длина заметки
const SCORE_MAX = 21;           // 7 вопросов по 0–3 балла
const BAD_MOOD_MAX = 2;         // 1 и 2 — плохой день
const TALK_STREAK = 2;          // столько плохих дней — уже «подряд»: комментарий обязательно предлагает разговор
const INSIGHT_MIN_MARKS = 3;    // с какого числа отметок доступен комментарий консультанта

function levelOf(score) {
  if (score <= 6) return "low";
  if (score <= 13) return "mid";
  return "high";
}

/* Сегодняшний день человека. tzOffset — как у Date.getTimezoneOffset: минуты от местного времени до UTC */
function todayFor(tzOffset) {
  const offset = tzOffset === undefined ? new Date().getTimezoneOffset() : tzOffset;
  return new Date(Date.now() - offset * 60000).toISOString().slice(0, 10);
}

function shiftDay(day, days) {
  return new Date(Date.parse(day + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}

/* entries — отметки от старых к новым. Среднее — с дня weekStart; серия — последние плохие отметки подряд, пропущенные дни её не прерывают */
function moodStats(entries, weekStart) {
  const week = entries.filter(function (e) { return e.day >= weekStart; });
  let badStreak = 0;
  for (let i = entries.length - 1; i >= 0 && entries[i].mood <= BAD_MOOD_MAX; i--) badStreak++;
  return {
    marks: entries.length,
    average: week.length ? week.reduce(function (sum, e) { return sum + e.mood; }, 0) / week.length : null,
    badStreak: badStreak
  };
}

module.exports = { levelOf, todayFor, shiftDay, moodStats, MOOD_DAYS, RESULTS_MAX, NOTE_MAX, SCORE_MAX, TALK_STREAK, INSIGHT_MIN_MARKS };
