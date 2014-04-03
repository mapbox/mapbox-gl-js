
var beautify = require('js-beautify').js_beautify,
    argv = require('minimist')(process.argv.slice(2)),
    upgradeToV1 = require('./migrations/v1');

var v0 = require('./' + argv._[0]);
var v1 = upgradeToV1(v0);

console.log(beautify(JSON.stringify(v1)));
