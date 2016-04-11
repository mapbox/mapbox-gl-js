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
                secondElementBuffer: 'testSecondElement',
                secondElementBufferComponents: 2,

                attributeArgs: options.attributeArgs || ['x', 'y'],

                attributes: options.attributes || [{
                    name: 'map',
                    type: 'Int16',
                    value: ['x'],
                    paintProperty: 'circle-color'
                }, {
                    name: 'box',
                    components: 2,
                    type: 'Int16',
                    value: ['x * 2', 'y * 2']
                }]
            }
        };

        Class.prototype.addFeature = function(feature) {
            this.makeRoomFor('test', 1);
            var point = feature.loadGeometry()[0][0];
            this.addTestVertex(point.x, point.y);
            this.addTestElement(1, 2, 3);
            this.addTestSecondElement(point.x, point.y);
        };

        return Class;
    }

    function createFeature(x, y) {
        return {
            loadGeometry: function() {
                return [[{x: x, y: y}]];
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

        var testVertex = bucket.arrays.testVertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.layerid__map, 17);
        t.equal(v0.layerid__box0, 34);
        t.equal(v0.layerid__box1, 84);

        var testElement = bucket.arrays.testElement;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testSecondElement = bucket.arrays.testSecondElement;
        t.equal(testSecondElement.length, 1);
        var e2 = testSecondElement.get(0);
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

        var v0 = bucket.arrays.testVertex.get(0);
        t.equal(v0.one__map, 17);
        t.equal(v0.two__map, 17);
        t.equal(v0.one__box0, 34);
        t.equal(v0.one__box1, 84);

        t.end();
    });

    t.test('add features, disabled attribute', function(t) {
        var bucket = create({
            attributes: [{
                name: 'map',
                type: 'Int16',
                value: ['5'],
                paintProperty: 'circle-color'
            }],
            layers: [
                { id: 'one', type: 'circle', paint: constantPaint }
            ]
        });

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        t.equal(bucket.arrays.testVertex.bytesPerElement, 0);
        t.deepEqual(
            bucket.attributes.test.disabled[0].getValue.call(bucket),
            [5]
        );

        t.end();
    });

    t.test('add features, array type attribute', function(t) {
        var bucket = create({
            attributes: [{
                name: 'map',
                type: 'Int16',
                value: '[17]'
            }]
        });

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var v0 = bucket.arrays.testVertex.get(0);
        t.equal(v0.layerid__map, 17);

        t.end();
    });

    t.test('reset buffers', function(t) {
        var bucket = create();

        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        bucket.createArrays();
        var arrays = bucket.arrays;

        t.equal(bucket.arrays, arrays);
        t.equal(arrays.testElement.length, 0);
        t.equal(arrays.testSecondElement.length, 0);
        t.equal(bucket.elementGroups.test.length, 0);

        t.end();
    });

    t.test('add features after resetting buffers', function(t) {
        var bucket = create();

        bucket.features = [createFeature(1, 5)];
        bucket.populateBuffers();
        bucket.createArrays();
        bucket.features = [createFeature(17, 42)];
        bucket.populateBuffers();

        var testVertex = bucket.arrays.testVertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.layerid__map, 17);
        t.equal(v0.layerid__box0, 34);
        t.equal(v0.layerid__box1, 84);

        var testElement = bucket.arrays.testElement;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testSecondElement = bucket.arrays.testSecondElement;
        t.equal(testSecondElement.length, 1);
        var e2 = testSecondElement.get(0);
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

        var testVertex = bucket.arrays.testVertex;
        t.equal(testVertex.length, 1);
        var v0 = testVertex.get(0);
        t.equal(v0.layerid__map, 17);
        t.equal(v0.layerid__box0, 34);
        t.equal(v0.layerid__box1, 84);

        var testElement = bucket.arrays.testElement;
        t.equal(testElement.length, 1);
        var e1 = testElement.get(0);
        t.equal(e1.vertices0, 1);
        t.equal(e1.vertices1, 2);
        t.equal(e1.vertices2, 3);

        var testSecondElement = bucket.arrays.testSecondElement;
        t.equal(testSecondElement.length, 1);
        var e2 = testSecondElement.get(0);
        t.equal(e2.vertices0, 17);
        t.equal(e2.vertices1, 42);

        t.end();
    });

    t.end();
});
