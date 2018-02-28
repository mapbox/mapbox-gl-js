import { test } from 'mapbox-gl-js-test';
import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import segment from '../../../src/data/segment';
import LineBucket from '../../../src/data/bucket/line_bucket';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer';

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.road.feature(0);

function createLine(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

test('LineBucket', (t) => {
    const layer = new LineStyleLayer({ id: 'test', type: 'line' });
    layer.recalculate({zoom: 0, zoomHistory: {}});

    const bucket = new LineBucket({ layers: [layer] });

    const line = {
        type: 2,
        properties: {}
    };

    const polygon = {
        type: 3,
        properties: {}
    };

    bucket.addLine([
        new Point(0, 0)
    ], line);

    bucket.addLine([
        new Point(0, 0)
    ], polygon);

    bucket.addLine([
        new Point(0, 0),
        new Point(0, 0)
    ], line);

    bucket.addLine([
        new Point(0, 0),
        new Point(0, 0)
    ], polygon);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(0, 0)
    ], line);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(0, 0)
    ], polygon);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ], line);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ], polygon);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20),
        new Point(0, 0)
    ], line);

    bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20),
        new Point(0, 0)
    ], polygon);

    bucket.addFeature(feature, feature.loadGeometry());

    t.end();
});

test('LineBucket segmentation', (t) => {
    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    t.stub(segment, 'MAX_VERTEX_ARRAY_LENGTH').value(256);

    const layer = new LineStyleLayer({ id: 'test', type: 'line' });
    layer.recalculate({zoom: 0, zoomHistory: {}});

    const bucket = new LineBucket({ layers: [layer] });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({}, [createLine(10)]);

    // add a feature that will break across the group boundary
    bucket.addFeature({}, [createLine(128)]);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.equal(bucket.layoutVertexArray.length, 276);
    t.deepEqual(bucket.segments.get(), [{
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
