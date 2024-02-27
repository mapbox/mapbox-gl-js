import {describe, test, expect} from "../../util/vitest.js";
import {CanonicalTileID, OverscaledTileID} from '../../../src/source/tile_id.js';

describe('CanonicalTileID', () => {
    test('#constructor', () => {
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(-1, 0, 0);
        }).toThrowError();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(26, 0, 0);
        }).toThrowError();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 4, 0);
        }).toThrowError();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 0, 4);
        }).toThrowError();
    });

    test('.key', () => {
        expect(new CanonicalTileID(0, 0, 0).key).toEqual(0);
        expect(new CanonicalTileID(1, 0, 0).key).toEqual(16);
        expect(new CanonicalTileID(1, 1, 0).key).toEqual(528);
        expect(new CanonicalTileID(1, 1, 1).key).toEqual(1552);
    });

    test('.equals', () => {
        expect(new CanonicalTileID(3, 2, 1).equals(new CanonicalTileID(3, 2, 1))).toBeTruthy();
        expect(new CanonicalTileID(9, 2, 3).equals(new CanonicalTileID(3, 2, 1))).toBeFalsy();
    });

    describe('.url', () => {
        test('replaces {z}/{x}/{y}', () => {
            expect(new CanonicalTileID(1, 0, 0).url(['{z}/{x}/{y}.json'])).toEqual('1/0/0.json');
            expect(new CanonicalTileID(15, 9876, 4321).url(['{z}/{x}/{z}_{x}_{y}.json'])).toEqual('15/9876/15_9876_4321.json');
        });

        test('replaces {quadkey}', () => {
            expect(new CanonicalTileID(1, 0, 0).url(['quadkey={quadkey}'])).toEqual('quadkey=0');
            expect(new CanonicalTileID(2, 0, 0).url(['quadkey={quadkey}'])).toEqual('quadkey=00');
            expect(new CanonicalTileID(2, 1, 1).url(['quadkey={quadkey}'])).toEqual('quadkey=03');
            expect(new CanonicalTileID(17, 22914, 52870).url(['quadkey={quadkey}'])).toEqual('quadkey=02301322130000230');

            // Test case confirmed by quadkeytools package
            // https://bitbucket.org/steele/quadkeytools/src/master/test/quadkey.js?fileviewer=file-view-default#quadkey.js-57
            expect(new CanonicalTileID(6, 29, 3).url(['quadkey={quadkey}'])).toEqual('quadkey=011123');
        });

        test('replaces {bbox-epsg-3857}', () => {
            expect(new CanonicalTileID(1, 0, 0).url(['bbox={bbox-epsg-3857}'])).toEqual('bbox=-20037508.342789244,0,0,20037508.342789244');
        });
    });
});

describe('OverscaledTileID', () => {
    test('#constructor', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID).toBeTruthy();
        expect(() => {
            /*eslint no-new: 0*/
            new OverscaledTileID(7, 0, 8, 0, 0);
        }).toThrowError();
    });

    test('.key', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).key).toEqual(0);
        expect(new OverscaledTileID(1, 0, 1, 0, 0).key).toEqual(16);
        expect(new OverscaledTileID(1, 0, 1, 1, 0).key).toEqual(528);
        expect(new OverscaledTileID(1, 0, 1, 1, 1).key).toEqual(1552);
        expect(new OverscaledTileID(1, -1, 1, 1, 1).key).toEqual(3600);
    });

    describe('.toString', () => {
        test('calculates strings', () => {
            expect(new OverscaledTileID(1, 0, 1, 1, 1).toString()).toEqual('1/1/1');
        });
    });

    test('.children', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(25)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(0)).toEqual([new OverscaledTileID(1, 0, 0, 0, 0)]);
    });

    describe('.scaledTo', () => {
        test('returns a parent', () => {
            expect(new OverscaledTileID(2, 0, 2, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
            expect(new OverscaledTileID(1, 0, 1, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
            expect(new OverscaledTileID(1, 0, 0, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
        });
    });

    test('.isChildOf', () => {
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 0, 0, 0, 0))
        ).toBeTruthy();
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 1, 0, 0, 0))
        ).toBeFalsy();
    });
});
