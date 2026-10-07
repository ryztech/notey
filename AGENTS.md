# AGENTS.md

Guidance for AI coding agents (and future-you) working in this repo.

## What this is

**notey** — a rapid-prototype PWA for planning a day as a flat list of
horizontal "bars": freeform text notes or to-do items, reorderable, dark
CLI-styled, mobile-first. See `docs/decisions.md` for the history of *why*
things work the way they do — read it before changing gesture or drag
behavior, since several non-obvious bugs were already found and fixed there.

Live: https://ryztech.github.io/notey/
Repo: https://github.com/ryztech/notey (public, `gh` authenticated as `ryztech`)

## Stack

TypeScript + React 19 + Vite, `vite-plugin-pwa` for the manifest/service
worker, plain CSS Modules (no UI library), `localStorage` for persistence
(no backend). Deployed to GitHub Pages via GitHub Actions on every push to
`main` — there is no manual deploy step.

## Commands

```
npm run dev      # vite dev server (localhost:5173, base "/")
npm run build    # tsc -b && vite build (production base "/notey/")
npm run preview  # serve the production build locally to sanity-check the
                 # real /notey/ base path and PWA/service-worker behavior
npm run lint     # oxlint
```

There's no test suite — this is a prototype. Verify changes by running
`npm run dev` (or `preview` for anything PWA/base-path related) and
exercising the feature in a real or emulated browser. For gesture changes,
prefer testing with synthetic `PointerEvent`s dispatched with
`pointerType: 'touch'` from JS (see commit history / past sessions for the
pattern) over automation-tool mouse drags, which don't reliably simulate
a held long-press or produce *trusted* events — native-focus-dependent
behavior (e.g. a `readOnly` input's own click-to-focus) only responds to
real, trusted events, not synthetic ones.

## Deploying

Push to `main` — `.github/workflows/deploy.yml` builds and publishes to
Pages automatically. Watch it with `gh run watch`. The app auto-reloads
itself once a new service worker takes control (see `src/main.tsx`), so a
deploy takes effect for a visitor without them needing to clear site data —
but *while developing*, remember the PWA caches aggressively; if "fixed"
behavior still looks broken after a deploy, hard-reload / check
`navigator.serviceWorker.getRegistrations()` before assuming the code is
wrong.

## Code map

```
src/
  types.ts                    Bar = { id, text, isTodo, done, createdAt }
  hooks/
    useLocalStorageState.ts   generic localStorage-backed useState
    useBars.ts                CRUD + reorder over Bar[]; array order IS the
                               order (no separate `order` field)
  gestures/
    useBarGesture.ts          row-level gesture state machine (see below)
  components/
    App.tsx                   root
    BarList.tsx                maps bars -> <Bar>, owns the "+add" row,
                               autofocus-after-create, and the single
                               commit-on-release reorder() call
    Bar.tsx                    one row: text input, checkbox (visual only),
                               drag handle (interactive)
    *.module.css                dark/monospace CLI theme, CSS variables
                               in src/index.css
```

## The gesture model (read this before touching any of it)

Each row has three independent interaction surfaces:

1. **Row body** (anywhere except the handle) — `useBarGesture`:
   - Horizontal swipe, direction decided by movement not start position:
     swipe right past a threshold → toggle to-do on/off (on release);
     swipe left past a threshold → delete (**on release only** — pulling
     back before releasing cancels it, same as the toggle).
   - Vertical movement before any direction is locked → treated as a page
     scroll, reproduced **manually** via `window.scrollBy` rather than left
     to the browser, because `touch-action` can't be changed reliably
     *during* an active touch sequence (mobile browsers sample it once at
     the start of the gesture) — so the row's `touch-action` is just
     `none` all the time and scrolling is faked in JS instead.
   - No movement: **short tap** (release before ~400ms) toggles the
     checkbox if the bar `isTodo`, otherwise does nothing. **Long press**
     (held past ~400ms) enters inline edit mode. A short tap deliberately
     does *not* focus the text input at all (see decision on the
     click-caret bug) — edit mode is only ever entered programmatically.
2. **Drag handle** (`=`, right-aligned) — reordering lives *only* here, on
   its own pointer handlers in `Bar.tsx`, completely separate from the row
   body's gesture state machine. Grabbing it starts dragging immediately
   (no long-press needed — there's no ambiguity to resolve). The row only
   *floats visually* (`translateY`) while dragging; the real array is
   **not** touched until release, when `BarList` computes the final target
   index fresh from wherever the pointer ended up and calls `reorder()`
   once. Do not change this back to "reorder live on every pointermove" —
   it very likely drops the handle's pointer capture when the dragged
   node's DOM position changes mid-gesture, which is what caused the
   "small drag range" and "stuck grey highlight" bugs previously.
3. **Checkbox** — purely a visual `<span>` (`[ ]` / `[x]`), not
   interactive; ticking happens through the row body's short-tap handler
   above, so it works no matter where on the row you tap, not just on the
   glyph itself.

Enter in the text input commits the current bar and creates a new one
right after it (`addBarAfter` in `useBars.ts`), focused for typing.

## Known gaps / likely next steps

- No delete confirmation or undo (by design, for now — see decisions log).
- No multi-day / date concept — one flat list, no scheduling.
- No automated tests.
- Service worker precaches the app shell for "basic offline" only — no
  background sync, no conflict resolution (single-device localStorage
  only; nothing to sync).
