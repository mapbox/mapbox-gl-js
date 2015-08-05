'use strict';

var t = require('tape'),
    diffStyles = require('../../diff/v7');

t('diff v7', function (t) {

    t.deepEqual(diffStyles({
        constants: { '@a': 1 }
    }, {
        constants: { '@a': 1 }
    }), [], 'no changes');

    t.deepEqual(diffStyles({
        version: 6,
        constants: { '@a': 1 }
    }, {
        version: 7,
        constants: { '@a': 1 }
    }), [
      { command: 'setStyle', args: [{ version: 7, constants: { '@a': 1 } }] }
    ], 'version change');


    t.deepEqual(diffStyles({
        constants: { '@a': 1 }
    }, {
        constants: { '@b': 1 }
    }), [
      { command: 'setConstant', args: ['@a', undefined] },
      { command: 'setConstant', args: ['@b', 1] }
    ], 'set constants');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [
        { command: 'addLayer', args: [{ id: 'b' }, undefined] }
    ], 'add a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'b' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [
        { command: 'addLayer', args: [{ id: 'a' }, 'b'] }
    ], 'add a layer before another');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }, { id: 'b', source: 'foo', nested: [1] }]
    }, {
        layers: [{ id: 'a' }]
    }), [
        { command: 'removeLayer', args: ['b'] }
    ], 'remove a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }, { id: 'b' }]
    }, {
        layers: [{ id: 'b' }, { id: 'a' }]
    }), [
      { command: 'removeLayer', args: ['a'] },
      { command: 'addLayer', args: [{ id: 'a' }, undefined] }
    ], 'move a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', paint: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', paint: { foo: 2 } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', 2, null] }
    ], 'update paint property');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', 'paint.light': { foo: 1 } }]
    }, {
        layers: [{ id: 'a', 'paint.light': { foo: 2 } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', 2, 'light'] }
    ], 'update paint property class');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', paint: { foo: { ramp: [1, 2] } } }]
    }, {
        layers: [{ id: 'a', paint: { foo: { ramp: [1] } } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', { ramp: [1] }, null] }
    ], 'nested style change');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', layout: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', layout: { foo: 2 } }]
    }), [
        { command: 'setLayoutProperty', args: ['a', 'foo', 2, null] }
    ], 'update layout property');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', filter: ['==', 'foo', 'bar'] }]
    }, {
        layers: [{ id: 'a', filter: ['==', 'foo', 'baz'] }]
    }), [
        { command: 'setFilter', args: ['a', [ '==', 'foo', 'baz' ] ] }
    ], 'update a filter');

    t.deepEqual(diffStyles({
        sources: { foo: 1 }
    }, {
        sources: {}
    }), [
        { command: 'removeSource', args: ['foo'] }
    ], 'remove a source');

    t.deepEqual(diffStyles({
        sources: {}
    }, {
        sources: { foo: 1 }
    }), [
        { command: 'addSource', args: ['foo', 1] }
    ], 'add a source');

    t.deepEqual(diffStyles({}, {
        metadata: { 'mapbox:author': 'nobody' }
    }), [], 'ignore style metadata');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', metadata: { 'mapbox:group': 'Group Name' } }]
    }, {
        layers: [{ id: 'a', metadata: { 'mapbox:group': 'Another Name' } }]
    }), [], 'ignore layer metadata');

    t.end();
});
