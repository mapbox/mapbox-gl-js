'use strict';

require('flow-remove-types/register');

const renderSuite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;
let shuffle = false;
let recycleMap = false;
let seed;

// https://stackoverflow.com/a/1349426/229714
function makeHash() {
    const array = [];
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 10; ++i)
        array.push(possible.charAt(Math.floor(Math.random() * possible.length)));

    // join array elements without commas.
    return array.join('');
}

function checkParameter(param) {
    const index = tests.indexOf(param);
    if (index === -1)
        return false;
    tests.splice(index, 1);
    return true;
}

function checkValueParameter(defaultValue, param) {
    const index = tests.findIndex((elem) => { return String(elem).startsWith(param); });
    if (index === -1)
        return defaultValue;

    const split = String(tests.splice(index, 1)).split('=');
    if (split.length !== 2)
        return defaultValue;

    return split[1];
}

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; });
    shuffle = checkParameter('--shuffle');
    seed = checkValueParameter(makeHash(), '--seed');
    recycleMap = checkParameter('--recycle-map');
}

renderSuite.run('js', { tests, ignores, shuffle, seed, recycleMap }, suiteImplementation);
