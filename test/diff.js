'use strict';

var t = require('tape'),
    diff = require('../lib/diff'),
    latest = require('../diff/latest'),
    v7 = require('../diff/v7');

t('diff', function (t) {
    t.equal(latest, diff.latest, 'diff is the latest');
    t.equal(v7, diff.latest, 'v7 is currently the latest');

    t.end();
});
