# Birth Certificate BD

A free, fully offline bilingual (English / বাংলা) Bangladesh birth certificate (জন্ম নিবন্ধন) guide. It answers the three questions every family asks: **how much is the fee, what are the steps, and which documents do I need?** — with a fee calculator, step-by-step guides, document checklists, and a quiz, all using the official fee schedule.

No network requests, no tracking — everything runs in the browser and all data stays in your device's localStorage.

## Problem

Birth registration is compulsory in Bangladesh (Birth and Death Registration Act, 2004), and it is free only for the first 45 days. After that a late fee applies, and the fee, the documents, and the steps all change with the child's age — yet the rules are scattered across gazettes, guide sites, and office counters, and older guides still quote the pre-2018 fees. This tool puts the current, sourced rules in one offline page.

## Features

- **Fee calculator** — date of birth + application date (defaults to today) → days since birth, fee tier, fee amount, free-window deadline (birth + 45 days), current age, and a status badge (Within free window / Late — fee applies / Adult). Inline validation rejects bad dates and an application date before the birth.
- **Fee chart** — the full verified fee table (7 rows, home + abroad rates). Tap a registration row to load a sample date into the calculator.
- **Step-by-step guides (3)** — New registration (online via bdris.gov.bd), Late registration, Correction of information — 6 steps each, with persisted mark-as-done progress.
- **Document checklists (4)** — Newborn, Child, Adult, Correction — 6 items each, tick-off progress persisted per list plus an overall %.
- **Age / status checker** — from the date of birth: age in years/months/days, registration status, and the free-window deadline.
- **10-question quiz** — only facts verified from the official fee rules and process (no invented fees or durations), instant feedback with explanations, best score persisted.
- **JSON export + strict import + typed-DELETE erase-all** — backup and restore progress across devices. Ships empty: no sample person is pre-filled.
- **Bilingual UI** — EN / বাংলা toggle with Bengali digits, persisted across sessions.
- **Responsive** — mobile-friendly at 390px, no horizontal overflow.

## Verified facts (with sources)

All fee and process facts below were verified from published sources on 2026-11-09 before building. Every fee in the app is labelled "reported — verify on bdris.gov.bd before paying".

- **Fee schedule — Birth and Death Registration Rules, 2018 (S.R.O. No. 79-Act/2018, Bangladesh Gazette, 8 March 2018), Rule 21 fee table:**
  - Registration up to 45 days after birth: **Free**
  - 46 days to 5 years: **৳25** at home, $1 abroad
  - After 5 years: **৳50** at home, $1 abroad
  - Correction of date of birth: **৳100** ($2 abroad)
  - Correction of name / father's name / mother's name / address: **৳50** ($1 abroad)
  - Copy of certificate after a correction: **Free** (Bangla and English)
  - Duplicate / copy of certificate (English): **৳50** ($1 abroad) — Financial Express, 19 Dec 2017, reporting the same fee revision
- **Law:** Birth and Death Registration Act, 2004 (Act No. 29 of 2004); section 8 requires the father, mother or guardian to inform the registrar within 45 days of birth; section 13 allows delayed registration with a late fee; section 15 allows correction with the prescribed fee.
- **Portal:** apply online at bdris.gov.bd/br/application; verify a certificate at everify.bdris.gov.bd; corrections through bdris.gov.bd/br/correction.
- **Where to submit:** the printed application and original documents go to the Union Parishad, Pourashava, City Corporation or Cantonment Board office selected in the form.
- **Documents:** newborn — EPI (vaccination) card or hospital birth/discharge certificate; 46 days–5 years — EPI card or vaccinator's certificate; after 5 years — PEC/JSC/SSC certificate or an MBBS doctor's age certificate; always — parents' NIDs, parents' 17-digit birth registration numbers if available, holding tax receipt for address proof, a parent's mobile number.

## Facts NOT verified — and how the app handles them

- **"Tk 500 after 10 years"** — several older guides cite ৳500 for registration more than 10 years after birth. That was the pre-2018 schedule (৳100 for 46 days–5 years, ৳200 for 5–10 years, ৳500 above 10 years). The 2018 Rules set ৳50 after 5 years with no higher tier, so the app uses the 2018 schedule and the quiz explains the conflict. No 10-year tier exists in the app.
- **"Certificate ready in 7 to 15 days"** — reported by guide sites only, not by an official source. The app states it as "(reported)" and does not use it in any calculation.
- **"Parents' 17-digit birth registration numbers are mandatory"** — sources conflict (one says not mandatory since 27 July 2022; another says mandatory for people born after 1 January 2001). The app says "if available" and never blocks on it.
- **"Union Parishad offices no longer process corrections (since January 2020)"** — reported by a guide site, not confirmed from an official notice. The app labels it "(reported)".

Sources: Birth and Death Registration Rules, 2018 (assets.crvslaws.org — Gazette PDF); Financial Express, "Govt lessens fees to register births, deaths", 19 Dec 2017; Birth and Death Registration Act, 2004 (platform.who.int — unofficial translation); BSS, "Right to birth, death registration is one of basics of state management", 8 May 2026; birthcertificatecheck.com (process and documents guide, updated 20 Oct 2026); legalclarity.org (registration, fees and uses guide).

## Stack

Vanilla HTML + CSS + JavaScript. No frameworks, no build step, no dependencies, zero runtime network requests. Dates are UTC calendar dates; fee boundaries are exact (45 days, 5 calendar years).

## Prerequisites

Any modern browser. For tests: Node.js 18+ and a Chromium binary (system Chromium or Chrome).

## Install

No install needed — open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Dev commands

```bash
node tests/logic.test.js  # 60 node unit tests (fee boundaries, age math, progress, quiz, import)
node tests/smoke.js       # 61 headless-Chrome smoke tests (UI, persistence, quiz flow, i18n, mobile)
```

## Testing

- Unit tests: hand-verified exact values, e.g. DOB 2026-09-25 applied 2026-11-09 = 45 days → **Free**; DOB 2026-09-24 = 46 days → **Tk 25**; DOB 2021-11-09 applied 2026-11-09 = exactly 5 years → **Tk 50**; DOB 2021-11-10 = one day short of 5 years → **Tk 25**; leap-day DOB 2024-02-29 has its 5-year date clamped to 2029-02-28. See `TEST_RESULTS.md`.
- Smoke tests: real headless-Chrome run over `file://` with `?asof=2026-11-09` — calculator hand-verified cases, chart row click loading a sample date, guide/checklist progress persisting across reload, full quiz flow (9/10 then 10/10), export → erase → import round-trip, Bengali toggle + persistence, 390px no-overflow on four tabs, zero non-file network requests, 0 console/page errors.

## Deployment

Static site — any static host works. GitHub Pages: push to `main`, enable Pages (main branch, root).

## Limitations

- This is an unofficial guide, not a government app. Fees are reported from the 2018 Rules and can change — verify on bdris.gov.bd before paying.
- The app never applies for you; it prepares you for the official portal and office visit.
- "Usually ready in 7–15 days" and the correction-route note are reported, not officially confirmed — see "Facts NOT verified" above.
- Dates before 1900 are rejected as a sanity cap.

## Status

Complete MVP — fee calculator, fee chart, 3 guides, 4 checklists, age/status checker, 10-question quiz, bilingual UI, export/import/erase, tests green.
