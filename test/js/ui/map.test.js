'use strict';
/* global process */

var test = require('tape').test;
var Map = require('../../../js/ui/map.js');

test('constructor', function(t) {
    var map = new Map({
        container: process.browser ? document.createElement('div') : null,
        style: {
            version: 3,
            layers: []
        }
    });
    t.ok(map.canvas);
    t.end();
});
