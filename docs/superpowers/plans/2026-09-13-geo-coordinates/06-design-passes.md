# Part 6 — Design specialist passes (added mid-run at the user's request)

Two screenshot-driven design passes by a design-focused agent. They refine the look; they do not change behaviour, interfaces, routes, i18n keys' meaning, or test contracts.

---

### Task D1: Design system pass (after Task 14, milestone 1)

**Goal:** Make the product feel designed and coherent before the remaining screens are built on top of it, so Tasks 15–20 inherit good defaults.

**Audience and tone:** 11–12-year-olds and their teacher; friendly, bright and confident, but uncluttered and calm — like a good museum exhibit or a modern atlas, not a cartoon. It must look good projected on a big classroom screen and on a phone.

**Inputs:** the built page at `dist/geo-coordinates.html`; screens `#en/`, `#pl/topic-1/explore/2`, `#en/topic-1/explore/4`, `#uk/topic-3/explore/2`, `#en/topic-2/practice`, `#en/topic-4/practice` (answer one question to see feedback), `#en/lab`; sizes 375×667, 768×1024, 1366×768, 1920×1080; light and dark.

**Scope (files):** `src/styles/tokens.css`, `src/styles/base.css`, and the `<style>` blocks (plus small markup tweaks for structure/classes/icons) of `src/app/*.svelte`, `src/map/*.svelte`, `src/map/layers/*.svelte`, `src/quiz/*.svelte`, `src/quiz/inputs/*.svelte`.

**What to work on:**
1. **Tokens:** palette (a primary accent plus a warm secondary; map colours — ocean, land, grid — harmonious in light and dark), type scale (fluid `clamp()` steps), spacing scale, radii, shadows/elevation, focus ring. Keep `--marker-*`, `--equator`, `--prime`, `--antimeridian`, `--tropics` distinguishable for colour-blind users (they are also dashed/labelled).
2. **Components:** one consistent button system (primary / secondary / quiet / icon; sizes; hover/active/disabled/pressed states), cards, panels, segmented controls, radio "answer cards", inputs, feedback boxes, the header and footer.
3. **Layouts:** Explore and Practice panel/map proportions at each breakpoint; vertical rhythm; sensible maximum widths; the map should dominate on large screens and stay usable at 375 px.
4. **Map styling:** label density and hierarchy (continent vs city vs line labels), halo quality, grid weight vs special lines, point marker and guides, globe shading/outline so it reads as a sphere (a subtle radial gradient is fine).
5. **Details:** a tasteful inline SVG logo mark for the header, topic number badges, icons for correct/incorrect, small delight (e.g. gentle transitions that switch off with reduced motion).

**Constraints (binding):**
- No new dependencies, no web fonts, no external requests; build stays < 1 MB.
- WCAG 2.2 AA must still pass (`npm run e2e` includes axe); touch targets ≥ 44×44; colour never the only signal; reduced motion respected.
- Do not change component props, exported names, routes, i18n keys, `data-*` hooks, ARIA roles/names used by e2e tests, or test files (except updating a screenshot path). If a design change needs one of those, report it instead.
- Keep changes reviewable: commit in 3–6 themed commits (tokens; buttons & controls; layouts; map styling; details).

**Process:**
1. Build, take "before" screenshots of all inputs into `shots/design-before/` (write a small temporary Playwright script in the scratch area, not in `scripts/`).
2. Write a short design critique (what's weak, what to change, the target look) to the report file before editing.
3. Iterate: change → build → screenshot → look (Read the PNGs) → adjust.
4. `npm run check && npm test && npm run build && npm run e2e` all green.
5. "After" screenshots into `shots/design-after/`, same names.
6. Report: critique, decisions (palette/type/spacing values and why), before/after file list, anything deferred.

---

### Task D2: Final polish pass (after Task 17, before Task 18)

Same brief, constraints and process as D1, applied to every screen that exists by then, with emphasis on the screens added after D1: topics 5–8 Explore (brackets, distance ruler, day/night shading, clocks table), Test rehearsal (setup, run, results review), Class quiz (setup and big-screen run at 1920×1080 and 3840×2160), and the Day and night lab. Check consistency with D1's system rather than reinventing it. Presenter-mode styling is out of scope (Task 18), but leave the tokens in a state where presenter overrides are straightforward.
