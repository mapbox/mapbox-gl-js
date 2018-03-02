'use strict';

require('./stub_loader');
require('../build/flow-remove-types.js');
require = require("@std/esm")(module, true);

const suite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

suite.run('js', ignores, suiteImplementation);
