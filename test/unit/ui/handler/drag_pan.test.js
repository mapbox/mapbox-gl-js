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

test('DragPanHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap();
    const update = t.spy(map, '_update');

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(update.callCount > 0);

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    update.reset();
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.equal(update.callCount, 1);
    t.end();
});
