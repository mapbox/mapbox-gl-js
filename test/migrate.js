'use strict';

var t = require('tape'),
    spec = require('mapbox-gl-style-spec'),
    migrate = require('../').migrate;

t('migrates to latest version', function(t) {
    var versions = Object.keys(spec),
        latest = spec[versions[versions.length - 1]].$version;
    t.deepEqual(migrate({version: 4, layers: []}).version, latest);
    t.end();
});
