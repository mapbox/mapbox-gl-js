/* eslint-disable import/unambiguous, import/no-commonjs, no-global-assign */

require('./stub_loader');
require('@mapbox/flow-remove-types/register');
require = require("esm")(module, true);

const querySuite = require('./integration/lib/query');
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

querySuite.run('js', {tests, ignores}, suiteImplementation);
