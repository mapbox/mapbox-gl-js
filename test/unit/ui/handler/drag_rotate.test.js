'use strict';

const test = require('mapbox-gl-js-test').test;
const util = require('../../../../src/util/util');
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DragRotateHandler = require('../../../../src/ui/handler/drag_rotate');

function createMap(options, callback) {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'offsetHeight', {value: 200, configurable: true});

    const map = new Map(util.extend({
        container: container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));

    if (callback) map.on('load', () => {
        callback(null, map);
    });

    return map;
}
test('drag_rotate', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('#{enable,disable}', (t) => {
        const map = createMap({interactive: false});
        const dragRotateHandler = new DragRotateHandler(map, {
            bearingSnap: 1
        });
        dragRotateHandler.enable();
        t.equals(dragRotateHandler.isEnabled(), true);
        dragRotateHandler.disable();
        t.equals(dragRotateHandler.isEnabled(), false);
        t.end();
    });

    t.end();
});
