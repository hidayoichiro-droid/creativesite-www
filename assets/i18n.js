/*
 * CREATIVESITE JP / EN 切り替え(パタパタ表示)
 *
 * 使い方(各ページ):
 *   <div class="lang" data-lang-switch></div>     … ここに JP / EN ボタンが入る
 *   <p data-i18n="key">日本語</p>                  … 中身(HTML)を辞書で入れ替える
 *   <input data-i18n-attr="placeholder:key">       … 属性を入れ替える(「;」で複数)
 *   <span data-flap>CREATIVESITE</span>            … 文字は変えず、切り替え時にめくるだけ
 *
 *   <script>window.I18N_EN = { title: '…', desc: '…', key: '…' };</script>
 *   <script>window.I18N_MSG = { ja: {…}, en: {…} };</script>   … JS が出すメッセージ(任意)
 *   <script src="/assets/i18n.js"></script>
 *
 * 日本語は、ページに書かれている内容をそのまま使う。
 * ページ側の JS からは I18N.lang() / I18N.t('key') が使える。
 */
(function () {
  var EN = window.I18N_EN || {};
  var MSG = window.I18N_MSG || { ja: {}, en: {} };

  var root = document.documentElement;
  var metaDesc = document.querySelector('meta[name="description"]');
  var nodes = toArray(document.querySelectorAll('[data-i18n]'));
  var attrNodes = toArray(document.querySelectorAll('[data-i18n-attr]'));
  var flapOnly = toArray(document.querySelectorAll('[data-flap]'));

  function toArray(list) { return Array.prototype.slice.call(list); }
  function attrPairs(el) {
    return el.getAttribute('data-i18n-attr').split(';').map(function (s) {
      var i = s.indexOf(':');
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }).filter(function (p) { return p[0] && p[1]; });
  }

  // 日本語(ページに書かれている内容)を控えておく
  var JA = { title: document.title, desc: metaDesc ? metaDesc.content : '' };
  nodes.forEach(function (el) { JA[el.dataset.i18n] = el.innerHTML; });
  attrNodes.forEach(function (el) {
    attrPairs(el).forEach(function (p) { JA[p[1]] = el.getAttribute(p[0]) || ''; });
  });
  var DICT = { ja: JA, en: EN };

  // ---- JP / EN ボタン ----
  var buttons = [];
  toArray(document.querySelectorAll('[data-lang-switch]')).forEach(function (box) {
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / 言語');
    box.innerHTML =
      '<button type="button" data-lang="ja" aria-pressed="true" lang="ja" title="日本語">JP</button>' +
      '<span aria-hidden="true">/</span>' +
      '<button type="button" data-lang="en" aria-pressed="false" lang="en" title="English">EN</button>';
    buttons = buttons.concat(toArray(box.querySelectorAll('button')));
  });

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 'ja';
  var raf = 0, jobs = [];

  // ---- パタパタ: 文字ごとにランダムな文字をめくり、左から順に止まる ----
  var KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン';
  var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var LOWER = 'abcdefghijklmnopqrstuvwxyz';
  function setFor(ch) {
    if (/[぀-ヿ㐀-鿿！-～]/.test(ch)) return KANA;
    if (/[A-Z0-9]/.test(ch)) return UPPER;
    if (/[a-z]/.test(ch)) return LOWER;
    return null; // 空白や記号はそのまま
  }
  // 同じ位置・同じ時刻なら同じ文字(床の映り込みと揃うように)
  function pick(set, i, tick) {
    var h = Math.imul(i + 1, 374761393) ^ Math.imul(tick + 7, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return set.charAt(((h ^ (h >>> 16)) >>> 0) % set.length);
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > -50 && r.top < innerHeight + 50 && r.width > 0;
  }
  function addJob(el, order) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var t, delay = Math.min(order * 45, 450);
    while ((t = walker.nextNode())) {
      if (!t.nodeValue.trim()) continue;
      var parent = t.parentNode;
      if (parent && /^(SCRIPT|STYLE)$/.test(parent.nodeName)) continue;
      var finalText = t.nodeValue;
      jobs.push({
        node: t, text: finalText,
        sets: Array.prototype.map.call(finalText, setFor),
        delay: delay, step: Math.min(24, 650 / finalText.length)
      });
    }
  }
  function run() {
    cancelAnimationFrame(raf);
    var start = performance.now();
    function frame(now) {
      var t = now - start, tick = Math.floor(t / 55), busy = false;
      jobs.forEach(function (j) {
        var out = '', done = true;
        for (var i = 0; i < j.text.length; i++) {
          var settle = j.delay + 160 + i * j.step;
          if (t >= settle || !j.sets[i]) out += j.text.charAt(i);
          else { out += pick(j.sets[i], i, tick); done = false; }
        }
        if (j.node.nodeValue !== out) j.node.nodeValue = out;
        if (!done) busy = true;
      });
      if (busy) raf = requestAnimationFrame(frame);
      else finish();
    }
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    cancelAnimationFrame(raf);
    jobs.forEach(function (j) { j.node.nodeValue = j.text; });
    jobs = [];
  }

  function apply(lang, animate) {
    finish();
    var d = DICT[lang];
    current = lang;
    root.lang = lang;
    if (d.title) document.title = d.title;
    if (metaDesc && d.desc) metaDesc.content = d.desc;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    attrNodes.forEach(function (el) {
      attrPairs(el).forEach(function (p) { if (d[p[1]] != null) el.setAttribute(p[0], d[p[1]]); });
    });

    var order = 0;
    nodes.forEach(function (el) {
      var html = d[el.dataset.i18n];
      if (html == null) return; // 辞書にないものは日本語のまま
      el.innerHTML = html;
      if (animate && inView(el)) addJob(el, order++);
    });
    if (animate) {
      flapOnly.forEach(function (el) { if (inView(el)) addJob(el, 0); });
      run();
    }
    try { document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } })); } catch (e) {}
  }

  function save(lang) {
    try { localStorage.setItem('lang', lang); } catch (e) {}
    try {
      var u = new URL(location.href);
      if (lang === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var lang = b.dataset.lang;
      if (lang === current) return;
      apply(lang, !reduce);
      save(lang);
    });
  });

  window.I18N = {
    lang: function () { return current; },
    t: function (key) {
      var m = MSG[current] || {};
      return m[key] != null ? m[key] : (MSG.ja && MSG.ja[key] != null ? MSG.ja[key] : key);
    }
  };

  // ?lang= を最優先、次に前回の選択、どちらもなければ日本語
  var m = /[?&]lang=(en|ja)\b/.exec(location.search);
  var initial = m ? m[1] : null;
  if (!initial) { try { initial = localStorage.getItem('lang'); } catch (e) {} }
  if (initial === 'en') apply('en', false);
})();
