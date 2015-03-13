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
* `gl-style-spritify`

### Validation

```bash
$ gl-style-validate style.json
```

Will validate the given style JSON and print errors to stdout. Provide a
`--json` flag to get JSON output.

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

### Building Sprites

The `gl-style-spritify` command can build sprite files for use in GL styles. Generate an image sprite by
running this script on one or more directories of images.

The first parameter is the basename that `gl-style-spritify` will use to generate `.json`, `.png`,
`@2x.json` and `@2x.png` files. For example, if you pass `bright`, `bright.json`, `bright.png`, etc
will be generated in the currrent directory.

Subsequent parameters are paths to directories which hold images to be included in the sprite.

```bash
$ gl-style-spritify bright sprite-assets
```

### [API](API.md)

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
