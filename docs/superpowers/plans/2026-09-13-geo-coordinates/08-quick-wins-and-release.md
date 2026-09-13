# Part 8 — Quick wins and release preparation (owner decisions 2026-09-13)

Owner decisions:
- License: MIT for code + CC BY 4.0 for lesson texts and content.
- Footer: link to the author's website https://serhiichuk.dev and GitHub profile https://github.com/xSAVIKx.
- GitHub: prepare everything for a public repo with GitHub Pages; do NOT create the repo or push.
- Free-play start point: Katowice.
- Quick wins: progress badges (nice to have), celebration (yes), cheat sheet (yes, printable to PDF in each language), worksheet (yes), hint button (yes). Homework code: no. QR code: no.

Execution order after Part 7: D2 → 18 → 24 → 25 → 19 → 20 → final review.

---

### Task 24: Quick wins

1. **Celebration on a perfect round** (Practice 10/10 and Rehearsal 15/15): a short confetti burst (canvas or SVG, ~1.5 s, no external assets) plus a friendly localized line ("Perfect round!"). No animation when reduced motion is on (show a static star badge instead). Never blocks focus; the summary heading still receives focus.
2. **Hint button** on unanswered practice questions (not in Rehearsal and not in Class quiz before reveal): "Hint" shows a short rule for the question type without the answer (e.g. read-coords: "First find the parallel and read its number on the left edge, then the meridian at the bottom edge. Don't forget the letters."; difference: "Same side of the line → subtract. Different sides → add. More than 180° → 360° minus the sum."; distance: "Degrees of latitude × 111.2 km."; time: "15° = 1 hour, 1° = 4 minutes. East is later."). Keys `q.hint.<type>` in EN/PL/UK. Using a hint is recorded; the summary marks hinted questions with a small "hint" tag (still counts as correct). The hint region is `aria-live="polite"`.
3. **Progress badges** on home topic cards: best score per topic across difficulties as a badge ("Best: 9/10 · medium"), "Not practised yet" otherwise; reads localStorage via scores.ts; accessible text.
4. **Cheat sheet** route `#<lang>/cheatsheet` (Home "Test yourself and explore" section gets a card): one A4 page per language with the key rules and small inline SVG diagrams:
   - grid basics (equator 0°, prime meridian 0°, 180°, hemispheres, N/S/E/W, latitude first);
   - reading coordinates (parallel → left edge, meridian → bottom edge, letters);
   - relative position (north/south, east/west, "bigger number" rule in S/W);
   - degrees and minutes (1° = 60′, 30′ = ½°);
   - differences (same side subtract, different sides add, >180° → 360 − sum);
   - distance (1° ≈ 111.2 km along a meridian);
   - time (15° = 1 h, 1° = 4 min, east is later);
   - map-app decimals (minus = S/W) — from topic 9.
   A language switch on the page (EN/PL/UK) and a "Print / Save as PDF" button (`window.print()`). Print CSS: A4 portrait, 12–15 mm margins, header/footer/nav hidden, black on white, no dark theme, diagrams with explicit fills, no page break inside a section, fits on one page (two at most) in all three languages. Footer line with author and license.
5. **Worksheet** route `#<lang>/worksheet`: choose topics (checkboxes), difficulty, number of questions (6/10/15), and a code (seed, prefilled random) → preview of a printable worksheet: title, name/date lines, numbered questions rendered for paper (prompt text; for map questions a static SVG map snippet with the scene — markers, highlighted lines, graticule labels — sized for print; choice options as lettered lists with empty boxes; coordinate/number/clock answers as blank lines), then a page break and an **answer key** page (answers + short explanations) that can be toggled off before printing. Same seed → same sheet. Print CSS as above. Map snippets reuse the Layers renderer with a static ctx (flat projection; globe scenes rendered as flat for paper).
6. **Katowice start point**: lab and all free-play (`play`) steps start at Katowice (50.26°N, 19.02°E) instead of Warsaw where the step text doesn't mention Warsaw; lab "Now" unchanged.

Tests: unit tests for hint keys existing for every question type; e2e: 10/10 keyboard round shows the celebration text (and no canvas animation under reduced motion); hint button shows text and is absent in Rehearsal; home badge after a round; cheatsheet route renders in 3 languages with axe clean and `@media print` snapshot (Playwright `page.pdf()` produces 1–2 A4 pages per language — assert page count via pdf page objects or size heuristic); worksheet with a fixed code renders the same questions twice and its answer key toggles; print PDF for a 10-question worksheet is ≤ 4 pages.

---

### Task 25: Release preparation (no push)

- `LICENSE` (MIT, © 2026 Yurii Serhiichuk) and `LICENSE-CONTENT.md` (CC BY 4.0 for lesson texts, translations, cheat sheet and worksheet content; notes that Natural Earth data is public domain and Maple Bear school locations are factual data from Maple Bear websites; the Maple Bear name is a trademark of its owner and the project is not affiliated with Maple Bear).
- Footer and README: links to https://serhiichuk.dev and https://github.com/xSAVIKx (`rel="author"` on the website link); "Not affiliated with Maple Bear or Google" line in README and on the topic 9 / schools layer info text.
- `src/app/credits.ts` gets `url` and `github` fields; Footer renders both links (44px targets, accessible names "Yurii Serhiichuk – website", "Yurii Serhiichuk on GitHub" localized).
- GitHub Pages: `.github/workflows/pages.yml` — on push to `main` (and manual dispatch): checkout, setup Node 24, `npm ci`, `npm test`, `npm run build`, copy `dist/geo-coordinates.html` to `site/index.html` (and `dist/translation-review.html` to `site/`), upload with `actions/upload-pages-artifact`, deploy with `actions/deploy-pages`. Also keep `dist/` committed for offline use.
- README: what it is, screenshots (2–3 PNGs committed under `docs/screenshots/`, compressed), how to use offline, links to the live page placeholder `https://xsavikx.github.io/geo-coordinates/`, how to develop, license section, credits (Natural Earth, Maple Bear data source, author).
- `package.json`: name, description, author, license "MIT", repository placeholder URL, `"private": true` kept.
- `docs/RELEASE.md`: the exact commands for the owner: `gh repo create geo-coordinates --public --source . --remote origin --push`, then enabling Pages (Settings → Pages → GitHub Actions) or `gh api` equivalent, and merging `feat/lesson-page` into `main` first.
- No push, no repo creation.
