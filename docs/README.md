# Documentation

## Generating Documentation

To generate new docs run

```bash
npm run docs
```

This will generate a [Jekyll](http://jekyllrb.com) site in the `docs` directory. To view the documentation, start a Jekyll server (in the project's root directory)

```bash
jekyll serve -w
```

and open the served page

```bash
open http://127.0.0.1:4000/mapbox-gl-js
```

## Public and Private Interfaces

Any interface not explicitly marked as `@private` will be displayed on the official [Mapbox GL JS documentation page](https://www.mapbox.com/mapbox-gl-js/api/). Internal interfaces can and should be documentated with JSDoc comments but must be marked as `@private`.

## References

 - [Documentation.js Homepage](http://documentation.js.org)
 - [Documentation.js Getting Started Guide](https://github.com/documentationjs/documentation/blob/master/docs/GETTTING_STARTED.md)
 - [JSDoc Specification](http://usejsdoc.org/index.html)

