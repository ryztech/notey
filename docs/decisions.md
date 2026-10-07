# Decisions log

Lightweight architecture-decision-record log for notey. Newest at the
bottom. Each entry is a decision plus the *why* — especially for the
gesture/drag code, which went through several iterations to fix real bugs,
not just preference changes. Read this before reverting or "simplifying"
anything in `src/gestures/` or the drag handling in `Bar.tsx`/`BarList.tsx`.

---

## 1. Stack: Vite + React + TS, GitHub Pages via Actions

**Context:** Wanted the fastest path from nothing to a deployed, installable
prototype, in TypeScript + React per the original ask.

**Decision:** `npm create vite -- --template react-ts`, `vite-plugin-pwa`
for manifest/service worker, plain CSS Modules (no UI library — a flat list
of custom-behavior rows doesn't benefit from one), `localStorage` for
persistence (no backend, single device). Deploy via the official
`actions/configure-pages` + `upload-pages-artifact` + `deploy-pages` GitHub
Actions flow, triggered on push to `main`.

**Consequence:** `vite.config.ts`'s `base` must be `/notey/` in production
(it's a repo-subpath Pages site, not a custom domain) but `/` in dev — this
is the single most common source of a blank-page-with-404s deploy if
touched carelessly. The PWA manifest's `start_url`/`scope` must agree with
it too.

---

## 2. Data model: array order *is* the order

**Decision:** `Bar` has no `order`/`index` field. Position in the `Bar[]`
array is canonical; reordering splices the array.

**Why:** Avoids a numeric field getting out of sync with actual array
position, a common bug class in reorderable lists. Simpler for a prototype
this size.

---

## 3. Gesture model v1: edge zones (left/right/middle)

**Original design:** Left-edge swipe toggled to-do, right-edge swipe
deleted, middle long-press-dragged to reorder, middle tap edited.

**Superseded (see #4):** the user needs every gesture to work "regardless
of where you click or tap on the row" — precise edge-targeting doesn't
hold up, especially on mobile/thumb-sized targets.

---

## 4. Gesture model v2: direction decides the action, not start position

**Decision:** Any horizontal swipe, starting anywhere on the row, is
classified by *direction* once it crosses a small movement threshold
(right → to-do toggle, left → delete). Any predominantly vertical
movement before that is treated as a page-scroll attempt.

**Why mobile needed its own fix:** gestures "didn't work on mobile" at all
initially. Root cause: mobile browsers sample `touch-action` once, at the
*start* of a touch sequence, and don't respect changing it mid-gesture
(e.g. flipping to `none` only once a long-press fires, which is what v1
did) — so native scroll/pull-to-refresh could hijack the gesture before JS
ever got a say. Fix: rows have `touch-action: none` unconditionally, and
vertical scrolling is reproduced **manually** via `window.scrollBy` in the
gesture handler instead of relying on the browser at all.

---

## 5. Enter key creates a new row

**Decision:** Pressing Enter in a bar's text input commits that bar and
calls `addBarAfter(id)`, focusing the new blank bar immediately after it
(not appended at the end of the list).

---

## 6. Dragging moved to a dedicated handle; tap semantics reworked

**Problem reported:** reordering (long-press anywhere on the row, per v2)
interfered with the browser's pull-to-refresh gesture near the top of the
page.

**Decision:**
- Reordering now only starts from a dedicated handle on the right of each
  row (originally `[::]`, simplified to a plain `=` per feedback) — its
  own pointer handlers, entirely separate from the row body's gesture
  state machine, `stopPropagation`'d so it never reaches the row's own
  handler.
- Row-body taps became duration-based instead of always opening edit mode:
  **short tap** toggles the checkbox (no-op on a plain note with none),
  **long press** opens inline edit. The checkbox itself became a
  non-interactive visual `<span>` — toggling now works from a tap anywhere
  on the row, not just the small glyph.

**Why a dedicated handle fixes pull-to-refresh specifically:** touching
the handle calls `setPointerCapture` immediately and the handle has
`touch-action: none` from the very first pointerdown (no mid-gesture
flip needed, unlike v1's problem) — so the browser never gets a chance to
interpret that touch as anything but ours, including pull-to-refresh.

---

## 7. Fixed: off-by-one in reorder index math

**Bug:** `getIndexForY` returned an index into the *full* array (including
the dragged bar's own slot). `reorder()` does remove-then-insert, so an
index computed against the full array overshoots by one whenever dragging
downward (confirmed by hand-tracing: dragging to "hover between D and E"
landed the bar after E instead of between D and E).

**Fix:** compute the index relative to the list **with the dragged bar
excluded**, counting only remaining items — which is exactly what
`reorder()`'s post-removal insertion point needs, with no direction-
dependent adjustment required.

---

## 8. Fixed: reorder now commits once on release, not live on every pointermove

**Symptoms reported:** dragging only worked across a small range of rows
before getting stuck, and some rows were left permanently with the grey
"dragging" highlight after a drag, seemingly at random.

**Root cause:** the previous handle implementation called `reorder()` on
every `pointermove`, which mutates the real `bars` array and therefore
moves the dragged bar's own DOM node within the list *while that same node
still holds active pointer capture* from the handle's `setPointerCapture`
call. This is a known rough edge across browsers: moving/detaching-and-
reattaching a capturing element mid-gesture can silently drop the capture,
after which no further `pointermove`/`pointerup` ever reaches the handle —
explaining both symptoms (drag "stops working" after a move or two, and
`pointerup` never arrives to reset `isDragging`).

**Fix:** the dragged row now only *floats visually* during the drag
(`translateY` offset tracked in local component state) — the real array
and DOM order are untouched until release, when the final target index is
computed fresh from the last known pointer position and `reorder()` is
called exactly once. Verified (via synthetic touch `PointerEvent`s): a
single continuous drag moving a row from last to first and back, and a
single large jump across the whole list, with no stuck highlight
afterward.

**Rule of thumb going forward:** never mutate the live list mid-gesture
while an element involved in that same gesture still holds pointer
capture.

---

## 9. Delete only commits on release, not mid-swipe

**Decision:** swipe-left-to-delete now checks the threshold at
`pointerup`, matching swipe-right-to-toggle, instead of firing
immediately when crossed during `pointermove`.

**Why:** lets the user pull back before releasing to cancel a delete —
a destructive action probably shouldn't commit the instant a threshold is
crossed with no way to back out short of trusting your thumb precisely.

---

## 10. Fixed: click placed a caret in a `readOnly` input

**Bug:** a short tap on a plain note showed a text caret (with no mobile
keyboard, since the input was `readOnly`) even though short taps are
supposed to do nothing on a non-to-do bar.

**Root cause:** `readOnly` only blocks *editing* — the input is still
natively focusable, and a plain click focuses it and shows a caret
regardless of anything our own JS does.

**Fix:** `e.preventDefault()` on the input's own `pointerdown`, but only
while not already editing (so it doesn't block cursor placement/selection
during an actual edit). The row body's gesture handler still gets the
event via bubbling, since propagation isn't stopped in that branch — only
the browser's native default action (focus) is suppressed.

**Testing note:** this class of bug only reproduces with *trusted* events
— a JS-dispatched synthetic `PointerEvent` doesn't trigger real browser
default actions like native focus-on-click, so it must be verified with
an actual click (e.g. the `computer` tool's `left_click`), not
`dispatchEvent`. Gesture *logic* (our own JS state machine) is fine to
test via synthetic events; native browser *default actions* are not.

---

## 11. Service worker auto-reloads on update

**Decision:** added a `controllerchange` listener in `src/main.tsx` that
reloads the page once when a new service worker takes control.

**Why:** without it, a visitor (or the developer mid-iteration) can keep
running a previous build's cached JS for a while after a new one has
deployed and activated in the background — a real risk of "I fixed it" /
"it's still broken" confusion that cost debugging time at least once
already in this project's history.
