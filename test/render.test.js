'use strict';

require('flow-remove-types/register');

const renderSuite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;
let recycleMap = false;

if (process.argv[1] === __filename && process.argv.length > 2) {
    if (process.argv[2] === '--recycle-map') {
        recycleMap = true;
        tests = process.argv.slice(3);
    } else {
        tests = process.argv.slice(2);
    }
}

renderSuite.run('js', {tests, ignores, recycleMap}, suiteImplementation);
