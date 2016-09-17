'use strict';

var test = require('tap').test;
var Hash = require('../../../js/ui/hash');
var window = require('../../../js/util/window');
var Map = require('../../../js/ui/map');

test('hash', function(t) {
    function createHash() {
        return new Hash();
    }

    function createMap() {
        var container = window.document.createElement('div');
        container.offsetWidth = 512;
        container.offsetHeight = 512;
        return new Map({container: container});
    }


    t.test('#addTo', function(t) {
        var map = createMap();
        var hash = createHash();

        t.notok(hash._map);

        hash.addTo(map);

        t.ok(hash._map);
        t.end();
    });

    t.test('#remove', function(t) {
        var map = createMap();
        var hash = createHash()
            .addTo(map);

        t.ok(hash._map);

        hash.remove();

        t.notok(hash._map);
        t.end();
    });

    t.test('#_onHashChange', function(t) {
        var map = createMap();
        var hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        t.equal(map.getCenter().lng, -1);
        t.equal(map.getCenter().lat, 3);
        t.equal(map.getZoom(), 10);
        t.equal(map.getBearing(), 0);
        t.equal(map.getPitch(), 0);

        window.location.hash = '#5/1.00/0.50/30/60';

        hash._onHashChange();

        t.equal(map.getCenter().lng, 0.5);
        t.equal(map.getCenter().lat, 1);
        t.equal(map.getZoom(), 5);
        t.equal(map.getBearing(), 30);
        t.equal(map.getPitch(), 60);

        window.location.hash = '';

        t.end();
    });

    t.test('#_updateHash', function(t) {
        function getHash() {
            return window.location.hash.split('/');
        }

        var map = createMap();
        createHash()
            .addTo(map);

        t.notok(window.location.hash);

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        t.ok(window.location.hash);

        var newHash = getHash();

        t.equal(newHash.length, 3);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1.00');
        t.equal(newHash[2], '2.00');

        map.setPitch(60);

        newHash = getHash();

        t.equal(newHash.length, 5);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1.00');
        t.equal(newHash[2], '2.00');
        t.equal(newHash[3], '0');
        t.equal(newHash[4], '60');

        map.setBearing(135);

        newHash = getHash();

        t.equal(newHash.length, 5);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1.00');
        t.equal(newHash[2], '2.00');
        t.equal(newHash[3], '135');
        t.equal(newHash[4], '60');

        t.end();
    });

    t.end();
});
