# Mapbox GL style specification & utilities

This directory contains code and reference files that define the Mapbox GL style specification and provides some utilities for working with Mapbox styles.

## npm package

The Mapbox GL style specification and utilities are published as a seperate npm
package so that they can be installed without the bulk of GL JS.

    npm install @mapbox/mapbox-gl-style-spec

In addition to ESM and CJS bundles, the package also provides separate modules. The difference between the bundles and the modules is that the modules use a minified version of the `latest` style refererence, which does not contain any `doc` and `example` fields. See the `exports` section of `package.json` for available modules.

## CLI Tools

If you install this package globally, you will have access to several CLI tools.

    npm install @mapbox/mapbox-gl-style-spec --global


### `gl-style-composite`
```bash
$ gl-style-composite style.json
```

Will take a non-composited style and produce a [composite style](https://www.mapbox.com/blog/better-label-placement-in-mapbox-studio/).

### `gl-style-migrate`

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

### `gl-style-format`

```bash
$ gl-style-format style.json
```

Will format the given style JSON to use standard indentation and sorted object keys.

### `gl-style-validate`

```bash
$ gl-style-validate style.json
```

Will validate the given style JSON and print errors to stdout. Provide a
`--json` flag to get JSON output.

To validate that a style can be uploaded to the Mapbox Styles API, use the `--mapbox-api-supported` flag.

## License

This project uses the standard Mapbox license, which is designed to provide flexibility for our customers and a sustained foundation for the development of our technology. Please consult LICENSE.txt for its specific details.

We understand that the Mapbox Style Specification embodied in this module may be useful in a wide variety of projects. If you are interested in using this module in a manner not expressly permitted by its license, please do not hesitate to contact legal@mapbox.com with details of what you have in mind.
```
