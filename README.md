# Mapbox GL Lint

[![Build Status](https://magnum.travis-ci.com/mapbox/mapbox-gl-style-lint.svg?token=6EjGQXFuGMFRr7mgpjEj)](https://magnum.travis-ci.com/mapbox/mapbox-gl-style-lint)

GL style spec and migration scripts for [mapbox-gl-web](https://github.com/mapbox/mapbox-gl-web) and
[mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native).

### Install

    npm install -g mapbox-gl-style-lint

Provides the utilities:

* `gl-style-migrate`
* `gl-style-validate`

### Validation

```bash
$ gl-style-validate style.json
```

Will validate the given style JSON and print errors to stdout. Provide a
`--json` flag to get JSON output.

### Migrations

This repo contains scripts for migrating GL style of any version to the latest version,
and also a script for migrating the latest version style to renderer-friendly version.

Migrate any style like this:

```bash
$ gl-style-migrate test/styles/bright-v0.js > bright-v1.js;  # v0 to v1
$ gl-style-migrate test/styles/bright-v1.js > bright-raw.js; # v1 to renderer-friendly
```

The old style needs to export the JSON node-style, with `module.exports = { ...`,
or just be a valid JSON with `.json` extension.

Things user-friendly to renderer-friendly migration script currently does:

- generates buckets (data selections) from layer structure, cleaning up duplicates
- moves style rules read at bucket parse time from layer classes to buckets
- detects types of each bucket from styles
- propagates styles and filter defined on a layer group to children layers
- replaces fill+line buckets where line <= 1px width with just fills with an outline

## Tests

To run tests:

    npm install
    npm test

To update test fixtures

    UPDATE=true npm test
