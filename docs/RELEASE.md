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

- **Missing water at three boxes.** Sydney Harbour, and the Thames and the Hudson at Greenwich and Manhattan, have
  no water fill in the two styles that have no photo (Atlas, Political) — their street data comes from coastline
  relations, which the street build excludes. The photo carries the water in Physical and Satellite.
- **Rovaniemi's one-minute seam.** The box centre (and the card/readout it drives) sits at 66°33′N, the village's
  own painted Arctic Circle line; the teaching note and the drawn Arctic Circle are at 66°34′N, about 180 m north
  of the box centre. Both are individually correct for what they measure, but a pupil comparing the readout to
  the note side by side will notice the one-minute gap.
- **The photo's box-edge feather at middling zooms.** The blend between the close-up photo and the world image
  around it is a soft gradient rather than a hard edge; at zooms between the fit zoom and full zoom in on the
  photo it can read as a faint band near the box boundary.

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
