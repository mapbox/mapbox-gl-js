// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import segment from '../../../src/data/segment';
import LineBucket from '../../../src/data/bucket/line_bucket';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer';
import tileStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

// Load a line feature from fixture tile.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const vt = new VectorTile(new Protobuf(tileStub));
const feature = vt.layers.road.feature(0);

function createLine(numPoints) {
    const points: Array<any> = [];
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bucket.addFeature({}, [createLine(10)]);

    // add a feature that will break across the group boundary
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

test('LineBucket with variable line-offset detects variable offset', () => {
    const layer = new LineStyleLayer({
        id: 'test',
        type: 'line',
        paint: {
            'line-offset': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, -10,
                1, 10
            ]
        }
    });
    layer.recalculate({zoom: 14});

    const bucket = new LineBucket({layers: [layer]});

    const line = {
        type: 2,
        properties: {
            mapbox_clip_start: 0,
            mapbox_clip_end: 1
        }
    };

    // Test that variable offset is detected when layer is configured
    const paint = layer.paint;
    const lineOffset = paint.get('line-offset').value;
    expect(lineOffset.kind).not.toBe('constant');
    expect(lineOffset.isLineProgressConstant).toBe(false);
});

test('LineBucket with both variable width and variable offset', () => {
    const layer = new LineStyleLayer({
        id: 'test',
        type: 'line',
        paint: {
            'line-width': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, 2,
                1, 10
            ],
            'line-offset': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, -5,
                1, 5
            ]
        }
    });
    layer.recalculate({zoom: 14});

    const bucket = new LineBucket({layers: [layer]});

    // Both variable width and offset should be detected in layer configuration
    const paint = layer.paint;
    const lineWidth = paint.get('line-width').value;
    const lineOffset = paint.get('line-offset').value;

    expect(lineWidth.kind).not.toBe('constant');
    expect(lineWidth.isLineProgressConstant).toBe(false);
    expect(lineOffset.kind).not.toBe('constant');
    expect(lineOffset.isLineProgressConstant).toBe(false);
});

test('LineBucket with constant offset should not set variableOffsetValue', () => {
    const layer = new LineStyleLayer({
        id: 'test',
        type: 'line',
        paint: {
            'line-offset': 5
        }
    });
    layer.recalculate({zoom: 14});

    const bucket = new LineBucket({layers: [layer]});

    const line = {
        type: 2,
        properties: {}
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bucket.addFeature(line, [[
        new Point(0, 0),
        new Point(100, 0)
    ]]);

    // Constant offset should not trigger variable offset
    expect(bucket.variableOffsetValue).toBeFalsy();
});
