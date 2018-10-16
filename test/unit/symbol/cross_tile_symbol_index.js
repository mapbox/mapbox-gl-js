import { test } from 'mapbox-gl-js-test';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index';
import { OverscaledTileID } from '../../../src/source/tile_id';

const styleLayer = {
    id: 'test'
};

function makeSymbolInstance(x, y, key) {
    return {
        anchorX: x,
        anchorY: y,
        key: key
    };
}

function makeTile(tileID, symbolInstances) {
    const bucket = {
        symbolInstances: {
            get: function(i) { return symbolInstances[i]; },
            length: symbolInstances.length
        },
        layerIds: ['test']
    };
    return {
        tileID: tileID,
        getBucket: () => bucket,
        latestFeatureIndex: {}
    };
}

test('CrossTileSymbolIndex.addLayer', (t) => {

    t.test('matches ids', (t) => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [
            makeSymbolInstance(1000, 1000, "Detroit"),
            makeSymbolInstance(2000, 2000, "Toronto")
        ];
        const mainTile = makeTile(mainID, mainInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        // Assigned new IDs
        t.equal(mainInstances[0].crossTileID, 1);
        t.equal(mainInstances[1].crossTileID, 2);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [
            makeSymbolInstance(2000, 2000, "Detroit"),
            makeSymbolInstance(2000, 2000, "Windsor"),
            makeSymbolInstance(3000, 3000, "Toronto"),
            makeSymbolInstance(4001, 4001, "Toronto")
        ];
        const childTile = makeTile(childID, childInstances);

        index.addLayer(styleLayer, [mainTile, childTile], 0);
        // matched parent tile
        t.equal(childInstances[0].crossTileID, 1);
        // does not match because of different key
        t.equal(childInstances[1].crossTileID, 3);
        // does not match because of different location
        t.equal(childInstances[2].crossTileID, 4);
        // matches with a slightly different location
        t.equal(childInstances[3].crossTileID, 2);

        const parentID = new OverscaledTileID(5, 0, 5, 4, 4);
        const parentInstances = [
            makeSymbolInstance(500, 500, "Detroit")
        ];
        const parentTile = makeTile(parentID, parentInstances);

        index.addLayer(styleLayer, [mainTile, childTile, parentTile], 0);
        // matched child tile
        t.equal(parentInstances[0].crossTileID, 1);

        const grandchildID = new OverscaledTileID(8, 0, 8, 32, 32);
        const grandchildInstances = [
            makeSymbolInstance(4000, 4000, "Detroit"),
            makeSymbolInstance(4000, 4000, "Windsor")
        ];
        const grandchildTile = makeTile(grandchildID, grandchildInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        index.addLayer(styleLayer, [mainTile, grandchildTile], 0);
        // Matches the symbol in `mainBucket`
        t.equal(grandchildInstances[0].crossTileID, 1);
        // Does not match the previous value for Windsor because that tile was removed
        t.equal(grandchildInstances[1].crossTileID, 5);

        t.end();
    });

    t.test('overwrites ids when re-adding', (t) => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [makeSymbolInstance(1000, 1000, "Detroit")];
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [makeSymbolInstance(2000, 2000, "Detroit")];
        const childTile = makeTile(childID, childInstances);

        // assigns a new id
        index.addLayer(styleLayer, [mainTile], 0);
        t.equal(mainInstances[0].crossTileID, 1);

        // removes the tile
        index.addLayer(styleLayer, [], 0);

        // assigns a new id
        index.addLayer(styleLayer, [childTile], 0);
        t.equal(childInstances[0].crossTileID, 2);

        // overwrites the old id to match the already-added tile
        index.addLayer(styleLayer, [mainTile, childTile], 0);
        t.equal(mainInstances[0].crossTileID, 2);
        t.equal(childInstances[0].crossTileID, 2);

        t.end();
    });

    t.test('does not duplicate ids within one zoom level', (t) => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [
            makeSymbolInstance(1000, 1000, ""), // A
            makeSymbolInstance(1000, 1000, "")  // B
        ];
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [
            makeSymbolInstance(2000, 2000, ""), // A'
            makeSymbolInstance(2000, 2000, ""), // B'
            makeSymbolInstance(2000, 2000, "")  // C'
        ];
        const childTile = makeTile(childID, childInstances);

        // assigns new ids
        index.addLayer(styleLayer, [mainTile], 0);
        t.equal(mainInstances[0].crossTileID, 1);
        t.equal(mainInstances[1].crossTileID, 2);

        const layerIndex = index.layerIndexes[styleLayer.id];
        t.deepEqual(Object.keys(layerIndex.usedCrossTileIDs[6]), [1, 2]);

        // copies parent ids without duplicate ids in this tile
        index.addLayer(styleLayer, [childTile], 0);
        t.equal(childInstances[0].crossTileID, 1); // A' copies from A
        t.equal(childInstances[1].crossTileID, 2); // B' copies from B
        t.equal(childInstances[2].crossTileID, 3); // C' gets new ID

        // Updates per-zoom usedCrossTileIDs
        t.deepEqual(Object.keys(layerIndex.usedCrossTileIDs[6]), []);
        t.deepEqual(Object.keys(layerIndex.usedCrossTileIDs[7]), [1, 2, 3]);

        t.end();
    });

    t.test('does not regenerate ids for same zoom', (t) => {
        const index = new CrossTileSymbolIndex();

        const tileID = new OverscaledTileID(6, 0, 6, 8, 8);
        const firstInstances = [
            makeSymbolInstance(1000, 1000, ""), // A
            makeSymbolInstance(1000, 1000, "")  // B
        ];
        const firstTile = makeTile(tileID, firstInstances);

        const secondInstances = [
            makeSymbolInstance(1000, 1000, ""), // A'
            makeSymbolInstance(1000, 1000, ""), // B'
            makeSymbolInstance(1000, 1000, ""), // C'
        ];
        const secondTile = makeTile(tileID, secondInstances);

        // assigns new ids
        index.addLayer(styleLayer, [firstTile], 0);
        t.equal(firstInstances[0].crossTileID, 1);
        t.equal(firstInstances[1].crossTileID, 2);

        const layerIndex = index.layerIndexes[styleLayer.id];
        t.deepEqual(Object.keys(layerIndex.usedCrossTileIDs[6]), [1, 2]);

        // uses same ids when tile gets updated
        index.addLayer(styleLayer, [secondTile], 0);
        t.equal(secondInstances[0].crossTileID, 1); // A' copies from A
        t.equal(secondInstances[1].crossTileID, 2); // B' copies from B
        t.equal(secondInstances[2].crossTileID, 3); // C' gets new ID

        t.deepEqual(Object.keys(layerIndex.usedCrossTileIDs[6]), [1, 2, 3]);

        t.end();
    });

    t.test('reuses indexes when longitude is wrapped', (t) => {
        const index = new CrossTileSymbolIndex();
        const longitude = 370;

        const tileID = new OverscaledTileID(6, 1, 6, 8, 8);
        const firstInstances = [
            makeSymbolInstance(1000, 1000, ""), // A
        ];
        const tile = makeTile(tileID, firstInstances);

        index.addLayer(styleLayer, [tile], longitude);
        t.equal(firstInstances[0].crossTileID, 1); // A

        tile.tileID = tileID.wrapped();

        index.addLayer(styleLayer, [tile], longitude % 360);
        t.equal(firstInstances[0].crossTileID, 1);
        t.end();

    });

    t.end();
});

test('CrossTileSymbolIndex.pruneUnusedLayers', (t) => {
    const index = new CrossTileSymbolIndex();

    const tileID = new OverscaledTileID(6, 0, 6, 8, 8);
    const instances = [
        makeSymbolInstance(1000, 1000, ""), // A
        makeSymbolInstance(1000, 1000, "")  // B
    ];
    const tile = makeTile(tileID, instances);

    // assigns new ids
    index.addLayer(styleLayer, [tile], 0);
    t.equal(instances[0].crossTileID, 1);
    t.equal(instances[1].crossTileID, 2);
    t.ok(index.layerIndexes[styleLayer.id]);

    // remove styleLayer
    index.pruneUnusedLayers([]);
    t.notOk(index.layerIndexes[styleLayer.id]);

    t.end();
});
