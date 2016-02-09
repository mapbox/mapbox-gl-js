'use strict';

var querySuite = require('mapbox-gl-test-suite').query;
var suiteImplementation = require('./suite_implementation');

var tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

querySuite.run('js', {tests: tests}, suiteImplementation);
