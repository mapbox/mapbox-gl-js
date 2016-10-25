'use strict';

require('flow-remove-types/register');
const renderSuite = require('mapbox-gl-test-suite').render;
const suiteImplementation = require('./suite_implementation');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

renderSuite.run('js', {tests: tests}, suiteImplementation);
