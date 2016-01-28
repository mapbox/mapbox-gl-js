Mapbox GL JS has [API documentation](#api-documentation) and [examples](#examples).

## API Documentation

API documentation is written as [JSDoc comments](http://usejsdoc.org/) and processed with [documentationjs](http://documentation.js.org/). We aim to document all classes and methods, public and private. Mark private classes and methods with `@private`.

Any interface not explicitly marked as `@private` will be displayed on the official [Mapbox GL JS documentation page](https://www.mapbox.com/mapbox-gl-js/api/). Internal interfaces can and should be documented with JSDoc comments but must be marked as `@private`.

References:

* [Documentation.js Homepage](http://documentation.js.org)
* [Documentation.js Getting Started Guide](https://github.com/documentationjs/documentation/blob/master/docs/GETTTING_STARTED.md)
* [JSDoc Specification](http://usejsdoc.org/index.html)

## Examples

Examples are written as Jekyll posts in `docs/_posts/examples`. The Jekyll front matter should include the following items:

* `layout`: `example`
* `category`: `example`
* `title`: A short title for the example in **sentence case** as a **verb phrase**
* `description`: A one sentence description of the example

In the post body, write the HTML and JavaScript constituting the example.

* Use **4 space indentation**. Exception: do not add an initial level of indentation to code within `<script>` tags (it should start flush left).
* Do **not** include an access token in the example code. The access token will be inserted automatically by the template, using the current logged in user's default public token, or a placeholder `<insert token here>` string if the user is not logged in.
* Do **not** use custom styles from your personal account. Use only the default `mapbox` account styles.
* When embedding literal JSON (GeoJSON or GL style snippets) into script code, double-quote property names and string values. Elsewhere, use single-quoted strings.

## Running Documentation Server Locally

To start a documentation server locally run
```bash
npm run start-docs
```

You can view the documentation at

```bash
open http://127.0.0.1:4000/mapbox-gl-js
```

## Troubleshooting

Ensure you have the right version of all dependencies

```bash
npm install
```

Ensure you are running Jekyll version 2.5.x

```bash
jekyll -v
 > jekyll 2.5.3
```

## Branch Usage

The mapbox-gl-js repository has both `master` and `mb-pages` as active branches. The **`master` branch** is used for mainline code development: the next version of mapbox-gl-js will come from the code in this branch, and it may contain documentation and examples for APIs that are not yet part of a public release. The **`mb-pages` branch** is published to https://www.mapbox.com/mapbox-gl-js/ on any push to the branch. For the purposes of documentation changes, use these two branches as follows:

* If your changes are relevant to the **currently released version**, make them on `mb-pages`. Examples: correcting the API documentation for a released API, adding a new example that depends only on current APIs.
* If your changes depend on gl-js features **not in the currently released version**, make them on `master`. Examples: documenting or adding an example for a newly-added API.

When releasing, the release manager will:

* Merge `mb-pages` to `master`, ensuring that any accumulated changes in `mb-pages` propagate to `master`
* Make the release
* Fast-forward `mb-pages` to the current `master`, ensuring that all accumulated changes are published to mapbox.com
