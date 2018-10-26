import { test } from 'mapbox-gl-js-test';
import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import SymbolBucket from '../../../src/data/bucket/symbol_bucket';
import { CollisionBoxArray } from '../../../src/data/array_types';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';
import featureFilter from '../../../src/style-spec/feature_filter';
import { performSymbolLayout } from '../../../src/symbol/symbol_layout';
import { Placement } from '../../../src/symbol/placement';
import Transform from '../../../src/geo/transform';
import { OverscaledTileID } from '../../../src/source/tile_id';
import Tile from '../../../src/source/tile';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index';
import FeatureIndex from '../../../src/data/feature_index';

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = { 'Test': glyphs };

function bucketSetup() {
    const layer = new SymbolStyleLayer({
        id: 'test',
        type: 'symbol',
        layout: { 'text-font': ['Test'], 'text-field': 'abcde' },
        filter: featureFilter()
    });
    layer.recalculate({zoom: 0, zoomHistory: {}});

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray: collisionBoxArray,
        layers: [layer]
    });
}

test('SymbolBucket', (t) => {
    const bucketA = bucketSetup();
    const bucketB = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};
    const placement = new Placement(transform, 0, true);
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const crossTileSymbolIndex = new CrossTileSymbolIndex();

    // add feature from bucket A
    bucketA.populate([{feature}], options);
    performSymbolLayout(bucketA, stacks, {});
    const tileA = new Tile(tileID, 512);
    tileA.latestFeatureIndex = new FeatureIndex(tileID);
    tileA.buckets = { test: bucketA };
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate([{feature}], options);
    performSymbolLayout(bucketB, stacks, {});
    const tileB = new Tile(tileID, 512);
    tileB.buckets = { test: bucketB };
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB]);

    const a = placement.collisionIndex.grid.keysLength();
    placement.placeLayerTile(bucketA.layers[0], tileA, false, {});
    const b = placement.collisionIndex.grid.keysLength();
    t.notEqual(a, b, 'places feature');

    const a2 = placement.collisionIndex.grid.keysLength();
    placement.placeLayerTile(bucketB.layers[0], tileB, false, {});
    const b2 = placement.collisionIndex.grid.keysLength();
    t.equal(b2, a2, 'detects collision and does not place feature');
    t.end();
});

test('SymbolBucket integer overflow', (t) => {
    t.stub(console, 'warn');
    t.stub(SymbolBucket, 'MAX_GLYPHS').value(5);

    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const fakeGlyph = { rect: { w: 10, h: 10 }, metrics: { left: 10, top: 10, advance: 10 } };
    performSymbolLayout(bucket, stacks, { 'Test': {97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph} });

    t.ok(console.warn.calledOnce);
    t.ok(console.warn.getCall(0).calledWithMatch(/Too many glyphs being rendered in a tile./));
    t.end();
});
