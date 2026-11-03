@AGENTS.md

# Nancy Eats

- Every change must work on phones, tablets and desktops, and every feature must be easy for someone who is not tech savvy (large controls, plain words, few steps).
- **Voice helper:** everything a person can do on the site must also work by voice (the "Ask" button and the home page card). When you add or change a feature, add or update its entry in `src/lib/voice/registry.ts`. One entry holds a plain-words `description` (what Claude reads), the `properties` it fills in, `parse` (check and tidy them), `summary` (what happens, in plain words) and `run` (call the same server action the button uses). Set `ask: true` for anything that removes or replaces things or spends many Spoonacular points, so she answers Yes or No first.
- Work directly on `main` (JD's choice, no pull requests). Run `npx eslint src` and `npm run build` before pushing.
