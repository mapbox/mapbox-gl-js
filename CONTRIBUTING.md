Hi, and thanks in advance for contributing to Mapbox GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Preparing your Development Environment

### OSX

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/) version 14
```bash
brew install node@14
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
yarn install
```

### Linux

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) version 14, [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update
curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -
sudo apt-get install build-essential git nodejs libglew-dev libxi-dev
```

Install [yarn](https://yarnpkg.com/en/docs/install#linux-tab)
```bash
curl -o- -L https://yarnpkg.com/install.sh | bash
```
(It is also possible to install yarn from Debian/Ubuntu packages. See [yarn's install instructions](https://yarnpkg.com/en/docs/install#linux-tab)).

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
yarn install
```

### Windows

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) version 14, [yarn](https://yarnpkg.com/en/docs/install#windows-tab), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```


Install node module dependencies
```bash
yarn install
```

Install headless-gl dependencies https://github.com/stackgl/headless-gl#windows
```
copy node_modules/headless-gl/deps/windows/dll/x64/*.dll c:\windows\system32
```

## Serving the Debug Page

Start the debug server

```bash
MAPBOX_ACCESS_TOKEN={YOUR_MAPBOX_ACCESS_TOKEN} yarn run start-debug
```

Open the debug page at [http://localhost:9966/debug](http://localhost:9966/debug)

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `mapbox-gl.js` and `mapbox-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
yarn run build-prod-min
yarn run build-css
```

Once those commands finish, you will have a standalone build at `dist/mapbox-gl.js` and `dist/mapbox-gl.css`

## Writing & Running Tests

See [`test/README.md`](./test/README.md).

## Writing & Running Benchmarks

See [`bench/README.md`](./bench/README.md).

## Code Conventions

* We use [`error` events](https://www.mapbox.com/mapbox-gl-js/api/#Map.event:error) to report user errors.
* We use [`assert`](https://nodejs.org/api/assert.html) to check invariants that are not likely to be caused by user error. These `assert` statements are stripped out of production builds.
* We use the following ES6 features:
  * `let`/`const`
  * `for...of` loops
  * Arrow functions
  * Classes
  * Template strings
  * Computed and shorthand object properties
  * Default parameters
  * Rest parameters
  * Destructuring
  * Modules
  * Spread (`...`) operator
  * Iterators and generators
  * "Library" features such as `Map`, `Set`, `array.find`, etc.

The conventions for module exports are:

* No exported "namespace objects" -- modules should export either classes or functions, with an occasional exception as needed for stubbing.
* If a module exports something with the same name as the file name (modulo case), it should be the default export.
* Anything else should be a named export.

### Version Control Conventions

* We use [rebase merging](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) (as opposed to [basic merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging#Basic-Merging)) to merge branches

Here is a recommended way to get setup:
1. Fork this project
2. Clone your new fork, `git clone git@github.com:GithubUser/mapbox-gl-js.git`
3. `cd mapbox-gl-js`
4. Add the Mapbox repository as an upstream repository: `git remote add upstream git@github.com:mapbox/mapbox-gl-js.git`
5. Create a new branch `git checkout -b your-branch` for your contribution
6. Write code, open a PR from your branch when you're ready
7. If you need to rebase your fork's PR branch onto main to resolve conflicts: `git fetch upstream`, `git rebase upstream/main` and force push to Github `git push --force origin your-branch`

## Changelog Conventions

`CHANGELOG.md` is a valuable document many people read. It contains a formatted, lightly editorialized history of changes in the project. Pull requests are the unit of change and are normally categorized and summarized when reviewed. The changelog is maintained by combining automated content search and formatting with a final human edit.

What warrants a changelog entry?

- Any change that affects the public API, visual appearance or user security *must* have a changelog entry
- Any performance improvement or bugfix *should* have a changelog entry
- Any contribution from a community member *may* have a changelog entry, no matter how small (accompanied by a hat-tip in the final changelog: `(h/t [<user>](https://github.com/<user>))`)
- Any documentation related changes *should not* have a changelog entry
- Any regression change introduced and fixed within the same release *should not* have a changelog entry
- Any internal refactoring, technical debt reduction, render test, unit test or benchmark related change *should not* have a changelog entry

How to add your changelog? Changelog entries are written inside the `<changelog></changelog>` tag in the PR template. A changelog entry should:

- be descriptive and concise; it should explain the change to a reader without context
- describe the surface bug and not the underlying problem. This might require some research.
- be labeled `skip changelog` if the PR has no impact on end users and does not require a changelog entry
- be labeled `breaking change` if the PR is a breaking change
- reference a PR and optionally an issue.

## Documentation Conventions

See [`README.md`](https://github.com/mapbox/mapbox-gl-js-docs/blob/publisher-production/README.md) from [`mapbox-gl-js-docs`](https://github.com/mapbox/mapbox-gl-js-docs/).

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
- [Graphics Pipeline Performance](http://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch28.html)

### Misc

- [Drawing Antialiased Lines with OpenGL](https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc)
- [Drawing Text with Signed Distance Fields in Mapbox GL](https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817)
- [Map Label Placement in Mapbox GL](https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa)
- [Signed Distance Fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
