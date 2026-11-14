(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* меню */
  var drawer = $('drawer'), burger = $('burger'), closeBtn = $('drawerClose'), lastFocus = null;
  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.setAttribute('data-open', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    var f = drawer.querySelector('a, button'); if (f) f.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute('data-open', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (lastFocus) lastFocus.focus();
  }
  if (burger) burger.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (drawer) {
    drawer.addEventListener('click', function (e) { if (e.target === drawer) closeDrawer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.getAttribute('data-open') === 'true') closeDrawer();
      if (e.key === 'Tab' && drawer.getAttribute('data-open') === 'true') {
        var items = drawer.querySelectorAll('a, button');
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 900) closeDrawer(); });
  }

  /* галерея по группам */
  var tabs = document.querySelectorAll('[data-gal]');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
      b.setAttribute('aria-selected', 'true');
      var g = b.getAttribute('data-gal');
      document.querySelectorAll('.gal figure').forEach(function (fig) {
        fig.hidden = !(g === 'all' || fig.getAttribute('data-g') === g);
      });
    });
  });

  /* частые вопросы */
  document.querySelectorAll('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.faq__i');
      var open = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', open ? 'false' : 'true');
      item.classList.toggle('is-open', !open);
    });
  });

  /* расчёт */
  var root = $('calc');
  if (!root) return;
  var carRate = function (d) {
    if (!d) return 0;
    if (d === 1) return 249;
    if (d <= 3) return 229;
    if (d <= 7) return 209;
    if (d <= 14) return 189;
    return 0;
  };
  function money(n) { return n.toLocaleString('ru-RU') + ' р.'; }
  function calc() {
    var nights = +$('cN').value, guests = +$('cG').value, days = +$('cD').value;
    var flat = 90 * nights;
    var rate = carRate(days);
    var car = rate * days;
    $('lFlat').textContent = nights + ' × 90 р.';
    $('vFlat').textContent = money(flat);
    $('lCar').textContent = rate ? days + ' × ' + rate + ' р.' : 'не выбрано';
    $('vCar').textContent = rate || days === 0 ? money(car) : 'по запросу';
    $('vTotal').textContent = money(flat + car);
    var notes = [];
    if (guests > 2) notes.push('В квартире до 6 гостей, но цена зависит от количества человек: для ' + guests + ' гостей хозяин подтвердит доплату.');
    if (days > 14) notes.push('От 15 суток аренда автомобиля — индивидуальная цена.');
    notes.push('Автомобиль: залог от 700 р., 350 км в сутки включено, перепробег 0,50 р./км.');
    $('calcNote').textContent = notes.join(' ');
    var msg = 'Здравствуйте! Хочу забронировать: квартира на ' + nights + ' сут., гостей ' + guests +
      (days ? ', автомобиль Deepal S05 на ' + days + ' сут.' : '') + '. Ориентировочно ' + money(flat + car) + '.';
    $('cWa').href = 'https://wa.me/375290000000?text=' + encodeURIComponent(msg);
    $('cCopy').setAttribute('data-msg', msg);
  }
  ['cN', 'cG', 'cD'].forEach(function (id) { var el = $(id); if (el) { el.addEventListener('change', calc); el.addEventListener('input', calc); } });
  calc();
  var copy = $('cCopy');
  if (copy) copy.addEventListener('click', function () {
    var t = copy.getAttribute('data-msg') || '';
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('calcNote').textContent = 'Текст заявки скопирован — вставьте его в сообщение на Куфаре или в мессенджер.'; });
  });

  /* форма */
  var send = $('sendForm');
  if (send) send.addEventListener('click', function (e) {
    e.preventDefault();
    var g = function (n) { var el = document.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    if (!g('name') || !g('tel')) { $('formout').textContent = 'Заполните имя и телефон'; return; }
    var msg = 'Заявка с сайта: ' + g('name') + ' · ' + g('tel') + ' · ' + g('dates') + ' · ' + g('task');
    $('formout').textContent = 'Открываю WhatsApp с готовым сообщением';
    window.open('https://wa.me/375290000000?text=' + encodeURIComponent(msg), '_blank');
  });
})();
