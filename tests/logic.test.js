// birth-certificate-bd - Node unit tests (pure logic + content data).
// Usage: node tests/logic.test.js
// Exits non-zero on any failure.
const L = require('../js/logic.js');
const D = require('../js/data.js');

let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// --- parseDate ---
check('parseDate valid', eq(L.parseDate('2026-11-09').toISOString().slice(0, 10), '2026-11-09'));
check('parseDate leap 2024-02-29 valid', L.parseDate('2024-02-29') !== null);
check('parseDate non-leap 2026-02-29 rejected', L.parseDate('2026-02-29') === null);
check('parseDate month 13 rejected', L.parseDate('2026-13-01') === null);
check('parseDate day 32 rejected', L.parseDate('2026-01-32') === null);
check('parseDate 2026-04-31 rejected', L.parseDate('2026-04-31') === null);
check('parseDate wrong format rejected', L.parseDate('2026-1-5') === null && L.parseDate('09/11/2026') === null);
check('parseDate garbage rejected', L.parseDate('hello') === null && L.parseDate('') === null && L.parseDate(null) === null);

// --- fee boundaries (asof 2026-11-09) ---
let r = L.calcFee('2026-10-25', '2026-11-09');
check('15 days: free, fee 0', r.ok && r.days === 15 && r.tier === 'free' && r.fee === 0, JSON.stringify(r));
check('15 days: free deadline 2026-12-09', r.freeDeadline === '2026-12-09', r.freeDeadline);
check('15 days: status free-window', r.status === 'free-window');
check('15 days: age 0y 0m 15d', eq(r.age, { years: 0, months: 0, days: 15 }), JSON.stringify(r.age));

r = L.calcFee('2026-09-25', '2026-11-09');
check('45 days exactly: free', r.ok && r.days === 45 && r.tier === 'free' && r.fee === 0, JSON.stringify(r));
check('45 days: deadline is application day', r.freeDeadline === '2026-11-09', r.freeDeadline);

r = L.calcFee('2026-09-24', '2026-11-09');
check('46 days: late25, fee 25', r.ok && r.days === 46 && r.tier === 'late25' && r.fee === 25, JSON.stringify(r));
check('46 days: status late', r.status === 'late');

r = L.calcFee('2021-11-10', '2026-11-09');
check('1 day short of 5y: late25', r.ok && r.tier === 'late25' && r.fee === 25, JSON.stringify(r));
check('1 day short of 5y: fiveYearDate 2026-11-10', r.fiveYearDate === '2026-11-10', r.fiveYearDate);

r = L.calcFee('2021-11-09', '2026-11-09');
check('exactly 5 years: late50, fee 50', r.ok && r.tier === 'late50' && r.fee === 50, JSON.stringify(r));

r = L.calcFee('2020-11-09', '2026-11-09');
check('6 years: late50, status late (not adult)', r.ok && r.tier === 'late50' && r.fee === 50 && r.status === 'late', JSON.stringify(r));
check('6 years: age 6y 0m 0d', eq(r.age, { years: 6, months: 0, days: 0 }), JSON.stringify(r.age));
r = L.calcFee('2008-11-09', '2026-11-09');
check('exactly 18 years: status adult', r.ok && r.status === 'adult' && r.age.years === 18, JSON.stringify(r));

r = L.calcFee('2000-01-01', '2026-11-09');
check('adult 26y: late50 + adult', r.ok && r.fee === 50 && r.status === 'adult' && r.age.years === 26, JSON.stringify(r));

r = L.calcFee('2020-03-15', '2026-11-09');
check('age math 2020-03-15 -> 6y 7m 25d', eq(r.age, { years: 6, months: 7, days: 25 }), JSON.stringify(r.age));

// Leap-day boundary: born 2024-02-29; 5-year date clamps to 2029-02-28.
r = L.calcFee('2024-02-29', '2029-02-27');
check('leap dob, day before 5y: late25', r.ok && r.tier === 'late25' && r.fiveYearDate === '2029-02-28', JSON.stringify(r));
r = L.calcFee('2024-02-29', '2029-02-28');
check('leap dob, on 5y date: late50', r.ok && r.tier === 'late50', JSON.stringify(r));

// --- validation errors ---
check('app before dob rejected', L.calcFee('2026-11-09', '2026-11-08').error === 'before-birth');
check('future dob rejected as before-birth', L.calcFee('2027-01-01', '2026-11-09').error === 'before-birth');
check('missing dob', L.calcFee('', '2026-11-09').error === 'missing-dob');
check('invalid dob', L.calcFee('2026-02-30', '2026-11-09').error === 'invalid-dob');
check('missing app date', L.calcFee('2026-10-25', '').error === 'missing-app');
check('invalid app date', L.calcFee('2026-10-25', '2026-13-01').error === 'invalid-app');
check('dob before 1900 rejected', L.calcFee('1899-12-31', '2026-11-09').error === 'too-old');
check('dob 1900-01-01 accepted', L.calcFee('1900-01-01', '2026-11-09').ok === true);

// --- progress ---
check('progress 2/3 = 67%', L.progressPct([true, false, true]) === 67, L.progressPct([true, false, true]));
check('progress empty = 0', L.progressPct([]) === 0);
check('progress all = 100', L.progressPct([true, true]) === 100);
check('progress none = 0', L.progressPct([false, false]) === 0);
check('overall 3/24 = 13%', L.overallPct({ a: [true, true, true, false, false, false], b: [false, false, false, false, false, false], c: [false, false, false, false, false, false], d: [false, false, false, false, false, false] }) === 13);
check('overall empty = 0', L.overallPct({}) === 0);

// --- quiz scoring ---
const allCorrect = D.QUIZ.map((q) => q.answer);
check('quiz all correct = 10/10', eq(L.quizScore(allCorrect, D.QUIZ), { correct: 10, total: 10 }));
const halfWrong = allCorrect.map((a, i) => (i % 2 === 0 ? a : (a + 1) % 4));
check('quiz half wrong = 5/10', L.quizScore(halfWrong, D.QUIZ).correct === 5);
check('quiz all skipped = 0', L.quizScore([], D.QUIZ).correct === 0);
check('quiz data: 10 questions, 4 options each, valid answers',
  D.QUIZ.length === 10 && D.QUIZ.every((q) => q.options.length === 4 && q.answer >= 0 && q.answer < 4));
check('quiz answers match verified fees (Q2=25, Q3=50, Q4=100)',
  D.QUIZ[1].options[D.QUIZ[1].answer].en === 'Tk 25' &&
  D.QUIZ[2].options[D.QUIZ[2].answer].en === 'Tk 50' &&
  D.QUIZ[3].options[D.QUIZ[3].answer].en === 'Tk 100');

// --- content data shape ---
check('fee rows: 7 rows, 3 registration tiers', D.FEE_ROWS.length === 7 && D.FEE_ROWS.filter((x) => x.kind === 'reg').length === 3);
check('fee rows match Rules 2018 (0/25/50 + 100/50/50/0)',
  eq(D.FEE_ROWS.map((x) => x.fee), [0, 25, 50, 100, 50, 50, 0]));
check('guides: 3 guides x 6 steps', D.GUIDES.length === 3 && D.GUIDES.every((g) => g.steps.length === 6));
check('checklists: 4 lists x 6 items', D.CHECKLISTS.length === 4 && D.CHECKLISTS.every((c) => c.items.length === 6));

// --- formatting ---
check("toBnDigits('12586') = Bengali digits", L.toBnDigits('12586') === '\u09e7\u09e8\u09eb\u09ee\u09ec');
check('formatTaka(25)', L.formatTaka(25) === 'Tk 25');

// --- import validation ---
function goodState() {
  return {
    lang: 'bn',
    guides: { new: [true, false, false, false, false, false], late: [false, false, false, false, false, false], correction: [false, false, false, false, false, false] },
    checks: { newborn: [true, true, false, false, false, false], child: [false, false, false, false, false, false], adult: [false, false, false, false, false, false], correction: [false, false, false, false, false, false] },
    quizBest: 7, quizLast: 5
  };
}
check('import good payload ok', L.validateImport({ app: 'birth-certificate-bd', version: 1, state: goodState() }, D).ok === true);
check('import wrong app rejected', L.validateImport({ app: 'dua-bd', version: 1, state: goodState() }, D).ok === false);
check('import version 2 rejected', L.validateImport({ app: 'birth-certificate-bd', version: 2, state: goodState() }, D).ok === false);
check('import missing state rejected', L.validateImport({ app: 'birth-certificate-bd', version: 1 }, D).ok === false);
check('import bad lang rejected', L.validateImport({ app: 'birth-certificate-bd', version: 1, state: Object.assign(goodState(), { lang: 'fr' }) }, D).ok === false);
check('import bad guides length rejected', L.validateImport({ app: 'birth-certificate-bd', version: 1, state: Object.assign(goodState(), { guides: { new: [true] } }) }, D).ok === false);
check('import non-bool checklist rejected', L.validateImport({ app: 'birth-certificate-bd', version: 1, state: Object.assign(goodState(), { checks: { newborn: [1, 0, 0, 0, 0, 0] } }) }, D).ok === false);
check('import quizBest 11 rejected', L.validateImport({ app: 'birth-certificate-bd', version: 1, state: Object.assign(goodState(), { quizBest: 11 }) }, D).ok === false);
check('import null rejected', L.validateImport(null, D).ok === false);

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
