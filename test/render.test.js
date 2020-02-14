/* eslint-disable import/unambiguous, import/no-commonjs, no-global-assign */

require('./stub_loader');
require('@mapbox/flow-remove-types/register');
const {registerFont} = require('canvas');
require = require("esm")(module, true);

const suite = require('./integration/lib/render');
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');
registerFont('./node_modules/npm-font-open-sans/fonts/Bold/OpenSans-Bold.ttf', {family: 'Open Sans', weight: 'bold'});

suite.run('js', ignores, suiteImplementation);
