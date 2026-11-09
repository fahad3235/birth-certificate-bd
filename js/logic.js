// birth-certificate-bd - pure fee / age / progress / quiz / import logic (no DOM).
// Node-testable. All dates are UTC calendar dates (YYYY-MM-DD).
//
// Fee basis - Birth and Death Registration Rules, 2018 (S.R.O. No. 79-Act/2018,
// Bangladesh Gazette, 8 March 2018), Rule 21 fee table, domestic rates:
//   * registration up to 45 days of birth: Free
//   * 46 days to 5 years: 25 Taka (abroad $1)
//   * after 5 years: 50 Taka (abroad $1)
//   * correction of date of birth: 100 Taka (abroad $2)
//   * correction of name / father's name / mother's name / address: 50 Taka ($1)
//   * copy of certificate after correction: Free
//   * duplicate / copy of certificate (English): 50 Taka ($1) - Financial Express,
//     19 Dec 2017, reporting the same fee revision.
// Older guides cite 500 Taka after 10 years; that was the pre-2018 schedule
// (100 for 46d-5y, 200 for 5-10y, 500 above 10y). The 2018 Rules set 50 Taka
// after 5 years with no higher tier, so no 10-year tier is used here.
// Process: Birth and Death Registration Act, 2004, s.8 (inform within 45 days),
// s.13 (delayed registration with late fee), s.15 (correction with fee).
// Portal: bdris.gov.bd/br/application; verification: everify.bdris.gov.bd;
// correction module: bdris.gov.bd/br/correction.
(function (root) {
  'use strict';

  var APP = 'birth-certificate-bd';
  var VERSION = 1;

  var FREE_DAYS = 45;
  var LATE_FEE_5Y = 25;
  var LATE_FEE_AFTER_5Y = 50;
  var CORRECTION_DOB_FEE = 100;
  var CORRECTION_NAME_FEE = 50;
  var DUPLICATE_FEE = 50;
  var MIN_YEAR = 1900;

  function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }

  // Strict YYYY-MM-DD parse; returns a UTC Date or null.
  function parseDate(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function fmtDate(dt) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate());
  }

  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function addDays(dt, n) {
    return new Date(dt.getTime() + n * 86400000);
  }

  // Add calendar years, clamping Feb 29 to Feb 28 in non-leap years.
  function addYears(dt, n) {
    var y = dt.getUTCFullYear() + n, m = dt.getUTCMonth(), day = dt.getUTCDate();
    var nd = new Date(Date.UTC(y, m, day));
    if (nd.getUTCMonth() !== m) nd = new Date(Date.UTC(y, m + 1, 0));
    return nd;
  }

  // Calendar age: { years, months, days }.
  function ageParts(dob, asOf) {
    var years = asOf.getUTCFullYear() - dob.getUTCFullYear();
    var months = asOf.getUTCMonth() - dob.getUTCMonth();
    var days = asOf.getUTCDate() - dob.getUTCDate();
    if (days < 0) {
      months--;
      var prev = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0));
      days += prev.getUTCDate();
    }
    if (months < 0) { years--; months += 12; }
    return { years: years, months: months, days: days };
  }

  // Fee + age + status for a date of birth and an application date.
  // Returns { ok, days, tier ('free'|'late25'|'late50'), fee, freeDeadline,
  //   fiveYearDate, age {years,months,days}, status ('free-window'|'late'|'adult') }
  // or { ok:false, error }.
  function calcFee(dobStr, appStr) {
    if (!dobStr) return { ok: false, error: 'missing-dob' };
    var dob = parseDate(dobStr);
    if (!dob) return { ok: false, error: 'invalid-dob' };
    if (!appStr) return { ok: false, error: 'missing-app' };
    var app = parseDate(appStr);
    if (!app) return { ok: false, error: 'invalid-app' };
    if (dob.getUTCFullYear() < MIN_YEAR) return { ok: false, error: 'too-old' };
    var days = daysBetween(dob, app);
    if (days < 0) return { ok: false, error: 'before-birth' };
    var freeDeadline = addDays(dob, FREE_DAYS);
    var fiveYear = addYears(dob, 5);
    var tier, fee;
    if (days <= FREE_DAYS) { tier = 'free'; fee = 0; }
    else if (app < fiveYear) { tier = 'late25'; fee = LATE_FEE_5Y; }
    else { tier = 'late50'; fee = LATE_FEE_AFTER_5Y; }
    var age = ageParts(dob, app);
    var status = days <= FREE_DAYS ? 'free-window' : (age.years >= 18 ? 'adult' : 'late');
    return {
      ok: true,
      days: days,
      tier: tier,
      fee: fee,
      freeDeadline: fmtDate(freeDeadline),
      fiveYearDate: fmtDate(fiveYear),
      age: age,
      status: status
    };
  }

  // --- checklist / guide progress ---
  function progressPct(done) {
    if (!Array.isArray(done) || done.length === 0) return 0;
    var n = 0;
    for (var i = 0; i < done.length; i++) if (done[i]) n++;
    return Math.round(n * 100 / done.length);
  }

  // Overall % across several lists: { id: [bool, ...], ... }.
  function overallPct(lists) {
    var done = 0, total = 0;
    for (var k in lists) {
      if (!Array.isArray(lists[k])) continue;
      for (var i = 0; i < lists[k].length; i++) { total++; if (lists[k][i]) done++; }
    }
    return total === 0 ? 0 : Math.round(done * 100 / total);
  }

  // --- quiz ---
  // answers: array of chosen option indexes (or null/undefined for skipped).
  function quizScore(answers, questions) {
    var correct = 0;
    for (var i = 0; i < questions.length; i++) {
      if (answers && answers[i] === questions[i].answer) correct++;
    }
    return { correct: correct, total: questions.length };
  }

  // --- formatting ---
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  // "25" -> "Tk 25"; used with digits() for Bengali rendering in the app.
  function formatTaka(n) { return 'Tk ' + n; }

  // --- state / import validation ---
  // Expected state shape:
  //   { lang, guides: {id:[bool]}, checks: {id:[bool]}, quizBest, quizLast }
  function validBoolArray(a, len) {
    if (!Array.isArray(a) || a.length !== len) return false;
    for (var i = 0; i < a.length; i++) if (typeof a[i] !== 'boolean') return false;
    return true;
  }

  function validateImport(payload, content) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'not-object' };
    if (payload.app !== APP || payload.version !== VERSION) return { ok: false, error: 'app-version' };
    var s = payload.state;
    if (!s || typeof s !== 'object') return { ok: false, error: 'state' };
    if (s.lang !== undefined && s.lang !== 'en' && s.lang !== 'bn') return { ok: false, error: 'lang' };
    if (content) {
      if (s.guides !== undefined) {
        if (typeof s.guides !== 'object') return { ok: false, error: 'guides' };
        for (var i = 0; i < content.GUIDES.length; i++) {
          var g = content.GUIDES[i];
          if (s.guides[g.id] !== undefined && !validBoolArray(s.guides[g.id], g.steps.length)) return { ok: false, error: 'guides' };
        }
      }
      if (s.checks !== undefined) {
        if (typeof s.checks !== 'object') return { ok: false, error: 'checks' };
        for (var j = 0; j < content.CHECKLISTS.length; j++) {
          var c = content.CHECKLISTS[j];
          if (s.checks[c.id] !== undefined && !validBoolArray(s.checks[c.id], c.items.length)) return { ok: false, error: 'checks' };
        }
      }
      if (s.quizAnswers !== undefined) {
        if (!Array.isArray(s.quizAnswers)) return { ok: false, error: 'quiz' };
        for (var k = 0; k < s.quizAnswers.length; k++) {
          var a = s.quizAnswers[k];
          if (a !== null && a !== undefined && (!isFiniteNumber(a) || a < 0 || a > 3 || Math.floor(a) !== a)) return { ok: false, error: 'quiz' };
        }
      }
    }
    if (s.quizBest !== undefined && (!isFiniteNumber(s.quizBest) || s.quizBest < 0 || s.quizBest > 10 || Math.floor(s.quizBest) !== s.quizBest)) return { ok: false, error: 'quizBest' };
    if (s.quizLast !== undefined && s.quizLast !== null && (!isFiniteNumber(s.quizLast) || s.quizLast < 0 || s.quizLast > 10 || Math.floor(s.quizLast) !== s.quizLast)) return { ok: false, error: 'quizLast' };
    return { ok: true };
  }

  var api = {
    APP: APP, VERSION: VERSION,
    FREE_DAYS: FREE_DAYS,
    LATE_FEE_5Y: LATE_FEE_5Y,
    LATE_FEE_AFTER_5Y: LATE_FEE_AFTER_5Y,
    CORRECTION_DOB_FEE: CORRECTION_DOB_FEE,
    CORRECTION_NAME_FEE: CORRECTION_NAME_FEE,
    DUPLICATE_FEE: DUPLICATE_FEE,
    parseDate: parseDate,
    fmtDate: fmtDate,
    daysBetween: daysBetween,
    addDays: addDays,
    addYears: addYears,
    ageParts: ageParts,
    calcFee: calcFee,
    progressPct: progressPct,
    overallPct: overallPct,
    quizScore: quizScore,
    toBnDigits: toBnDigits,
    formatTaka: formatTaka,
    validateImport: validateImport,
    validBoolArray: validBoolArray
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BirthLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
