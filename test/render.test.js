/* eslint-disable import/unambiguous, import/no-commonjs, no-global-assign */

require('./stub_loader');
require('@mapbox/flow-remove-types/register');
require = require("esm")(module, true);

const suite = require('./integration/lib/render');
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

suite.run('js', ignores, suiteImplementation);
