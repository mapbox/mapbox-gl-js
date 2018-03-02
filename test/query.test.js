'use strict';

require('./stub_loader');
require('../build/flow-remove-types.js');
require = require("@std/esm")(module, true);

const querySuite = require('./integration').query;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

querySuite.run('js', {tests, ignores}, suiteImplementation);
