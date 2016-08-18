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

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
npm install
```

### Linux

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version 4 or greater), [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git nodejs libglew-dev libxi-dev
```

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
npm install
```

### Windows

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version 4 or greater), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js
npm install
```

Install headless-gl dependencies https://github.com/stackgl/headless-gl#windows
```
copy node_modules/headless-gl/deps/windows/dll/x64/*.dll c:\windows\system32
```

## Serving the Debug Page

Start the debug server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} npm run start-debug
```

Open the debug page at [http://localhost:9966/debug](http://localhost:9966/debug)

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `mapbox-gl.js` and `mapbox-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
npm run build-min
```

Once that command finishes, you will have a standalone build at `dist/mapbox-gl.js` and `dist/mapbox-gl.css`

## Running Tests

There are two test suites associated with Mapbox GL JS

 - `npm test` runs quick unit tests
 - `npm run test-suite` runs slower rendering tests from the [mapbox-gl-test-suite](https://github.com/mapbox/mapbox-gl-test-suite) repository

## Running Benchmarks

See [`bench/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/bench/README.md).

## Sprint Planning

* We will use Github milestones to schedule tasks into two week sprints
* We will end each sprint and publish a release every other Wednesday unless there is an outstanding “release blocker” issue.
    * If there is a "release blocker" issue, we fix it as soon as possible and do the release
* We will prioritize feature work as follows:
    1. “release blocker” bugs
    3. in-progress things
    2. things needed by customers
    4. new things
* We will try to include one "testing and release process", one "refactoring", and one "bug" issue in each release.
* We will name releases alphabetically after [cities](https://en.wikipedia.org/wiki/List_of_towns_and_cities_with_100,000_or_more_inhabitants/cityname:_A). (Fun facts are encouraged!)

## Code Conventions

* Our code conventions are mostly enforced with eslint, which will be run as part of `npm test`.
* In internal / private methods, we check preconditions with `assert`, helping us catch mistakes within the library. For performance, these checks are removed from the production build with [unassertify](https://www.npmjs.com/package/unassertify).
* In external / public methods, we check preconditions where appropriate and emit an error. "Emit" can mean throwing an `Error`, passing an `Error` as a first callback argument, or emitting an `error` event, as appropriate for the context. These checks remain present in production builds, helping downstream authors avoid common mistakes.

## Git Conventions

 - If you have commit access to the repository, please be aware that we strive to maintain a clean, mostly-linear history.
 - You may use the GitHub merge button to squash and merge a branch. If you do not want to squash the branch into a single commit, see "Manually Merging a Branch" below.
 - Never merge a branch that is failing CI.

### Manually Merging a Branch

Before manually merging a branch, please

 - rebase the branch onto the current tip of the target branch (`master` or `mb-pages`).
 - squash commits until they are self-contained, potentially down to a single commit if appropriate.
 - perform a fast-forward merge into the target branch and push the result

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

### GL performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)
- [Graphics Pipeline Performance](http://http.developer.nvidia.com/GPUGems/gpugems_ch28.html)

### Misc

- [drawing antialiased lines](https://www.mapbox.com/blog/drawing-antialiased-lines/)
- [drawing text with signed distance fields](https://www.mapbox.com/blog/text-signed-distance-fields/)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
