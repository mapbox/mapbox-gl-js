Hi, and thanks in advance for contributing to Mapbox GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Issues

When reporting a bug, if possible please include **executable code** that demonstrates the issue you have encountered. A good way to do so is to attach a link to an example on [JSFiddle](https://jsfiddle.net/).

## Code conventions

* Our code conventions are mostly enforced with eslint, which will be run as part of `npm test`.
* In internal / private methods, we check preconditions with `assert`, helping us catch mistakes within the library. For performance, these checks are removed from the production build with [unassertify](https://www.npmjs.com/package/unassertify).
* In external / public methods, we check preconditions where appropriate and emit an error. "Emit" can mean throwing an `Error`, passing an `Error` as a first callback argument, or emitting an `error` event, as appropriate for the context. These checks remain present in production builds, helping downstream authors avoid common mistakes.

## Documentation conventions

See [docs/README.md](https://github.com/mapbox/mapbox-gl-js/blob/master/docs/README.md).
