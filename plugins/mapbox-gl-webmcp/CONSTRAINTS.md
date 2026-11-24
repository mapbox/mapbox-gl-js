# Constraints

These rules cover `plugins/mapbox-gl-webmcp/`. Paths are relative to the plugin directory. Do not weaken this file to make a change pass.

Last reviewed: 2026-11-13 by Stepan Kuzmin

## Floor

A floor violation blocks the change.

- No new suppression comments: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `istanbul ignore`, `v8 ignore`.
- No unfinished work: a `Not implemented` stub, an empty `catch`, a `TODO` or a `FIXME`.
- No easier tests: no `.skip`, `.only` or `.todo`, and no deleted test file.
- No new row in the Exceptions table without a reviewer's approval.
- No rule in this file removed or loosened in the same change as the code that needed it.

## Implementation rules

The plugin must work on any map, with any style and any GL JS release, without changes to the plugin. So the plugin reads everything it needs from the map and the style at run time, and it uses only what GL JS makes public.

A reviewer checks these rules, because no tool can tell an assumption or a copy of GL JS logic from new logic. The reviewer refuses every new violation that the Exceptions table does not allow.

### Use only what GL JS makes public

- No private GL JS API: the plugin uses only the public GL JS API and reads only documented fields. Any GL JS release can change private API without notice.
- No copies of GL JS logic: the plugin does not copy logic from GL JS. When GL JS changes, a copy goes out of step without an error.
- No hardcoded values: the plugin must not hardcode a value that the map, the style or GL JS owns. Such values are a URL, a range, a default, a list of names, an import id and a config value. The rule covers code, tool descriptions, schemas and examples. A tileset URL that the [Mapbox tileset reference](https://docs.mapbox.com/data/tilesets/reference/) lists is not hardcoded, such as `mapbox://mapbox.mapbox-terrain-dem-v1`. A value that the GL JS API reference documents as an argument is not hardcoded, such as the projection name `globe`.
- Derive style logic: the plugin learns from the style how the style does something, such as how it shows a highlight. It never assumes a mechanism, such as a feature-state key named `highlight`, a property name, a layer id, an import id, a config name or a list of config values. If the style shows no mechanism, the tool tells the agent so and changes nothing.
- No support for the legacy APIs: the plugin does not support any legacy APIs, such as the old `filter` syntax.
- GL JS terms only: tool names, action names, fields, descriptions and error messages use the terms in [GLOSSARY.md](GLOSSARY.md). They never use a word in the sense that GLOSSARY.md lists under "Avoid".

### Make each change through GL JS

- Behave as GL JS: when it is not clear what a tool must do, the tool does what GL JS does. The plugin never adds behavior that GL JS does not have, such as a refusal, a limit or a default. For example, GL JS gives the feature ids `1` and `"1"` one feature state. So a tool that sets the state of `1` also changes `"1"`. Three rules require a refusal and take precedence over this rule: "Derive style logic", "A tool changes only what the agent asks for" and "Own what you add". "Data as GL JS returns it" also takes precedence, because it allows sorting and cutting a result.
- No hacks: the plugin does not emulate what GL JS lacks, such as a transaction across calls or an undo. When GL JS cannot do or report something, the tool tells the agent so.
- Apply each part as GL JS does: a call that changes several things applies each part with its own GL JS call. If GL JS refuses a part, the tool still applies the other parts. The tool reports each failed part with its GL JS error.
- A tool changes only what the agent asks for: it keeps the rest of the state that the app set. A tool can set or remove any feature-state key that the target reads, also one that the app set. A tool can set a paint or layout property on any layer, also on a layer that the app added.
- Own what you add: everything that the plugin adds to the map has an id that starts with `mapbox-webmcp-`. A tool that removes things covers only what the plugin added. A tool removes a thing that it added and that failed to load, such as an import or an inline source. This cleanup is not an undo, because the thing never loaded. A tool can list what the app added, such as a source that a new layer can use.
- No assumed map state: each time a tool runs, the plugin reads the map state from GL JS. The app can change the map at any time, so the plugin never relies on a value that it set or read before.
- Read back results: after a change, a tool reads the new state from GL JS. A call without a failed part returns that state. A tool never returns its input or a value that it computed before the change.

### Keep features as GL JS returns them

- GL JS ids only: the plugin names a feature only by the id that GL JS gives it. It never builds an identity from properties or geometry.
- Data as GL JS returns it: the plugin keeps feature properties, values and types as GL JS returns them. It matches, filters and measures features only with GL JS expressions, such as a filter, `within` or `distance`. It can sort a result and cut it to its first features.

### Behave the same everywhere

- One way to size a result: `properties` chooses the keys of each item in every action that returns a list or an item, and the agent sizes the result with it. A list of what the style or the app defines, such as layers, sources, targets, markers and popups, is complete: it has no `limit`, and by default each item has only the keys that do not grow with the content. A query of features cuts its list with `limit`, returns `total` and selects keys inside each feature's `properties` with `featureProperties`. The plugin never cuts a result on its own.
- Every action that returns a list takes `properties`.
- One response to one mistake: a call that lacks a target or an id that another call returns throws an error that starts with `Give` and ends with the call that returns it, such as `List the layers to see them.` A tool never answers such a call with a different result.

### Serve the user

- Respect reduced motion: the plugin follows the user's `prefers-reduced-motion` setting. Only the agent can animate a move against it, with `essential: true`. The plugin never sets `essential: true` itself. If the user prefers reduced motion, the plugin's own motion stops. The tool description tells the agent to set `essential: true` only at the user's request to see the motion.
- Keep the map responsive: the user feels that the map responds at once, also while a tool runs. A tool never blocks user input, such as a pan, a zoom or a click, and the user can stop a move at any time. The map starts to show the change within 100 ms of the call, before slow work such as a wait for tiles. A response under 100 ms feels instant.
- Fewest tool calls: one user request needs the fewest tool calls possible.

## Checks

| Rule | Checked by | Runs at |
|------|-----------|---------|
| Zero type errors | `npm run tsc` | `npm run check:fast` |
| Zero lint errors | `npm run eslint` | `npm run check:fast`, CI |
| All tests pass | `npm test` | `npm run check:task`, CI |

ESLint enforces part of the floor. `@typescript-eslint/ban-ts-comment` refuses `@ts-ignore`, `no-warning-comments` refuses `TODO` and `FIXME`, and `no-empty` refuses an empty `catch`. A reviewer checks the rest of the floor.

## Exceptions

An approved row allows a violation of one implementation rule. For "No private GL JS API", the public API must have no clear way to do the same thing. For "No copies of GL JS logic" and "No hardcoded values", no other way must work. An exception expires after 90 days. That is long enough to plan the fix in GL JS, and short enough that someone remembers it.

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| P1 | No private GL JS API | `src/index.ts`, `_sendCounts` | Fires the `telemetry` map event once per session with the count of each built-in tool. GL JS keeps the event private, for its plugins only. GL JS sends the counts with the map's access token, as it sends its own metrics. | Stepan Kuzmin | 2027-02-14 |
