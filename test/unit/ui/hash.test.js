'use strict';

import { test } from 'mapbox-gl-js-test';
import Hash from '../../../src/ui/hash';
import window from '../../../src/util/window';
import Map from '../../../src/ui/map';

test('hash', (t) => {
    function createHash() {
        const hash = new Hash();
        hash._updateHash = hash._updateHashUnthrottled.bind(hash);
        return hash;
    }

    function createMap() {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        return new Map({container: container});
    }


    t.test('#addTo', (t) => {
        const map = createMap();
        const hash = createHash();

        t.notok(hash._map);

        hash.addTo(map);

        t.ok(hash._map);
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        t.ok(hash._map);

        hash.remove();

        t.notok(hash._map);
        t.end();
    });

    t.test('#_onHashChange', (t) => {
        const map = createMap();
        const hash = createHash()
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

    t.test('#_onHashChange empty', (t) => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        t.equal(map.getCenter().lng, -1);
        t.equal(map.getCenter().lat, 3);
        t.equal(map.getZoom(), 10);
        t.equal(map.getBearing(), 0);
        t.equal(map.getPitch(), 0);

        window.location.hash = '';

        hash._onHashChange();

        t.equal(map.getCenter().lng, -1);
        t.equal(map.getCenter().lat, 3);
        t.equal(map.getZoom(), 10);
        t.equal(map.getBearing(), 0);
        t.equal(map.getPitch(), 0);

        t.end();
    });

    t.test('#_updateHash', (t) => {
        function getHash() {
            return window.location.hash.split('/');
        }

        const map = createMap();
        createHash()
            .addTo(map);

        t.notok(window.location.hash);

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        t.ok(window.location.hash);

        let newHash = getHash();

        t.equal(newHash.length, 3);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1');
        t.equal(newHash[2], '2');

        map.setPitch(60);

        newHash = getHash();

        t.equal(newHash.length, 5);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1');
        t.equal(newHash[2], '2');
        t.equal(newHash[3], '0');
        t.equal(newHash[4], '60');

        map.setBearing(135);

        newHash = getHash();

        t.equal(newHash.length, 5);
        t.equal(newHash[0], '#3');
        t.equal(newHash[1], '1');
        t.equal(newHash[2], '2');
        t.equal(newHash[3], '135');
        t.equal(newHash[4], '60');

        t.end();
    });

    t.end();
});
