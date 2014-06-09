GL Style
========

[![Build Status](https://magnum.travis-ci.com/mapbox/gl-style.svg?token=6EjGQXFuGMFRr7mgpjEj&branch=reference)](https://magnum.travis-ci.com/mapbox/gl-style)

GL style spec and migration scripts for both [llmr](https://github.com/mapbox/llmr) and
[mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native).
Will also contain the style spec in future ([mapbox-gl-native#275](https://github.com/mapbox/mapbox-gl-native/issues/275)).

### Install

    npm install -g gl-style

Provides the utilities:

* `gl-style-migrate`

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
