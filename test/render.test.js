'use strict';

require('flow-remove-types/register');

const renderSuite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

renderSuite.run('js', {tests, ignores}, suiteImplementation);
