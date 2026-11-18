# geo-coordinates

An offline, single-file geography lesson (Svelte + Vite). `npm run build` writes `dist/geo-coordinates.html`,
which is committed. Rebuild and commit it when a change affects the page.

## Design identity

This site uses the shared identity from xSAVIKx/xSAVIKx.github.io/identity.
- Do not edit the vendored `ys-*.css` file. To update it, copy the new file from the hub.
- Keep this project's own brand colours, logo and illustrations.
- Use system fonts only. Do not add a web font or serif headings.
- New text colours must meet 4.5:1 contrast in light and dark.

In this project the vendored file is `src/styles/ys-tokens.css`. `src/main.ts` imports it, so the build inlines
it into the offline file. `src/styles/tokens.css` maps the page neutrals (`--bg`, `--surface`, `--text` and the
others) to `--ys-*`. The accent, the badges, the art, the map colours and the presenter-mode palette stay this
project's own.
