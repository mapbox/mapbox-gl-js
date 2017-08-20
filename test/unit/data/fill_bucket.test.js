'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('@mapbox/vector-tile').VectorTile;
const Point = require('@mapbox/point-geometry');
const segment = require('../../../src/data/segment');
const FillBucket = require('../../../src/data/bucket/fill_bucket');
const StyleLayer = require('../../../src/style/style_layer');

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.water.feature(0);

function createFeature(points) {
    return {
        properties: {
            'foo': 1
        },
        loadGeometry: function() {
            return points;
        }
    };
}

function createPolygon(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

test('FillBucket', (t) => {
    const layer = new StyleLayer({ id: 'test', type: 'fill', layout: {} });
    const bucket = new FillBucket({ layers: [layer] });

    bucket.addFeature(createFeature([[
        new Point(0, 0),
        new Point(10, 10)
    ]]));

    bucket.addFeature(createFeature([[
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]]));

    bucket.addFeature(feature);

    t.end();
});

test('FillBucket segmentation', (t) => {
    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    t.stub(segment, 'MAX_VERTEX_ARRAY_LENGTH').value(256);

    const layer = new StyleLayer({
        id: 'test',
        type: 'fill',
        layout: {},
        paint: { 'fill-color': {
            stops: [[0, 'red'], [1, 'blue']],
            property: 'foo'
        } }
    });

    // this, plus the style function, sets things up so that
    // populatePaintArrays iterates through each vertex
    layer.updatePaintTransition('fill-color', [], {});

    const bucket = new FillBucket({ layers: [layer] });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature(createFeature([createPolygon(10)]));

    // add a feature that will break across the group boundary
    bucket.addFeature(createFeature([
        createPolygon(128),
        createPolygon(128)
    ]));

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.equal(bucket.layoutVertexArray.length, 266);
    t.deepEqual(bucket.segments.get()[0], {
        vertexOffset: 0,
        vertexLength: 138,
        primitiveOffset: 0,
        primitiveLength: 134
    });
    t.deepEqual(bucket.segments.get()[1], {
        vertexOffset: 138,
        vertexLength: 128,
        primitiveOffset: 134,
        primitiveLength: 126
    });

    t.end();
});
