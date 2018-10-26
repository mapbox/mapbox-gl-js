Mapbox GL JS has [API documentation](#writing-api-documentation) and [examples](#writing-examples).

## Writing API Documentation

API documentation is written as [JSDoc comments](http://usejsdoc.org/) and processed with [documentationjs](http://documentation.js.org/).

* Classes, methods, events, and anything else in the public interface must be documented with JSDoc comments. Everything outside of the public interface may be documented and must be tagged as `@private`.
* Text within JSDoc comments may use markdown formatting. Code identifiers must be surrounded by \`backticks\`.
* Documentation must be written in grammatically correct sentences ending with periods.
* Documentation must specify measurement units when applicable.
* Documentation descriptions must contain more information than what is obvious from the identifier and JSDoc metadata.
* Class descriptions should describe what the class *is*, or what its instances *are*. They do not document the constructor, but the class. They should begin with either a complete sentence or a phrase that would complete a sentence beginning with "A `T` is..." or "The `T` class is..." Examples: "Lists are ordered indexed dense collections." "A class used for asynchronous computations."
* Function descriptions should begin with a third person singular present tense verb, as if completing a sentence beginning with "This function..." If the primary purpose of the function is to return a value, the description should begin with "Returns..." Examples: "Returns the layer with the specified id." "Sets the map's center point."
* `@param`, `@property`, and `@returns` descriptions should be capitalized and end with a period. They should begin as if completing a sentence beginning with "This is..." or "This..."
* Functions that do not return a value (return `undefined`), should not have a `@returns` annotation.
* Member descriptions should document what a member represents or gets and sets. They should also indicate whether the member is read-only.
* Event descriptions should begin with "Fired when..." and so should describe when the event fires. Event entries should clearly document any data passed to the handler, with a link to MDN documentation of native Event objects when applicable.

## Writing Examples

Examples are written as [Batfish](https://github.com/mapbox/batfish) pages in `docs/pages/example`. Each example requires two files: an `.html` file containing the source
code for the example, and a `.js` file containing example boilerplate and front matter. The front matter should include the following items:

* `title`: A short title for the example in **sentence case** as a **verb phrase**
* `description`: A one sentence description of the example
* `tags`: An array of tags for the example, which determine the sections it is listed in in the sidebar navigation
* `pathname`: The relative path of the example, including leading `/mapbox-gl-js/example/` path

In the `.html` file, write the HTML and JavaScript constituting the example.

* Use **4 space indentation**. Exception: do not add an initial level of indentation to code within `<script>` tags (it should start flush left).
* Do **not** include an access token in the example code. The access token will be inserted automatically by the template, using the current logged in user's default public token, or a placeholder `<insert token here>` string if the user is not logged in.
* Do **not** use custom styles from your personal account. Use only the default `mapbox` account styles.
* When embedding literal JSON (GeoJSON or Mapbox style snippets) into script code, double-quote property names and string values. Elsewhere, use single-quoted strings.

## Running the Documentation Server Locally

To start a documentation server locally run
```bash
npm run start-docs
```

The command will print the URL you can use to view the documentation.

## Committing and Publishing Documentation

The mapbox-gl-js repository has both `master` and `mb-pages` as active branches. The **`master` branch** is used for mainline code development: the next version of mapbox-gl-js will come from the code in this branch, and it may contain documentation and examples for APIs that are not yet part of a public release. The **`mb-pages` branch** is published to https://www.mapbox.com/mapbox-gl-js/ on any push to the branch. For the purposes of documentation changes, use these two branches as follows:

* If your changes are relevant to the **currently released version**, make them on `mb-pages`. Examples: correcting the API documentation for a released API, adding a new example that depends only on current APIs.
* If your changes depend on gl-js features **not in the currently released version**, make them on `master`. Examples: documenting or adding an example for a newly-added API.

When releasing, the release manager will:

* Merge `mb-pages` to `master`, ensuring that any accumulated changes in `mb-pages` propagate to `master`
* Make the release
* Fast-forward `mb-pages` to the current `master`, ensuring that all accumulated changes are published to mapbox.com
