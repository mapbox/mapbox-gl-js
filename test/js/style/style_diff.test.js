'use strict';

var test = require('prova');
var styleDiff = require('../../../js/style/style_diff');
var Style = require('../../../js/style/style');
var util = require('../../../js/util/util');

function createStyleJSON(properties) {
    return util.extend({
        "version": 7,
        "sources": {},
        "layers": []
    }, properties);
}

test('styleDiff#diff', function (t) {

    t.deepEqual(styleDiff.diff({
        constants: { '@a': 1 }
    }, {
        constants: { '@a': 1 }
    }), [], 'no changes');

    t.deepEqual(styleDiff.diff({
        constants: { '@a': 1 }
    }, {
        constants: { '@b': 1 }
    }), [
        { command: styleDiff.operations.setConstant, args: ['@a', undefined] },
        { command: styleDiff.operations.setConstant, args: ['@b', 1] }
    ]);

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [ { command: styleDiff.operations.addLayer, args: [{ id: 'b' }, undefined] } ], 'add a layer');

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'b' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [ { command: styleDiff.operations.addLayer, args: [{ id: 'a' }, 'b'] } ], 'add a layer before another');

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a' }, { id: 'b', source: 'foo', nested: [1] }]
    }, {
        layers: [{ id: 'a' }]
    }), [ { command: styleDiff.operations.removeLayer, args: ['b'] } ], 'remove a layer');

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a' }, { id: 'b' }]
    }, {
        layers: [{ id: 'b' }, { id: 'a' }]
    }), [
        { command: styleDiff.operations.removeLayer, args: ['a'] },
        { command: styleDiff.operations.addLayer, args: [{ id: 'a' }, undefined] }
    ], 'move a layer');

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a', paint: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', paint: { foo: 2 } }]
    }), [ { command: styleDiff.operations.setPaintProperty, args: ['a', 'foo', 2, null] } ]);

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a', 'paint.light': { foo: 1 } }]
    }, {
        layers: [{ id: 'a', 'paint.light': { foo: 2 } }]
    }), [ { command: styleDiff.operations.setPaintProperty, args: ['a', 'foo', 2, 'light'] } ]);

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a', paint: { foo: { ramp: [1, 2] } } }]
    }, {
        layers: [{ id: 'a', paint: { foo: { ramp: [1] } } }]
    }), [ { command: styleDiff.operations.setPaintProperty, args: ['a', 'foo', { ramp: [1] }, null] } ], 'nested style change');

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a', layout: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', layout: { foo: 2 } }]
    }), [ { command: styleDiff.operations.setLayoutProperty, args: ['a', 'foo', 2, null] } ]);

    t.deepEqual(styleDiff.diff({
        layers: [{ id: 'a', filter: ['==', 'foo', 'bar'] }]
    }, {
        layers: [{ id: 'a', filter: ['==', 'foo', 'baz'] }]
    }), [ { command: styleDiff.operations.setFilter, args: ['a', [ '==', 'foo', 'baz' ] ] } ]);

    t.deepEqual(styleDiff.diff({
        sources: { foo: 1 }
    }, {
        sources: { }
    }), [ { command: styleDiff.operations.removeSource, args: ['foo'] } ]);

    t.deepEqual(styleDiff.diff({
        sources: { }
    }, {
        sources: { foo: 1 }
    }), [ { command: styleDiff.operations.addSource, args: ['foo', 1] } ]);

    t.end();
});

test('styleDiff#patch', function (t) {

    t.test('applies addLayer', function (t) {
        var style = new Style(createStyleJSON());

        style.on('load', function () {
            t.notOk(style.getLayer('background'), 'has no background');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.addLayer,
                    args: [{ id: 'background', type: 'background' }]
                }
            ]);
            t.ok(style.getLayer('background'), 'has background');

            t.end();
        });
    });

    t.test('applies removeLayer', function (t) {
        var style = new Style(createStyleJSON({
            layers: [
                { id: 'background', type: 'background' }
            ]
        }));

        style.on('load', function () {
            t.ok(style.getLayer('background'), 'has background');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.removeLayer,
                    args: ['background']
                }
            ]);
            t.notOk(style.getLayer('background'), 'has no background');

            t.end();
        });
    });

    t.test('applies setPaintProperty', function (t) {
        var style = new Style(createStyleJSON({
            layers: [
                { id: 'background', type: 'background' }
            ]
        }));

        style.on('load', function () {
            t.notOk(style.getPaintProperty('background', 'background-color'), 'has no background-color');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.setPaintProperty,
                    args: ['background', 'background-color', 'black', null]
                }
            ]);
            t.ok(style.getPaintProperty('background', 'background-color'), 'has background-color');

            t.end();
        });
    });

    t.test('applies setLayoutProperty', function (t) {
        var style = new Style(createStyleJSON({
            layers: [
                { id: 'background', type: 'background' }
            ]
        }));

        style.on('load', function () {
            t.equal(style.getLayoutProperty('background', 'visibility'), 'visible', 'has no visibility');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.setLayoutProperty,
                    args: ['background', 'visibility', 'none', null]
                }
            ]);
            t.equal(style.getLayoutProperty('background', 'visibility'), 'none', 'has visibility');

            t.end();
        });
    });

    t.test('applies setFilter', function (t) {
        var style = new Style(createStyleJSON({
            sources: {
                streets: {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                }
            },
            layers: [
                { id: 'streets', type: 'symbol', source: 'streets' }
            ]
        }));

        style.on('load', function () {
            t.notOk(style.getFilter('streets'), 'has no filter');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.setFilter,
                    args: ['streets', ['==', 'class', 'major']]
                }
            ]);
            t.ok(style.getFilter('streets'), 'has filter');

            t.end();
        });
    });

    t.test('applies addSource', function (t) {
        var style = new Style(createStyleJSON());

        style.on('load', function () {
            t.notOk(style.getSource('streets'), 'has no source');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.addSource,
                    args: ['streets', { type: 'vector', tiles: [] }]
                }
            ]);
            t.ok(style.getSource('streets'), 'has source');

            t.end();
        });
    });

    t.test('applies removeSource', function (t) {
        var style = new Style(createStyleJSON({
            sources: {
                streets: { type: 'vector', tiles: [] }
            }
        }));

        style.on('load', function () {
            t.ok(style.getSource('streets'), 'has source');
            styleDiff.patch(style, [
                {
                    command: styleDiff.operations.removeSource,
                    args: ['streets']
                }
            ]);
            t.notOk(style.getSource('streets'), 'has no source');

            t.end();
        });
    });

    t.test('handles unsupported commands', function (t) {
        var style = new Style(createStyleJSON());

        style.on('load', function () {
            t.throws(function () {
                styleDiff.patch(style, [
                    {
                        command: styleDiff.operations.setStyle,
                        args: [createStyleJSON()]
                    }
                ]);
            }, /Unable to apply command/);

            t.end();
        });
    });

    t.end();
});
