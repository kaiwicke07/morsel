# Morsel

A calorie and macro tracker for my iPhone. Snap a meal, scan a barcode or a nutrition label, or just describe what you ate.

- **AI scanning** with your own Claude API key (Opus 5.5 by default) or a free Gemini key. Photos go straight from the phone to the AI; nothing goes through a server.
- **Barcodes** from Open Food Facts and **food search** from USDA FoodData Central. These work without any key.
- Plan from your height, weight, age, activity and goal (Mifflin-St Jeor), with macros, fiber, sugar, sodium and water targets.
- Exercise (run, lifting, describe, manual), burned-calorie add-back, 200-calorie rollover, water, weight trend, BMI, weekly nutrition chart, streaks, badges, progress photos.
- Everything is stored on the phone (IndexedDB). Backups exist, and API keys are never included in them.

## Install on iPhone
Open the site in **Safari** → Share → **Add to Home Screen**. Then open Morsel from the home screen, go to Settings → AI provider & key, and paste your key.

## Develop
```
npm install
npm run dev      # http://localhost:5173/morsel/
npm test
npm run build
```
`npm run deploy` publishes `dist/` to the gh-pages branch (GitHub Pages). `docs/deploy-workflow.yml` is an Actions version for when the CLI token has the workflow scope.
