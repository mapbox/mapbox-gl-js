Hi, and thanks in advance for contributing to Mapbox GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Preparing your Development Environment

### OSX

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/) version 4 or greater
```bash
brew install node
```
Install [yarn](https://yarnpkg.com/en/)
```bash
brew install yarn
```

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
yarn install
```

### Linux

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version 6 or greater), [yarn](https://yarnpkg.com/en/docs/install#linux-tab), [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git nodejs yarn libglew-dev libxi-dev
```

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
yarn install
```

### Windows

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version 4 or greater), [yarn](https://yarnpkg.com/en/docs/install#windows-tab), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```


Install node module dependencies
```bash
cd mapbox-gl-js
yarn install
```

Install headless-gl dependencies https://github.com/stackgl/headless-gl#windows
```
copy node_modules/headless-gl/deps/windows/dll/x64/*.dll c:\windows\system32
```

## Serving the Debug Page

Start the debug server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} yarn run start-debug
```

Open the debug page at [http://localhost:9966/debug](http://localhost:9966/debug)

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `mapbox-gl.js` and `mapbox-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
yarn run build-min
```

Once that command finishes, you will have a standalone build at `dist/mapbox-gl.js` and `dist/mapbox-gl.css`

## Writing & Running Tests

See [`test/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/test/README.md).

## Writing & Running Benchmarks

See [`bench/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/bench/README.md).

## Code Conventions

* We use [`error` events](https://www.mapbox.com/mapbox-gl-js/api/#Map.event:error) to report user errors.
* We use [`assert`](https://nodejs.org/api/assert.html) to check invariants that are not likely to be caused by user error. These `assert` statements are stripped out of production builds.
* We use the following ES6 features:
  * `let`/`const`
  * `for...of` loops (for arraylike iteration only, i.e. what is supported by [Bublé's `dangerousForOf` transform](https://buble.surge.sh/guide/#dangerous-transforms))
  * Arrow functions
  * Classes
  * Template strings
  * Computed and shorthand object properties
  * Default parameters
  * Rest parameters
  * Destructuring
* The following ES6 features are not to be used, in order to maintain support for IE 11 and older mobile browsers. This may change in the future.
  * Spread (`...`) operator (because it requires Object.assign)
  * Iterators and generators
  * "Library" features such as `Map`, `Set`, `array.find`, etc.
  * Modules

### Version Control Conventions

* We use [rebase merging](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) (as opposed to [basic merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging#Basic-Merging)) to merge branches

## Documentation Conventions

See [`docs/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/docs/README.md).

### Github Issue Labels

Our labeling system is

 - **minimalistic:** Labels' usefulness are inversely proportional to how many we have.
 - **objective:** Labels should be objective enough that any two people would agree on a labeling decision.
 - **useful:** Labels should track state or capture semantic meaning that would otherwise be hard to search.

We have divided our labels into categories to make them easier to use.

 - type (blue)
 - actionable status (red)
 - non-actionable status (grey)
 - importance / urgency (green)
 - topic / project / misc (yellow)

## Recommended Reading

### Learning WebGL

- [Greggman's WebGL articles](http://webglfundamentals.org/)
- [WebGL reference card](http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

### GL Performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)
- [Graphics Pipeline Performance](http://http.developer.nvidia.com/GPUGems/gpugems_ch28.html)

### Misc

- [drawing antialiased lines](https://www.mapbox.com/blog/drawing-antialiased-lines/)
- [drawing text with signed distance fields](https://www.mapbox.com/blog/text-signed-distance-fields/)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
