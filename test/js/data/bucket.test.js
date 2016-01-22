'use strict';

var test = require('prova');
var Buffer = require('../../../js/data/buffer');
var Bucket = require('../../../js/data/bucket');
var util = require('../../../js/util/util');

test('Bucket', function(t) {

    function createClass() {
        function Class() {
            Bucket.apply(this, arguments);
        }

        Class.prototype = util.inherit(Bucket, {});

        Class.prototype.shaders = {
            test: {
                vertexBuffer: 'testVertex',
                elementBuffer: 'testElement',
                secondElementBuffer: 'testSecondElement',
                secondElementBufferComponents: 2,

                attributeArgs: ['x', 'y'],

                attributes: [{
                    name: 'map',
                    value: ['x']
                }, {
                    name: 'box',
                    components: 2,
                    type: Buffer.AttributeType.SHORT,
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
            buffers: {}
        });
    }

    t.test('add features', function(t) {
        var builder = create();

        builder.features = [createFeature(17, 42)];
        builder.addFeatures();

        var testVertex = builder.buffers.testVertex;
        t.equal(testVertex.type, Buffer.BufferType.VERTEX);
        t.equal(testVertex.length, 1);
        t.deepEqual(testVertex.get(0), { map: [17], box: [34, 84] });

        var testElement = builder.buffers.testElement;
        t.equal(testElement.type, Buffer.BufferType.ELEMENT);
        t.equal(testElement.length, 1);
        t.deepEqual(testElement.get(0), { vertices: [1, 2, 3] });

        var testSecondElement = builder.buffers.testSecondElement;
        t.equal(testSecondElement.type, Buffer.BufferType.ELEMENT);
        t.equal(testSecondElement.length, 1);
        t.deepEqual(testSecondElement.get(0), { vertices: [17, 42] });

        t.end();
    });

    t.test('reset buffers', function(t) {
        var builder = create();

        builder.features = [createFeature(17, 42)];
        builder.addFeatures();

        var buffers = {};
        builder.resetBuffers(buffers);

        t.equal(builder.buffers, buffers);
        t.equal(buffers.testElement.length, 0);
        t.equal(buffers.testSecondElement.length, 0);
        t.equal(builder.elementGroups.test.groups.length, 0);

        t.end();
    });

    t.test('add features after resetting buffers', function(t) {
        var builder = create();

        builder.features = [createFeature(1, 5)];
        builder.addFeatures();
        builder.resetBuffers({});
        builder.features = [createFeature(17, 42)];
        builder.addFeatures();

        var testVertex = builder.buffers.testVertex;
        t.equal(testVertex.length, 1);
        t.deepEqual(testVertex.get(0), { map: [17], box: [34, 84] });

        var testElement = builder.buffers.testElement;
        t.equal(testElement.length, 1);
        t.deepEqual(testElement.get(0), { vertices: [1, 2, 3] });

        var testSecondElement = builder.buffers.testSecondElement;
        t.equal(testSecondElement.length, 1);
        t.deepEqual(testSecondElement.get(0), { vertices: [17, 42] });

        t.end();
    });

    t.test('layout properties', function(t) {
        var bucket = create();
        t.equal(bucket.layer.layout.visibility, 'visible');
        t.end();
    });

    t.end();
});
