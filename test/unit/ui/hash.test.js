import {test} from '../../util/test';
import Hash from '../../../src/ui/hash';
import window from '../../../src/util/window';
import {createMap as globalCreateMap} from '../../util';

test('hash', (t) => {
    function createHash(name) {
        const hash = new Hash(name);
        hash._updateHash = hash._updateHashUnthrottled.bind(hash);
        return hash;
    }

    function createMap(t) {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        return globalCreateMap(t, {container});
    }

    t.test('#addTo', (t) => {
        const map = createMap(t);
        const hash = createHash();

        t.notok(hash._map);

        hash.addTo(map);

        t.ok(hash._map);
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap(t);
        const hash = createHash()
            .addTo(map);

        t.ok(hash._map);

        hash.remove();

        t.notok(hash._map);
        t.end();
    });

    t.test('#_onHashChange', (t) => {
        const map = createMap(t);
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

        window.location.hash = '#4/wrongly/formed/hash';

        t.false(hash._onHashChange());

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        t.false(hash._onHashChange());

        window.location.hash = '';

        t.end();
    });

    t.test('#_onHashChange empty', (t) => {
        const map = createMap(t);
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

    t.test('#_onHashChange named', (t) => {
        const map = createMap(t);
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        hash._onHashChange();

        t.equal(map.getCenter().lng, -1);
        t.equal(map.getCenter().lat, 3);
        t.equal(map.getZoom(), 10);
        t.equal(map.getBearing(), 0);
        t.equal(map.getPitch(), 0);

        window.location.hash = '#map&foo=bar';

        t.false(hash._onHashChange());

        window.location.hash = '#map=4/5/baz&foo=bar';

        t.false(hash._onHashChange());

        window.location.hash = '#5/1.00/0.50/30/60';

        t.false(hash._onHashChange());

        window.location.hash = '';

        t.end();
    });

    t.test('#_getCurrentHash', (t) => {
        const map = createMap(t);
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        const currentHash = hash._getCurrentHash();

        t.equal(currentHash[0], '10');
        t.equal(currentHash[1], '3.00');
        t.equal(currentHash[2], '-1.00');

        window.location.hash = '';

        t.end();
    });

    t.test('#_getCurrentHash named', (t) => {
        const map = createMap(t);
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        let currentHash = hash._getCurrentHash();

        t.equal(currentHash[0], '10');
        t.equal(currentHash[1], '3.00');
        t.equal(currentHash[2], '-1.00');

        window.location.hash = '#baz&map=10/3.00/-1.00';

        currentHash = hash._getCurrentHash();

        t.equal(currentHash[0], '10');
        t.equal(currentHash[1], '3.00');
        t.equal(currentHash[2], '-1.00');

        window.location.hash = '';

        t.end();
    });

    t.test('#_updateHash', (t) => {
        function getHash() {
            return window.location.hash.split('/');
        }

        const map = createMap(t);
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

        window.location.hash = '';

        t.end();
    });

    t.test('#_updateHash named', (t) => {
        const map = createMap(t);
        createHash('map')
            .addTo(map);

        t.notok(window.location.hash);

        map.setZoom(3);
        map.setCenter([1.0, 2.0]);

        t.ok(window.location.hash);

        t.equal(window.location.hash, '#map=3/2/1');

        map.setPitch(60);

        t.equal(window.location.hash, '#map=3/2/1/0/60');

        map.setBearing(135);

        t.equal(window.location.hash, '#map=3/2/1/135/60');

        window.location.hash += '&foo=bar';

        map.setZoom(7);

        t.equal(window.location.hash, '#map=7/2/1/135/60&foo=bar');

        window.location.hash = '#baz&map=7/2/1/135/60&foo=bar';

        map.setCenter([2.0, 1.0]);

        t.equal(window.location.hash, '#baz&map=7/1/2/135/60&foo=bar');

        window.location.hash = '';

        t.end();
    });

    t.test('map#remove', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});

        const map = createMap(t, {hash: true});

        map.remove();

        t.ok(map);
        t.end();
    });

    t.end();
});
