'use strict';

var renderSuite = require('mapbox-gl-test-suite').render;
var suiteImplementation = require('./suite_implementation');

var tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

renderSuite.run('js', {tests: tests}, suiteImplementation);
