# Mapbox GL Spec & Lint

[![Circle CI](https://circleci.com/gh/mapbox/mapbox-gl-style-spec.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-style-spec)

GL style spec, validation, and migration scripts for [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) and
[mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native).

### Install

    npm install -g mapbox-gl-style-spec

Provides the utilities:

* `gl-style-migrate`
* `gl-style-format`
* `gl-style-validate`

### Validation

```bash
$ gl-style-validate style.json
```

Will validate the given style JSON and print errors to stdout. Provide a
`--json` flag to get JSON output.

### Migrations

This repo contains scripts for migrating GL styles of any version to the latest version
(currently v8). Migrate a style like this:

```bash
$ gl-style-migrate bright-v7.json > bright-v8.json
```

To migrate a file in place, you can use the `sponge` utility from the `moreutils` package:

```bash
$ brew install moreutils
$ gl-style-migrate bright.json | sponge bright.json
```

### [API](API.md)

## Tests

To run tests:

    npm install
    npm test

To update test fixtures

    UPDATE=true npm test

### Documentation

* The utility reference page [API.md](API.md) is generated automatically from inline source documentation.
* The style reference page exists here: `docs/_generate/index.html` and can be edited directly.

To view the documentation, run

```bash
npm start
```

and open the served page

```bash
open http://127.0.0.1:4000/mapbox-gl-style-spec
```
