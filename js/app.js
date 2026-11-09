// birth-certificate-bd - UI wiring (browser only). All fee/age math via BirthLogic.
(function () {
  'use strict';
  var L = window.BirthLogic;
  var D = window.BirthData;
  var I = window.BirthI18n;
  var LS_KEY = 'birth-certificate-bd-v1';
  var $ = function (id) { return document.getElementById(id); };

  // ?asof=YYYY-MM-DD pins "today" for deterministic tests.
  var asof = null;
  try {
    var m = /[?&]asof=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    if (m) asof = m[1];
  } catch (e) { /* ignore */ }
  function todayStr() {
    if (asof) return asof;
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayDate() { return L.parseDate(todayStr()); }

  function blankBools(n) { var a = []; for (var i = 0; i < n; i++) a.push(false); return a; }

  var state = {
    lang: 'en',
    guides: {},
    checks: {},
    quizBest: 0,
    quizLast: null
  };
  D.GUIDES.forEach(function (g) { state.guides[g.id] = blankBools(g.steps.length); });
  D.CHECKLISTS.forEach(function (c) { state.checks[c.id] = blankBools(c.items.length); });

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s.lang === 'bn' || s.lang === 'en') state.lang = s.lang;
      if (s.guides) D.GUIDES.forEach(function (g) {
        if (L.validBoolArray(s.guides[g.id], g.steps.length)) state.guides[g.id] = s.guides[g.id];
      });
      if (s.checks) D.CHECKLISTS.forEach(function (c) {
        if (L.validBoolArray(s.checks[c.id], c.items.length)) state.checks[c.id] = s.checks[c.id];
      });
      if (typeof s.quizBest === 'number' && s.quizBest >= 0 && s.quizBest <= 10) state.quizBest = s.quizBest;
      if (typeof s.quizLast === 'number' && s.quizLast >= 0 && s.quizLast <= 10) state.quizLast = s.quizLast;
    } catch (e) { /* corrupted storage: start fresh */ }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function t(key) { return I.STR[state.lang][key] || I.STR.en[key] || key; }
  function digits(s) { return state.lang === 'bn' ? L.toBnDigits(String(s)) : String(s); }
  function fmtTaka(n) { return n === 0 ? t('free') : 'Tk ' + digits(n); }
  function loc(obj) { return (obj && (obj[state.lang] || obj.en)) || ''; }

  function showTab(name) {
    var tabs = ['calc', 'chart', 'guides', 'check', 'quiz', 'data'];
    tabs.forEach(function (n) {
      $('tab-' + n).hidden = (n !== name);
      $('tabbtn-' + n).classList.toggle('active', n === name);
    });
  }

  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    $('langBtn').textContent = t('langBtn');
    renderChart();
    renderGuides();
    renderChecklists();
    renderQuizIntro();
    renderData();
  }

  // --- calculator ---
  var ERR_KEYS = {
    'missing-dob': 'errMissingDob', 'invalid-dob': 'errInvalidDob',
    'missing-app': 'errMissingApp', 'invalid-app': 'errInvalidApp',
    'before-birth': 'errBeforeBirth', 'too-old': 'errTooOld'
  };
  var TIER_KEYS = { free: 'tierFree', late25: 'tierLate25', late50: 'tierLate50' };
  var STATUS_KEYS = { 'free-window': 'statusFree', late: 'statusLate', adult: 'statusAdult' };

  function doCalc() {
    var dob = $('dobInput').value.trim();
    var app = $('appDateInput').value.trim();
    var res = L.calcFee(dob, app);
    $('calcError').hidden = true;
    if (!res.ok) {
      $('calcError').textContent = t(ERR_KEYS[res.error] || 'errInvalidDob');
      $('calcError').hidden = false;
      $('resultBox').hidden = true;
      return;
    }
    $('resFee').textContent = fmtTaka(res.fee);
    $('resTier').textContent = t(TIER_KEYS[res.tier]);
    $('resDays').textContent = digits(res.days);
    $('resDeadline').textContent = digits(res.freeDeadline);
    $('resAge').textContent = digits(res.age.years) + ' ' + t('ageYears') + ', ' +
      digits(res.age.months) + ' ' + t('ageMonths') + ', ' +
      digits(res.age.days) + ' ' + t('ageDays');
    var badge = $('resStatus');
    badge.textContent = t(STATUS_KEYS[res.status]);
    badge.className = 'badge ' + res.status;
    $('resultBox').hidden = false;
  }

  // --- fee chart ---
  function renderChart() {
    var body = $('feeBody');
    body.innerHTML = '';
    D.FEE_ROWS.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row.kind === 'reg') {
        tr.className = 'clickable';
        tr.title = t('tapHint');
        tr.addEventListener('click', function () { loadTierIntoCalc(row.id); });
      }
      var a = document.createElement('td'); a.textContent = loc(row.range);
      var b = document.createElement('td'); b.textContent = fmtTaka(row.fee);
      var c = document.createElement('td'); c.textContent = row.abroad === 'Free' ? t('free') : row.abroad;
      var d = document.createElement('td'); d.textContent = loc(row.note);
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(c); tr.appendChild(d);
      body.appendChild(tr);
    });
  }

  function loadTierIntoCalc(tierId) {
    var today = todayDate();
    var dob;
    if (tierId === 'free') dob = L.addDays(today, -10);
    else if (tierId === 'late25') dob = L.addDays(today, -100);
    else dob = L.addYears(today, -6);
    $('dobInput').value = L.fmtDate(dob);
    $('appDateInput').value = todayStr();
    showTab('calc');
    doCalc();
  }

  // --- guides ---
  function renderGuides() {
    var wrap = $('guidesWrap');
    wrap.innerHTML = '';
    D.GUIDES.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'card sub';
      var h = document.createElement('h3');
      h.textContent = loc(I.GUIDE_TITLES[g.id]);
      card.appendChild(h);
      var prog = document.createElement('p');
      prog.className = 'hint';
      var pct = L.progressPct(state.guides[g.id]);
      prog.textContent = digits(pct) + '% ' + t('done');
      card.appendChild(prog);
      var bar = document.createElement('div');
      bar.className = 'bar';
      var fill = document.createElement('div');
      fill.className = 'barfill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      var list = document.createElement('ol');
      list.className = 'steps';
      g.steps.forEach(function (step, i) {
        var li = document.createElement('li');
        var lab = document.createElement('label');
        lab.className = 'check';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!state.guides[g.id][i];
        cb.addEventListener('change', function () {
          state.guides[g.id][i] = cb.checked;
          save();
          renderGuides();
          renderData();
        });
        var sp = document.createElement('span');
        sp.textContent = loc(step);
        lab.appendChild(cb);
        lab.appendChild(sp);
        li.appendChild(lab);
        list.appendChild(li);
      });
      card.appendChild(list);
      wrap.appendChild(card);
    });
  }

  // --- checklists ---
  function renderChecklists() {
    var overall = L.overallPct(state.checks);
    $('overallPct').textContent = t('overall') + ': ' + digits(overall) + '%';
    $('overallFill').style.width = overall + '%';
    var wrap = $('checksWrap');
    wrap.innerHTML = '';
    D.CHECKLISTS.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'card sub';
      var h = document.createElement('h3');
      h.textContent = loc(I.CHECK_TITLES[c.id]);
      card.appendChild(h);
      var prog = document.createElement('p');
      prog.className = 'hint';
      prog.textContent = digits(L.progressPct(state.checks[c.id])) + '% ' + t('done');
      card.appendChild(prog);
      var list = document.createElement('ul');
      list.className = 'steps';
      c.items.forEach(function (item, i) {
        var li = document.createElement('li');
        var lab = document.createElement('label');
        lab.className = 'check';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!state.checks[c.id][i];
        cb.addEventListener('change', function () {
          state.checks[c.id][i] = cb.checked;
          save();
          renderChecklists();
          renderData();
        });
        var sp = document.createElement('span');
        sp.textContent = loc(item);
        lab.appendChild(cb);
        lab.appendChild(sp);
        li.appendChild(lab);
        list.appendChild(li);
      });
      card.appendChild(list);
      wrap.appendChild(card);
    });
  }

  // --- quiz ---
  var quiz = { started: false, idx: 0, answers: [], answered: false };

  function renderQuizIntro() {
    $('quizStartBox').hidden = quiz.started;
    $('quizBox').hidden = !quiz.started;
    $('quizResult').hidden = true;
    if (!quiz.started) {
      $('quizBestLine').textContent = t('quizBest') + ': ' + digits(state.quizBest) + ' / ' + digits(10);
    }
  }

  function renderQuestion() {
    var q = D.QUIZ[quiz.idx];
    quiz.answered = false;
    $('quizQ').textContent = t('quizOf') + ' ' + digits(quiz.idx + 1) + ' / ' + digits(D.QUIZ.length) + ': ' + loc(q.q);
    var opts = $('quizOpts');
    opts.innerHTML = '';
    q.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt';
      btn.textContent = loc(opt);
      btn.addEventListener('click', function () { answerQuiz(i, btn); });
      opts.appendChild(btn);
    });
    $('quizFeedback').hidden = true;
    $('quizNext').hidden = true;
    $('quizNext').textContent = quiz.idx === D.QUIZ.length - 1 ? t('quizFinish') : t('quizNext');
  }

  function answerQuiz(i, btn) {
    if (quiz.answered) return;
    quiz.answered = true;
    quiz.answers[quiz.idx] = i;
    var q = D.QUIZ[quiz.idx];
    var correct = i === q.answer;
    var buttons = $('quizOpts').querySelectorAll('button');
    buttons.forEach(function (b, j) {
      b.disabled = true;
      if (j === q.answer) b.classList.add('correct');
      if (j === i && !correct) b.classList.add('wrong');
    });
    var fb = $('quizFeedback');
    fb.textContent = (correct ? t('quizCorrect') : t('quizWrong') + ' ' + loc(q.options[q.answer])) + ' ' + loc(q.explain);
    fb.className = correct ? 'note' : 'note warn';
    fb.hidden = false;
    $('quizNext').hidden = false;
  }

  function nextQuiz() {
    if (quiz.idx < D.QUIZ.length - 1) {
      quiz.idx++;
      renderQuestion();
      return;
    }
    var score = L.quizScore(quiz.answers, D.QUIZ);
    state.quizLast = score.correct;
    if (score.correct > state.quizBest) state.quizBest = score.correct;
    save();
    quiz.started = false;
    $('quizBox').hidden = true;
    $('quizStartBox').hidden = true;
    $('quizResult').hidden = false;
    $('quizScoreText').textContent = t('quizScore') + ': ' + digits(score.correct) + ' / ' + digits(score.total);
    $('quizBestLine2').textContent = t('quizBest') + ': ' + digits(state.quizBest) + ' / ' + digits(10);
    $('quizDoneTitle').textContent = t('quizDone');
    renderData();
  }

  // --- data tab ---
  function renderData() {
    var guidesDone = 0, guidesTotal = 0;
    D.GUIDES.forEach(function (g) {
      state.guides[g.id].forEach(function (v) { guidesTotal++; if (v) guidesDone++; });
    });
    var checksDone = 0, checksTotal = 0;
    D.CHECKLISTS.forEach(function (c) {
      state.checks[c.id].forEach(function (v) { checksTotal++; if (v) checksDone++; });
    });
    $('dataSummary').textContent =
      t('guidesDone') + ': ' + digits(guidesDone) + '/' + digits(guidesTotal) + ' - ' +
      t('checksDone') + ': ' + digits(checksDone) + '/' + digits(checksTotal) + ' - ' +
      t('quizBest') + ': ' + digits(state.quizBest) + '/' + digits(10);
    $('dataEmpty').hidden = (guidesDone + checksDone + state.quizBest) > 0;
  }

  function exportPayload() {
    return JSON.stringify({ app: L.APP, version: L.VERSION, state: state });
  }
  function importPayload(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    var v = L.validateImport(parsed, D);
    if (!v.ok) return v;
    var s = parsed.state;
    if (s.lang) state.lang = s.lang;
    if (s.guides) D.GUIDES.forEach(function (g) {
      if (L.validBoolArray(s.guides[g.id], g.steps.length)) state.guides[g.id] = s.guides[g.id];
    });
    if (s.checks) D.CHECKLISTS.forEach(function (c) {
      if (L.validBoolArray(s.checks[c.id], c.items.length)) state.checks[c.id] = s.checks[c.id];
    });
    if (typeof s.quizBest === 'number') state.quizBest = s.quizBest;
    if (typeof s.quizLast === 'number') state.quizLast = s.quizLast;
    save();
    quiz.started = false;
    applyLang();
    return { ok: true };
  }
  function eraseAll() {
    D.GUIDES.forEach(function (g) { state.guides[g.id] = blankBools(g.steps.length); });
    D.CHECKLISTS.forEach(function (c) { state.checks[c.id] = blankBools(c.items.length); });
    state.quizBest = 0;
    state.quizLast = null;
    quiz.started = false;
    save();
    applyLang();
    return { ok: true };
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function init() {
    load();
    $('appDateInput').value = todayStr();
    applyLang();
    showTab('calc');

    ['calc', 'chart', 'guides', 'check', 'quiz', 'data'].forEach(function (n) {
      $('tabbtn-' + n).addEventListener('click', function () { showTab(n); });
    });
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save();
      applyLang();
    });
    $('calcBtn').addEventListener('click', doCalc);
    $('quizStartBtn').addEventListener('click', function () {
      quiz.started = true;
      quiz.idx = 0;
      quiz.answers = [];
      renderQuizIntro();
      renderQuestion();
    });
    $('quizNext').addEventListener('click', nextQuiz);
    $('quizRestartBtn').addEventListener('click', function () {
      quiz.started = true;
      quiz.idx = 0;
      quiz.answers = [];
      renderQuizIntro();
      renderQuestion();
    });
    $('exportBtn').addEventListener('click', function () { download('birth-certificate-bd-backup.json', exportPayload()); });
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = importPayload(String(r.result));
        var m = $('importMsg');
        m.textContent = res.ok ? t('importOk') : t('importBad');
        m.hidden = false;
      };
      r.readAsText(f);
      ev.target.value = '';
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value.trim() === 'DELETE') {
        eraseAll();
        $('eraseMsg').textContent = t('erasedMsg');
        $('eraseMsg').hidden = false;
        $('eraseInput').value = '';
      }
    });
  }

  window.__bc = {
    state: state, exportPayload: exportPayload, importPayload: importPayload,
    eraseAll: eraseAll, calcFee: L.calcFee, todayStr: todayStr
  };
  document.addEventListener('DOMContentLoaded', init);
})();
