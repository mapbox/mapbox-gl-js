'use strict';

const test = require('mapbox-gl-js-test').test;
const Bucket = require('../../../src/data/bucket');
const createElementArrayType = require('../../../src/data/element_array_type');
const FeatureIndex = require('../../../src/data/feature_index');
const StyleLayer = require('../../../src/style/style_layer');
const featureFilter = require('../../../src/style-spec/feature_filter');
const TileCoord = require('../../../src/source/tile_coord');

test('Bucket', (t) => {
    function createFeature(x, y) {
        return {
            loadGeometry: function() {
                return [[{x: x, y: y}]];
            },
            properties: {
                x: x
            }
        };
    }

    const dataDrivenPaint = {
        'circle-opacity': {
            stops: [[0, 0], [100, 100]],
            property: 'x'
        }
    };

    const constantPaint = {};

    function create(options) {
        options = options || {};

        const programInterface = {
            layoutAttributes: options.layoutAttributes || [{
                name: 'a_box',
                components: 2,
                type: 'Int16'
            }],
            elementArrayType: createElementArrayType(),
            elementArrayType2: createElementArrayType(2),

            paintAttributes: options.paintAttributes || [{
                property: 'circle-opacity',
                type: 'Int16'
            }]
        };

        class Class extends Bucket {
            constructor(options) {
                super(options, programInterface);
            }

            addFeature(feature) {
                const arrays = this.arrays;
                const point = feature.loadGeometry()[0][0];
                arrays.layoutVertexArray.emplaceBack(point.x * 2, point.y * 2);
                arrays.elementArray.emplaceBack(1, 2, 3);
                arrays.elementArray2.emplaceBack(point.x, point.y);
                arrays.populatePaintArrays(feature.properties);
            }
        }

        const serializedLayers = (options.layers || [{
            id: 'layerid',
            type: 'circle',
            paint: dataDrivenPaint
        }]);
        const layers = serializedLayers.map((serializedLayer) => {
            const styleLayer = new StyleLayer(serializedLayer);
            styleLayer.filter = featureFilter();
            styleLayer.updatePaintTransitions([], {}, {});
            return styleLayer;
        });

        return new Class({layers});
    }

    function createOptions() {
        return {featureIndex: new FeatureIndex(new TileCoord(0, 0, 0), 0, null)};
    }

    t.test('add features', (t) => {
        const bucket = create();

        bucket.populate([createFeature(17, 42)], createOptions());

        const testVertex = bucket.arrays.layoutVertexArray;
        t.equal(testVertex.length, 1);
        const v0 = testVertex.get(0);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);
        const paintVertex = bucket.arrays.layerData.layerid.paintVertexArray;
        t.equal(paintVertex.length, 1);
        const p0 = paintVertex.get(0);
        t.equal(p0.a_opacity, 17);

        const testElement = bucket.arrays.elementArray;
        t.equal(testElement.length, 1);
        const e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        const testElement2 = bucket.arrays.elementArray2;
        t.equal(testElement2.length, 1);
        const e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.test('add features, multiple layers', (t) => {
        const bucket = create({layers: [
            { id: 'one', type: 'circle', paint: dataDrivenPaint },
            { id: 'two', type: 'circle', paint: dataDrivenPaint }
        ]});

        bucket.populate([createFeature(17, 42)], createOptions());

        const v0 = bucket.arrays.layoutVertexArray.get(0);
        const a0 = bucket.arrays.layerData.one.paintVertexArray.get(0);
        const b0 = bucket.arrays.layerData.two.paintVertexArray.get(0);
        t.equal(a0.a_opacity, 17);
        t.equal(b0.a_opacity, 17);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);

        t.end();
    });

    t.test('add features, disabled attribute', (t) => {
        const bucket = create({
            paintAttributes: [{
                property: 'circle-opacity',
                type: 'Int16'
            }],
            layoutAttributes: [],
            layers: [
                { id: 'one', type: 'circle', paint: constantPaint }
            ]
        });

        bucket.populate([createFeature(17, 42)], createOptions());

        t.equal(bucket.arrays.layoutVertexArray.bytesPerElement, 0);
        t.end();
    });

    t.test('add features, array type attribute', (t) => {
        const bucket = create({
            paintAttributes: [],
            layoutAttributes: [{
                name: 'a_map',
                type: 'Int16'
            }]
        });

        bucket.populate([createFeature(17, 42)], createOptions());

        const v0 = bucket.arrays.layoutVertexArray.get(0);
        t.equal(v0.a_map, 34);

        t.end();
    });

    t.test('isEmpty', (t) => {
        const bucket = create();
        t.ok(bucket.isEmpty());

        bucket.populate([createFeature(17, 42)], createOptions());
        t.ok(!bucket.isEmpty());

        t.end();
    });

    t.test('serialize', (t) => {
        const bucket = create();
        bucket.populate([createFeature(17, 42)], createOptions());

        const transferables = [];
        bucket.serialize(transferables);

        t.equal(4, transferables.length);
        t.equal(bucket.arrays.layoutVertexArray.arrayBuffer, transferables[0]);
        t.equal(bucket.arrays.elementArray.arrayBuffer, transferables[1]);
        t.equal(bucket.arrays.elementArray2.arrayBuffer, transferables[2]);
        t.equal(bucket.arrays.layerData.layerid.paintVertexArray.arrayBuffer, transferables[3]);

        t.end();
    });

    t.test('layout properties', (t) => {
        const bucket = create();
        t.equal(bucket.layers[0].layout.visibility, 'visible');
        t.end();
    });

    t.end();
});
