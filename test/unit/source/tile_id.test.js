'use strict';

import { test } from 'mapbox-gl-js-test';
import { CanonicalTileID, OverscaledTileID } from '../../../src/source/tile_id';

test('CanonicalTileID', (t) => {
    t.test('#constructor', (t) => {
        t.throws(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(-1, 0, 0);
        });
        t.throws(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(26, 0, 0);
        });
        t.throws(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 4, 0);
        });
        t.throws(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 0, 4);
        });
        t.end();
    });

    t.test('.key', (t) => {
        t.deepEqual(new CanonicalTileID(0, 0, 0).key, 0);
        t.deepEqual(new CanonicalTileID(1, 0, 0).key, 1);
        t.deepEqual(new CanonicalTileID(1, 1, 0).key, 33);
        t.deepEqual(new CanonicalTileID(1, 1, 1).key, 97);
        t.end();
    });

    t.test('.equals', (t) => {
        t.ok(new CanonicalTileID(3, 2, 1).equals(new CanonicalTileID(3, 2, 1)));
        t.notOk(new CanonicalTileID(9, 2, 3).equals(new CanonicalTileID(3, 2, 1)));
        t.end();
    });

    t.test('.url', (t) => {
        t.test('replaces {z}/{x}/{y}', (t) => {
            t.equal(new CanonicalTileID(1, 0, 0).url(['{z}/{x}/{y}.json']), '1/0/0.json');
            t.end();
        });

        t.test('replaces {quadkey}', (t) => {
            t.equal(new CanonicalTileID(1, 0, 0).url(['quadkey={quadkey}']), 'quadkey=0');
            t.equal(new CanonicalTileID(2, 0, 0).url(['quadkey={quadkey}']), 'quadkey=00');
            t.equal(new CanonicalTileID(2, 1, 1).url(['quadkey={quadkey}']), 'quadkey=03');
            t.equal(new CanonicalTileID(17, 22914, 52870).url(['quadkey={quadkey}']), 'quadkey=02301322130000230');

            // Test case confirmed by quadkeytools package
            // https://bitbucket.org/steele/quadkeytools/src/master/test/quadkey.js?fileviewer=file-view-default#quadkey.js-57
            t.equal(new CanonicalTileID(6, 29, 3).url(['quadkey={quadkey}']), 'quadkey=011123');

            t.end();
        });

        t.test('replaces {bbox-epsg-3857}', (t) => {
            t.equal(new CanonicalTileID(1, 0, 0).url(['bbox={bbox-epsg-3857}']), 'bbox=-20037508.342789244,0,0,20037508.342789244');
            t.end();
        });

        t.end();
    });

    t.end();
});

test('OverscaledTileID', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID);
        t.throws(() => {
            /*eslint no-new: 0*/
            new OverscaledTileID(7, 0, 8, 0, 0);
        });
        t.end();
    });

    t.test('.key', (t) => {
        t.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).key, 0);
        t.deepEqual(new OverscaledTileID(1, 0, 1, 0, 0).key, 1);
        t.deepEqual(new OverscaledTileID(1, 0, 1, 1, 0).key, 33);
        t.deepEqual(new OverscaledTileID(1, 0, 1, 1, 1).key, 97);
        t.deepEqual(new OverscaledTileID(1, -1, 1, 1, 1).key, 225);
        t.end();
    });

    t.test('.toString', (t) => {
        t.test('calculates strings', (t) => {
            t.deepEqual(new OverscaledTileID(1, 0, 1, 1, 1).toString(), '1/1/1');
            t.end();
        });
        t.end();
    });

    t.test('.children', (t) => {
        t.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).children(25), [
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);
        t.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).children(0), [new OverscaledTileID(1, 0, 0, 0, 0)]);
        t.end();
    });

    t.test('.scaledTo', (t) => {
        t.test('returns a parent', (t) => {
            t.deepEqual(new OverscaledTileID(2, 0, 2, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
            t.deepEqual(new OverscaledTileID(1, 0, 1, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
            t.deepEqual(new OverscaledTileID(1, 0, 0, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
            t.end();
        });
        t.end();
    });

    t.end();
});
