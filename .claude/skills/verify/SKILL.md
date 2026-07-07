---
name: verify
description: Browser-verify ChIC UI changes end-to-end — build, serve dist on the /ChIC/ base path, drive headless Chrome over CDP across viewports
---

# Verifying ChIC UI changes

## Build + serve

- `npm run build`, then serve `dist/` under the `/ChIC/` base path — `vite preview`
  404s chunks under headless Chromium. Symlink trick:
  `mkdir -p site && ln -sfn "$(pwd)/dist" site/ChIC && (cd site && python3 -m http.server 8139 &)`
  → app at `http://127.0.0.1:8139/ChIC/`.
- Dev server (`npm run dev`, port 8137) works for fast CSS iteration; always re-verify
  the built bundle afterwards.

## Drive headless Chrome over CDP (no Playwright/Puppeteer installed)

Node ≥22 has a built-in WebSocket client, so raw CDP works without dependencies:

1. `google-chrome --headless=new --remote-debugging-port=0 --user-data-dir=$(mktemp -d) --no-first-run --disable-gpu about:blank`
2. Poll `<profile>/DevToolsActivePort` for the port.
3. `PUT /json/new` returns a target — but it IGNORES the url param; you must
   `Page.navigate` explicitly after connecting the WebSocket.
4. `Emulation.setDeviceMetricsOverride` per viewport (set `deviceScaleFactor: 3,
   mobile: true` for phone cases), sleep ~900ms for Chart.js's resize observer,
   then `Runtime.evaluate` measurements and `Page.captureScreenshot`
   (`captureBeyondViewport: true` for full page).

A working harness from the issue-#7 fix: measure `.chart-container canvas`
bounding-box ratio + `.footer-logos` overflow across
1280×900 / 1000×800 / 800×1100 / 430×932@3x / 375×812@3x / 812×375@3x.

## Gotchas

- A disclaimer modal blocks the UI on first load — dismiss with
  `document.querySelector('.modal-action-button')?.click()` before measuring.
- `.acknowledgment-message` is `position: fixed; bottom: 0`; in
  `captureBeyondViewport` screenshots it paints mid-page — artifact, not a bug.
- The app registers a service worker (workbox); use a fresh Chrome profile per run
  or stale bundles will haunt you (that staleness is what got issue #7 reopened).
- Invariants to assert: canvas ratio ≈ 1.667 at EVERY viewport (issue #7), canvas
  buffer = CSS px × devicePixelRatio (no stretch), no horizontal document scroll,
  footer logos share one height and never clip.
