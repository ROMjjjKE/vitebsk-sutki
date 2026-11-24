/* Бронирование квартиры: аккаунты, календарь, заявки. Данные — в localStorage браузера. */
(function () {
  'use strict';
  var K = { users: 'vsb:users', sess: 'vsb:session', book: 'vsb:bookings', busy: 'vsb:busy', seed: 'vsb:seeded' };
  var RATE = 90;
  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function iso(d) { var m = d.getMonth() + 1, day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day; }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function nights(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function money(n) { return n.toLocaleString('ru-RU') + ' р.'; }
  var MNN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function ruFmt(key) { var d = parse(key); return d.getDate() + ' ' + MNN[d.getMonth()] + ' ' + d.getFullYear(); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function code() { var s = 'VS-'; for (var i = 0; i < 4; i++) s += '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 31)]; return s; }

  /* занятые даты: демо-занятость на ближайшие недели */
  function busy() {
    if (!read(K.seed, false)) {
      var t = today(), out = [];
      [3, 4, 9, 10, 11, 19, 20, 26].forEach(function (n) { var d = new Date(t); d.setDate(d.getDate() + n); out.push(iso(d)); });
      write(K.busy, out); write(K.seed, true);
    }
    var list = read(K.busy, []);
    read(K.book, []).forEach(function (b) { if (b.status !== 'cancelled') list.push(b.from, b.to); });
    return list;
  }
  function isBusy(day) { return busy().indexOf(day) > -1; }

  /* аккаунты */
  async function hash(pw, salt) {
    var data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) {
      var buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    var h = 0;
    for (var i = 0; i < data.length; i++) { h = (h * 31 + data[i]) | 0; }
    return 'f' + (h >>> 0).toString(16);
  }
  function users() { return read(K.users, []); }
  function session() {
    var s = read(K.sess, null);
    if (!s) return null;
    if (Date.now() - s.ts > 7 * 864e5) { localStorage.removeItem(K.sess); return null; }
    var u = users().filter(function (x) { return x.id === s.id; })[0];
    return u || null;
  }
  function setSession(u) { write(K.sess, { id: u.id, ts: Date.now() }); }
  async function register(d) {
    var list = users();
    if (!/^[^@\s]+@[^@\s]+\.[a-zа-я]{2,}$/i.test(d.email)) return { err: 'Проверьте адрес почты.' };
    if (d.password.length < 6) return { err: 'Пароль короче шести символов.' };
    if (list.some(function (x) { return x.email.toLowerCase() === d.email.toLowerCase(); })) return { err: 'Такая почта уже зарегистрирована. Войдите.' };
    var salt = uid() + uid();
    var u = { id: uid(), email: d.email.trim(), name: d.name.trim() || d.email.split('@')[0], phone: (d.phone || '').trim(), salt: salt, hash: await hash(d.password, salt), created: Date.now() };
    list.push(u); write(K.users, list); setSession(u);
    return { user: u };
  }
  async function login(email, password) {
    var u = users().filter(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase(); })[0];
    if (!u) return { err: 'Аккаунт с такой почтой не найден.' };
    if (await hash(password, u.salt) !== u.hash) return { err: 'Неверный пароль.' };
    setSession(u);
    return { user: u };
  }
  function logout() { localStorage.removeItem(K.sess); }
  function bookings(uidOnly) {
    var list = read(K.book, []);
    if (uidOnly) { var u = session(); if (!u) return []; list = list.filter(function (b) { return b.userId === u.id; }); }
    return list.sort(function (a, b) { return parse(a.from) - parse(b.from); });
  }
  function addBooking(b) { var list = read(K.book, []); list.push(b); write(K.book, list); return b; }
  function cancelBooking(id) {
    var list = read(K.book, []);
    list.forEach(function (b) { if (b.id === id) b.status = 'cancelled'; });
    write(K.book, list);
  }

  window.VSB = {
    iso: iso, parse: parse, today: today, nights: nights, money: money, ru: ruFmt, isBusy: isBusy, busy: busy,
    RATE: RATE, session: session, register: register, login: login, logout: logout,
    bookings: bookings, addBooking: addBooking, cancelBooking: cancelBooking, code: code, uid: uid, write: write, read: read
  };

  /* шапка: состояние аккаунта на всех страницах */
  var acc = document.getElementById('accLink');
  if (acc) {
    var u = session();
    if (u) { acc.textContent = 'Мои брони'; acc.href = 'kabinet.html'; acc.setAttribute('data-in', '1'); }
    else { acc.textContent = 'Войти'; acc.href = 'vhod.html'; }
  }
})();

/* календарь: два месяца, выбор заезда и выезда */
(function () {
  'use strict';
  var root = document.getElementById('cal');
  if (!root || !window.VSB) return;
  var V = window.VSB;
  var MN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  var t = V.today();
  var view = new Date(t.getFullYear(), t.getMonth(), 1);
  var from = null, to = null;

  function monthHtml(base) {
    var y = base.getFullYear(), m = base.getMonth();
    var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    var pad = (first.getDay() + 6) % 7;
    var h = '<div><div class="cal__m">' + MN[m] + ' ' + y + '</div><div class="wd">' + WD.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="days">';
    for (var p = 0; p < pad; p++) h += '<span class="day day--pad"></span>';
    for (var d = 1; d <= days; d++) {
      var date = new Date(y, m, d), key = V.iso(date);
      var cls = 'day', attrs = ' data-d="' + key + '"';
      if (date < t) { cls += ' day--past'; attrs += ' aria-disabled="true"'; }
      else if (V.isBusy(key)) { cls += ' day--busy'; attrs += ' aria-disabled="true" data-busy="1"'; }
      else cls += ' day--free';
      if (from && key === from) cls += ' day--edge';
      if (to && key === to) cls += ' day--edge';
      if (from && to && key > from && key < to) cls += ' day--in';
      if (key === V.iso(t)) cls += ' day--today';
      h += '<button type="button" class="' + cls + '"' + attrs + '>' + d + '</button>';
    }
    return h + '</div></div>';
  }

  function render() {
    var next = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    var thisMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    root.innerHTML =
      '<div class="cal__bar"><div><span class="mono">Заезд и выезд</span></div><div class="cal__nav">' +
      '<button type="button" id="calPrev" aria-label="Предыдущий месяц"' + (view <= thisMonth ? ' disabled' : '') + '>←</button>' +
      '<button type="button" id="calNext" aria-label="Следующий месяц">→</button></div></div>' +
      '<div class="months">' + monthHtml(view) + monthHtml(next) + '</div>' +
      '<div class="legend"><span><i class="i-free"></i>свободно</span><span><i class="i-busy"></i>занято</span><span><i class="i-sel"></i>выбрано</span></div>' +
      '<input type="hidden" id="calFrom" value="' + (from || '') + '"><input type="hidden" id="calTo" value="' + (to || '') + '">';

    document.getElementById('calPrev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
    document.getElementById('calNext').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
    root.querySelectorAll('.day--free').forEach(function (b) { b.addEventListener('click', function () { pick(b.getAttribute('data-d')); }); });
    root.querySelectorAll('.day--busy').forEach(function (b) { b.addEventListener('click', function () { tell('Эти даты уже заняты — выберите другие.', 'err'); }); });
    summary();
  }

  function rangeFree(a, b) {
    var d = V.parse(a), end = V.parse(b);
    while (d < end) { if (V.isBusy(V.iso(d))) return false; d.setDate(d.getDate() + 1); }
    return true;
  }

  function pick(key) {
    if (!from || (from && to)) { from = key; to = null; tell('Теперь выберите дату выезда.', 'ok'); render(); return; }
    if (key <= from) { from = key; to = null; tell('Заезд позже выезда — выбрали новый заезд.', 'ok'); render(); return; }
    if (!rangeFree(from, key)) { tell('В этом промежутке есть занятые дни. Выберите другой выезд.', 'err'); return; }
    to = key; tell('Даты выбраны. Проверьте сумму и забронируйте.', 'ok'); render();
  }

  function tell(text, kind) {
    var el = document.getElementById('calMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (kind === 'err' ? 'msg--err' : 'msg--ok');
  }

  function summary() {
    var box = document.getElementById('bkSum');
    if (!box) return;
    var n = from && to ? V.nights(from, to) : 0;
    var total = n * V.RATE;
    box.innerHTML = '<div><span>Заезд</span><b>' + (from ? ru(from) : '—') + '</b></div>' +
      '<div><span>Выезд</span><b>' + (to ? ru(to) : '—') + '</b></div>' +
      '<div><span>Ночей</span><b>' + (n || '—') + '</b></div>' +
      '<div><span>' + V.money(V.RATE) + ' × ' + (n || 0) + '</span><b>' + V.money(total) + '</b></div>' +
      '<div class="bk__total"><span>Предварительно</span><b>' + V.money(total) + '</b></div>';
    var btn = document.getElementById('bkGo');
    if (btn) { btn.disabled = !(from && to); btn.setAttribute('aria-disabled', from && to ? 'false' : 'true'); }
    return { from: from, to: to, n: n, total: total };
  }
  function ru(key) { var d = V.parse(key); return d.getDate() + ' ' + MN[d.getMonth()] + ' ' + d.getFullYear(); }

  window.VSCAL = { get: function () { return { from: from, to: to, n: from && to ? V.nights(from, to) : 0, total: from && to ? V.nights(from, to) * V.RATE : 0 }; }, reset: function () { from = null; to = null; render(); }, render: render, summary: summary, ru: ru };
  render();
})();

/* вход и регистрация */
(function () {
  'use strict';
  var form = document.getElementById('authForm');
  if (!form || !window.VSB) return;
  var V = window.VSB, mode = 'login';
  var tabs = document.querySelectorAll('.tabs2 button');
  var regFields = ['regExtra', 'regPhone', 'regPass2'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  function setMode(m) {
    mode = m;
    tabs.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-m') === m ? 'true' : 'false'); });
    regFields.forEach(function (el) { el.hidden = m !== 'register'; });
    form.querySelector('[type=submit]').textContent = m === 'register' ? 'Создать аккаунт' : 'Войти';
    say('');
  }
  function say(text, ok) {
    var el = document.getElementById('authMsg');
    el.textContent = text || '';
    el.className = 'msg ' + (ok ? 'msg--ok' : 'msg--err');
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-m')); }); });
  setMode(new URLSearchParams(location.search).get('m') === 'register' ? 'register' : 'login');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var g = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value.trim() : ''; };
    var go = new URLSearchParams(location.search).get('next') || 'kabinet.html';
    if (mode === 'register') {
      if (g('password') !== g('password2')) { say('Пароли не совпадают.'); return; }
      var r = await V.register({ email: g('email'), password: g('password'), name: g('name'), phone: g('phone') });
      if (r.err) { say(r.err); return; }
      say('Аккаунт создан. Переходим в кабинет…', true);
    } else {
      var l = await V.login(g('email'), g('password'));
      if (l.err) { say(l.err); return; }
      say('Вход выполнен. Открываем кабинет…', true);
    }
    setTimeout(function () { location.href = go; }, 500);
  });
})();

/* оформление брони */
(function () {
  'use strict';
  var btn = document.getElementById('bkGo');
  if (!btn || !window.VSB) return;
  var V = window.VSB;
  btn.addEventListener('click', function () {
    var u = V.session();
    var sel = window.VSCAL.get();
    var msg = document.getElementById('bkMsg');
    if (!sel.from || !sel.to) { msg.className = 'msg msg--err'; msg.textContent = 'Выберите даты в календаре.'; return; }
    if (!u) { msg.className = 'msg msg--err'; msg.innerHTML = 'Для брони нужен аккаунт. <a href="vhod.html?next=bronirovanie.html" style="text-decoration:underline">Войти или зарегистрироваться</a>'; return; }
    var name = (document.querySelector('[name=bName]') || {}).value || u.name;
    var phone = (document.querySelector('[name=bPhone]') || {}).value || u.phone;
    var guests = (document.querySelector('[name=bGuests]') || {}).value || '1';
    var note = (document.querySelector('[name=bNote]') || {}).value || '';
    if (!phone.trim()) { msg.className = 'msg msg--err'; msg.textContent = 'Укажите телефон для связи.'; return; }
    var b = V.addBooking({ id: V.uid(), code: V.code(), userId: u.id, from: sel.from, to: sel.to, nights: sel.n, total: sel.total, guests: guests, name: name, phone: phone, note: note, status: 'active', created: Date.now() });
    try { notifyLead(b, sel, guests, name, phone, note); } catch (e) {}
    msg.className = 'msg msg--ok';
    msg.innerHTML = 'Готово. Бронь <b>' + b.code + '</b> на ' + sel.n + ' ноч., сумма ' + V.money(sel.total) + ' — подтвердите у хозяина: ' +
      '<a href="https://wa.me/375290000000?text=' + encodeURIComponent('Бронь ' + b.code + ': ' + sel.from + ' — ' + sel.to + ', гостей ' + guests + ', ' + b.name + ', ' + phone) + '" target="_blank" rel="noopener" style="text-decoration:underline">WhatsApp</a> · <a href="kabinet.html" style="text-decoration:underline">мои брони</a>';
    if (window.VSCAL) window.VSCAL.reset();
  });
})();

/* кабинет */
(function () {
  'use strict';
  var box = document.getElementById('accBox');
  if (!box || !window.VSB) return;
  var V = window.VSB;
  function draw() {
    var u = V.session();
    var who = document.getElementById('accWho');
    if (!u) {
      if (who) who.innerHTML = '<p>Чтобы видеть свои брони, войдите в аккаунт.</p><div class="bk__act"><a class="btn btn--blue" href="vhod.html?next=kabinet.html">Войти или зарегистрироваться</a></div>';
      box.innerHTML = '';
      return;
    }
    if (who) who.innerHTML = '<h3>' + u.name + '</h3><p>' + u.email + (u.phone ? ' · ' + u.phone : '') + '</p><div class="bk__act"><a class="btn btn--ghost" href="bronirovanie.html">Забронировать даты</a><button type="button" id="accOut">Выйти</button></div>';
    var list = V.bookings(true);
    if (!list.length) { box.innerHTML = '<div class="note-demo">Записей пока нет. Выберите даты в календаре — бронь появится здесь.</div>'; }
    else {
      box.innerHTML = list.map(function (b) {
        var cancelled = b.status === 'cancelled';
        return '<div class="bcard"><div class="bcard__top"><div><b>' + V.ru(b.from) + ' — ' + V.ru(b.to) + '</b><div class="bcard__code">' + b.code + ' · ' + b.nights + ' ноч. · ' + b.guests + ' гост.</div></div>' +
          '<span class="bcard__st" style="' + (cancelled ? 'border-color:#A3231B;color:#A3231B' : '') + '">' + (cancelled ? 'отменена' : 'заявка активна') + '</span></div>' +
          '<div>' + V.money(b.total) + (cancelled ? '' : ' · оплата при заселении') + '</div>' +
          '<div class="bcard__act">' + (cancelled ? '' : '<button type="button" data-cancel="' + b.id + '">Отменить бронь</button>') +
          '<a href="https://wa.me/375290000000?text=' + encodeURIComponent('Бронь ' + b.code + ': ' + b.from + ' — ' + b.to) + '" target="_blank" rel="noopener">Написать хозяину</a></div></div>';
      }).join('');
      box.querySelectorAll('[data-cancel]').forEach(function (c) {
        c.addEventListener('click', function () {
          if (!confirm('Отменить бронь? Даты снова станут свободными.')) return;
          V.cancelBooking(c.getAttribute('data-cancel'));
          draw();
        });
      });
    }
    var out = document.getElementById('accOut');
    if (out) out.addEventListener('click', function () { V.logout(); location.href = 'index.html'; });
  }
  draw();
})();
  function notifyLead(b, sel, guests, name, phone, note) {
    var cfg = window.VS_NOTIFY || {};
    var text = 'Новая бронь ' + b.code + '\n' + sel.from + ' — ' + sel.to + ' (' + sel.n + ' ноч.)' +
      '\nСумма: ' + V.money(sel.total) + '\nГостей: ' + guests +
      '\nИмя: ' + name + '\nТелефон: ' + phone + (note ? '\nКомментарий: ' + note : '');
    if (cfg.tgToken && cfg.tgChat) {
      try {
        fetch('https://api.telegram.org/bot' + cfg.tgToken + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cfg.tgChat, text: text, disable_web_page_preview: true })
        }).catch(function () {});
      } catch (e) {}
    }
    if (cfg.email) {
      try {
        fetch('https://formsubmit.co/ajax/' + encodeURIComponent(cfg.email), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            _subject: 'Бронь ' + b.code + ' с сайта',
            Код: b.code, Даты: sel.from + ' — ' + sel.to, Ночей: sel.n,
            Сумма: V.money(sel.total), Гостей: guests, Имя: name, Телефон: phone, Комментарий: note || ''
          })
        }).catch(function () {});
      } catch (e) {}
    }
  }


