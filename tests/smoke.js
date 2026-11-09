// birth-certificate-bd \u2014 headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
// ?asof=2026-11-09 pins "today" for deterministic dates.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9350;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?asof=2026-11-09';
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/bc-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const reload = async () => { await send('Page.navigate', { url: FILE }); await wait(1200); };
  const setDob = async (dob, app) => {
    await ev(`document.getElementById('dobInput').value='${dob}';`);
    await ev(`document.getElementById('appDateInput').value='${app || '2026-11-09'}';`);
    await ev(`document.getElementById('calcBtn').click()`);
  };

  check('page title contains Birth Certificate', (await ev('document.title'))?.includes('Birth Certificate'));
  check('6 tabs render', (await ev(`document.querySelectorAll('.tab').length`)) === 6);
  check('calc tab visible by default', (await ev(`document.getElementById('tab-calc').hidden`)) === false);
  check('app date defaults to asof 2026-11-09', (await ev(`document.getElementById('appDateInput').value`)) === '2026-11-09');
  check('dob ships empty (no sample person)', (await ev(`document.getElementById('dobInput').value`)) === '');

  // Calculator: DOB 2026-10-25 -> 15 days, Free, deadline 2026-12-09, free window.
  await setDob('2026-10-25');
  check('15d fee Free', (await ev(`document.getElementById('resFee').textContent`)) === 'Free');
  check('15d days = 15', (await ev(`document.getElementById('resDays').textContent`)) === '15');
  check('15d deadline 2026-12-09', (await ev(`document.getElementById('resDeadline').textContent`)) === '2026-12-09');
  check('15d status Within free window', (await ev(`document.getElementById('resStatus').textContent`)) === 'Within free window');
  check('15d age 0 years, 0 months, 15 days', (await ev(`document.getElementById('resAge').textContent`)) === '0 years, 0 months, 15 days');

  // 45 days exactly -> Free; 46 days -> Tk 25.
  await setDob('2026-09-25');
  check('45d fee Free', (await ev(`document.getElementById('resFee').textContent`)) === 'Free');
  await setDob('2026-09-24');
  check('46d fee Tk 25', (await ev(`document.getElementById('resFee').textContent`)) === 'Tk 25');
  check('46d tier label late', (await ev(`document.getElementById('resTier').textContent`)).includes('46 days'));

  // Exactly 5 years -> Tk 50; adult -> Adult badge.
  await setDob('2021-11-09');
  check('5y fee Tk 50', (await ev(`document.getElementById('resFee').textContent`)) === 'Tk 50');
  await setDob('2000-01-01');
  check('adult fee Tk 50', (await ev(`document.getElementById('resFee').textContent`)) === 'Tk 50');
  check('adult status badge', (await ev(`document.getElementById('resStatus').textContent`)) === 'Adult \u2014 late registration');

  // Validation: empty DOB, app before birth.
  await ev(`document.getElementById('dobInput').value='';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('empty DOB shows error', (await ev(`document.getElementById('calcError').hidden`)) === false);
  await setDob('2026-11-09', '2026-11-08');
  check('app before birth shows error', (await ev(`document.getElementById('calcError').hidden`)) === false);
  check('result hidden on error', (await ev(`document.getElementById('resultBox').hidden`)) === true);

  // Fee chart: 7 rows; click late25 row (index 1) -> DOB 2026-08-01, fee Tk 25.
  await ev(`document.getElementById('tabbtn-chart').click()`);
  check('chart has 7 rows', (await ev(`document.querySelectorAll('#feeBody tr').length`)) === 7);
  check('chart row 2 fee Tk 25', (await ev(`document.querySelectorAll('#feeBody tr')[1].textContent`)).includes('Tk 25'));
  check('chart row 4 fee Tk 100 (DOB correction)', (await ev(`document.querySelectorAll('#feeBody tr')[3].textContent`)).includes('Tk 100'));
  await ev(`document.querySelectorAll('#feeBody tr')[1].click()`);
  check('chart click switches to calc tab', (await ev(`document.getElementById('tab-calc').hidden`)) === false);
  check('chart click loads DOB 2026-08-01', (await ev(`document.getElementById('dobInput').value`)) === '2026-08-01');
  check('chart click result Tk 25', (await ev(`document.getElementById('resFee').textContent`)) === 'Tk 25');

  // Guides: tick first step of guide 1 -> 17% done, persists after reload.
  await ev(`document.getElementById('tabbtn-guides').click()`);
  check('3 guides render', (await ev(`document.querySelectorAll('#guidesWrap .card').length`)) === 3);
  check('each guide has 6 steps', (await ev(`document.querySelectorAll('#guidesWrap .steps li').length`)) === 18);
  await ev(`document.querySelector('#guidesWrap .card input[type=checkbox]').click()`);
  check('guide progress 17% after 1/6', (await ev(`document.querySelector('#guidesWrap .card .hint').textContent`)).includes('17%'));
  await reload();
  await ev(`document.getElementById('tabbtn-guides').click()`);
  check('guide progress persists after reload', (await ev(`document.querySelector('#guidesWrap .card .hint').textContent`)).includes('17%'));

  // Checklists: tick 3 newborn items -> 50% list, 13% overall, persists.
  await ev(`document.getElementById('tabbtn-check').click()`);
  check('4 checklists render', (await ev(`document.querySelectorAll('#checksWrap .card').length`)) === 4);
  await ev(`document.querySelectorAll('#checksWrap .card')[0].querySelectorAll('input[type=checkbox]')[0].click()`);
  await ev(`document.querySelectorAll('#checksWrap .card')[0].querySelectorAll('input[type=checkbox]')[1].click()`);
  await ev(`document.querySelectorAll('#checksWrap .card')[0].querySelectorAll('input[type=checkbox]')[2].click()`);
  check('newborn checklist 50% after 3/6', (await ev(`document.querySelectorAll('#checksWrap .card')[0].querySelector('.hint').textContent`)).includes('50%'));
  check('overall 13% after 3/24', (await ev(`document.getElementById('overallPct').textContent`)).includes('13%'));
  await reload();
  await ev(`document.getElementById('tabbtn-check').click()`);
  check('checklist persists after reload', (await ev(`document.querySelectorAll('#checksWrap .card')[0].querySelector('.hint').textContent`)).includes('50%'));

  // Quiz: start, answer Q1 correctly (index 2), Q2 wrong, then finish all correct.
  await ev(`document.getElementById('tabbtn-quiz').click()`);
  await ev(`document.getElementById('quizStartBtn').click()`);
  check('quiz question 1 shows', (await ev(`document.getElementById('quizQ').textContent`)).includes('Question 1'));
  await ev(`document.querySelectorAll('#quizOpts button')[2].click()`);
  check('quiz Q1 correct feedback', (await ev(`document.getElementById('quizFeedback').textContent`)).includes('Correct!'));
  await ev(`document.getElementById('quizNext').click()`);
  check('quiz question 2 shows', (await ev(`document.getElementById('quizQ').textContent`)).includes('Question 2'));
  await ev(`document.querySelectorAll('#quizOpts button')[0].click()`);
  check('quiz Q2 wrong feedback shows answer', (await ev(`document.getElementById('quizFeedback').textContent`)).includes('Not quite'));
  // Finish: answer remaining 8 correctly (Q3..Q10), then score 9/10.
  for (let qi = 2; qi < 10; qi++) {
    await ev(`document.getElementById('quizNext').click()`);
    await ev(`document.querySelectorAll('#quizOpts button')[window.BirthData.QUIZ[${qi}].answer].click()`);
  }
  await ev(`document.getElementById('quizNext').click()`);
  check('quiz score 9/10', (await ev(`document.getElementById('quizScoreText').textContent`)).includes('9 / 10'));
  check('quiz best 9/10 saved', (await ev(`document.getElementById('quizBestLine2').textContent`)).includes('9 / 10'));
  // Replay perfectly -> 10/10, best updates.
  await ev(`document.getElementById('quizRestartBtn').click()`);
  for (let qi = 0; qi < 10; qi++) {
    await ev(`document.querySelectorAll('#quizOpts button')[window.BirthData.QUIZ[${qi}].answer].click()`);
    await ev(`document.getElementById('quizNext').click()`);
  }
  check('quiz perfect 10/10', (await ev(`document.getElementById('quizScoreText').textContent`)).includes('10 / 10'));
  check('quiz best updated to 10', (await ev(`document.getElementById('quizBestLine2').textContent`)).includes('10 / 10'));

  // Export / import round-trip + invalid import via test hooks.
  const payload = await ev(`window.__bc.exportPayload()`);
  check('export payload is birth-certificate-bd v1', payload.includes('"app":"birth-certificate-bd"') && payload.includes('"version":1'), payload);
  check('export payload carries quizBest 10', payload.includes('"quizBest":10'), payload);
  await ev(`window.__bc.eraseAll()`);
  check('eraseAll clears quizBest', (await ev(`window.__bc.exportPayload()`)).includes('"quizBest":0'));
  check('eraseAll clears guide progress', (await ev(`JSON.stringify(window.__bc.state.guides.new)`)) === '[false,false,false,false,false,false]');
  const imp = await ev(`JSON.stringify(window.__bc.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores quizBest 10', (await ev(`window.__bc.exportPayload()`)).includes('"quizBest":10'));
  const badImp = await ev(`JSON.stringify(window.__bc.importPayload('{"app":"dua-bd","version":1,"state":{}}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__bc.exportPayload()`)).includes('"quizBest":10'));
  await ev(`window.__bc.eraseAll()`);

  // Language toggle: Bengali title + digits, persists after reload.
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === '\u099c\u09a8\u09cd\u09ae \u09b8\u09a8\u09a6 \u09ac\u09bf\u09a1\u09bf');
  check('BN toggle: tab label in Bengali', (await ev(`document.getElementById('tabbtn-calc').textContent`)) === '\u0995\u09cd\u09af\u09be\u09b2\u0995\u09c1\u09b2\u09c7\u099f\u09b0');
  await setDob('2026-09-24');
  check('BN toggle: fee in Bengali digits', (await ev(`document.getElementById('resFee').textContent`)) === 'Tk \u09e8\u09eb');
  check('BN toggle: days in Bengali digits', (await ev(`document.getElementById('resDays').textContent`)) === '\u09ea\u09ec');
  await reload();
  check('BN toggle persists after reload', (await ev(`window.__bc.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__bc.state.lang`)) === 'en');

  // Mobile 390px: no horizontal overflow on calc / chart / guides / quiz tabs.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await reload();
  const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (calc)', overflow <= 0, 'overflow=' + overflow);
  await ev(`document.getElementById('tabbtn-chart').click()`);
  const overflow2 = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (chart)', overflow2 <= 0, 'overflow=' + overflow2);
  await ev(`document.getElementById('tabbtn-guides').click()`);
  const overflow3 = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (guides)', overflow3 <= 0, 'overflow=' + overflow3);
  await ev(`document.getElementById('tabbtn-quiz').click()`);
  const overflow4 = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (quiz)', overflow4 <= 0, 'overflow=' + overflow4);

  // Zero network requests: app is fully offline (only file:// loads).
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
