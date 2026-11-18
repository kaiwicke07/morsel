# Morsel — design

Approved by Kai on 2026-11-18.

## Why
Kai doesn't want to pay for Cal AI. He wants his own app on his iPhone with the same features: snap a meal, get calories and macros, track progress.

## Goals
- Feature parity with Cal AI (researched from 2026 walkthroughs): onboarding → plan, home dashboard, photo/barcode/label/search/describe logging, food detail with AI fix, exercise, water, progress + weight, badges, settings.
- Installs on iPhone from Safari (Add to Home Screen), full-screen, works offline for everything except AI and lookups.
- Own name (Morsel) and own visual identity.

## Non-goals
- No accounts, cloud sync, social/groups, paywall, referral, Apple Health steps (not reachable from a web app).
- No copying of Cal AI's name, logo, copy or monochrome look.

## Anti-goals
- A scan that silently fails or loses the photo. Every scan has a visible analyzing state and a retry.
- Data loss: provide export/import backup.

## Approaches considered
1. **Installable web app (PWA), key on device, direct API calls** — chosen. No Apple dev account, no Mac, no server, free hosting on GitHub Pages.
2. Native iOS (Swift/Expo) — needs a Mac or $99/yr dev account to keep it installed. Rejected.
3. PWA + Vercel proxy holding the key — Kai's Vercel CLI currently needs 2FA set up, and a key on his own phone is fine for a single-user app. Rejected for now.

## Decisions
- AI: Claude API via `@anthropic-ai/sdk` in the browser (`dangerouslyAllowBrowser`), model `claude-opus-5-5`, structured JSON output. Gemini free tier as an optional backup provider in Settings. Kai supplies the key.
- Data: IndexedDB (Dexie) on the phone. Photos stored downscaled as JPEG blobs.
- Lookups: Open Food Facts (barcode), USDA FoodData Central (search; DEMO_KEY, user key optional).
- Plan math: Mifflin-St Jeor BMR × activity factor (0-2: 1.375, 3-5: 1.55, 6+: 1.725), ± pace × 500 kcal per lb/week, floor 1200 (F) / 1500 (M). Protein ≈ 0.8 g/lb bodyweight clamped to 25-35% of kcal, fat 27%, carbs the rest. Fiber 14 g/1000 kcal, sugar ≤ 10% kcal... shown as limit, sodium 2300 mg.
- Exercise kcal = MET × kg × hours. Run MET low 3.5 / med 9.8 / high 14.5; lifting 3.5 / 5 / 6.
- Rollover: up to 200 kcal of yesterday's unused target, only if yesterday had food logged.
- Burned calories: optionally added to the day's target; macros scale proportionally.
- Streak: consecutive days with at least one food logged, ending today or yesterday.
- Look: warm paper (#F3EDE2) and ink (#1E1915), paprika accent (#D4471C), protein plum, carbs saffron, fat olive. Fraunces for numbers/headings, Instrument Sans for text. Bar meters, not rings. Dark mode = espresso.
- Hosting: public repo kaiwicke07/morsel + GitHub Pages (approved).

## Left to the builder
Exact screen layouts, copy, animation, badge list details, chart styling.
