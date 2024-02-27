import {test, expect, vi} from "../../util/vitest.js";
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import segment from '../../../src/data/segment.js';
import LineBucket from '../../../src/data/bucket/line_bucket.js';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer.js';
// eslint-disable-next-line import/no-unresolved
import tileStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(tileStub));
const feature = vt.layers.road.feature(0);

function createLine(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

test('LineBucket', () => {
    const layer = new LineStyleLayer({id: 'test', type: 'line'});
    layer.recalculate({zoom: 0});

    const bucket = new LineBucket({layers: [layer]});

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
});

test('LineBucket segmentation', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    vi.spyOn(segment, 'MAX_VERTEX_ARRAY_LENGTH', 'get').mockImplementation(() => 256);

    const layer = new LineStyleLayer({id: 'test', type: 'line'});
    layer.recalculate({zoom: 0});

    const bucket = new LineBucket({layers: [layer]});

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({}, [createLine(10)]);

    // add a feature that will break across the group boundary
    bucket.addFeature({}, [createLine(128)]);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    expect(bucket.layoutVertexArray.length).toEqual(276);
    expect(bucket.segments.get()).toEqual([{
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

    expect(console.warn).toHaveBeenCalledTimes(1);
});
