import {describe, beforeEach, test, expect, createMap as globalCreateMap} from "../../util/vitest.js";
import Hash from '../../../src/ui/hash.js';

describe('hash', () => {
    beforeEach(() => {
        window.location.hash = '';
    });
    function createHash(name) {
        const hash = new Hash(name);
        hash._updateHash = hash._updateHashUnthrottled.bind(hash);
        return hash;
    }

    function createMap() {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'getBoundingClientRect',
            {value: () => ({height: 512, width: 512})});
        return globalCreateMap({container});
    }

    test('#addTo', () => {
        const map = createMap();
        const hash = createHash();

        expect(hash._map).toBeFalsy();

        hash.addTo(map);

        expect(hash._map).toBeTruthy();
    });

    test('#remove', () => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        expect(hash._map).toBeTruthy();

        hash.remove();

        expect(hash._map).toBeFalsy();
    });

    test('#_onHashChange', () => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(-1);
        expect(map.getCenter().lat).toEqual(3);
        expect(map.getZoom()).toEqual(10);
        expect(map.getBearing()).toEqual(0);
        expect(map.getPitch()).toEqual(0);

        // map is created with `interactive: false`
        // so explicitly enable rotation for this test
        map.dragRotate.enable();
        map.touchZoomRotate.enable();

        window.location.hash = '#5/1.00/0.50/30/60';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(0.5);
        expect(map.getCenter().lat).toEqual(1);
        expect(map.getZoom()).toEqual(5);
        expect(map.getBearing()).toEqual(30);
        expect(map.getPitch()).toEqual(60);

        // disable rotation to test that updating
        // the hash's bearing won't change the map
        map.dragRotate.disable();
        map.touchZoomRotate.disable();

        window.location.hash = '#5/1.00/0.50/-45/60';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(0.5);
        expect(map.getCenter().lat).toEqual(1);
        expect(map.getZoom()).toEqual(5);
        expect(map.getBearing()).toEqual(30);
        expect(map.getPitch()).toEqual(60);

        // test that a hash with no bearing resets
        // to the previous bearing when rotation is disabled
        window.location.hash = '#5/1.00/0.50/';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(0.5);
        expect(map.getCenter().lat).toEqual(1);
        expect(map.getZoom()).toEqual(5);
        expect(map.getBearing()).toEqual(30);
        expect(window.location.hash).toEqual('#5/1/0.5/30');

        window.location.hash = '#4/wrongly/formed/hash';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '';
    });

    test('#_onHashChange empty', () => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(-1);
        expect(map.getCenter().lat).toEqual(3);
        expect(map.getZoom()).toEqual(10);
        expect(map.getBearing()).toEqual(0);
        expect(map.getPitch()).toEqual(0);

        window.location.hash = '';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(-1);
        expect(map.getCenter().lat).toEqual(3);
        expect(map.getZoom()).toEqual(10);
        expect(map.getBearing()).toEqual(0);
        expect(map.getPitch()).toEqual(0);
    });

    test('#_onHashChange named', () => {
        const map = createMap();
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        hash._onHashChange();

        expect(map.getCenter().lng).toEqual(-1);
        expect(map.getCenter().lat).toEqual(3);
        expect(map.getZoom()).toEqual(10);
        expect(map.getBearing()).toEqual(0);
        expect(map.getPitch()).toEqual(0);

        window.location.hash = '#map&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#map=4/5/baz&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#5/1.00/0.50/30/60';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '';
    });

    test('#_getCurrentHash', () => {
        const map = createMap();
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        const currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toEqual('10');
        expect(currentHash[1]).toEqual('3.00');
        expect(currentHash[2]).toEqual('-1.00');

        window.location.hash = '';
    });

    test('#_getCurrentHash named', () => {
        const map = createMap();
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        let currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toEqual('10');
        expect(currentHash[1]).toEqual('3.00');
        expect(currentHash[2]).toEqual('-1.00');

        window.location.hash = '#baz&map=10/3.00/-1.00';

        currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toEqual('10');
        expect(currentHash[1]).toEqual('3.00');
        expect(currentHash[2]).toEqual('-1.00');

        window.location.hash = '';
    });

    test('#_updateHash', () => {
        function getHash() {
            return window.location.hash.split('/');
        }

        const map = createMap();
        createHash()
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBeTruthy();

        let newHash = getHash();

        expect(newHash.length).toEqual(3);
        expect(newHash[0]).toEqual('#3');
        expect(newHash[1]).toEqual('1');
        expect(newHash[2]).toEqual('2');

        map.setPitch(60);

        newHash = getHash();

        expect(newHash.length).toEqual(5);
        expect(newHash[0]).toEqual('#3');
        expect(newHash[1]).toEqual('1');
        expect(newHash[2]).toEqual('2');
        expect(newHash[3]).toEqual('0');
        expect(newHash[4]).toEqual('60');

        map.setBearing(135);

        newHash = getHash();

        expect(newHash.length).toEqual(5);
        expect(newHash[0]).toEqual('#3');
        expect(newHash[1]).toEqual('1');
        expect(newHash[2]).toEqual('2');
        expect(newHash[3]).toEqual('135');
        expect(newHash[4]).toEqual('60');

        window.location.hash = '';
    });

    /**
     * @todo GLJS-671
     */
    test.skip('#_updateHash named', () => {
        const map = createMap();
        createHash('map')
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

        map.setZoom(3);
        map.setCenter([1.0, 2.0]);

        expect(window.location.hash).toBeTruthy();

        expect(window.location.hash).toEqual('#map=3/2/1');

        map.setPitch(60);

        expect(window.location.hash).toEqual('#map=3/2/1/0/60');

        map.setBearing(135);

        expect(window.location.hash).toEqual('#map=3/2/1/135/60');

        window.location.hash += '&foo=bar';

        map.setZoom(7);

        expect(window.location.hash).toEqual('#map=7/2/1/135/60&foo=bar');

        window.location.hash = '#baz&map=7/2/1/135/60&foo=bar';

        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toEqual('#baz&map=7/1/2/135/60&foo=bar');

        window.location.hash = '';
    });

    test('map#remove', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'getBoundingClientRect',
            {value: () => ({height: 512, width: 512})});

        const map = createMap({hash: true});

        map.remove();

        expect(map).toBeTruthy();
    });
});
