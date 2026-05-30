# CLAUDE.md

## Project Overview

Mapbox GL JS is a JavaScript library for interactive, customizable vector maps on the web. It uses WebGL to render vector tiles that conform to the Mapbox Vector Tile Specification.

## Workflow
- Keep changes minimal and fully justified
- Always inspect a referenced file before explaining or fixing it
- Understand WHY code exists before changing it — GL JS has many browser quirks, performance hacks, and WebGL subtleties; check git blame when in doubt
- No abstractions or helpers until you see repetition, and only if cleaner than the duplication
- Always run `npm run tsc` and `npm run lint` when you're done making a series of code changes
- Run `npm run codegen` if you modify style properties or the style specification
- Run `npm run test-typings` after modifying public API types or the style specification
- Prefer running single tests, and avoid running the whole test suite, for performance
- Never add any dependencies unless explicitly requested

## Essential Commands

### Development

```bash
npm start
npm run build-esm-dev
npm run build-esm-prod
npm run build-prod # UMD build
npm run build-css
npm run codegen
```

### Testing

```bash
npm run test-unit
npm run test-unit -- test/unit/style-spec/spec.test.ts -t 'Style#addImage'

npm run test-render -- -t "background-color"
# Regenerate expected.png baselines (inspect diffs before committing!)
UPDATE=1 npm run test-render -- -t "<pattern>"

npm run test-typings
```

Render tests:
- Test name = folder path under `test/integration/render-tests/` (e.g. `circle-radius/literal`). `-t` matches substrings — use a trailing slash to narrow: `-t "circle-radius/"` not `-t "circle"` (also hits `circle-color`, `circle-blur`, etc.)
- Always use `npm run test-render`, not `npx vitest` — the `pretest` hook rebuilds `dist/mapbox-gl-dev.js` and pmtiles
- Inspect diffs: `open test/integration/render-tests/render-tests.html`
- Platform-specific failures → `test/ignores/<platform>.js` (prefer `todo` over `skip`, link the issue)

### Code Quality

```bash
npm run tsc
npm run lint
npm run lint-css
```

## Architecture Overview

Tile parsing and layout run in Web Workers; rendering runs on the main thread. `Map` is the top-level handle, `Style` owns layers and configuration, `SourceCache` manages tile loading/caching per source, `Transform` owns camera state and projection math, and `Painter` orchestrates WebGL rendering.

1. **Tile Parsing & Layout** (Worker)
   - `WorkerTile#parse()` decodes features and creates `Bucket` instances per style layer family
   - Each `Bucket` holds vertex/element arrays ready for WebGL upload
   - `ProgramConfiguration` maps style properties to shader attributes/uniforms
   - Feature geometries are indexed in `FeatureIndex` for `queryRenderedFeatures` / `querySourceFeatures`

2. **Transfer** — parsed bucket data is serialized and sent to the main thread via `src/util/web_worker_transfer.ts`

3. **Symbol Placement** (Main Thread) — symbols run cross-tile collision detection after worker parsing

4. **WebGL Rendering** (Main Thread)
   - `Painter#render()` iterates layers by render pass (`Painter.renderPass`: offscreen → opaque → translucent)
   - Layer-specific `draw*()` functions in `src/render/draw_*.ts`

## Project Structure

```
3d-style/ # (mirrors src)

src/
├── data/
├── geo/
├── gl/
├── render/
├── shaders/
├── source/
├── style/
├── style-spec/ (separate workspace)
├── symbol/
├── terrain/
├── ui/
└── util/

test/
├── unit/
├── integration/
└── build/

debug/ # served by `npm start`
```

## Code Style

- Prefer named exports over default exports
- Modules export classes or functions (no namespace objects)
- Don't use `!.` for non-null assertions (hides potential null issues)
- Don't use `?.` or `??` operators (hides null handling, harder to debug)
- Use `assert` for invariants
- Object spread (`{...obj}`) is banned, use `Object.assign()` instead
- Use `import type` for type-only imports
- No TODO/FIXME comments in committed code

## TypeScript

- Configured with `strict: false`, but write code as if strict — no `any`, handle all `null`/`undefined`, use proper type annotations
- Prefer explicit return types over `// @ts-expect-error` suppressions for functions that may not return a value
- Prefer literal unions over boolean flags; allows future extension without breaking changes

## Testing Guidelines

### Integration Tests

- Any PR that changes rendering behavior (shader changes, draw function logic, bucket data changes) must include a render test in `test/integration/render-tests/`
- For query behavior changes, add corresponding query tests covering all affected layer types
- Render tests for bug fixes must fail without the fix; a tolerance loose enough to pass either way is useless
- Every render test `style.json` must include a `_comment` field explaining what it checks; drop unused intermediate `wait` steps
- Don't inflate render test tolerance to make a failing test pass — investigate the root cause
- Size render test expected images to the minimum needed (e.g., 32×64, not 128×128)

### Unit Tests

- No shared variables between test cases
- Don't mock internal domain objects (Style, Map, Transform, Dispatcher)
- One return value or side effect per test - pull shared logic into functions
- Only test return values and global side effects - not internal behavior or method calls
- No network requests - use `mockFetch` from `test/util/network.ts` if needed

## Documentation Conventions

- All public API must have JSDoc comments; private items tagged with `@private`
- Style-spec `doc` fields in `v8.json` are public — use unambiguous language, avoid internal terms, and don't reference implementation details
- When adding a new property to `v8.json`, populate the `sdk-support` table and set `experimental: true` until release version is confirmed

## WebGL and Shaders

- Custom `#pragma mapbox` directives in shaders expand to uniforms or attributes based on style properties
- Use named `#define` constants for integer mode values in shaders — never bare magic numbers like `if (u_blend_mode == 1)`
- Use `#if defined(A) && defined(B)` for compound shader conditionals (not `#ifdef`); required for the Metal preprocessing pipeline
- See [src/shaders/README.md](src/shaders/README.md) for shader documentation

## Performance

- Allocate GPU objects (buffers, textures, bind groups, UBOs) at bucket creation or style load time; invalidate only when underlying data changes. **Never allocate GPU objects inside draw functions that run every frame.**
- In hot paths, prefer flat typed arrays (`Float32Array`, `Uint16Array`) over arrays of objects or nested arrays
