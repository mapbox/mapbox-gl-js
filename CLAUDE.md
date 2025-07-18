# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mapbox GL JS is a JavaScript library for interactive, customizable vector maps on the web. It uses WebGL to render vector tiles that conform to the Mapbox Vector Tile Specification.

## Workflow
- Make changes as concise as possible, ensure they are minimal and fully justified
- Always run `npm run tsc` and `npm run lint` when you're done making a series of code changes
- Run `npm run codegen` if you modify style properties or the style specification (regenerates style code, struct arrays, and TypeScript types)
- Run `npm run test-typings` after modifying public API types or the style specification
- Prefer running single tests, and avoid running the whole test suite, for performance
- Never add any dependencies unless explicitly requested

## Essential Commands

### Development
```bash
# Start development server with live reload
npm run start

# Build development version
npm run build-dev

# Build production bundles
npm run build-prod-min  # Minified production build
npm run build-css       # Build CSS file

# Generate code (style code, struct arrays, and TypeScript types)
npm run codegen
```

### Testing
```bash
# Test TypeScript definitions
npm run test-typings

# Run unit tests
npm run test-unit

# Run unit tests for specific file
npm run test-unit -- test/unit/style-spec/spec.test.ts

# Run specific test inside a file (use -t with test name pattern)
npm run test-unit -- test/unit/style/style.test.ts -t 'Style#addImage'

# Run render tests with pattern matching
npm run test-render -- -t "render-tests/background-color"
```

### Code Quality
```bash
# Type checking
npm run tsc

# Run ESLint
npm run lint

# Run CSS linter
npm run lint-css
```

## Architecture Overview

For detailed architecture documentation including Map subsystems, SourceCache, Transform, and Controls, see [@ARCHITECTURE.md](./ARCHITECTURE.md).

### Main Thread / Worker Split

Mapbox GL JS uses WebWorkers to parse vector tiles off the main thread:

1. **Main Thread**: Handles rendering, user interactions, and map state
2. **Worker Threads**: Parse vector tiles, perform layout operations, and prepare render-ready data

### Rendering Pipeline

1. **Tile Fetching & Parsing** (Worker)
   - Vector tiles are fetched and deserialized from PBF format
   - Features are transformed into render-ready WebGL buffers
   - Feature geometries are indexed for spatial queries

2. **Layout Process** (Worker)
   - `WorkerTile#parse()` creates `Bucket` instances for style layer families
   - Each `Bucket` holds vertex and element array data for WebGL rendering
   - `ProgramConfiguration` handles shader attribute/uniform configuration

3. **WebGL Rendering** (Main Thread)
   - Rendering happens layer-by-layer in `Painter#render()`, `Painter.renderPass` tracks the current render phase
   - Layer-specific `draw*()` methods in `src/render/draw_*.js`
   - Shader programs are compiled and cached by `Painter`

### Key Components

- **Map**: Central class managing the map instance
- **Style**: Manages map styling and layer configuration
- **SourceCache**: Manages tile loading and caching
- **Transform**: Handles map positioning and projections
- **Painter**: WebGL rendering orchestration

## Project Structure

```
3d-style/          # 3D building and model rendering

src/
├── data/          # Data structures for tiles and rendering
├── geo/           # Geographic calculations and transformations
├── gl/            # WebGL abstraction layer
├── render/        # Rendering implementation
├── shaders/       # GLSL shaders with custom #pragma directives
├── source/        # Tile source implementations
├── style/         # Style layer implementations
├── style-spec/    # Mapbox Style Specification (separate workspace)
├── symbol/        # Text and icon rendering
├── terrain/       # 3D terrain rendering
├── ui/            # User interaction handlers
└── util/          # Utility functions

test/
├── unit/          # Unit tests (Vitest)
├── integration/   # Integration and render tests
└── build/         # Build-related tests
```

## Code Style

- ES6+ features are used throughout
- Prefer immutable data structures
- Always use named exports, default exports are forbidden
- Modules export classes or functions (no namespace objects)
- JSDoc comments for all public APIs
- Don't use `!.` for non-null assertions
- Don't use `?.` or `??` operators for optional chaining
- No async/await - use Promises instead
- Use `assert` for invariants

## TypeScript

- The project has TypeScript configured with `strict: false`, but write all TypeScript code as if strict mode is enabled
- This means: always handle `null`/`undefined` cases, use proper type annotations, avoid `any` types, and ensure type safety

## Testing Guidelines

- Tests use Vitest framework with Playwright for testing in browsers
- Install Playwright browsers: `npx playwright install chromium`

### Writing Unit Tests

- No shared variables between test cases
- Don't mock internal domain objects (Style, Map, Transform, Dispatcher)
- One return value or side effect per test - pull shared logic into functions
- Only test return values and global side effects - not internal behavior or method calls
- No network requests - use `mockFetch` from `test/util/network.ts` if needed
- Use clear input space partitioning - look for edge cases

## Documentation Conventions

- All public API must have JSDoc comments; private items tagged with `@private`
- Use markdown in JSDoc; surround code identifiers with \`backticks\`
- Class descriptions: describe what the class/instances *are* (e.g., "A layer that...")
- Function descriptions: start with third-person verb (e.g., "Sets...", "Returns...")
- For functions returning values, start with "Returns..."
- Event descriptions: start with "Fired when..."

## WebGL and Shaders

- Custom `#pragma mapbox` directives in shaders expand to uniforms or attributes
- Shader programs are dynamically generated based on style properties
- Data-driven styling creates paint vertex arrays at layout time
- See [@src/shaders/README.md](src/shaders/README.md) for shader documentation
