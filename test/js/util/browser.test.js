'use strict';

var test = require('tape').test;
var util = require('../../../js/util/browser.js');

test('browser', function(t) {
    t.test('supported', function(t) {
        t.equal(util.supported(), true);
        t.end();
    });

    t.end();
});
