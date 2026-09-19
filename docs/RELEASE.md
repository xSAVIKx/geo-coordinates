# Release checklist

This project has no remote yet. Nothing here has been run — these are the exact steps for the
owner to run manually when ready to publish. Do **not** run these as part of an automated task
without the owner's go-ahead.

## Pre-release checklist

- [ ] All tests pass: `npm run check && npm test && npm run build && npm run e2e`
      (`npm run build` also checks the 8 MiB size budget — with a per-asset breakdown, one line per place — and
      the third-party licence notices).
- [ ] Translation review done by the owner: open `dist/translation-review.html` and read
      every flagged ("check") and info-noted Polish/Ukrainian cell.
- [ ] Screenshots updated: after the build, run `npm run shots:readme`. It writes
      `docs/screenshots/home.png`, `docs/screenshots/lesson.png`, `docs/screenshots/lab.png`,
      `docs/screenshots/satellite.png` and `docs/screenshots/close-up.png` — the first 1366×768 screen of
      `en/`, `en/topic-6/explore/5`, `en/lab`, `en/lab` again in the Satellite style at night, and the Katowice
      close-up in the lab — and reduces them to 256 colours when `python3` with Pillow is installed. Look at
      them, then commit them.
      (`npm run shot -- <route> <name>` is a different tool: full-page captures of one route at
      375×667 and 1366×768, written to `shots/<name>-<width>x<height>.png`, which is not committed.)
- [ ] Map styles checked on a real phone (Satellite globe drag smooth) and on the classroom projector in
      presenter mode.
- [ ] Topic 10 and Seasons mode texts reviewed in Polish and Ukrainian on the translation review sheet (keys
      `topic.10.*`, `seasons.*`, `map.style.*`, `physical.*`, `lab.realSun*`).
- [ ] All twelve close-ups looked at by eye on the contact sheet (Task 8's `shots/closeup-*.png`): the right
      feature in the middle, no cloud or seam, streets readable over the photo.
- [ ] Close-up attribution checked in all four places: the footer, the README, `LICENSE-CONTENT.md` and the
      built file's licence comment — six sources, each with its own wording.
- [ ] Places up close texts reviewed in Polish and Ukrainian on the translation review sheet (keys
      `closeup.*`, `settings.closeUps*`, `topic.9.step.find.closeUp`, `footer.closeUp*`).
- [ ] The close-up photos are the newest the sources have: re-running `npm run data:city-photos --refresh` is a
      data change, not a code change, and needs the twelve looked at again.

## Known issues (left for the owner to accept or defer)

- **Water is complete at every box, as of the final fix wave — the entry that used to stand here was wrong in
  both directions.** It said the gap was two boxes and only in the styles with no photo. It was six boxes, and
  it showed in *every* style including Physical and Satellite, because the water fill is drawn over the photo
  and the photo is only 10 m to a pixel at half of them. Measured water as a share of each box, before and
  after: Sydney 0.00 % → 51.63 %, Manhattan 0.65 % → 31.46 % (the island was not one), Paris 0.12 % → 4.18 %
  (the Seine was a hairline under its own bridge names), Warsaw 1.15 % → 5.65 % and Kraków 1.07 % → 3.51 % (no
  Vistula at either), Greenwich 4.91 % → 7.64 % (the Thames stopped at the peninsula). The cause was planning
  ruling R16, which skipped OpenStreetMap relations, together with a query that never asked for
  `natural=coastline`: the big water of a city is never one closed way. `scripts/build-city-streets.ts` now
  assembles multipolygon relations and closes coastlines against the box, and `tests/unit/
  city-streets-data.test.ts` holds a floor under each box's water so a rebuild cannot drop a river again. Four
  boxes have no water worth drawing and say so in writing there, each with a ceiling of 1 % instead of a floor:
  Mitad del Mundo (nothing mapped at all), Rovaniemi (two small lakes, 0.05 %), Tokyo (two park ponds, 0.08 %;
  the Shibuya river is culverted) and Giza (an irrigation canal at the city edge, 0.22 %).
- **Rovaniemi is Sentinel-2 at 10 m, not Finland's 0.5 m orthophotos.** The NLS open WMTS needs a free API key
  (`avoin-karttakuva.maanmittauslaitos.fi` answers 401 to every route, re-checked during the final fix wave);
  the only keyless mirror found redirects to a host whose certificate does not match its own name. A school
  lesson's build does not hang on that, and an API key is not something this repository can carry. The box
  stays as it is, and that box is forest, an airport and a village, which 10 m resolves.
- **Rovaniemi's one-minute gap — already resolved, kept here for awareness only.** The box centre (and the
  card/readout it drives) sits at 66°33′N, the village's own painted Arctic Circle line; the drawn Arctic Circle
  is at 66°34′N, about 180 m north of the box centre. This is a real geometric fact, not a bug, and it no longer
  needs an owner decision: Task 8's teaching note already names both numbers and says they are one minute apart,
  so the pupil-facing contradiction is resolved by design.
- **The photo's box-edge feather at middling zooms.** The blend between the close-up photo and the world image
  around it is a soft gradient rather than a hard edge; at zooms between the fit zoom and full zoom in on the
  photo it can read as a faint band near the box boundary.
- **Two boxes are dark on a projector.** Rovaniemi's photo averages 35.6 of 255 and Sydney's 50.7 — a September
  evening over forest and a winter-morning harbour. Both read well on a laptop screen and both go muddy on a
  classroom projector in a lit room. The lesson does not brighten a photo per box, and the honest fixes are a
  different Sentinel scene for each (a data change, needing the twelve looked at again) or a projector-mode
  lift applied to the close-up only. Giza, the third box the review named, is fixed: it now uses a January
  scene with the sun 33.8° up instead of a September one at 61.5°, so the pyramids cast shadows and read as
  pyramids — its mean moved 204 → 161 and its spread 45.8 → 61.5.
- **Rovaniemi letterboxes at its fit zoom.** Rovaniemi's box is 0.135° of longitude — the widest of the twelve,
  because 6 km is a lot of longitude at 66°N — so it fills the view's width long before its height, and a strip
  of ordinary world map shows above and below it. Every other box is bound by its 4 km height instead. It is
  geometry, not a bug; closing it would mean a different box shape at high latitude.
- **The street grid is dense at Tokyo and at Giza's city half.** From the final fix wave: the ordinary streets
  (`residential`, `unclassified`, `living_street`) now arrive at each box's own fit zoom, which is the view the
  close-up list lands on, so a pupil who taps "Katowice — the school" sees the school's own street. At the two
  boxes with the densest grids — Tokyo draws 1 899 of those subpaths at that zoom and Giza 2 540 — that leaves
  little of the photograph showing between them until the pupil zooms further in. Giza's plateau, which is what
  that box exists for, has no streets on it and is completely clear. If the owner would rather have the
  photograph back at the arriving view, the lever is the road casing (a 3.4 px light stroke under a 1.8 px
  core) rather than the threshold: dropping the casing on classes 4 and 5 until a deeper zoom recovers most of
  the ink without taking the streets away.

## Publish steps

Pages must be enabled **before** the first push to `main`: the push starts the `pages.yml`
workflow, and its deploy job fails if the repository has no Pages site yet.

1. **Be on `main`.** The finished lesson is already merged into `main`:

       git checkout main

2. **Create the GitHub repository without pushing** (creates the repo under the `xSAVIKx`
   account and adds it as the `origin` remote):

       gh repo create geo-coordinates --public --source . --remote origin

3. **Enable GitHub Pages with source "GitHub Actions"**, either via the API:

       gh api -X POST repos/xSAVIKx/geo-coordinates/pages -f build_type=workflow

   or via the web UI: repository **Settings → Pages → Build and deployment → Source →
   GitHub Actions**.

4. **Push `main`**, which starts the `pages.yml` workflow:

       git push -u origin main

5. **Check the Actions run.** Confirm both the `build` and `deploy` jobs succeed:

       gh run list --workflow=pages.yml
       gh run watch

   If the deploy job failed because Pages was not enabled yet (for example, step 3 was done after
   the push), enable it and run the workflow again:

       gh workflow run pages.yml

6. **Visit the published URL** and confirm the page loads and works:

   <https://xsavikx.github.io/geo-coordinates/>

   (First deploy can take a few minutes to become live.)
