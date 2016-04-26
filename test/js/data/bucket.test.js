'use strict';

var test = require('tap').test;
var Bucket = require('../../../js/data/bucket');
var util = require('../../../js/util/util');
var StyleLayer = require('../../../js/style/style_layer');

test('Bucket', function(t) {

    function createClass(options) {
        function Class() {
            Bucket.apply(this, arguments);
        }

        Class.prototype = util.inherit(Bucket, {});

        Class.prototype.programInterfaces = {
            test: {
                vertexBuffer: 'testVertex',
                elementBuffer: 'testElement',
                elementBuffer2: 'testElement2',
                elementBuffer2Components: 2,

                layoutAttributes: options.layoutAttributes || [{
                    name: 'box',
                    components: 2,
                    type: 'Int16'
                }],
                paintAttributes: options.paintAttributes || [{
                    name: 'map',
                    type: 'Int16',
                    getValue: function(layer, globalProperties, featureProperties) {
                        return [featureProperties.x];
                    },
                    paintProperty: 'circle-color'
                }]
            }
        };

        Class.prototype.addFeature = function(feature) {
            var group = this.makeRoomFor('test', 1);
            var point = feature.loadGeometry()[0][0];
            var startIndex = group.layout.vertex.length;
            group.layout.vertex.emplaceBack(point.x * 2, point.y * 2);
            group.layout.element.emplaceBack(1, 2, 3);
            group.layout.element2.emplaceBack(point.x, point.y);
            this.addPaintAttributes('test', {}, feature.properties, group, startIndex);
        };

        return Class;
    }

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

    var dataDrivenPaint = {
        'circle-color': {
            stops: [[0, 'red'], [100, 'violet']],
            property: 'mapbox'
        }
    };

    var constantPaint = {};

    function create(options) {
        options = options || {};

        var serializedLayers = (options.layers || [{
            id: 'layerid',
            type: 'circle',
            paint: dataDrivenPaint
        }]);
        var layers = serializedLayers.map(function(serializedLayer) {
            var styleLayer = new StyleLayer(serializedLayer);
            styleLayer.updatePaintTransitions([], {}, {});
            return styleLayer;
        });


        var Class = createClass(options);
        return new Class({
            layer: layers[0],
            childLayers: layers,
            buffers: {}
        });
    }

    t.test('add features', function(t) {
        var bucket = create();

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var testVertex = bucket.arrayGroups.test[0].layout.vertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);
        var paintVertex = bucket.arrayGroups.test[0].paint.layerid;
        t.equal(paintVertex.length, 1);
        var p0 = paintVertex.get(0);
        t.equal(p0.map, 17);

        var testElement = bucket.arrayGroups.test[0].layout.element;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testElement2 = bucket.arrayGroups.test[0].layout.element2;
        t.equal(testElement2.length, 1);
        var e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.test('add features, multiple layers', function(t) {
        var bucket = create({layers: [
            { id: 'one', type: 'circle', paint: dataDrivenPaint },
            { id: 'two', type: 'circle', paint: dataDrivenPaint }
        ]});

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var v0 = bucket.arrayGroups.test[0].layout.vertex.get(0);
        var a0 = bucket.arrayGroups.test[0].paint.one.get(0);
        var b0 = bucket.arrayGroups.test[0].paint.two.get(0);
        t.equal(a0.map, 17);
        t.equal(b0.map, 17);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);

        t.end();
    });

    t.test('add features, disabled attribute', function(t) {
        var bucket = create({
            paintAttributes: [{
                name: 'map',
                type: 'Int16',
                getValue: function() { return [5]; },
                paintProperty: 'circle-color'
            }],
            layoutAttributes: [],
            layers: [
                { id: 'one', type: 'circle', paint: constantPaint }
            ]
        });

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        t.equal(bucket.arrayGroups.test[0].layout.vertex.bytesPerElement, 0);
        t.deepEqual(
            bucket.paintAttributes.test.one.uniforms[0].getValue.call(bucket),
            [5]
        );

        t.end();
    });

    t.test('add features, array type attribute', function(t) {
        var bucket = create({
            paintAttributes: [],
            layoutAttributes: [{
                name: 'map',
                type: 'Int16'
            }]
        });

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var v0 = bucket.arrayGroups.test[0].layout.vertex.get(0);
        t.equal(v0.map, 34);

        t.end();
    });

    t.test('reset buffers', function(t) {
        var bucket = create();

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        t.equal(bucket.arrayGroups.test.length, 1);
        bucket.createArrays();
        t.equal(bucket.arrayGroups.test.length, 0);

        t.end();
    });

    t.test('add features after resetting buffers', function(t) {
        var bucket = create();

        bucket.features = [createFeature(1, 5)];
        bucket.populateBuffers();
        bucket.createArrays();
        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var testVertex = bucket.arrayGroups.test[0].layout.vertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);
        var testPaintVertex = bucket.arrayGroups.test[0].paint.layerid;
        t.equal(testPaintVertex.length, 1);
        var p0 = testPaintVertex.get(0);
        t.equal(p0.map, 17);

        var testElement = bucket.arrayGroups.test[0].layout.element;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testElement2 = bucket.arrayGroups.test[0].layout.element2;
        t.equal(testElement2.length, 1);
        var e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.test('layout properties', function(t) {
        var bucket = create();
        t.equal(bucket.layer.layout.visibility, 'visible');
        t.end();
    });

    t.test('add features', function(t) {
        var bucket = create();

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var testVertex = bucket.arrayGroups.test[0].layout.vertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);
        var testPaintVertex = bucket.arrayGroups.test[0].paint.layerid;
        t.equal(testPaintVertex.length, 1);
        var p0 = testPaintVertex.get(0);
        t.equal(p0.map, 17);

        var testElement = bucket.arrayGroups.test[0].layout.element;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testElement2 = bucket.arrayGroups.test[0].layout.element2;
        t.equal(testElement2.length, 1);
        var e2 = testElement2.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.end();
});
