'use strict';

const test = require('mapbox-gl-js-test').test;
const Bucket = require('../../../js/data/bucket');
const VertexArrayType = require('../../../js/data/vertex_array_type');
const ElementArrayType = require('../../../js/data/element_array_type');
const FeatureIndex = require('../../../js/data/feature_index');
const StyleLayer = require('../../../js/style/style_layer');
const featureFilter = require('feature-filter');
const TileCoord = require('../../../js/source/tile_coord');

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
        'circle-color': {
            stops: [[0, 'red'], [100, 'violet']],
            property: 'mapbox'
        }
    };

    const constantPaint = {};

    function create(options) {
        options = options || {};

        class Class extends Bucket {
            get programInterfaces() {
                return {
                    test: {
                        layoutVertexArrayType: new VertexArrayType(options.layoutAttributes || [{
                            name: 'a_box',
                            components: 2,
                            type: 'Int16'
                        }]),
                        elementArrayType: new ElementArrayType(),
                        elementArrayType2: new ElementArrayType(2),

                        paintAttributes: options.paintAttributes || [{
                            name: 'a_map',
                            type: 'Int16',
                            getValue: function(layer, globalProperties, featureProperties) {
                                return [featureProperties.x];
                            },
                            paintProperty: 'circle-color'
                        }]
                    }
                };
            }

            addFeature(feature) {
                const group = this.prepareArrayGroup('test', 1);
                const point = feature.loadGeometry()[0][0];
                const startIndex = group.layoutVertexArray.length;
                group.layoutVertexArray.emplaceBack(point.x * 2, point.y * 2);
                group.elementArray.emplaceBack(1, 2, 3);
                group.elementArray2.emplaceBack(point.x, point.y);
                this.populatePaintArrays('test', {}, feature.properties, group, startIndex);
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

        return new Class({
            layer: layers[0],
            childLayers: layers,
            buffers: {},
            featureIndex: new FeatureIndex(new TileCoord(0, 0, 0), 0, null)
        });
    }

    t.test('add features', (t) => {
        const bucket = create();

        bucket.populate([createFeature(17, 42)]);

        const testVertex = bucket.arrayGroups.test[0].layoutVertexArray;
        t.equal(testVertex.length, 1);
        const v0 = testVertex.get(0);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);
        const paintVertex = bucket.arrayGroups.test[0].paintVertexArrays.layerid;
        t.equal(paintVertex.length, 1);
        const p0 = paintVertex.get(0);
        t.equal(p0.a_map, 17);

        const testElement = bucket.arrayGroups.test[0].elementArray;
        t.equal(testElement.length, 1);
        const e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        const testElement2 = bucket.arrayGroups.test[0].elementArray2;
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

        bucket.populate([createFeature(17, 42)]);

        const v0 = bucket.arrayGroups.test[0].layoutVertexArray.get(0);
        const a0 = bucket.arrayGroups.test[0].paintVertexArrays.one.get(0);
        const b0 = bucket.arrayGroups.test[0].paintVertexArrays.two.get(0);
        t.equal(a0.a_map, 17);
        t.equal(b0.a_map, 17);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);

        t.end();
    });

    t.test('add features, disabled attribute', (t) => {
        const bucket = create({
            paintAttributes: [{
                name: 'a_map',
                type: 'Int16',
                getValue: function() { return [5]; },
                paintProperty: 'circle-color'
            }],
            layoutAttributes: [],
            layers: [
                { id: 'one', type: 'circle', paint: constantPaint }
            ]
        });

        bucket.populate([createFeature(17, 42)]);

        t.equal(bucket.arrayGroups.test[0].layoutVertexArray.bytesPerElement, 0);
        t.deepEqual(
            bucket.paintAttributes.test.one.uniforms[0].getValue.call(bucket),
            [5]
        );

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

        bucket.populate([createFeature(17, 42)]);

        const v0 = bucket.arrayGroups.test[0].layoutVertexArray.get(0);
        t.equal(v0.a_map, 34);

        t.end();
    });

    t.test('reset buffers', (t) => {
        const bucket = create();

        bucket.populate([createFeature(17, 42)]);

        t.equal(bucket.arrayGroups.test.length, 1);
        bucket.createArrays();
        t.equal(bucket.arrayGroups.test.length, 0);

        t.end();
    });

    t.test('trimArrays', (t) => {
        const bucket = create();

        bucket.createArrays();
        bucket.prepareArrayGroup('test', 10);
        t.equal(0, bucket.arrayGroups.test[0].layoutVertexArray.length);
        t.notEqual(0, bucket.arrayGroups.test[0].layoutVertexArray.capacity);

        bucket.trimArrays();
        t.equal(0, bucket.arrayGroups.test[0].layoutVertexArray.length);
        t.equal(0, bucket.arrayGroups.test[0].layoutVertexArray.capacity);

        t.end();
    });

    t.test('isEmpty', (t) => {
        const bucket = create();
        t.ok(bucket.isEmpty());

        bucket.createArrays();
        t.ok(bucket.isEmpty());

        bucket.populate([createFeature(17, 42)]);
        t.ok(!bucket.isEmpty());

        t.end();
    });

    t.test('getTransferables', (t) => {
        const bucket = create();
        bucket.populate([createFeature(17, 42)]);

        const transferables = [];
        bucket.getTransferables(transferables);

        t.equal(4, transferables.length);
        t.equal(bucket.arrayGroups.test[0].layoutVertexArray.arrayBuffer, transferables[0]);
        t.equal(bucket.arrayGroups.test[0].elementArray.arrayBuffer, transferables[1]);
        t.equal(bucket.arrayGroups.test[0].elementArray2.arrayBuffer, transferables[2]);
        t.equal(bucket.arrayGroups.test[0].paintVertexArrays.layerid.arrayBuffer, transferables[3]);

        t.end();
    });

    t.test('add features after resetting buffers', (t) => {
        const bucket = create();

        bucket.populate([createFeature(1, 5)]);
        bucket.createArrays();
        bucket.populate([createFeature(17, 42)]);

        const testVertex = bucket.arrayGroups.test[0].layoutVertexArray;
        t.equal(testVertex.length, 1);
        const v0 = testVertex.get(0);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);
        const testPaintVertex = bucket.arrayGroups.test[0].paintVertexArrays.layerid;
        t.equal(testPaintVertex.length, 1);
        const p0 = testPaintVertex.get(0);
        t.equal(p0.a_map, 17);

        const testElement = bucket.arrayGroups.test[0].elementArray;
        t.equal(testElement.length, 1);
        const e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        const testElement2 = bucket.arrayGroups.test[0].elementArray2;
        t.equal(testElement2.length, 1);
        const e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.test('layout properties', (t) => {
        const bucket = create();
        t.equal(bucket.layer.layout.visibility, 'visible');
        t.end();
    });

    t.test('add features', (t) => {
        const bucket = create();

        bucket.populate([createFeature(17, 42)]);

        const testVertex = bucket.arrayGroups.test[0].layoutVertexArray;
        t.equal(testVertex.length, 1);
        const v0 = testVertex.get(0);
        t.equal(v0.a_box0, 34);
        t.equal(v0.a_box1, 84);
        const testPaintVertex = bucket.arrayGroups.test[0].paintVertexArrays.layerid;
        t.equal(testPaintVertex.length, 1);
        const p0 = testPaintVertex.get(0);
        t.equal(p0.a_map, 17);

        const testElement = bucket.arrayGroups.test[0].elementArray;
        t.equal(testElement.length, 1);
        const e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        const testElement2 = bucket.arrayGroups.test[0].elementArray2;
        t.equal(testElement2.length, 1);
        const e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.end();
});
