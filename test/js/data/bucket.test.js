'use strict';

var test = require('tap').test;
var Bucket = require('../../../js/data/bucket');
var util = require('../../../js/util/util');

test('Bucket', function(t) {

    function createClass() {
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

                attributeArgs: ['x', 'y'],

                attributes: [{
                    name: 'map',
                    type: 'Int16',
                    value: ['x']
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

    function create() {
        var Class = createClass();
        return new Class({
            layer: { type: 'circle' },
            childLayers: [{ type: 'circle' }],
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
        t.equal(v0.map, 17);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);

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
        t.equal(v0.map, 17);
        t.equal(v0.box0, 34);
        t.equal(v0.box1, 84);

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

    t.end();
});
