# Release checklist

This project has no remote yet. Nothing here has been run — these are the exact steps for the
owner to run manually when ready to publish. Do **not** run these as part of an automated task
without the owner's go-ahead.

## Pre-release checklist

- [ ] All tests pass: `npm run check && npm test && npm run build && npm run e2e`
      (`npm run build` also checks the size budget and the third-party licence notices).
- [ ] Translation review done by the owner: open `dist/translation-review.html` and read
      every flagged ("check") and info-noted Polish/Ukrainian cell.
- [ ] Screenshots updated: after the build, run `npm run shots:readme`. It writes
      `docs/screenshots/home.png`, `docs/screenshots/lesson.png` and `docs/screenshots/lab.png` — the
      first 1366×768 screen of `en/`, `en/topic-6/explore/5` and `en/lab` — and reduces them to
      256 colours when `python3` with Pillow is installed. Look at them, then commit them.
      (`npm run shot -- <route> <name>` is a different tool: full-page captures of one route at
      375×667 and 1366×768, written to `shots/<name>-<width>x<height>.png`, which is not committed.)

## Publish steps

Pages must be enabled **before** the first push to `main`: the push starts the `pages.yml`
workflow, and its deploy job fails if the repository has no Pages site yet.

1. **Merge `feat/lesson-page` into `main`.**

   `main` currently holds only the design docs, so it can fast-forward:

       git checkout main
       git merge --ff-only feat/lesson-page

   If `main` has since diverged (no longer a pure ancestor relationship), merge normally instead:

       git checkout main
       git merge feat/lesson-page

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
