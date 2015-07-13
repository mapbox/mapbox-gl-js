# Documentation

To generate new docs run

```bash
npm run docs
```

This will generate a [Jekyll](http://jekyllrb.com) site in the `docs` directory. To view the documentation, start a Jekyll server 

```bash
cd docs && jekyll serve -w
```

and open the served page

```bash
open http://localhost:4000
```

## Public and Private Interfaces

Any interface not explicitly marked as `@private` will be displayed on the official [Mapbox GL JS documentation page](https://www.mapbox.com/mapbox-gl-js/api/). Internal interfaces can and should be documentated with JSDoc comments but must be marked as `@private`.

