// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {Evented} from '../../../src/util/evented';
import loadTileJSON from '../../../src/source/load_tilejson';

class StubMap extends Evented {
    constructor() {
        super();
        this._requestManager = {
            canonicalizeTileset: tileJSON => tileJSON.tiles
        };
    }
}


describe('LoadTileJson#variants', () => {
    const map = new StubMap();
    
    test('returns error if variants is not an array', () => {
        // variants should be an array
        let tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": "variants should not be a string"
        };
        let tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err.message).toEqual("variants must be an array");
        });
        // variants elements should be objects
        tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": ["variants elements should be objects"]
        };
        tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err.message).toEqual("variant must be an object");
        });
        // capabilities should be an array
        tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities" : "capabilities should be an array"
                }
            ]
        };
        tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err.message).toEqual("capabilities must be an array");
        });
        // tiles should be replaced if capabilities.lenght == 1 and capabilities[0]== "meshopt"
        tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities" : ["meshopt"],
                    "tiles": ["http://dataset2"]
                }
            ]
        };
        tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err).toEqual(null);
            expect(result.tiles).toEqual(["http://dataset2"]);
        });
        //  tiles should be replaced even when the above condition is met, and it happens in a different variant.
        tileJSON = {
            "tiles": ["http://dataset1"],
            "variants": [
                {
                    "capabilities" : ["customcapability"],
                    "tiles": ["http://dataset2"]
                },
                {
                    "capabilities" : ["meshopt"],
                    "tiles": ["http://dataset3"]
                }
            ]
        };
        tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err).toEqual(null);
            expect(result.tiles).toEqual(["http://dataset3"]);
        });
        //  meshopt variants should replace other fields as well
        tileJSON = {
            "tiles": ["http://dataset1"],
            "minzoom": 1,
            "variants": [
                {
                    "capabilities" : ["customcapability"],
                    "tiles": ["http://dataset2"]
                },
                {
                    "minzoom": 14,
                    "capabilities" : ["meshopt"],
                    "tiles": ["http://dataset3"]
                }
            ]
        };
        tileJSONRequest = loadTileJSON(tileJSON, map._requestManager, null, null, (err, result) => {
            expect(err).toEqual(null);
            expect(result.minzoom).toEqual(14);
        });
   });
});
