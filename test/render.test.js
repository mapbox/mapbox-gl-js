/* eslint-disable import/unambiguous,no-global-assign */

require('./stub_loader');
require('@mapbox/flow-remove-types/register');
require = require("@std/esm")(module, true);

const suite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

suite.run('js', ignores, suiteImplementation);
