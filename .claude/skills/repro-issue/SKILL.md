---
name: repro-issue
description: Reproduce a public GitHub issue or PR in the Mapbox GL JS repo as a minimal focused debug page under `./debug/`. Trigger when the user pastes a GitHub issue/PR URL (github.com/mapbox/mapbox-gl-js/issues/N or /pull/N), or says "repro this issue", "reproduce #N", "make a repro page for", "debug page for issue", "recreate this bug", "build a minimal repro", or provides a bare issue number like `#12345` in the context of investigating a bug. Use this skill whenever the user wants to investigate a bug report, regression, or reported behavior — even if they don't say the word "repro" — since a working debug page is almost always the first step before fixing.
---

# Reproduce a GitHub issue as a debug page

Goal: given a link to a public GitHub issue or PR, produce the **smallest** self-contained debug page at `debug/<issue-number>.html` that exercises the reported bug. A tired developer should be able to open it, see the bug, and start debugging in under a minute.

## Why this matters

- Bug fixes start from a concrete, runnable repro. No repro → no fix.
- Issue reporters often give incomplete code. The repro fills gaps with the smallest viable style, data, and interactions.
- A focused page (one style, few sources, minimal UI) makes it obvious which component misbehaves.
- Future maintainers reopen the same page when regressions recur. Keep it self-describing.

## Workflow

### 1. Read the issue carefully

Use `gh issue view <N> --repo mapbox/mapbox-gl-js --comments` (or `gh pr view` for PRs) to fetch the full body **and comments**. Do not rely only on the title or first paragraph — triage comments, maintainer replies, and attached code snippets usually contain the actual repro recipe.

Extract:
- **Expected vs actual behavior** — what the user sees vs what they want.
- **Minimal reproducing inputs** — style, source type, layer type, specific properties, zoom/pitch/bearing, viewport size, interactions.
- **Version** — if the bug was introduced in a specific version, note it but reproduce against the current `../dist/mapbox-gl-dev.js` build regardless.
- **External assets** — public URLs for tiles, styles, GeoJSON, images. Inline tiny GeoJSON directly; link large assets.
- **Attached JSFiddle / CodePen / screenshot / video** — fetch the linked code if present. Otherwise reconstruct from description.

If the issue is ambiguous, ask one clarifying question before writing code. Do **not** invent symptoms not reported.

### 2. Check if a repro already exists

```bash
ls debug/<issue-number>.html 2>/dev/null
```

If a file exists, read it first and ask whether to overwrite or iterate.

### 3. Write the smallest possible page

Target: **one HTML file**, `debug/<issue-number>.html`. No new dependencies. No new assets unless the bug requires a specific image/font/tile set already hosted publicly.

#### Required scaffolding

```html
<!DOCTYPE html>
<html>
<head>
    <title>#<N>: <one-line summary></title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="../dist/mapbox-gl.css" />
    <style>
        body { margin: 0; padding: 0; }
        html, body, #map { height: 100%; }
    </style>
</head>
<body>
<div id="map"></div>
<script src="../dist/mapbox-gl-dev.js"></script>
<script type="module">
import {getAccessToken} from './access_token_generated.js';
mapboxgl.accessToken = getAccessToken();

const map = window.map = new mapboxgl.Map({
    container: 'map',
    hash: true,
    // ...issue-specific config
});
</script>
</body>
</html>
```

#### Conventions (follow unless the bug requires breaking them)

- `window.map = new mapboxgl.Map({...})` — exposes the map on `window` for console debugging (`map.getStyle()`, `map.queryRenderedFeatures(...)`).
- `hash: true` — preserves camera state in URL so reloading keeps the failure view.
- `../dist/mapbox-gl-dev.js` — user must run `npm run build-dev` first; do not use a minified build.
- `access_token_generated.js` — shared token file. Never hardcode tokens.
- Inline style objects for JSON-style bugs. Only reference external styles (`mapbox://styles/...`) when the bug is about a specific public style.
- Minimal UI: only add checkboxes/buttons for interactions the bug requires (toggle layer, click feature, pan to coord).
- No framework, no build step, no extra CSS beyond the scaffold.

#### Header comment

At the top of the `<script type="module">` block, add a one-line comment:

```js
// Repro for https://github.com/mapbox/mapbox-gl-js/issues/<N>
// <one-sentence summary of expected vs actual>
```

This lets future maintainers tie the page back to the issue without re-reading it.

### 4. Keep it small

Before writing, ask: what is the minimum the page needs to show the bug? Strip aggressively:

- One source, one layer, unless the bug is about layer interaction.
- No terrain/fog/3D/atmosphere unless the bug is about them.
- Default camera (zoom 0, center [0,0]) unless the bug is viewport-specific.
- No `map.on('load', ...)` callback unless sources/layers must be added imperatively.
- No animation loop unless the bug is time-dependent.

If the issue's sample code is already minimal, port it directly. If it's a 200-line snippet, cut everything not causally related to the bug.

### 5. Verify

Tell the user how to run it:

```
npm run start
open http://localhost:9966/debug/<N>.html
```

If you can run it yourself (auto mode, MCP browser, etc.), confirm the page loads and the reported failure is visible before declaring done. If you cannot run it, say so explicitly — do not claim the repro works.

### 6. Report

End with:
- Path to the file.
- One-line restatement of the expected vs actual behavior.
- Any assumptions you made where the issue was ambiguous (so the user can correct them).
- Suspected subsystem (e.g., symbol layout, tile pipeline, `Transform`) if obvious, as a starting point for the fix.

## Edge cases

- **Private repo / 404** — fail fast. Skill only supports public issues. Ask the user to paste the relevant content instead.
- **Issue is a question, not a bug** — no repro needed. Say so and propose answering inline instead.
- **Bug is platform-specific** (iOS Safari, specific GPU) — note the constraint in the header comment; the repro page itself stays generic.
- **Bug is about build/tooling, not runtime** — a debug page is the wrong surface. Redirect to a failing unit test or build config instead.
- **Reporter provided a working CodeSandbox** — still port it into `debug/` so it runs against the local dev build. Sandboxes pin old versions and mask regressions.

## Output format

Always:
1. Write the file to `debug/<issue-number>.html`.
2. Print the path and the `npm run start` instructions.
3. Do **not** commit or open a PR. Debug pages are local aids, not shipped.
