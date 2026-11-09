# TEST RESULTS — birth-certificate-bd (run #280, 2026-11-09 09:00 slot)

## Node unit tests — 60/60 passed (0 failed)
Command: `node tests/logic.test.js`

Hand-verified exact values (asof 2026-11-09):
- DOB 2026-10-25, app 2026-11-09: 15 days, tier free, fee 0, free deadline **2026-12-09**, age 0y 0m 15d, status free-window
- DOB 2026-09-25: **45 days exactly → Free**; free deadline is the application day itself
- DOB 2026-09-24: **46 days → late25, Tk 25**, status late
- DOB 2021-11-10: one day short of 5 years → **late25, Tk 25**; fiveYearDate 2026-11-10
- DOB 2021-11-09: **exactly 5 years → late50, Tk 50**
- DOB 2020-11-09: 6 years → late50, status late (not adult), age 6y 0m 0d
- DOB 2008-11-09: exactly 18 years → status adult
- DOB 2000-01-01: 26 years → late50, status adult
- Age math: DOB 2020-03-15 → app 2026-11-09 = **6y 7m 25d**
- Leap day: DOB 2024-02-29 → 5-year date clamps to **2029-02-28**; app 2029-02-27 → late25, app 2029-02-28 → late50
- Validation: app before birth, future DOB, missing/invalid DOB/app, DOB before 1900 — all rejected with the right error; DOB 1900-01-01 accepted
- parseDate: 2024-02-29 valid, 2026-02-29 / 2026-04-31 / month 13 / wrong format / garbage all rejected
- Progress: 2/3 = 67%, empty = 0, all = 100; overall 3/24 = 13%
- Quiz: all correct = 10/10, half wrong = 5/10, all skipped = 0; quiz answers match verified fees (Q2 Tk 25, Q3 Tk 50, Q4 Tk 100)
- Content: 7 fee rows (0/25/50 + 100/50/50/0), 3 guides x 6 steps, 4 checklists x 6 items
- Formatting: toBnDigits('12586') = '১২৫৮৬'; formatTaka(25) = 'Tk 25'
- Import: good payload accepted; wrong app / version 2 / missing state / bad lang / bad guide length / non-bool checklist / quizBest 11 / null — all rejected

Repairs: 1 test-side fix during testing — a unit test expected status 'adult' for a 6-year-old; the logic was right (adult means 18+), the test was corrected to expect 'late' and a separate exactly-18-years case was added. 0 app-logic bugs found by unit tests.

## Headless-Chrome smoke tests — 61/61 passed (0 failed)
Command: `node tests/smoke.js` (raw CDP, headless_shell-1187, file:// + ?asof=2026-11-09)

- Page renders: title, 6 tabs, app date defaults to 2026-11-09, DOB ships empty (no sample person)
- Calc: 15d → Free, 15 days, deadline 2026-12-09, Within free window, age 0y 0m 15d; 45d → Free; 46d → Tk 25 with late tier label; 5y → Tk 50; adult → Tk 50 + Adult badge
- Validation: empty DOB shows inline error; application before birth shows error and hides the result
- Chart: 7 rows, row 2 Tk 25, row 4 Tk 100 (DOB correction); clicking the late25 row switches to the calc tab, loads DOB 2026-08-01 (today − 100 days), result Tk 25
- Guides: 3 guides, 18 steps total; ticking 1 step → 17% done, persists after reload
- Checklists: 4 lists; ticking 3 newborn items → 50% list, 13% overall, persists after reload
- Quiz: Q1 correct → 'Correct!' feedback; Q2 wrong → 'Not quite' + correct answer; finishing with one wrong = 9/10, best 9/10 saved; replay all correct = 10/10, best updated to 10
- Export/import: payload is birth-certificate-bd v1, carries quizBest 10; eraseAll clears quizBest and guide progress; valid import restores quizBest 10; wrong-app import rejected with data intact
- i18n: Bengali title + tab label + Bengali-digit fee (Tk ২৫) and days (৪৬), persists after reload, back to EN
- Mobile: 390px no horizontal overflow on calc / chart / guides / quiz tabs
- Zero non-file network requests; 0 console/page errors

Repairs: 1 test-side fix only — two import assertions JSON-stringified the export string (escaping its quotes), so the '"quizBest":10' substring never matched; the assertions now read the raw export string. 0 app-logic bugs in the smoke run.

## ASCII hygiene
All shipped sources are pure ASCII (Bengali stored as \uXXXX escapes in JS; static HTML uses plain English). Verified with `grep -P '[^\x00-\x7F]'` — 0 matches across index.html, css/, js/, tests/. Bengali decode spot-checked in Node: title renders 'জন্ম সনদ বিডি', quiz Q1 renders 'বাংলাদেশে জন্মের কত দিন পর্যন্ত জন্ম নিবন্ধন বিনামূল্যে?'.

## Facts verified before build (web search, 2026-11-09)
- Fee schedule (Rules, 2018, S.R.O. 79-Act/2018, Gazette 8 Mar 2018): free ≤45 days, Tk 25 for 46 days–5 years, Tk 50 after 5 years, Tk 100 DOB correction, Tk 50 name/parents/address correction, free copy after correction, Tk 50 duplicate/English copy. Abroad: $1 / $1 / $2 / $1 / $1 / free.
- Act, 2004, s.8 (45 days), s.13 (delayed registration), s.15 (correction); portal bdris.gov.bd/br/application; verification everify.bdris.gov.bd; correction bdris.gov.bd/br/correction; submit at Union Parishad / Pourashava / City Corporation / Cantonment Board.
- Documents by age band (EPI/hospital certificate; vaccinator certificate; PEC/JSC/SSC or MBBS age certificate; parents' NIDs; holding tax receipt; mobile number).
- NOT verified and handled by omission/labelling: 'Tk 500 after 10 years' is the pre-2018 schedule (omitted; quiz explains the conflict); 'certificate ready in 7–15 days' is guide-site reporting only (labelled '(reported)'); parents' 17-digit numbers mandatory vs optional conflict (app says 'if available'); Union Parishad no longer processing corrections since Jan 2020 (labelled '(reported)').
