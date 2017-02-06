'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('vector-tile').VectorTile;
const Point = require('point-geometry');
const ArrayGroup = require('../../../src/data/array_group');
const LineBucket = require('../../../src/data/bucket/line_bucket');
const StyleLayer = require('../../../src/style/style_layer');

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.road.feature(0);

function createFeature(points) {
    return {
        loadGeometry: function() {
            return points;
        }
    };
}

function createLine(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

test('LineBucket', (t) => {
    const layer = new StyleLayer({ id: 'test', type: 'line' });
    const bucket = new LineBucket({ layers: [layer] });

    const pointWithScale = new Point(0, 0);
    pointWithScale.scale = 10;

    // should throw in the future?
    bucket.addLine([
        new Point(0, 0)
    ], {});

    // should also throw in the future?
    // this is a closed single-segment line
    bucket.addLine([
        new Point(0, 0),
        new Point(0, 0)
    ], {});

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ], {});

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20),
        new Point(0, 0)
    ], {});

    bucket.addFeature(feature);

    t.end();
});

test('LineBucket segmentation', (t) => {
    // Stub ArrayGroup.MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    t.stub(ArrayGroup, 'MAX_VERTEX_ARRAY_LENGTH', 256);

    const layer = new StyleLayer({ id: 'test', type: 'line' });
    const bucket = new LineBucket({ layers: [layer] });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature(createFeature([createLine(10)]));

    // add a feature that will break across the group boundary
    bucket.addFeature(createFeature([createLine(128)]));

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.equal(bucket.arrays.layoutVertexArray.length, 276);
    t.deepEqual(bucket.arrays.segments, [{
        vertexOffset: 0,
        vertexLength: 20,
        primitiveOffset: 0,
        primitiveLength: 18
    }, {
        vertexOffset: 20,
        vertexLength: 256,
        primitiveOffset: 18,
        primitiveLength: 254
    }]);

    t.end();
});
