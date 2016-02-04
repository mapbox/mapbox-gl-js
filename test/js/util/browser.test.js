'use strict';

var test = require('prova');
var util = require('../../../js/util/browser');

test('browser', function(t) {
    t.test('supported', function(t) {
        t.equal(util.supported(), true);
        t.end();
    });

    t.test('frame', function(t) {
        var id = util.frame(function() {
            t.pass('called frame');
            t.ok(id, 'returns id');
            t.end();
        });
    });

    t.test('now', function(t) {
        t.equal(typeof util.now(), 'number');
        t.end();
    });

    t.test('cancelFrame', function(t) {
        var id = util.frame(function() {
            t.fail();
        });
        util.cancelFrame(id);
        t.end();
    });

    t.end();
});
