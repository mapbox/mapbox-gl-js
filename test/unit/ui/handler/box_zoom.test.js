'use strict';

import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('BoxZoomHandler fires boxzoomstart and boxzoomend events at appropriate times', (t) => {
    const map = createMap();

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 1);

    map.remove();
    t.end();
});

test('BoxZoomHandler avoids conflicts with DragPanHandler when disabled and reenabled (#2237)', (t) => {
    const map = createMap();

    map.boxZoom.disable();
    map.boxZoom.enable();

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 1);

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('BoxZoomHandler does not begin a box zoom if preventDefault is called on the mousedown event', (t) => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._updateCamera();

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._updateCamera();

    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    map.remove();
    t.end();
});
