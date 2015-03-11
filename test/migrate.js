'use strict';

var t = require('tape'),
    spec = require('../'),
    migrate = require('../').migrate;

t('migrates to latest version', function(t) {
    t.deepEqual(migrate({version: 4, layers: []}).version, spec.latest.$version);
    t.end();
});
