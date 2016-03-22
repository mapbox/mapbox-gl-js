'use strict';

var test = require('tap').test;
var resolveTokens = require('../../../js/util/token');

test('token', function(t) {
    t.equal('literal', resolveTokens({name:'14th St NW'}, 'literal'));
    t.equal('14th St NW', resolveTokens({name:'14th St NW'}, '{name}'));
    t.equal('', resolveTokens({text:'14th St NW'}, '{name}'));
    t.equal('1400', resolveTokens({num:1400}, '{num}'));
    t.equal('500 m', resolveTokens({num:500}, '{num} m'));
    t.equal('3 Fine Fields', resolveTokens({a:3, b:'Fine', c:'Fields'}, '{a} {b} {c}'));
    t.equal(' but still', resolveTokens({}, '{notset} but still'));
    t.equal('dashed', resolveTokens({'dashed-property': 'dashed'}, '{dashed-property}'));
    t.equal('150 m', resolveTokens({'HØYDE': 150}, '{HØYDE} m'));
    t.equal('reserved {for:future} use', resolveTokens({'for:future': 'unknown'}, 'reserved {for:future} use'));

    t.end();
});
