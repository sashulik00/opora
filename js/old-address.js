/*
  Старые адреса: страниц памятки и отдельного видео больше нет, файлы memo.html и video.html оставлены ради сохранённых ссылок.
  В теге script: data-to — куда вести ({id} заменяется темой из адреса), data-list — куда, если темы в адресе нет.
*/
(function () {
  const script = document.currentScript;
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || params.get("topic");
  location.replace(id ? script.dataset.to.replace("{id}", encodeURIComponent(id)) : script.dataset.list);
})();
