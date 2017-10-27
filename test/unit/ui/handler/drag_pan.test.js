'use strict';

const test = require('mapbox-gl-js-test').test;
const util = require('../../../../src/util/util');
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap(options) {
    return new Map(util.extend({
        container: DOM.create('div', '', window.document.body),
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));
}

test('DragPanHandler stops dragging in response to dragPan.disable() mid-drag', (t) => {
    const map = createMap();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(map.getCanvas());
    t.ok(dragstart.calledOnce);
    t.ok(drag.calledOnce);

    map.dragPan.disable();
    t.ok(dragend.calledOnce);

    map.remove();
    t.end();
});
