'use strict';
var test = require('tape').test;
var resolveTokens = require('../js/util/token.js');

test('token', function(t) {
    var orig = console.warn;
    var warn = [];
    console.warn = function() { warn.push(arguments); };

    t.equal('14th St NW', resolveTokens({name:'14th St NW'}, 'name'));
    t.equal(undefined, resolveTokens({text:'14th St NW'}, 'name'));
    t.equal(1400, resolveTokens({num:1400}, 'num'));
    t.equal('500 m', resolveTokens({num:500}, '{{num}} m'));
    t.equal('3 Fine Fields', resolveTokens({a:3, b:'Fine', c:'Fields'}, '{{a}} {{b}} {{c}}'));
    t.equal(' but still', resolveTokens({}, '{{notset}} but still'));
    t.deepEqual([
        '[WARNING] feature doesn\'t have property \'%s\' required for labelling',
        'notset'
    ], warn[0]);
    t.equal(1, warn.length);

    t.end();

    console.warn = orig;
});
