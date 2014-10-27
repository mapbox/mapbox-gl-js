'use strict';

var t = require('tape'),
    migrate = require('../migrations/v6-filter');

t('basic', function(t) {
    t.deepEqual(migrate({a: 'b'}),
        ['==', 'a', 'b']);
    t.deepEqual(migrate({a: 'b', c: 'd'}),
        ['all', ['==', 'a', 'b'], ['==', 'c', 'd']]);
    t.end();
});

t('operators', function(t) {
    t.deepEqual(migrate({a: {'==': 'b'}}),
        ['==', 'a', 'b']);
    t.deepEqual(migrate({a: {'>=': 'b'}}),
        ['>=', 'a', 'b']);
    t.deepEqual(migrate({a: {'in': ['b']}}),
        ['in', 'a', 'b']);
    t.deepEqual(migrate({a: {'!in': ['b']}}),
        ['!in', 'a', 'b']);
    t.end();
});

t('arrays', function(t) {
    t.deepEqual(migrate({a: ['b', 'c']}),
        ['in', 'a', 'b', 'c']);
    t.end();
});

t('&', function(t) {
    t.deepEqual(migrate({'&': { 'a': 'b', 'c': 'd' }}),
        ['all', ['==', 'a', 'b'], ['==', 'c', 'd']]);
    t.end();
});

t('|', function(t) {
    t.deepEqual(migrate({'|': { 'a': 'b', 'c': 'd' }}),
        ['any', ['==', 'a', 'b'], ['==', 'c', 'd']]);
    t.end();
});

t('!', function(t) {
    t.deepEqual(migrate({'!': { 'a': 'b' }}),
        ['!=', 'a', 'b']);
    t.deepEqual(migrate({'!': { 'a': 'b', 'c': 'd' }}),
        ['any', ['!=', 'a', 'b'], ['!=', 'c', 'd']]);
    t.end();
});

t('example', function(t) {
    var f = migrate({
        "class": "street_limited",
        "admin_level": { ">=": 3 },
        "!": { "$type": "Polygon" }
    });
    t.deepEqual(f, [
        'all',
        ['==', 'class', 'street_limited'],
        ['>=', 'admin_level', 3],
        ['!=', '$type', 'Polygon']
    ])
    t.end();
});
