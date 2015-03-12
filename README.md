# Mapbox GL Spec & Lint

[![Build Status](https://travis-ci.org/mapbox/mapbox-gl-style-spec.svg?branch=master)](https://travis-ci.org/mapbox/mapbox-gl-style-spec)
 [![Coverage Status](https://coveralls.io/repos/mapbox/mapbox-gl-style-spec/badge.png)](https://coveralls.io/r/mapbox/mapbox-gl-style-spec)

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

### [API](API.md)

### Migrations

This repo contains scripts for migrating GL styles of any version to the latest version
(currently v5). Migrate a style like this:

```bash
$ gl-style-migrate bright-v0.json > bright-v5.json
```

To migrate a file in place, you can use the `sponge` utility from the `moreutils` package:

```bash
$ brew install moreutils
$ gl-style-migrate bright.json | sponge bright.json
```

## Tests

To run tests:

    npm install
    npm test

To update test fixtures

    UPDATE=true npm test

### Documentation

Documentation is generated from the JSON reference. To update the docs, run:

```sh
$ npm run docs
```
