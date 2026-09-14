# Release checklist

This project has no remote yet. Nothing here has been run — these are the exact steps for the
owner to run manually when ready to publish. Do **not** run these as part of an automated task
without the owner's go-ahead.

## Pre-release checklist

- [ ] All tests pass: `npm run check && npm test && npm run build && npm run e2e`.
- [ ] Translation review done by the owner: open `dist/translation-review.html` and read
      every flagged ("check") and info-noted Polish/Ukrainian cell.
- [ ] Screenshots updated: generate `docs/screenshots/home.png`, `docs/screenshots/lesson.png`
      and `docs/screenshots/lab.png` with `npm run shot` (Task 20), compressed, and committed.

## Publish steps

1. **Merge `feat/lesson-page` into `main`.**

   `main` currently holds only the design docs, so it can fast-forward:

       git checkout main
       git merge --ff-only feat/lesson-page

   If `main` has since diverged (no longer a pure ancestor relationship), merge normally instead:

       git checkout main
       git merge feat/lesson-page

2. **Create the GitHub repository and push it** (creates the repo under the `xSAVIKx` account,
   adds it as the `origin` remote, and pushes `main`):

       gh repo create geo-coordinates --public --source . --remote origin --push

3. **Push `main`** (only needed if step 2's `--push` didn't already cover it, e.g. after later
   commits):

       git push origin main

4. **Enable GitHub Pages with source "GitHub Actions"**, either via the API:

       gh api -X POST repos/xSAVIKx/geo-coordinates/pages -f build_type=workflow

   or via the web UI: repository **Settings → Pages → Build and deployment → Source →
   GitHub Actions**.

5. **Check the Actions run**: the `pages.yml` workflow runs automatically on the push to
   `main` (or trigger it manually with `gh workflow run pages.yml`). Confirm both the `build`
   and `deploy` jobs succeed:

       gh run list --workflow=pages.yml
       gh run watch

6. **Visit the published URL** and confirm the page loads and works:

   <https://xsavikx.github.io/geo-coordinates/>

   (First deploy can take a few minutes to become live.)
